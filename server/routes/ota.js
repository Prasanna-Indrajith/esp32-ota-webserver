// server/routes/ota.js
// Public ESP32-facing endpoints.
// Project-scoped:   GET /ota/:projectId/check    GET /ota/:projectId/download?ver=X.Y.Z
// Backward-compat:  GET /ota/check               GET /ota/download?ver=X.Y.Z  → "default"
import { Router } from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { readState } from '../services/configService.js';
import { isRollbackActive } from '../services/rollbackService.js';
import { sanitizeVersion, firmwarePath, firmwareExists } from '../services/firmwareService.js';
import { validateProjectId, projectExists } from '../services/projectService.js';

const router = Router();

// Rate limits
const checkLimiter = rateLimit({
  windowMs: 60_000, max: 30,
  message: JSON.stringify({ error: 'Rate limit exceeded' }),
  standardHeaders: true, legacyHeaders: false,
});
const downloadLimiter = rateLimit({
  windowMs: 60_000, max: 5,
  message: JSON.stringify({ error: 'Download rate limit exceeded' }),
  standardHeaders: true, legacyHeaders: false,
});

// ─── Shared handler for OTA check ────────────────────────────────────────────
function handleCheck(projectId, res) {
  res.setHeader('Content-Type', 'application/json');
  const { version, url } = readState(projectId);
  if (isRollbackActive(projectId)) {
    return res.json({ version, url: '', command: 'rollback' });
  }
  res.json({ version, url, command: 'update' });
}

// ─── Shared handler for firmware download ────────────────────────────────────
function handleDownload(projectId, req, res) {
  let ver;
  try {
    ver = sanitizeVersion(req.query.ver ?? '');
  } catch {
    return res.status(400).json({ error: 'Invalid version format — must be X.Y.Z' });
  }

  if (!firmwareExists(projectId, ver)) {
    return res.status(404).json({ error: `firmware_${ver}.bin not found on server` });
  }

  const fp   = firmwarePath(projectId, ver);
  const size = fs.statSync(fp).size;
  let start  = 0;
  let end    = size - 1;
  let status = 200;

  // HTTP Range support (ESP32 OTA uses this for resume/chunked download)
  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d*)-(\d*)/i);
    if (m) {
      start = m[1] !== '' ? parseInt(m[1]) : 0;
      end   = m[2] !== '' ? parseInt(m[2]) : size - 1;
      if (start > end || end >= size) {
        res.status(416).set('Content-Range', `bytes */${size}`);
        return res.end();
      }
      status = 206;
    }
  }

  const len = end - start + 1;
  res.status(status).set({
    'Content-Type':        'application/octet-stream',
    'Content-Disposition': `attachment; filename="firmware_${ver}.bin"`,
    'Content-Length':      len,
    'Accept-Ranges':       'bytes',
    'Content-Range':       `bytes ${start}-${end}/${size}`,
    'Cache-Control':       'no-store',
  });

  fs.createReadStream(fp, { start, end }).pipe(res);
}

// ─── Project-scoped routes ────────────────────────────────────────────────────

// GET /ota/:projectId/check
router.get('/:projectId/check', checkLimiter, (req, res) => {
  let id;
  try { id = validateProjectId(req.params.projectId); } catch {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  if (!projectExists(id)) {
    return res.status(404).json({ error: `Project "${id}" not found` });
  }
  handleCheck(id, res);
});

// GET /ota/:projectId/download?ver=X.Y.Z
router.get('/:projectId/download', downloadLimiter, (req, res) => {
  let id;
  try { id = validateProjectId(req.params.projectId); } catch {
    return res.status(400).json({ error: 'Invalid project ID' });
  }
  if (!projectExists(id)) {
    return res.status(404).json({ error: `Project "${id}" not found` });
  }
  handleDownload(id, req, res);
});

// ─── Backward-compat flat routes → "default" project ─────────────────────────
// These keep existing ESP32 devices (using /ota/check) working without change.

router.get('/check',    checkLimiter,    (_req, res)        => handleCheck('default', res));
router.get('/download', downloadLimiter, (req, res)         => handleDownload('default', req, res));

export default router;
