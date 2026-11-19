# ParkPro — Parking Management (Full Stack PWA)

A mobile-first, offline-capable parking management app for gate staff and parking owners, with a real **Express + SQLite** backend. Staff scan QR passes, record gate entry/exit, capture walk-ins and review history; owners manage passes, renewals, printable/shareable QR passes, reports, logs and settings. Everyone on the same server sees the same live data.

**Frontend:** Vite 6, React 18, TypeScript (strict), Tailwind CSS, Framer Motion, Recharts, jsQR, qrcode, html-to-image, vite-plugin-pwa (Workbox).
**Backend:** Node.js ≥ 22.5, Express 4, built-in `node:sqlite` (`DatabaseSync`, no native build step), JWT auth, bcrypt password hashing.

---

## Quick start

```bash
npm install
npm run dev:full   # API on :4000 + Vite dev server on :5173 (proxy /api → :4000)
```

Open **http://localhost:5173**. The database is created and seeded automatically on first start at `data/parkpro.db`.

Run the parts separately if you prefer:

```bash
npm run server     # API only, watch mode, http://localhost:4000/api/health
npm run dev        # frontend only, http://localhost:5173
```

Production (single Express process serving API + built SPA):

```bash
npm run build      # typecheck + build to dist/
npm start          # http://localhost:4000
```

Other scripts: `npm run typecheck`, `npm run preview`, `npm run db:reset` (deletes and reseeds the database), `npm run icons` (regenerates PWA/splash icons with sharp).

Node 22.16+ prints an `ExperimentalWarning` for `node:sqlite`; it is expected and harmless.

### Demo accounts

| Role | Username | Password | Entry |
| --- | --- | --- | --- |
| Owner | `admin` | `admin123` | Login form or "Owner demo" |
| Gate staff | `staff` | `staff123` | Login form or "Gate staff demo" |

The server seeds Riverfront Parking (120 slots), 56 passes, gate history, walk-ins and logs on first run. **Settings → App → Reset demo data** (owner only) restores the seed. Demo accounts are enabled in development and **disabled in production by default** — set `DEMO_LOGIN=true` to expose them. The login page hides the demo buttons automatically when they are disabled.

### Configuration

Copy `.env.example` to `.env` (or `.env.local`) and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API/SPA port |
| `JWT_SECRET` | dev fallback | **Required in production** — 32+ random characters, the server refuses to start without it |
| `DB_PATH` | `data/parkpro.db` | SQLite file location (PITR: back this file up) |
| `DEMO_LOGIN` | on in dev, **off in production** | Exposes `POST /api/auth/demo` and the login demo buttons |
| `SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` | random in production, `admin123` / `staff123` in dev | Initial passwords for seeded accounts (first run only). In production a random password is generated and printed once if unset. |

---

## Architecture

- **Server is the source of truth.** Passes, scans, walk-ins, logs, users and site settings live in SQLite (`data/parkpro.db`, WAL mode).
- **Auth:** `POST /api/auth/login` returns a JWT (7 days). Role `owner` or `staff` is embedded in the token and checked on every request. Passwords are bcrypt hashes (minimum 8 characters). Failed logins are throttled (12 per 5 minutes per IP) and reset on success. Responses carry `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS (production).
- **Bootstrap:** after sign-in the client fetches `GET /api/bootstrap` once and mirrors the payload into IndexedDB (`parkpro-cache`) for instant loads and offline reads.
- **Real-time:** successful writes broadcast a change ping to open devices over Server-Sent Events (`GET /api/events`), so an admin dashboard reflects a staff scan within a second without refreshing. Because `EventSource` cannot send an `Authorization` header, the stream is authenticated by a 10-minute ticket (`POST /api/events/ticket`), not the session JWT. If a proxy blocks streams, the client falls back to polling every 20 s while the tab is visible.
- **Gate scans:** online scans call `POST /api/scans/scan` for the authoritative decision (valid/expiring/expired/unknown, alternating IN/OUT) and record the event. Offline scans are computed locally with the same rules, queued in IndexedDB, and uploaded via `POST /api/sync` when the connection returns.
- **Writes that need the server:** creating/renewing/deleting passes, editing site settings and resetting demo data require connectivity (owner role). Walk-ins and scans queue offline and sync automatically.
- **Lock screen** (auto-lock, biometric) is device-local by design and works offline; it mirrors the last password on the device at sign-in/password change.

### Roles

| Capability | Owner | Staff |
| --- | --- | --- |
| Dashboard, passes list/detail, create/renew/delete pass | ✅ | ❌ (hidden + 403) |
| Reports, activity log, clear log, reset demo, site settings | ✅ | ❌ (hidden + 403) |
| Scan pass, parked list, call customer | ✅ | ✅ |
| Add walk-in, view history, change own password | ✅ | ✅ |

### API reference

All routes are under `/api` and (except auth/health) require `Authorization: Bearer <token>`.

| Method & path | Role | Purpose |
| --- | --- | --- |
| `GET /health` | public | Liveness + demo flag |
| `POST /auth/login` | public | Username/password → JWT |
| `POST /auth/demo` | public | One-click demo login (`{ role }`) |
| `GET /auth/me` | any | Validate session |
| `POST /auth/password` | any | Change own password |
| `GET /bootstrap` | any | Site + passes + scans + walk-ins + logs snapshot |
| `POST /events/ticket` | any | Mint a 10-minute ticket for the event stream |
| `GET /events?ticket=…` | ticket | Server-Sent Events: `change` ping after every write |
| `GET /passes` | any | List passes |
| `POST /passes` | owner | Create pass |
| `PATCH /passes/:id` | owner | Update/renew pass |
| `DELETE /passes/:id` | owner | Delete pass |
| `GET /scans` | any | Scan history (latest 5000) |
| `POST /scans/scan` | any | Authoritative gate scan `{ text, source }` |
| `POST /scans` | any | Upload an offline-captured scan |
| `GET /walkins` / `POST /walkins` | any | List / add walk-in |
| `GET /logs` / `POST /logs` | any | Activity log |
| `DELETE /logs` | owner | Clear log |
| `GET /site` / `PATCH /site` | any / owner | Site name + capacity |
| `POST /sync` | any | Batch-upload queued scans and walk-ins |
| `POST /demo/reset` | owner | Restore seeded demo data |

Errors return `{ "error": "message" }` with 400/401/403/404/413/500.

---

## Feature map

**Gate staff**
- Full-screen rear-camera QR scanner with torch, camera flip, Wake Lock and sub-second results.
- Result screens: green **entry/exit recorded** (photo, name, vehicle, direction, time, days left), red **expired** (denied), orange **expiring**; sound + vibration; 3-second auto-dismiss.
- Manual fallback lookup by phone, vehicle number or pass code.
- Walk-in capture: live photo, retake, JPEG compression, details, vehicle type, entry charge.
- Parked list with search, pull-to-refresh, swipe-to-call and one-tap Call (renew/pass-detail actions are owner-only and hidden for staff).
- History timeline with filters, pending-sync banner and sync-now.

**Owner**
- Dashboard: stat cards, occupancy meter, 7-day revenue chart, expiring/nearly-full alerts.
- Passes: search and status filters, create pass bottom sheet with validation, pass detail with printable/shareable QR card (PNG download, Web Share / WhatsApp), renew and delete.
- Reports: 7/30/90-day range, revenue, passes sold, average value, renewals, daily collections, hourly entries, plan mix, vehicle mix, export.
- Logs: scans, passes, sync, auth and system events stored in the database, grouped by day, with clear-log confirmation.
- Settings: profile/site/capacity (owner edits), theme, EN/HI/GU language, text size, sound/haptics, notifications, password change, auto-lock, biometric unlock, install guide, offline simulation, demo reset.

**Cross-cutting**
- Installable PWA with update-available prompt and install guide.
- Offline queue with pending badge and automatic upload when the network returns.
- Live dashboards: scans, walk-ins, pass changes and log events reach every open device over SSE, with a polling fallback when streams are blocked.
- WCAG AA contrast, 48 px targets, safe-area insets, reduced-motion support, dark mode.

---

## Responsive layout

The UI is mobile-first; desktop gets a sidebar and wider content columns at ≥1024 px.

| Viewport | Result |
| --- | --- |
| 320 × 720 | no horizontal scroll, no console errors |
| 360 × 800 | ✅ |
| 390 × 844 | ✅ |
| 412 × 915 | ✅ |
| 768 × 1024 | bottom tabs (sidebar intentionally ≥1024 px) |
| 1280 × 900 | sidebar layout |

- Bottom tab bar (staff: Parked/Walk-in/Scan/History/Settings; owner: Home/Passes/Scan/Reports/Logs) with centered Scan action.
- Sticky header with online/offline state and pending count; back button on detail screens.
- `100dvh` layouts, `env(safe-area-inset-*)` padding, nothing hidden behind nav.
- Bottom sheets instead of centered modals on phones; stacked cards instead of tables.
- Inputs ≥16 px with correct `type`/`inputMode`/`autoComplete`; native date pickers.
- Long Hindi/Gujarati strings verified at 360 px; dark mode and 200% text scaling safe.

> Camera, vibration, Wake Lock and install flows still deserve a smoke test on real iOS/Android hardware.

---

## PWA / offline behavior

- Workbox precaches the app shell, falls back to `/index.html` for navigation, and keeps `/api/*` out of the SPA fallback.
- `/api/passes`: NetworkFirst (3 s timeout); other `/api/*`: NetworkFirst (4 s). Images: CacheFirst.
- IndexedDB (`parkpro-cache`) mirrors server data and holds the pending queue, so an offline scan or walk-in is never lost.
- `registerType: 'prompt'` shows the in-app "Update available" toast.

To test offline: `npm run build && npm start`, open `http://localhost:4000`, sign in, reload once so the service worker takes control, then use **Settings → Offline → Simulate offline** (or DevTools). Record a scan or walk-in, reload offline, go back online and watch the queue upload (`/api/sync`).

---

## Deployment

Camera, service workers, Wake Lock and notifications need a **secure context** (HTTPS). `localhost` is exempt.

**Recommended: one Node host (VPS, Render, Railway, Fly.io, Docker)**

1. Node ≥ 22.5, persistent disk for `data/`.
2. Set `NODE_ENV=production`, `JWT_SECRET` (required, 32+ chars), `PORT` and (optionally) `DB_PATH` to a mounted volume. Set `SEED_ADMIN_PASSWORD` and `SEED_STAFF_PASSWORD` before the first start, or note the random passwords printed in the startup log. Demo accounts stay off by default; add `DEMO_LOGIN=true` only if you want prospect demos.
3. `npm ci && npm run build && npm start`.
4. Put HTTPS in front (Caddy, nginx, or the platform's TLS). Express serves both the API and `dist/`.
5. Back up the SQLite file (and `-wal`/`-shm`) or use the host's volume snapshots.

**Static hosts (Netlify/Vercel/Cloudflare Pages)** only host the frontend. For a split deployment, proxy `/api/*` from the same origin to the Node API (rewrite rule), otherwise the client's relative `/api` calls will 404. A single-origin Node deployment is simpler and recommended.

**nginx example**

```nginx
server {
  listen 443 ssl http2;
  server_name parkpro.example.com;

  ssl_certificate     /etc/letsencrypt/live/parkpro.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/parkpro.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Live updates (Server-Sent Events) — must not be buffered.
  location = /api/events {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
  }
}
```

The API already sends `X-Accel-Buffering: no`, which disables nginx buffering; the explicit block keeps the setting even if the header is stripped. If a corporate proxy drops event streams, the app polls every 20 s instead, so dashboards still update.

---

## Project structure

```
server/                Express API
  index.ts             app wiring, static dist, SPA fallback, shutdown
  db.ts                node:sqlite schema
  repository.ts        queries + row mappers
  auth.ts              bcrypt + JWT + role middleware
  events.ts            SSE client registry + change fan-out
  parsers.ts           request validation
  seed.ts              deterministic demo data + reset
  routes/              auth, passes, scans, walkins, logs, site, sync, demo, bootstrap, events
src/
  App.tsx              lazy routes + owner-only guards
  components/          AppShell, Header, BottomNav, Sidebar, Sheet, PassCard, QrCode,
                       LockScreen, InstallPrompt, UpdateToast, PullToRefresh, SwipeableCard, ...
  pages/               Login, Scan, Parked, WalkIn, History, Settings,
                       AdminHome, Passes, PassDetail, Reports, Logs
  state/               Settings, Toast, Auth (JWT), Data (cache + offline queue)
  lib/                 api (fetch client), live (SSE + polling fallback), db
                       (IndexedDB cache), camera, share, biometric, notifications,
                       i18n, utils
public/                login-bg.webp/jpg (login background), og-cover.jpg, icons,
                       splash screens, fonts
data/                  parkpro.db (created at runtime, git-ignored)
```

---

## Known limits

- SQLite is single-writer. That is plenty for one parking site; for horizontal scaling, move to Postgres behind the same repository interface.
- Push notifications while the app is fully closed need a Web Push subscription service; in-app and open-tab notifications work today.
- Pass create/renew/delete and site settings require connectivity; gate scans and walk-ins work offline.
- The lock screen is device-local (offline-first); server auth protects the API.
- iOS does not support the Vibration API or background Web Push for home-screen web apps the same way Android does.
- Web Share with files may fall back to a PNG download on unsupported browsers.
- Biometric unlock depends on WebAuthn platform authenticator support.
