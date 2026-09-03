# CRQ AI-Knowledge & Retrieval Layer (RAG Microservice)

Auxiliary Python FastAPI microservice providing semantic context retrieval for the **CyberRisk Quantifier (CRQ)** platform.

---

## Core Philosophy

- **Supabase/SQL = exact, current, structured banking data.**
- **RAG/pgvector = static semantic knowledge — what things mean, not what they currently are.**

The microservice NEVER executes SQL, NEVER queries live banking tables (`users`, `accounts`, `transactions`, etc.), and NEVER embeds customer PII. It serves strictly as a semantic retrieval engine over curated knowledge documents.

---

## Architecture & Directory Structure

```text
ai-knowledge/
├── knowledge/                         # Knowledge Corpus (13 Markdown Docs)
│   ├── compliance/
│   │   ├── cis_controls.md            # CIS Controls v8 (18 Controls, IG1-3)
│   │   ├── nist_csf.md                # NIST CSF 2.0 (Govern, Identify, Protect, Detect, Respond, Recover)
│   │   ├── pci_dss.md                 # PCI DSS v4.0 (12 Requirements, 6 Goals)
│   │   ├── rbi_cyber_security.md      # RBI Cyber Security Framework for Banks
│   │   └── sebi_cscrf.md              # SEBI CSCRF 2024 (5-Tier Risk Model)
│   ├── policies/
│   │   └── security_policies.md       # Internal Bank Security Policies (Password, IR, Data Retention)
│   ├── query_examples/
│   │   ├── golden_eval_set.md         # 18 Annotated Golden Queries for RAG Evaluation
│   │   └── nl_to_sql_examples.md      # 12 NL-to-SQL Pattern Pairs
│   ├── schema_docs/
│   │   └── bank_schema.md             # 12 Banking Tables Schema & Security Relevance
│   ├── security_concepts/
│   │   ├── control_effectiveness.md   # Control Effectiveness Measurement & Table Mapping
│   │   ├── criticality_levels.md      # Asset Criticality Tiers 1-3 & EAL Calculation
│   │   └── fair_model.md              # FAIR Risk Quantification Taxonomy (TEF, LEF, Vuln, EAL)
│   └── vulnerabilities/
│       └── cve_concepts.md            # CVE, CVSS v3.1/v4.0 Metrics, Exploit Lifecycle, Risk Impact
├── src/                               # Service Implementation
│   ├── api.py                         # FastAPI Router (POST /retrieve, GET /health)
│   ├── chunker.py                     # Heading-Aware Markdown Chunker
│   ├── config.py                      # Singleton Pydantic Settings
│   ├── db.py                          # Async Psycopg Connection Provider (Supabase pgvector)
│   ├── embedder.py                    # BAAI/bge-m3 Embedding Model Wrapper (1024-dim)
│   ├── ingest.py                      # Idempotent Ingestion CLI
│   ├── models.py                      # Pydantic Schemas
│   └── retrieve.py                    # Cosine Similarity Search Engine
├── scripts/                           # Maintenance Scripts
│   ├── create_tables.py               # Table Creation (knowledge_chunks + HNSW index)
│   ├── inspect_db.py                  # Live Schema Inspection & Ground Truth Verifier
│   └── inspection_report.json         # Automated Inspection Report
├── tests/                             # Test Suite (25 Tests)
│   ├── conftest.py                    # Windows Selector Event Loop Policy Setup
│   ├── test_api.py                    # FastAPI Endpoint Direct Async Tests
│   ├── test_db.py                     # DB Connection & Table Verification
│   ├── test_ingest.py                 # Ingestion & Chunk Verification
│   └── test_retrieval.py              # Golden Retrieval Query Accuracy Tests
├── .env                               # Environment Configuration
├── INTEGRATION.md                     # Backend Integration Contract & Node.js Code Example
├── pyproject.toml                     # Dependencies & Tool Config
├── README.md                          # Documentation
└── requirements.txt                   # Pip Dependencies
```

---

## Compliance Framework Decisions & Notes

1. **NIST CSF 2.0:** Public domain (U.S. government work). Full category text for all 6 functions included.
2. **RBI Cyber Security Framework:** Free public circular (RBI/2015-16/418). Full regulatory directive text included.
3. **PCI DSS v4.0:** Official requirement titles and objectives across all 12 principal requirements included.
4. **CIS Controls v8:** Official titles, descriptions, and Implementation Group (IG1-IG3) mappings for all 18 controls included.
5. **SEBI CSCRF:** Official 5-tier risk model, 6-hour incident reporting deadline, and VAPT guidelines included.
6. **ISO 27001:** Omitted due to commercial copyright restrictions (as per architecture decision rules).

---

## Quick Start Guide

### 1. Environment Setup
```bash
cd ai-knowledge
python -m venv .venv
# On Windows:
.venv\Scripts\activate
pip install -r requirements.txt
```

Ensure `.env` contains:
```ini
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.tctpljxllwvgvrpycrow.supabase.co:5432/postgres
EMBEDDING_MODEL=BAAI/bge-m3
```

### 2. Inspect Database
```bash
python scripts/inspect_db.py
```

### 3. Create Storage Table & Indexes
```bash
python scripts/create_tables.py
```

### 4. Run Ingestion Pipeline
```bash
python -m src.ingest
```

### 5. Run Test Suite
```bash
python -m pytest tests/ -v
```

### 6. Start API Server
```bash
uvicorn src.api:app --host 0.0.0.0 --port 8100 --reload
```

---

## Integration with Main Backend

For full API request/response JSON schemas, live example payloads, and a worked Node.js TypeScript integration example, refer to [INTEGRATION.md](file:///c:/Users/aryad/OneDrive/Desktop/banking_website/ai-knowledge/INTEGRATION.md).
