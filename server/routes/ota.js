// server/routes/ota.js
// Public ESP32-facing endpoints: GET /ota/check  and  GET /ota/download
import { Router } from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { readState } from '../services/configService.js';
import { isRollbackActive } from '../services/rollbackService.js';
import { sanitizeVersion, firmwarePath, firmwareExists } from '../services/firmwareService.js';

const router = Router();

// Rate limits — ESP32 devices are low-frequency; abuse limits are strict
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

// ── GET /ota/check ─────────────────────────────────────────────────────────
// Returns: { version, url, command }
// ESP32 polls this every ~7 min to detect updates or rollback signals
router.get('/check', checkLimiter, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { version, url } = readState();

  if (isRollbackActive()) {
    return res.json({ version, url: '', command: 'rollback' });
  }
  res.json({ version, url, command: 'update' });
});

// ── GET /ota/download?ver=X.Y.Z ────────────────────────────────────────────
// Streams the firmware binary with Range support (required by ESP32 HTTP OTA)
router.get('/download', downloadLimiter, (req, res) => {
  let ver;
  try {
    ver = sanitizeVersion(req.query.ver ?? '');
  } catch {
    return res.status(400).json({ error: 'Invalid version format — must be X.Y.Z' });
  }

  if (!firmwareExists(ver)) {
    return res.status(404).json({ error: `firmware_${ver}.bin not found on server` });
  }

  const fp   = firmwarePath(ver);
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
});

export default router;
