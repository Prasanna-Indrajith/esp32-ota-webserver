// server/services/rollbackService.js
// TTL-based rollback flag (mirrors PHP rollback.flag logic exactly)
import fs from 'fs';
import path from 'path';
import { ROLLBACK_FLAG, ROLLBACK_EXPIRE_MIN } from '../config/constants.js';

export function isRollbackActive() {
  if (!fs.existsSync(ROLLBACK_FLAG)) return false;
  const stat = fs.statSync(ROLLBACK_FLAG);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  if (ageSeconds > ROLLBACK_EXPIRE_MIN * 60) {
    try { fs.unlinkSync(ROLLBACK_FLAG); } catch {}
    return false;
  }
  return true;
}

export function getRollbackInfo() {
  if (!fs.existsSync(ROLLBACK_FLAG)) return { active: false };
  const stat = fs.statSync(ROLLBACK_FLAG);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  if (ageSeconds > ROLLBACK_EXPIRE_MIN * 60) {
    try { fs.unlinkSync(ROLLBACK_FLAG); } catch {}
    return { active: false };
  }
  const remainingMin = Math.max(1, Math.ceil((ROLLBACK_EXPIRE_MIN * 60 - ageSeconds) / 60));
  const remainingPct  = Math.round((remainingMin / ROLLBACK_EXPIRE_MIN) * 100);
  const since = new Date(stat.mtimeMs).toLocaleTimeString('en-GB');
  return { active: true, since, remainingMin, remainingPct };
}

export function sendRollback() {
  fs.mkdirSync(path.dirname(ROLLBACK_FLAG), { recursive: true });
  fs.writeFileSync(ROLLBACK_FLAG, new Date().toISOString(), 'utf8');
}

export function cancelRollback() {
  try { fs.unlinkSync(ROLLBACK_FLAG); } catch {}
}
