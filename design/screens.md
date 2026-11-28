# Screens and the API each one uses

All paths are under `/api/v1`. Any 401 clears the token and returns to Login.

| Screen | Endpoints |
|---|---|
| 1. Login (waking-server state) | `GET /health`, `POST /auth/login` (form-encoded `username`, `password`), `GET /auth/me` |
| 2. Dashboard | `GET /installments/due?date=`, `GET /members`, `GET /members/{id}/balance`, `GET /loans`, `GET /areas`, `GET /gata/groups`, `GET /gata/groups/{id}/status`, `POST /installments/{id}/pay` |
| 3. Members (and areas) | `GET /members?search=&area_id=&account_type=`, `POST /members`, `PATCH /members/{id}`, `PATCH /members/{id}/account-type`, `DELETE /members/{id}`, `GET/POST/PATCH/DELETE /areas` |
| 4. Member Details | `GET /members/{id}`, `GET /members/{id}/balance`, `GET /loans?member_id=`, `GET /installments/due?date=`, `POST /installments/{id}/pay`, `POST /loans`, `PATCH /loans/{id}/status`, `DELETE /loans/{id}` |
| 5. Loans & Due | `GET /installments/due?date=&area_id=`, `POST /installments/{id}/pay`, `GET /loans?status=`, `POST /loans`, `PATCH /loans/{id}/status`, `DELETE /loans/{id}` |
| 6. Gata Group | `GET /gata/groups`, `GET /gata/groups/{id}`, `GET /gata/groups/{id}/status`, `POST /gata/groups`, `POST /gata/groups/{id}/members`, `POST /gata/groups/{id}/start`, `POST /gata/groups/{id}/payments` (no amount field), `POST /gata/groups/{id}/payout` |
| 7. AI Chat | `POST /chat` (full `messages` history), `POST /knowledge/search`, `POST /knowledge/ingest` (admin only) |

Roles: admin can do everything; manager can create and edit members and areas
and collect payments; collector can view and collect. Buttons a role cannot use
are hidden, and the backend still checks the role on every request.
