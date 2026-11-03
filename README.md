# openplaud-fed-operator

Operator-side web console for the OpenPlaud XMPP chat call center. Operators sign in with their own XMPP credentials, watch live call cards appear in real time, accept calls to go 1:1 with the customer, chat, and transfer calls to other operators in their group.

It is one of three parts of the OpenPlaud system:

| Repo | Role |
| --- | --- |
| `openplaud-srv-admin` | Kotlin REST API (`http://localhost:8080/api/v1`) |
| `open-plaud-admin` | Admin web frontend |
| `openplaud-fed-operator` (this repo) | Operator web console |

## Stack

- **React 19** + **Next.js 16.4.3** (App Router, TypeScript)
- **Bootstrap 5.3.8** — plain Bootstrap, no Tailwind (mirrors the admin frontend's conventions)
- **Strophe.js 5.0.0** — XMPP client over a native WebSocket to `ejabberd_http_ws` on port 5280
- Node `ws`, `@xmldom/xmldom`, `saxes` are runtime deps so Turbopack can resolve Strophe's Node build at SSR — do not remove them

## How it works

**Login**
1. `GET /operator/login` with the operator's XMPP credentials (Basic auth). The API validates against the XMPP server and returns 401 for bad credentials.
2. `GET /operators` — the operator's row is found by matching the JID localpart against `xmppUser`.
3. `GET /operators/{id}/groups` — every group the operator belongs to.
4. Once the Strophe connection is `CONNECTED`, the app MucSub-subscribes each group's persistent room (`<room>@<service>`).

**Call cards (left panel)**
Cards are **message-driven**: a card appears when a MESSAGE arrives for a room — either a MucSub pubsub push (customer joined the group's temp room) or a MUC room message. Cards are not built from subscription lists.

**Rooms**
- *Group room*: `room@conference` — the group's persistent room.
- *Temp room*: `<customerUUID>_<groupUUID>@conference` — created by `POST /chatroom` when a customer starts a call; the customer is subscribed and every group operator is admin+subscribed.

**History**
The custom `mod_mam` returns only `count/first/last`, so the app accumulates history client-side in `sessionStorage` (`openplaud.operator.history`, capped at 500 messages per room).

**Accept a call**
`Accept call` → `POST /chatroom/join {operatorId, groupId, room}` + MUC join. The backend outcasts the other operators, leaving the accepting operator 1:1 with the customer. The window then shows an "In call — you are 1:1 with the customer" chip and a **Transfer** button.

**Transfer**
`TransferDialog` lists transfer candidates from `GET /groups/{groupId}/operators` minus the current operator → `POST /chatroom/transfer {room, operatorId, previousOperatorId, service}`. The backend re-applies admin+subscription to the target and outcasts the previous operator; the target starts receiving MucSub messages for the room.

**Windows**
Multiple chat windows per call: floating, draggable by the title bar, minimizable to the bottom **Dock**. Clicking a card opens/focuses its window.

**Toasts**
`Toaster` renders `.toast-card` toasts (auto-dismiss ~6.5 s) for errors, accepts, and transfers.

**API**
All backend calls go through `app/api/proxy/[...path]/route.ts` — `API_BASE_URL` never ships to the browser.

## Operator flow (walkthrough)

1. **Login** — the app opens on the login screen. Enter the operator's XMPP username and password; on success the session is stored and the Strophe connection opens.
2. **Workspace** — left rail holds one card per active call; the canvas area is where chat windows open, and the bottom **Dock** holds minimized windows.
3. **Incoming call** — when a customer starts a call (`POST /chatroom`), a card appears in the rail with a "New call" state.
4. **Open the window** — click the card: history, composer, and an **Accept call** button.
5. **Accept** — `POST /chatroom/join` + MUC join. The window then shows the "In call — you are 1:1 with the customer" chip and a **Transfer** button; the other operators of the group are outcast.
6. **Chat** — type in the composer (`.form-control`), send with the send button or Enter.
7. **Transfer** — the Transfer dialog lists the group's other operators; picking one sends `POST /chatroom/transfer`. The window shows "Transferred to <name>" and the card gets a "Transferred" badge; the target operator starts receiving the room's messages.

## Project structure

```
app/
  page.tsx                     # operator console page (Workspace + providers)
  login/page.tsx               # login gate
  layout.tsx
  api/proxy/[...path]/route.ts # server-side proxy to the Kotlin API
components/
  Workspace.tsx                # layout: left card rail + window canvas + Dock
  RoomCard.tsx                 # one call card
  ChatWindow.tsx               # floating chat window (history, composer, accept/transfer)
  Dock.tsx                     # minimized windows
  TransferDialog.tsx           # transfer candidate list + POST /chatroom/transfer
  Toaster.tsx / Icon.tsx / Logo.tsx
lib/
  api.ts                       # fetch wrapper for the /api/proxy prefix
  auth.tsx                     # session (sessionStorage) + login state
  types.ts
  xmpp/
    client.ts                  # Strophe 5 wrapper (connect, handlers, MucSub IQs, MUC)
    store.tsx                  # ChatProvider: rooms, calls, accept/transfer, history cap
spec.txt                       # protocol deep-dive, RESOLVED notes, E2E log
strophe-test/                  # standalone Node XMPP test harness (own node_modules)
```

## Getting started

**Prerequisites**

- Node 20+
- The OpenPlaud Kotlin API running on `:8080`
- ejabberd with `ejabberd_http_ws` on `:5280` and the custom `mucsub` + `mam` modules
- An operator account

**Run**

```bash
npm install
cp .env.example .env.local   # then edit if your environment differs
npm run dev                  # http://localhost:3000
```

Log in with the operator's XMPP username and password. The session lives in `sessionStorage` (`openplaud.operator.session`); **Sign out** clears it and drops the XMPP connection.

**Environment variables** (see `.env.example`)

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | Kotlin API base, no trailing slash (server-side only) |
| `NEXT_PUBLIC_XMPP_WS_URL` | XMPP WebSocket endpoint, e.g. `ws://localhost:5280/websocket` |
| `NEXT_PUBLIC_XMPP_DOMAIN` | XMPP domain for JIDs, e.g. `localhost` |
| `NEXT_PUBLIC_XMPP_SERVICE` | MUC service host, e.g. `conference` (room JIDs are `<room>@<service>`) |

**Scripts**

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) on `:3000` |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint (baseline: 1 pre-existing error in `lib/auth.tsx` + 1 warning in `components/Logo.tsx`, intentional) |
| `npx tsc --noEmit` | Type-check |

## Test harness (`strophe-test/`)

Standalone Node scripts that drive the same Strophe 5 + WebSocket stack the app uses. They have their **own `node_modules`** — always run them **from `strophe-test/`**:

| Script | Purpose |
| --- | --- |
| `test-operator-flow.js` | Full operator flow: login → groups → MucSub subscribe → temp-room message |
| `e2e-customer.js` | Customer side of an E2E: registers a fresh customer (via `docker exec ejabberdctl register`), `POST /chatroom` to create the temp room, MUC-joins, and waits for the operator (the browser) to accept and reply |
| `nudge-customer.js` | MUC-join as a customer and send a message (drives the operator card) |
| `probe-subs.js` | Query the MucSub subscription list for a room |
| `secondop-verify.js` / `secondop-debug.js` | Verify/log post-transfer MucSub delivery to a named operator |
| `test-mam*.js`, `test-flow.js`, `test-reconnect.js`, `probe-raw-ws.js` | MAM, flow, reconnect, and raw WebSocket probes |

Usage: `node e2e-customer.js [customerUUID] [customerName] [keepSeconds]` — with the browser logged in as an operator, the script creates the temp room; the operator card appears, and once the operator clicks **Accept call** and replies, the script prints `RESULT gotOperatorReply: true`.

## Verified end-to-end

Full flow verified against the local dev environment (2026-11-03): temp room created by customer → operator card appears → **Accept call** → `POST /chatroom/join` 200 → operator reply reaches the customer 1:1 → **transfer** to a second operator → `POST /chatroom/transfer` 200, target receives MucSub messages for the room, previous operator is outcast. See the `RESOLVED` section in `spec.txt` for protocol-level notes (MucSub delivery stanza, outcast-drops-subscriptions finding, etc.).

## Development environment

- **Operator**: Create one from the Admin page and add to a Group
- **Customers**: ad-hoc — `e2e-customer.js` registers a fresh one on the fly (`docker exec ejabberdctl register`) and creates the temp room through the API, Update the groupId in the script.
- XMPP: ejabberd with `ejabberd_http_ws` on `:5280`, domain `localhost`, MUC service `conference`
- API: Kotlin backend on `:8080` (`/api/v1`)

## XMPP protocol notes

The app's `lib/xmpp/client.ts` encodes a set of non-obvious protocol facts (see `spec.txt` for the full derivation):

- **MucSub subscribe** is an IQ `type=set`: `<subscribe xmlns='urn:xmpp:mucsub:0'><nick/></subscribe>` — sent only once the connection is `CONNECTED`; pre-auth IQs are rejected with `not-authorized`.
- **MucSub delivery** arrives as an outer `<message to='bare' from='room@conference'>` wrapping a pubsub `<event>` → `<items node='urn:xmpp:mucsub:nodes:messages'>` → inner MUC room message; the app parses the inner message for history.
- **Initial presence** (`$pres()`) after connect is required for the stream to be authorized.
- **Subscription-list IQ** requires room **moderator** rights — after an accept/transfer outcast the previous operator gets 403 "Moderator privileges required".
- **Outcast drops MucSub subscriptions** server-side, which is why transfer candidates come from `GET /groups/{groupId}/operators`, not the subscription list.
- **Strophe 5**: a handler that returns `false` is removed — every handler in this codebase must return `true`; `Connection` is not a root export (use `InstanceType<NonNullable<typeof Strophe['Connection']>>`); `sendIQ` auto-assigns missing `id`s, raw `send` does not.

## Troubleshooting

- **SSR build fails on Strophe import** — keep the `ws`, `@xmldom/xmldom`, and `saxes` runtime deps; Turbopack picks Strophe's Node build and needs them at analysis time.
- **Login returns 401** — the API validates credentials against the XMPP server; the account must exist and the password must match.
- **No call card appears** — cards are message-driven: the operator must be MucSub-subscribed to the group room (subscribes happen at login) and the API must have created the temp room.
- **No history after a reconnect** — history is session-scoped (`sessionStorage`, capped at 500 per room); it is intentionally not persisted across sessions.
- **`npm run lint` exits 1** — pre-existing intentional baseline (1 error in `lib/auth.tsx`, 1 warning in `components/Logo.tsx`); not a regression.
