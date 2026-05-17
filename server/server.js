// server/server.js
// ═══════════════════════════════════════════════════════════════
//  ESP32 OTA Admin — Node.js / Express Entry Point
// ═══════════════════════════════════════════════════════════════
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { PORT, NODE_ENV, SESSION_SECRET, DATA_DIR, FIRMWARE_DIR, UPLOAD_TMP_DIR } from './config/constants.js';
import apiRouter from './routes/api.js';
import otaRouter from './routes/ota.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

// ── Ensure required directories exist ──────────────────────────────────────
for (const dir of [DATA_DIR, FIRMWARE_DIR, UPLOAD_TMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();

// ── Security headers (helmet) ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      connectSrc:  ["'self'"],
      imgSrc:      ["'self'", 'data:'],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// OTA endpoints need CORS for ESP32 HTTP client
app.use('/ota', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Session ─────────────────────────────────────────────────────────────────
app.use(session({
  secret:            SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  name:              'ota.sid',
  cookie: {
    httpOnly:  true,
    secure:    NODE_ENV === 'production',
    sameSite:  'strict',
    maxAge:    60 * 60 * 1000,  // 1 hour
  },
}));

// ── Static files ────────────────────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);
app.use('/ota', otaRouter);

// ── Root → login page ───────────────────────────────────────────────────────
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚡ ESP32 OTA Server running`);
  console.log(`   Admin UI  → http://localhost:${PORT}`);
  console.log(`   OTA check → http://localhost:${PORT}/ota/check`);
  console.log(`   Mode      → ${NODE_ENV}\n`);
});
