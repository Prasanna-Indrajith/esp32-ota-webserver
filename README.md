# ESP32 OTA Admin Server

Secure **multi-project** OTA (Over-The-Air) firmware update server for ESP32 devices.
Each project gets its own isolated firmware storage, version state, rollback window, and OTA URL.
Built with **Node.js + Express + Vanilla JS** with full security hardening.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run interactive setup (creates .env, hashes password)
node scripts/setup.js

# 3. Migrate existing single-project data → "default" project
node scripts/migrate-to-multi-project.js

# 4. Start server
npm start

# 5. Open browser
open http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## Multi-Project Workflow

### Creating a project

Use the **"+ New Project"** button in the topbar, or via API:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  -d '{"id":"smart-meter","name":"Smart Meter","description":"Power meter OTA"}'
```

### Switching projects in the dashboard

Click the project dropdown in the topbar — all panels (upload, firmware table, activity graph,
constants) instantly switch context to the selected project.

### ESP32 sketch per project

The **ESP32 Code Constants** panel auto-generates the correct snippet for the active project:

```cpp
const char* PROJECT_ID  = "smart-meter";          // set per device firmware
const char* CURRENT_VER = "1.1.0";
#define DEFAULT_OTA_URL  "http://your-server/ota/smart-meter/check"
```

---

## Project Structure

```
WebServer/
├── server/
│   ├── server.js                    # Express entry point
│   ├── config/constants.js          # All settings + per-project path helpers
│   ├── middleware/auth.js            # Session + CSRF guard
│   ├── routes/
│   │   ├── api.js                   # Admin REST API (/api/projects/:id/*)
│   │   └── ota.js                   # ESP32 API (/ota/:projectId/*)
│   ├── services/
│   │   ├── projectService.js        # Project registry CRUD
│   │   ├── configService.js         # Per-project state.json read/write
│   │   ├── rollbackService.js       # Per-project rollback TTL flag
│   │   └── firmwareService.js       # Upload, list, delete, clean (per project)
│   ├── projects/                    # Runtime data — one dir per project (gitignored)
│   │   └── {projectId}/
│   │       ├── state.json
│   │       ├── rollback.flag        # exists only when rollback active
│   │       └── firmware/
│   │           └── firmware_X.Y.Z.bin
│   └── data/
│       ├── projects.json            # Project registry
│       └── tmp/                     # Upload staging (shared)
├── public/                          # Static frontend
│   ├── index.html                   # Login page
│   ├── admin.html                   # Dashboard
│   ├── css/
│   │   ├── style.css                # Main stylesheet
│   │   └── style-project.css        # Project switcher + modal styles
│   └── js/
│       ├── login.js
│       ├── dashboard.js             # Main controller (project-aware)
│       ├── upload.js                # XHR progress upload (project-scoped)
│       └── components/
│           ├── statusBar.js
│           ├── firmwareTable.js
│           ├── rollbackBanner.js
│           ├── activityGraph.js     # GitHub-style upload heatmap
│           └── projectSwitcher.js   # Project dropdown + New Project modal
├── scripts/
│   ├── setup.js                     # First-time setup wizard
│   └── migrate-to-multi-project.js  # One-time migration from single-project
└── .env.example
```

---

## ESP32 API

### Project-scoped endpoints (recommended)

| Endpoint | Usage |
|----------|-------|
| `GET /ota/:projectId/check` | Returns `{version, url, command}` |
| `GET /ota/:projectId/download?ver=X.Y.Z` | Streams firmware binary (Range support) |

### Backward-compatible aliases (original single-project endpoints)

| Endpoint | Maps to |
|----------|---------|
| `GET /ota/check` | `/ota/default/check` |
| `GET /ota/download` | `/ota/default/download` |

Existing ESP32 devices using `/ota/check` **continue to work unchanged** after migration.

---

## Admin API (all require session auth)

### Project management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create project `{id, name, description}` |
| `DELETE` | `/api/projects/:projectId` | Delete project + all its firmware |

### Per-project operations

All paths below are prefixed with `/api/projects/:projectId/`

| Method | Path suffix | Description |
|--------|-------------|-------------|
| `GET` | `/status` | Active version, rollback state, file count |
| `GET` | `/firmwares` | List all firmware files |
| `POST` | `/upload` | Upload new firmware (multipart) |
| `POST` | `/switch` | Switch active version `{version}` |
| `DELETE` | `/firmware/:version` | Delete a stored version |
| `POST` | `/rollback/send` | Trigger rollback for all devices |
| `POST` | `/rollback/cancel` | Cancel active rollback |

---

## Security Features

- **bcrypt** password hashing (12 rounds)
- **Rate limiting**: 5 login attempts / 15 min; 30 OTA checks / min
- **Magic byte validation**: rejects non-binary uploads even if renamed `.bin`
- **Path traversal prevention**: strict version regex + project ID slug validation + `path.basename()`
- **Project isolation**: each project's firmware, state, and rollback flag are completely separate
- **CSRF**: `sameSite=strict` cookie + `X-Requested-With` header
- **XSS**: `textContent` only, never `innerHTML` with server data; CSP headers
- **Helmet**: 15+ security headers (HSTS, X-Frame-Options, nosniff, etc.)
- **Session hardening**: `httpOnly`, `secure` (prod), 1-hour expiry, regeneration on login

---

## Environment Variables

See `.env.example`. Generate with `node scripts/setup.js`.

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `BASE_URL` | Public URL (used in firmware download links) |
| `SESSION_SECRET` | Long random string for session signing |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `MAX_FIRMWARE_MB` | Max upload size in MB (default: 10) |
| `KEEP_OLD_VERSIONS` | Number of old versions to keep per project (default: 3) |
| `ROLLBACK_EXPIRE_MIN` | Rollback TTL in minutes (default: 15) |
| `MAX_PROJECTS` | Maximum number of projects (default: 50) |