// server/routes/api.js
// Admin REST API — all routes protected by requireAdmin middleware
import { Router } from 'express';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/auth.js';
import { readState, writeState } from '../services/configService.js';
import { getRollbackInfo, sendRollback, cancelRollback } from '../services/rollbackService.js';
import {
  listFirmwares, sanitizeVersion, firmwareExists,
  validateBinaryFile, commitUpload, deleteFirmware, cleanOldVersions,
} from '../services/firmwareService.js';
import { UPLOAD_TMP_DIR, ADMIN_PASSWORD_HASH, MAX_FIRMWARE_MB, NODE_ENV } from '../config/constants.js';

const router = Router();

// ── Multer: disk storage in tmp/, validate extension before touching disk ───
const upload = multer({
  dest: UPLOAD_TMP_DIR,
  limits: { fileSize: MAX_FIRMWARE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.match(/\.bin$/i)) {
      return cb(Object.assign(new Error('Only .bin files are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

// ── Rate limiter for login endpoint ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  message: { error: 'Too many login attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/login
router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }

  // Dev mode shortcut (never used in production)
  let match = false;
  if (NODE_ENV === 'development' && !ADMIN_PASSWORD_HASH.startsWith('$2b$')) {
    match = password === (process.env.ADMIN_PASSWORD || 'admin');
  } else {
    match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  }

  if (!match) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.admin = true;
    res.json({ ok: true });
  });
});

// POST /api/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// GET /api/auth — check current session status
router.get('/auth', (req, res) => {
  res.json({ authenticated: !!req.session?.admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATUS (all require auth from here on)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/status
router.get('/status', requireAdmin, (req, res) => {
  const state     = readState();
  const rbInfo    = getRollbackInfo();
  const firmwares = listFirmwares(state.version);
  res.json({
    version:    state.version,
    url:        state.url,
    fileExists: firmwareExists(state.version),
    rollback:   rbInfo,
    count:      firmwares.length,
  });
});

// GET /api/firmwares
router.get('/firmwares', requireAdmin, (req, res) => {
  const { version } = readState();
  res.json(listFirmwares(version));
});

// ─────────────────────────────────────────────────────────────────────────────
// FIRMWARE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/upload  (multipart: firmware file + version field)
router.post('/upload', requireAdmin, (req, res) => {
  upload.single('firmware')(req, res, (err) => {
    if (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const tmpFile = req.file;
    if (!tmpFile) return res.status(400).json({ error: 'No file received' });

    let version;
    try {
      version = sanitizeVersion(req.body?.version ?? '');
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      return res.status(400).json({ error: e.message });
    }

    // Magic-byte / binary validation
    try {
      validateBinaryFile(tmpFile.path);
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      return res.status(422).json({ error: e.message });
    }

    // Move to firmware dir + update state
    try {
      commitUpload(tmpFile.path, version);
      writeState(version);
      cleanOldVersions(version);
      res.json({ ok: true, message: `firmware_${version}.bin uploaded & activated` });
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      res.status(500).json({ error: e.message });
    }
  });
});

// POST /api/switch  { version: "X.Y.Z" }
router.post('/switch', requireAdmin, (req, res) => {
  let version;
  try { version = sanitizeVersion(req.body?.version ?? ''); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  if (!firmwareExists(version)) {
    return res.status(404).json({ error: `firmware_${version}.bin not found on disk` });
  }
  writeState(version);
  res.json({ ok: true, message: `Active version → v${version}` });
});

// DELETE /api/firmware/:version
router.delete('/firmware/:version', requireAdmin, (req, res) => {
  let version;
  try { version = sanitizeVersion(req.params.version); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const { version: active } = readState();
  if (version === active) {
    return res.status(409).json({ error: 'Cannot delete the active version' });
  }

  try {
    deleteFirmware(version);
    res.json({ ok: true, message: `firmware_${version}.bin deleted` });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/rollback/send
router.post('/rollback/send', requireAdmin, (_req, res) => {
  sendRollback();
  res.json({ ok: true, message: 'Rollback sent — all devices will rollback within 15 min' });
});

// POST /api/rollback/cancel
router.post('/rollback/cancel', requireAdmin, (_req, res) => {
  cancelRollback();
  res.json({ ok: true, message: 'Rollback cancelled' });
});

export default router;
