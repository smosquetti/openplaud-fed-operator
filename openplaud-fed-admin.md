# OpenPlaud Admin

Admin console for the OpenPlaud chat platform, built with **Next.js** (App Router, TypeScript) and **React 19**.
It talks to the `openplaud-srv-admin` Kotlin/Spring Boot API and, through it, manages the **ejabberd** XMPP server.

## What it does

| Area | Endpoints used |
| --- | --- |
| **Login** | `GET /api/v1/admin/login` — verifies the ejabberd admin account (Basic auth) |
| **Operators** | `POST /operators`, `GET /operators`, `DELETE /operators/{id}`, `GET /operators/{id}/groups` |
| **Groups** | `POST /groups`, `GET /groups`, `DELETE /groups/{id}`, `GET /groups/{id}/operators`, `POST` / `DELETE` `/groups/{groupId}/operators/{operatorId}` |

Features:

- **Auth-gated panel** — everything behind `/login`. Credentials are verified against
  `GET /admin/login` (Basic auth) and kept in `sessionStorage` for the tab; any `401`
  from the API logs the session out back to the login screen.
- **Operators** — create (name, email, optional password; a server-generated
  `initialPassword` is shown **once** with a copy button), list, delete (confirm dialog),
  and view which groups an operator belongs to.
- **Groups** — create (name + MUC service), list, delete (destroys the MUC room), and a
  **Members** manager: add operators to a group (MUC affiliation `member`), remove them.
- **Dashboard** — operator/group counts plus recent lists.
- Backend errors (`409` duplicate, `422` invalid slug, `400` validation fields, …) are
  mapped from the API's `{status, code, message, fields?}` body into toasts/field errors.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Sign in with the ejabberd admin account configured on the backend
(default: `admin@localhost` / `admin`).

### Configuration

| Where | Variable | Default | Purpose |
| --- | --- | --- | --- |
| `.env.local` | `API_BASE_URL` | `http://localhost:8080/api/v1` | Kotlin admin API base URL |

The URL is read **server-side** by the proxy route (below), so the browser never sees it.

### How the API is reached

Browser requests go to `app/api/proxy/[...path]/route.ts`, a Next.js route handler that
forwards to `API_BASE_URL/<path>` and passes the `Authorization: Basic …` header through.
This keeps the admin URL out of the client bundle (no CORS, no env leakage) and limits
proxied paths to the `admin`, `operators` and `groups` resource families.

If the backend is down the proxy answers `502`; the login screen and the panel handle it
with readable messages instead of network errors.

## Project layout

```
app/
├── api/proxy/[...path]/route.ts   # server-side proxy to the Kotlin API
├── login/                         # admin login page
├── (panel)/                       # auth-gated shell (sidebar + guard)
│   ├── page.tsx                   # dashboard
│   ├── operators/page.tsx         # operators CRUD + view-groups
│   └── groups/page.tsx            # groups CRUD + member management
components/                        # UI building blocks (modal, toasts, icons, …)
lib/                               # api client, auth context, shared types
```

## Notes

- Credentials live in `sessionStorage` (per tab, cleared on sign-out, on 401, or when
  the session fails to validate on reload).
- `initialPassword` is returned by the API only in the create response — the banner is
  the only place it is ever shown.
- The temp-room endpoints (`/chatroom`, `/join`) are conversation-side and not part of
  the admin surface.
# openplaud-fed-admin
