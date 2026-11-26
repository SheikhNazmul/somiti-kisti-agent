# Screens and the API each one uses

| Route | Screen | Endpoints |
|---|---|---|
| `#/login` | Login (shows a "server waking up" note after 4 s) | `POST /auth/login`, `GET /auth/me` |
| `#/` | Dashboard | `GET /installments/due`, `/members`, `/loans`, `/gata/groups`, `/gata/groups/{id}/status` |
| `#/members` | Members (search, type filter, admin: add) | `GET /members`, `POST /members`, `GET /areas` |
| `#/members/{id}` | Member details | `GET /members/{id}`, `/members/{id}/balance`, `/loans?member_id=`, `/installments/due`, `POST /installments/{id}/pay` |
| `#/loans` | Loans and due (area filter, admin: new loan) | `GET /installments/due`, `/loans`, `POST /loans`, `POST /installments/{id}/pay` |
| `#/gata` | Gata groups (admin: payout) | `GET /gata/groups`, `/gata/groups/{id}/status`, `POST .../payments`, `POST .../payout` |
| `#/chat` | AI chat (full history sent each turn) | `POST /chat` |

Admin-only actions (new member, new loan, payout) are hidden for collectors;
the backend still enforces roles on every request.
