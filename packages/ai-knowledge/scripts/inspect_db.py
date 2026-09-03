"""
Phase 1 — Database inspection script.

Connects to Supabase, verifies the live schema against the ground-truth,
and checks for existing vector tables / pgvector extension.

Usage:
    python scripts/inspect_db.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add parent to path so we can import src.*
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg
from src.config import get_settings

# ── Ground-truth schema ──────────────────────────────────────

EXPECTED_TABLES: dict[str, list[str]] = {
    "users": [
        "id", "name", "email", "phone", "password_hash",
        "role", "status", "created_at", "last_login",
    ],
    "customer_profiles": [
        "id", "user_id", "customer_id", "date_of_birth",
        "address", "city", "state", "postal_code", "created_at",
    ],
    "employee_profiles": [
        "id", "user_id", "employee_id", "department",
        "designation", "branch", "joining_date", "created_at",
    ],
    "manager_profiles": [
        "id", "user_id", "manager_id", "designation",
        "branch", "approval_limit", "joining_date", "created_at",
    ],
    "accounts": [
        "id", "user_id", "account_number", "account_type",
        "balance", "status", "created_at",
    ],
    "beneficiaries": [
        "id", "user_id", "beneficiary_name", "account_number",
        "bank_name", "ifsc", "status", "created_at",
    ],
    "transactions": [
        "id", "sender_account_id", "receiver_account_id", "amount",
        "transaction_type", "status", "description", "ip_address", "created_at",
    ],
    "requests": [
        "id", "user_id", "request_type", "description",
        "status", "processed_by", "created_at", "processed_at",
    ],
    "login_events": [
        "id", "user_id", "ip_address", "device",
        "success", "failure_reason", "created_at",
    ],
    "security_events": [
        "id", "user_id", "event_type", "severity",
        "description", "ip_address", "created_at",
    ],
    "audit_logs": [
        "id", "user_id", "role", "action",
        "resource", "resource_id", "ip_address", "created_at",
    ],
    "otp_challenges": [
        "id", "user_id", "otp_hash", "expires_at",
        "attempts", "used", "created_at",
    ],
}


def inspect() -> dict:
    """Run full inspection and return structured report."""
    settings = get_settings()
    report: dict = {
        "connection": "FAILED",
        "vector_extension": False,
        "existing_vector_tables": [],
        "schema_match": {},
        "extra_tables": [],
        "missing_tables": [],
        "discrepancies": [],
    }

    print("=" * 60)
    print("  CRQ AI-Knowledge — Phase 1: Database Inspection")
    print("=" * 60)

    # ── Connect ───────────────────────────────────────────────
    try:
        conn = psycopg.connect(settings.supabase_db_url)
        report["connection"] = "OK"
        print("\n✓ Connected to Supabase Postgres.")
    except Exception as exc:
        print(f"\n✗ Connection failed: {exc}")
        return report

    with conn:
        cur = conn.cursor()

        # ── Check vector extension ────────────────────────────
        cur.execute("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'")
        row = cur.fetchone()
        if row:
            report["vector_extension"] = True
            print(f"✓ pgvector extension is enabled (version {row[1]}).")
        else:
            print("✗ pgvector extension is NOT enabled.")

        # ── Check for existing vector columns ─────────────────
        cur.execute("""
            SELECT table_name, column_name, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND udt_name = 'vector'
            ORDER BY table_name, column_name
        """)
        vector_cols = cur.fetchall()
        if vector_cols:
            print(f"\n⚠ Found {len(vector_cols)} existing vector column(s):")
            for tname, cname, udt in vector_cols:
                print(f"    {tname}.{cname} ({udt})")
                report["existing_vector_tables"].append(
                    {"table": tname, "column": cname}
                )
        else:
            print("\n✓ No existing vector columns — knowledge_chunks needs to be created.")

        # ── List actual tables in public schema ───────────────
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        actual_tables = {row[0] for row in cur.fetchall()}
        expected_names = set(EXPECTED_TABLES.keys())

        report["extra_tables"] = sorted(actual_tables - expected_names)
        report["missing_tables"] = sorted(expected_names - actual_tables)

        print(f"\n── Table comparison ({'✓' if not report['missing_tables'] else '✗'}) ──")
        print(f"  Expected: {len(expected_names)} tables")
        print(f"  Found:    {len(actual_tables)} tables")

        if report["extra_tables"]:
            print(f"  Extra:    {report['extra_tables']}")
        if report["missing_tables"]:
            print(f"  Missing:  {report['missing_tables']}")

        # ── Column-level comparison ───────────────────────────
        print("\n── Column-level verification ──")
        for table_name, expected_cols in sorted(EXPECTED_TABLES.items()):
            if table_name not in actual_tables:
                report["schema_match"][table_name] = "MISSING"
                print(f"  ✗ {table_name}: TABLE MISSING")
                continue

            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,))
            actual_cols = [row[0] for row in cur.fetchall()]

            expected_set = set(expected_cols)
            actual_set = set(actual_cols)

            missing = expected_set - actual_set
            extra = actual_set - expected_set

            if not missing and not extra:
                report["schema_match"][table_name] = "MATCH"
                print(f"  ✓ {table_name}: all {len(expected_cols)} columns match")
            else:
                report["schema_match"][table_name] = "MISMATCH"
                if missing:
                    report["discrepancies"].append(
                        {"table": table_name, "missing_columns": sorted(missing)}
                    )
                    print(f"  ✗ {table_name}: missing columns {sorted(missing)}")
                if extra:
                    report["discrepancies"].append(
                        {"table": table_name, "extra_columns": sorted(extra)}
                    )
                    print(f"  ⚠ {table_name}: extra columns {sorted(extra)}")

    # ── Summary ───────────────────────────────────────────────
    all_match = all(v == "MATCH" for v in report["schema_match"].values())
    print("\n" + "=" * 60)
    if all_match and not report["missing_tables"]:
        print("  ✓ RESULT: Schema matches ground truth exactly.")
    else:
        print("  ⚠ RESULT: Discrepancies found — review above.")
    print("=" * 60)

    return report


if __name__ == "__main__":
    result = inspect()
    # Also dump machine-readable JSON
    output_path = Path(__file__).resolve().parent / "inspection_report.json"
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nReport saved to {output_path}")
