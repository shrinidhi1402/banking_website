"""
Phase 7 — Tests: database connectivity and schema verification.
"""

from __future__ import annotations

import pytest
import psycopg

from src.config import get_settings


EXPECTED_TABLES = [
    "users", "customer_profiles", "employee_profiles", "manager_profiles",
    "accounts", "beneficiaries", "transactions", "requests",
    "login_events", "security_events", "audit_logs", "otp_challenges",
]


@pytest.fixture(scope="module")
def db_conn():
    """Provide a synchronous database connection for testing."""
    settings = get_settings()
    conn = psycopg.connect(settings.supabase_db_url)
    yield conn
    conn.close()


def test_db_connection(db_conn: psycopg.Connection) -> None:
    """Verify basic connectivity to Supabase Postgres."""
    cur = db_conn.execute("SELECT 1 AS alive")
    row = cur.fetchone()
    assert row is not None
    assert row[0] == 1


def test_vector_extension(db_conn: psycopg.Connection) -> None:
    """Verify pgvector extension is enabled."""
    cur = db_conn.execute(
        "SELECT extname FROM pg_extension WHERE extname = 'vector'"
    )
    row = cur.fetchone()
    assert row is not None, "pgvector extension is not enabled"


def test_banking_tables_exist(db_conn: psycopg.Connection) -> None:
    """Verify all expected banking tables exist."""
    cur = db_conn.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    """)
    actual = {row[0] for row in cur.fetchall()}

    for table in EXPECTED_TABLES:
        assert table in actual, f"Missing table: {table}"


def test_knowledge_chunks_table(db_conn: psycopg.Connection) -> None:
    """Verify knowledge_chunks table exists with expected columns."""
    cur = db_conn.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'knowledge_chunks'
        ORDER BY ordinal_position
    """)
    cols = {row[0] for row in cur.fetchall()}

    expected = {"id", "source", "section", "framework", "content", "embedding", "created_at"}
    assert expected.issubset(cols), f"Missing columns: {expected - cols}"


def test_users_columns(db_conn: psycopg.Connection) -> None:
    """Spot-check users table columns against ground truth."""
    cur = db_conn.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
    """)
    cols = {row[0] for row in cur.fetchall()}
    expected = {"id", "name", "email", "phone", "password_hash", "role", "status", "created_at", "last_login"}
    assert expected.issubset(cols), f"Missing user columns: {expected - cols}"


def test_transactions_columns(db_conn: psycopg.Connection) -> None:
    """Spot-check transactions table columns."""
    cur = db_conn.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions'
    """)
    cols = {row[0] for row in cur.fetchall()}
    expected = {"id", "sender_account_id", "receiver_account_id", "amount", "transaction_type", "status"}
    assert expected.issubset(cols), f"Missing transaction columns: {expected - cols}"
