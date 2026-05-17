# ESP32 OTA Admin Server

Secure OTA (Over-The-Air) firmware update server for ESP32 devices.
Converted from PHP to **Node.js + Express + Vanilla JS** with full security hardening.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run interactive setup (creates .env, hashes password)
node scripts/setup.js

# 3. Start server
npm start

# 4. Open browser
open http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## Project Structure

```
WebServer/
├── server/
│   ├── server.js              # Express entry point
│   ├── config/constants.js    # All settings from .env
│   ├── middleware/auth.js     # Session + CSRF guard
│   ├── routes/
│   │   ├── api.js             # Admin REST API (/api/*)
│   │   └── ota.js             # ESP32 API (/ota/*)
│   ├── services/
│   │   ├── configService.js   # state.json read/write
│   │   ├── rollbackService.js # Rollback TTL flag
│   │   └── firmwareService.js # Upload, list, delete, clean
│   └── data/                  # Runtime data (gitignored)
├── public/                    # Static frontend
│   ├── index.html             # Login page
│   ├── admin.html             # Dashboard
│   ├── css/style.css
│   └── js/
│       ├── login.js
│       ├── dashboard.js       # Main controller
│       ├── upload.js          # XHR progress upload
│       └── components/
├── firmware/                  # .bin files (gitignored)
├── scripts/setup.js           # First-time setup wizard
├── _php_original/             # Original PHP files (gitignored)
└── .env.example
```

---

## ESP32 API (unchanged contract)

| Endpoint | Usage |
|----------|-------|
| `GET /ota/check` | Returns `{version, url, command}` |
| `GET /ota/download?ver=X.Y.Z` | Streams firmware binary (Range support) |

```cpp
// ESP32 sketch constants
const char* CURRENT_VER    = "1.1.2";
#define DEFAULT_OTA_URL "http://your-server/ota/check"
```

---

## Security Features

- **bcrypt** password hashing (12 rounds)
- **Rate limiting**: 5 login attempts / 15 min; 30 OTA checks / min
- **Magic byte validation**: rejects non-binary uploads even if renamed `.bin`
- **Path traversal prevention**: strict version regex + `path.join()`
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
| `KEEP_OLD_VERSIONS` | Number of old versions to keep (default: 3) |
| `ROLLBACK_EXPIRE_MIN` | Rollback TTL in minutes (default: 15) |
