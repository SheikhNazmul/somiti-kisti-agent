# Screens and the API each one uses

| Route | Screen | Endpoints |
|---|---|---|
| `#/login` | Login (shows a "server waking up" note after 4 s) | `POST /auth/login`, `GET /auth/me` |
| `#/` | Dashboard | `GET /installments/due`, `/members`, `/loans`, `/gata/groups`, `/gata/groups/{id}/status` |
| `#/members` | Members (search, type filter, admin: add) | `GET /members`, `POST /members`, `GET /areas` |
| `#/areas` | Areas (admin/manager: add, edit; admin: delete) | `GET /areas`, `POST /areas`, `PATCH /areas/{id}`, `DELETE /areas/{id}`, `GET /members` |
| `#/members/{id}` | Member details | `GET /members/{id}`, `/members/{id}/balance`, `/loans?member_id=`, `/installments/due`, `POST /installments/{id}/pay` |
| `#/loans` | Loans and due (area filter, admin: new loan) | `GET /installments/due`, `/loans`, `POST /loans`, `POST /installments/{id}/pay` |
| `#/gata` | Gata groups (admin: payout) | `GET /gata/groups`, `/gata/groups/{id}/status`, `POST .../payments`, `POST .../payout` |
| `#/chat` | AI chat (full history sent each turn) | `POST /chat` |

Admin and manager can add members and areas; new loan, payout and deleting an area are admin-only. Buttons a role cannot use are hidden;
the backend still enforces roles on every request.
