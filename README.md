# Somiti Kisti Agent

A backend system for a Bangladeshi micro-lending cooperative (somiti). It manages
weekly loan installments and rotating group savings circles (gata), and adds a
Bangla AI assistant that answers staff questions from the live records and from
a written rule book — without ever being able to move money.

**Live:** https://somiti-kisti-agent.onrender.com · API docs at `/docs`
**Stack:** FastAPI · async SQLAlchemy · PostgreSQL 18 + pgvector · Alembic · Docker

## What it does

- **Loans (kisti)** — a loan is split into weekly installments. The system
  computes the total payable (principal + service charge) and the per-week
  amount, tracks due and paid installments, and reports each member's balance.
- **Gata (rotating savings)** — a group of members each save the same fixed
  amount every round; each round one member receives the whole pot, chosen by
  lottery among members who have not won yet, until everyone has won once.
- **AI chat** — staff ask questions in Bangla (`POST /api/v1/chat`). Google
  Gemini answers using read-only tools against the database, and answers rule
  questions from the somiti's own rule book via vector search (RAG). The
  assistant cannot create loans, record payments, or change any record.

## Features

- JWT login (OAuth2 form) with two roles: `admin` (manager) and `collector`
- Areas with a fixed weekly collection day, which drives installment due dates
- Members with account types `loan`, `gata`, or `both`; unique phone numbers
- Full CRUD for areas, members, loans, installments and gata groups
- Gata rules enforced by the system: members join only while a group is
  forming, payments only for the current round of a running group, no double
  payment per round, payout only when everyone has paid
- A gata payment carries **no amount from the client** — the system records the
  group's fixed amount itself, so a wrong amount can never be entered
- Tool calling: the chat model picks from six read-only tools (below)
- RAG over pgvector: the rule book is stored as embeddings in the same
  PostgreSQL database and searched by meaning
- MCP server: the same six tools are published over the Model Context
  Protocol for other AI applications
- Consistent error shape everywhere; clean 422 responses that never echo the
  submitted input; secrets only in environment variables

## The six read-only tools

| Tool | What it returns |
|---|---|
| `find_member` | Members matching part of a name or a phone number |
| `get_member_balance` | One member's total payable, total paid and remaining balance |
| `list_due_installments` | Due and not fully paid installments, optionally per area |
| `list_gata_groups` | All gata groups with amount, frequency, slots and status |
| `get_gata_status` | A group's current round, winners so far and unpaid members |
| `search_knowledge` | Passages from the rule book that match a question (RAG) |

## Project structure

```
app/
  core/          settings, security (JWT), error handling
  db/            async engine and session
  modules/
    auth/        login and current-user handling
    areas/       collection areas
    members/     somiti members
    loans/       loans and shared loan calculations
    installments/ weekly installment schedule and payments
    gata/        savings circles: groups, members, payments, payout
    chat/        the AI assistant: prompt, tool loop, tool definitions
    knowledge/   the rule book: ingest and vector search (RAG)
  integrations/
    llm/         Gemini chat client (the only LLM caller)
    embeddings/  Gemini embedding client
  mcp_server.py  MCP server publishing the same six tools
scripts/         database bootstrap and the idempotent seed
alembic/         migrations
```

## Quick start

### With Docker Compose

```bash
cp .env.example .env   # fill in the values (see below)
docker compose up --build
```

The API is then at http://localhost:8002 and the docs at
http://localhost:8002/docs. The database is the `pgvector/pgvector:pg17`
image, so the vector extension is available.

### Manually with uv

```bash
uv sync
python -m scripts.bootstrap_db   # creates the schema, then the vector extension
alembic upgrade head
python -m scripts.seed           # demo data (idempotent)
uvicorn app.main:app --reload
```

The bootstrap order matters: the schema must exist before the vector
extension is created inside it.

## Environment variables

See `.env.example` for the full list. The important ones:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection |
| `DB_SCHEMA` | Schema that holds all tables (`somiti`) |
| `DB_SSL` | Whether the database connection uses SSL |
| `JWT_SECRET` | Signing key for login tokens — at least 32 characters, or the app will not start |
| `JWT_EXPIRE_MINUTES` | Token lifetime (60) |
| `LLM_PROVIDER`, `LLM_MODEL` | Chat model selection (`gemini`, `gemini-3.5-flash-lite`) |
| `LLM_API_KEY` | Google AI Studio API key — required, or the app will not start |
| `EMBEDDING_MODEL`, `EMBEDDING_DIM` | Embedding model and vector size (768) |
| `RAG_TOP_K`, `RAG_MAX_DISTANCE` | How many rule-book passages a search returns, and the similarity cutoff |

## Demo accounts (from the seed)

| Role | Email | Password |
|---|---|---|
| Manager (admin) | manager@somiti.local | manager123 |
| Collector | rahim@somiti.local | collector123 |
| Collector | karim@somiti.local | collector123 |

The seed also creates 5 areas, 50 members, 10 loans with their installments,
and one running 41-member gata group, so every endpoint and the chat have real
data to work with. It is idempotent and can run on every start.

## API overview

All endpoints are under `/api/v1` and, except login and health, require the
`Authorization: Bearer <token>` header.

- `POST /auth/login`, `GET /auth/me`
- `GET /health`, `GET /health/db`
- `/areas`, `/members`, `/loans`, `/installments` — CRUD; `GET /installments/due` lists what is due
- `/gata/groups` — create and list groups; `/{id}/members`, `/{id}/start`,
  `/{id}/payments`, `/{id}/payout`, `/{id}/status`
- `POST /knowledge/ingest` — (re)build the rule book embeddings (admin only)
- `POST /knowledge/search` — search the rule book
- `POST /chat` — ask the assistant; send `{"messages": [{"role": "user", "content": "..."}]}`

## MCP server

The same six tools are served over MCP at `/mcp` (streamable HTTP). Requests
need the same JWT: send `Authorization: Bearer <token>`; without it the server
replies 401. For local MCP clients, a stdio mode is available:

```bash
python -m app.mcp_server
```

## Deployment

The app and its PostgreSQL database run on Render (Singapore) as a Docker
service. On every start the container runs, in order: database bootstrap,
Alembic migrations, the seed, then Uvicorn — so a restart returns the same
working system.
