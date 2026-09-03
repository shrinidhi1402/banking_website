# CRQ AI-Knowledge Integration Contract

This document provides the technical integration contract for the main Node.js / backend service consuming the `ai-knowledge` RAG service.

---

## Service Overview

- **Service Name:** CRQ AI-Knowledge Microservice
- **Protocol:** HTTP / REST (JSON)
- **Base URL (Dev):** `http://localhost:8100`
- **Base URL (Production):** `http://ai-knowledge.internal:8100` (or configured container service name)
- **Role:** Pure semantic retrieval layer. Provides context on schema meanings, security concepts, compliance frameworks, internal policies, and query patterns.
- **Rule:** Never executes SQL, never accesses live customer banking rows.

---

## API Endpoints

### 1. Health Check
- **Endpoint:** `GET /health`
- **Description:** Verifies service health, database connection to Supabase, embedding model status, and total ingested chunk count.

**Response Schema (`200 OK`):**
```json
{
  "status": "ok",
  "model_loaded": true,
  "db_connected": true,
  "chunk_count": 186
}
```

---

### 2. Semantic Context Retrieval
- **Endpoint:** `POST /retrieve`
- **Content-Type:** `application/json`

#### Request Schema
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | `string` | Yes | - | Natural language question or query string. |
| `top_k` | `integer` | No | `5` | Maximum number of ranked chunks to return (1-20). |
| `framework` | `string` | No | `null` | Optional filter (e.g. `"NIST CSF"`, `"RBI CSF"`, `"PCI DSS"`, `"CIS Controls"`, `"SEBI CSCRF"`). |
| `source` | `string` | No | `null` | Optional filter by source file name (e.g. `"schema_docs/bank_schema.md"`). |

#### Real Example Request
```json
POST /retrieve HTTP/1.1
Host: localhost:8100
Content-Type: application/json

{
  "query": "what does approval_limit mean",
  "top_k": 2
}
```

#### Real Example Response (Live Output)
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "query": "what does approval_limit mean",
  "count": 2,
  "results": [
    {
      "content": "## Query 01: Manager Approval Limit\n\n- **Query:** \"What does approval_limit mean in manager profiles?\"\n- **Domain:** Schema Documentation\n- **Expected Top Source:** `knowledge/schema_docs/bank_schema.md`\n- **Key Concepts:** `manager_profiles`, `approval_limit`, segregation of duties, financial threshold",
      "source": "query_examples/golden_eval_set.md",
      "section": "Query 01: Manager Approval Limit",
      "framework": null,
      "similarity": 0.660739898681641
    },
    {
      "content": "## manager_profiles\n\n**Purpose & Business Context:** Extended profile for high-privilege internal staff capable of overriding limits and approving requests.\n**Key/Non-obvious Columns:**\n- `approval_limit` (numeric): Specifies the maximum financial threshold for transaction or request approval.\n**Relationships:** `user_id` FK to `users`.\n**Security & Compliance Relevance:** Represents segregation-of-duties (SoD) controls. The `approval_limit` is a critical business logic control that bounds the impact of a compromised manager account.",
      "source": "schema_docs/bank_schema.md",
      "section": "manager_profiles",
      "framework": null,
      "similarity": 0.641630568601524
    }
  ]
}
```

---

## Architecture Pipeline & Backend Integration Flow

The main CRQ backend must orchestrate the response generation following the architecture pipeline:

```
[ User Request ]
       │
       ▼
[ 1. Semantic Retrieval ] ────► HTTP POST http://localhost:8100/retrieve
       │                          (Retrieves schema meaning, policy rules, NL-to-SQL guidance)
       ▼
[ 2. Computation (SQL) ] ───► Query Supabase SQL DB
       │                          (Executes exact SQL against live banking tables: users, transactions, etc.)
       ▼
[ 3. Context Formatter ]  ───► Combine (1) Semantic Chunks + (2) SQL Query Results
       │                          into unified LLM System & User Prompts
       ▼
[ 4. Grounding Validator ] ──► Validate LLM output against retrieved facts & SQL data
```

---

## Worked Node.js Backend Code Example

Below is a complete Node.js / TypeScript snippet demonstrating how the backend team calls `/retrieve`, queries Supabase SQL, formats the context, and invokes the LLM:

```typescript
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RetrievalResult {
  content: string;
  source: string;
  section?: string;
  framework?: string;
  similarity: number;
}

interface RetrieveResponse {
  query: string;
  count: number;
  results: RetrievalResult[];
}

async function processUserQuery(userQuestion: string) {
  // Step 1: Semantic Retrieval from AI-Knowledge Microservice
  const ragResponse = await axios.post<RetrieveResponse>('http://localhost:8100/retrieve', {
    query: userQuestion,
    top_k: 3
  });
  
  const semanticContext = ragResponse.data.results
    .map(r => `[Source: ${r.source} | Similarity: ${r.similarity.toFixed(3)}]\n${r.content}`)
    .join('\n\n---\n\n');

  // Step 2: Computation (SQL Execution against Supabase)
  // Example: User asks "Show active managers with approval limit above 50000"
  const { data: sqlData, error } = await supabase
    .from('manager_profiles')
    .select('user_id, manager_id, designation, approval_limit, branch')
    .gt('approval_limit', 50000);

  if (error) throw error;

  // Step 3: Context Formatter
  const combinedPrompt = `
SYSTEM PROMPT:
You are the CyberRisk Quantifier (CRQ) AI assistant. Use the provided Semantic Knowledge to understand terms, security concepts, and policies, and use the Live Banking SQL Data to answer the user's question accurately.

SEMANTIC KNOWLEDGE (from RAG):
${semanticContext}

LIVE BANKING DATA (from Supabase SQL):
${JSON.stringify(sqlData, null, 2)}

USER QUESTION:
${userQuestion}
`;

  // Step 4: Pass formatted prompt to LLM and send to Grounding Validator
  console.log("Combined Prompt Ready for LLM Generation:\n", combinedPrompt);
  return combinedPrompt;
}
```

---

## Compliance Framework Reference Table

| Framework | Tag / `framework` Filter | Key Coverage |
|-----------|--------------------------|--------------|
| **NIST CSF 2.0** | `"NIST CSF"` | Govern, Identify, Protect, Detect, Respond, Recover |
| **RBI Cyber Security** | `"RBI CSF"` | C-SOC, 2-6h Incident Reporting, RBTM, MFA |
| **PCI DSS v4.0** | `"PCI DSS"` | Cardholder Data, PAN Masking, Req 1-12 |
| **CIS Controls v8** | `"CIS Controls"` | 18 Controls, IG1-IG3 Safeguards |
| **SEBI CSCRF** | `"SEBI CSCRF"` | 5-Tier Risk Model, 6h Reporting, VAPT, Data Localization |
