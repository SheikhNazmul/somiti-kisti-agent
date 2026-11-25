# Frontend

The frontend of Somiti Kisti Agent — planned, not built yet. It is designed
in Figma and will be a thin layer over the backend API (see `BACKEND.md`):
every figure on every screen comes from an API response, and no business
rule lives in the frontend.

- **Design:** seven mobile screens in Figma, deep green `#065F46` on white,
  Inter + Hind Siliguri fonts
- **Form:** a static web app deployed on Netlify — no server of its own
- **API base:** https://somiti-kisti-agent.onrender.com (all calls under `/api/v1`)

## How it connects to the backend

1. The user signs in on the Login screen; the app calls
   `POST /auth/login` and stores the returned JWT in the browser.
2. Every later call sends `Authorization: Bearer <token>`.
3. If a call returns 401 (token missing or expired after 60 minutes), the
   app returns to the Login screen.

## The seven screens

| Screen | What it shows | Endpoints it uses |
|---|---|---|
| Login | Email and password form | `POST /auth/login`, `GET /auth/me` |
| Dashboard | Today's dues, gata round status, member count | `GET /installments/due`, `GET /gata/groups`, `GET /members` |
| Members | Searchable member list | `GET /members` |
| Member Details | One member: loans, installments, balance | `GET /members/{id}`, the member's loans and installments |
| Loans & Due | Loan list and the due-installment visit list | `GET /loans`, `GET /installments/due` |
| Gata Group | Group status, who has paid this round, record a payment, run the payout | `GET /gata/groups`, `GET /gata/groups/{id}/status`, `POST /gata/groups/{id}/payments`, `POST /gata/groups/{id}/payout` |
| AI Chat | Bangla chat with the assistant | `POST /chat` with `{"messages": [{"role": "user", "content": "..."}]}` |

Notes for the build:

- Recording a gata payment sends only the member and the round — the amount
  comes from the group on the backend, so the screen has no amount field.
- Chat answers can take a few seconds (the model may chain two tool calls);
  the screen should show a typing state.
- The backend is on a free plan and sleeps when idle; the first call after
  a break can take about a minute, so the Login screen should show a
  "waking up" state instead of an error.

## Status

| Part | State |
|---|---|
| Design (Figma) | Done — seven screens |
| Build | Not started |
| Deployment | Planned on Netlify once built |
