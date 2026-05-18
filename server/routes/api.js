// server/routes/api.js
// Admin REST API — all routes protected by requireAdmin middleware.
// Routes are now project-scoped: /api/projects/:projectId/...
// Backward-compat flat routes (/api/status, /api/firmwares, ...) alias "default".
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
import {
  listProjects, getProject, createProject, deleteProject,
  validateProjectId, ensureDefaultProject,
} from '../services/projectService.js';
import { UPLOAD_TMP_DIR, ADMIN_PASSWORD_HASH, MAX_FIRMWARE_MB, NODE_ENV } from '../config/constants.js';

const router = Router();

// Ensure the default project exists on first use
ensureDefaultProject();

// ── Multer: disk storage in tmp/ ─────────────────────────────────────────────
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

// ── Rate limiter for login ───────────────────────────────────────────────────
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

router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body ?? {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }

  let match = false;
  if (NODE_ENV === 'development' && !ADMIN_PASSWORD_HASH.startsWith('$2b$')) {
    match = password === (process.env.ADMIN_PASSWORD || 'admin');
  } else {
    match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  }

  if (!match) return res.status(401).json({ error: 'Invalid password' });

  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.admin = true;
    res.json({ ok: true });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth', (req, res) => {
  res.json({ authenticated: !!req.session?.admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/projects
router.get('/projects', requireAdmin, (_req, res) => {
  res.json(listProjects());
});

// POST /api/projects  { id, name, description }
router.post('/projects', requireAdmin, (req, res) => {
  try {
    const { id, name, description } = req.body ?? {};
    const project = createProject({ id, name, description });
    res.status(201).json({ ok: true, project });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

// DELETE /api/projects/:projectId
router.delete('/projects/:projectId', requireAdmin, (req, res) => {
  try {
    deleteProject(req.params.projectId);
    res.json({ ok: true, message: `Project "${req.params.projectId}" deleted` });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: resolve + validate projectId from route param, default to "default"
// ─────────────────────────────────────────────────────────────────────────────
function resolveProject(req, res) {
  const raw = req.params?.projectId ?? 'default';
  try {
    const id = validateProjectId(raw);
    // Verify it actually exists
    getProject(id);
    return id;
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS & FIRMWARE — project-scoped routes
// ─────────────────────────────────────────────────────────────────────────────

function handleStatus(projectId, res) {
  const state     = readState(projectId);
  const rbInfo    = getRollbackInfo(projectId);
  const firmwares = listFirmwares(projectId, state.version);
  res.json({
    version:    state.version,
    url:        state.url,
    fileExists: firmwareExists(projectId, state.version),
    rollback:   rbInfo,
    count:      firmwares.length,
  });
}

// GET /api/projects/:projectId/status
router.get('/projects/:projectId/status', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;
  handleStatus(id, res);
});

// GET /api/projects/:projectId/firmwares
router.get('/projects/:projectId/firmwares', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;
  const { version } = readState(id);
  res.json(listFirmwares(id, version));
});

// POST /api/projects/:projectId/upload
router.post('/projects/:projectId/upload', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;

  upload.single('firmware')(req, res, err => {
    if (err) return res.status(err.status || 400).json({ error: err.message });

    const tmpFile = req.file;
    if (!tmpFile) return res.status(400).json({ error: 'No file received' });

    let version;
    try {
      version = sanitizeVersion(req.body?.version ?? '');
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      return res.status(400).json({ error: e.message });
    }

    try {
      validateBinaryFile(tmpFile.path);
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      return res.status(422).json({ error: e.message });
    }

    try {
      commitUpload(id, tmpFile.path, version);
      writeState(id, version);
      cleanOldVersions(id, version);
      res.json({ ok: true, message: `firmware_${version}.bin uploaded & activated` });
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      res.status(500).json({ error: e.message });
    }
  });
});

// POST /api/projects/:projectId/switch  { version: "X.Y.Z" }
router.post('/projects/:projectId/switch', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;

  let version;
  try { version = sanitizeVersion(req.body?.version ?? ''); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  if (!firmwareExists(id, version)) {
    return res.status(404).json({ error: `firmware_${version}.bin not found on disk` });
  }
  writeState(id, version);
  res.json({ ok: true, message: `Active version → v${version}` });
});

// DELETE /api/projects/:projectId/firmware/:version
router.delete('/projects/:projectId/firmware/:version', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;

  let version;
  try { version = sanitizeVersion(req.params.version); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const { version: active } = readState(id);
  if (version === active) {
    return res.status(409).json({ error: 'Cannot delete the active version' });
  }

  try {
    deleteFirmware(id, version);
    res.json({ ok: true, message: `firmware_${version}.bin deleted` });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// POST /api/projects/:projectId/rollback/send
router.post('/projects/:projectId/rollback/send', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;
  sendRollback(id);
  res.json({ ok: true, message: 'Rollback sent — all devices will rollback within 15 min' });
});

// POST /api/projects/:projectId/rollback/cancel
router.post('/projects/:projectId/rollback/cancel', requireAdmin, (req, res) => {
  const id = resolveProject(req, res);
  if (!id) return;
  cancelRollback(id);
  res.json({ ok: true, message: 'Rollback cancelled' });
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD-COMPAT FLAT ROUTES  →  alias "default" project
// These routes keep any existing scripts / ESP32 devices working unchanged.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/status',   requireAdmin, (_req, res) => handleStatus('default', res));

router.get('/firmwares', requireAdmin, (_req, res) => {
  const { version } = readState('default');
  res.json(listFirmwares('default', version));
});

router.post('/upload', requireAdmin, (req, res) => {
  req.params = { projectId: 'default' };
  // Re-use the project-scoped handler logic inline
  upload.single('firmware')(req, res, err => {
    if (err) return res.status(err.status || 400).json({ error: err.message });
    const tmpFile = req.file;
    if (!tmpFile) return res.status(400).json({ error: 'No file received' });
    let version;
    try { version = sanitizeVersion(req.body?.version ?? ''); }
    catch (e) { try { fs.unlinkSync(tmpFile.path); } catch {} return res.status(400).json({ error: e.message }); }
    try { validateBinaryFile(tmpFile.path); }
    catch (e) { try { fs.unlinkSync(tmpFile.path); } catch {} return res.status(422).json({ error: e.message }); }
    try {
      commitUpload('default', tmpFile.path, version);
      writeState('default', version);
      cleanOldVersions('default', version);
      res.json({ ok: true, message: `firmware_${version}.bin uploaded & activated` });
    } catch (e) {
      try { fs.unlinkSync(tmpFile.path); } catch {}
      res.status(500).json({ error: e.message });
    }
  });
});

router.post('/switch', requireAdmin, (req, res) => {
  let version;
  try { version = sanitizeVersion(req.body?.version ?? ''); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!firmwareExists('default', version)) return res.status(404).json({ error: `firmware_${version}.bin not found on disk` });
  writeState('default', version);
  res.json({ ok: true, message: `Active version → v${version}` });
});

router.delete('/firmware/:version', requireAdmin, (req, res) => {
  let version;
  try { version = sanitizeVersion(req.params.version); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const { version: active } = readState('default');
  if (version === active) return res.status(409).json({ error: 'Cannot delete the active version' });
  try { deleteFirmware('default', version); res.json({ ok: true, message: `firmware_${version}.bin deleted` }); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

router.post('/rollback/send',   requireAdmin, (_req, res) => { sendRollback('default');   res.json({ ok: true, message: 'Rollback sent' }); });
router.post('/rollback/cancel', requireAdmin, (_req, res) => { cancelRollback('default'); res.json({ ok: true, message: 'Rollback cancelled' }); });

export default router;
