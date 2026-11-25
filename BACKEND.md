# Backend

The backend of Somiti Kisti Agent — built and live. All business rules,
security and the AI assistant live here; the frontend (see `FRONTEND.md`)
contains no business rules and only calls this API.

- **Live at:** https://somiti-kisti-agent.onrender.com · API docs at `/docs`
- **Stack:** FastAPI · async SQLAlchemy · PostgreSQL 18 + pgvector · Alembic · Docker
- **Hosting:** Render (Singapore), Docker service; database in schema `somiti`

## Run it locally

```bash
cp .env.example .env   # fill in DB credentials, JWT_SECRET, LLM_API_KEY
docker compose up --build
```

The API is then at http://localhost:8002. Without Docker, use uv:
`uv sync`, `python -m scripts.bootstrap_db`, `alembic upgrade head`,
`python -m scripts.seed`, `uvicorn app.main:app --reload`. Environment
variables are listed in the README.

## Structure

```
app/
  core/          settings, security (JWT), error handling
  db/            async engine and session
  modules/
    auth/        login and current-user handling
    areas/       collection areas (one collection day each)
    members/     somiti members (account types loan / gata / both)
    loans/       loans and the shared loan calculations
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

## Auth

`POST /api/v1/auth/login` takes an OAuth2 form (username + password) and
returns a JWT valid for 60 minutes. Every other endpoint requires the
`Authorization: Bearer <token>` header and replies 401 without it. Two roles:
`admin` (manager) and `collector`; area management and knowledge ingest are
admin-only.

## API overview

All endpoints are under `/api/v1`:

- `GET /health`, `GET /health/db`
- `POST /auth/login`, `GET /auth/me`
- `/areas`, `/members`, `/loans`, `/installments` — CRUD; `GET /installments/due` lists due installments
- `/gata/groups` — create and list groups; `/{id}/members`, `/{id}/start`,
  `/{id}/payments`, `/{id}/payout`, `/{id}/status`
- `POST /knowledge/ingest` — (re)build the rule book embeddings (admin only)
- `POST /knowledge/search` — search the rule book
- `POST /chat` — ask the assistant: `{"messages": [{"role": "user", "content": "..."}]}`

## Business rules the backend enforces

- Loan totals are computed once, in one shared place: total payable =
  principal + service charge, split into equal weekly installments.
- Gata members join only while the group is `forming`; a loan-only member
  cannot join. Payments are accepted only for the current round of a
  `running` group, once per member per round.
- A gata payment carries **no amount from the client** — the system records
  the group's fixed amount itself, so a wrong amount can never be entered.
- Payout happens only when every member has paid the round; the winner is
  chosen by lottery among members who have not won yet, and the payout is
  the weekly amount × total slots.

## AI layer

- **Chat** — Google Gemini (`gemini-3.5-flash-lite`) answers in Bangla. It
  must not invent numbers and cannot move money: it only reads, through six
  read-only tools — `find_member`, `get_member_balance`,
  `list_due_installments`, `list_gata_groups`, `get_gata_status`,
  `search_knowledge`.
- **RAG** — the somiti's rule book (eleven short sections) is embedded with
  Gemini embeddings at 768 dimensions and stored in `knowledge_chunks`
  (pgvector). Rule questions are answered only from the passages found.
- **MCP** — the same six tools are served at `/mcp` (streamable HTTP, JWT
  required) and over stdio via `python -m app.mcp_server`.

## Deployment

On every start the container runs, in order: database bootstrap (schema,
then the vector extension), Alembic migrations, the idempotent seed, then
Uvicorn — so a restart returns the same working system.
