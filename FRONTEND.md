# Frontend

The frontend of Somiti Kisti Agent lives in `frontend/`. It is a thin layer
over the backend API (see `BACKEND.md`): every figure on every screen comes
from an API response, and no business rule lives in the frontend.

- **Design:** Bangla UI, warm paper background with navy and saffron, Hind
  Siliguri font — tokens and screen map in `design/`
- **Form:** a static web app (plain HTML, CSS and JS modules, no build step)
- **API base:** https://somiti-kisti-agent.onrender.com (all calls under
  `/api/v1`). The app calls `/api/v1/...` on its own domain, and the
  `frontend/netlify.toml` rule forwards `/api/*` to Render, so the browser
  never makes a cross-origin call.

## Run it locally

Start the backend with Docker first (it listens on `localhost:8002`), then:

```bash
cd frontend
python dev_server.py          # open http://localhost:8080
```

`dev_server.py` serves the files and forwards `/api/*` to the backend, the
same way Netlify does in production, so no CORS change is needed. To use the
live backend instead: `python dev_server.py --api https://somiti-kisti-agent.onrender.com`.

## Deploy on Netlify

Base directory `frontend`, no build command, publish directory `.`. The
`netlify.toml` there already holds the `/api/*` proxy rule.

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
| Member Details | One member: loans, balance, due installments with a collect action | `GET /members/{id}`, `GET /members/{id}/balance`, `GET /loans?member_id=`, `GET /installments/due` |
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
| Design | Tokens and screen map in `design/`; Figma file in progress |
| Build | Done — seven screens in `frontend/` |
| Deployment | Netlify, using `frontend/netlify.toml` |
