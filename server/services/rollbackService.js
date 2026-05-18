// server/services/rollbackService.js
// TTL-based rollback flag — one flag file per project.
import fs from 'fs';
import path from 'path';
import { projectRollbackFlag, ROLLBACK_EXPIRE_MIN } from '../config/constants.js';

function flagPath(projectId = 'default') {
  return projectRollbackFlag(projectId);
}

export function isRollbackActive(projectId = 'default') {
  const flag = flagPath(projectId);
  if (!fs.existsSync(flag)) return false;
  const stat = fs.statSync(flag);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  if (ageSeconds > ROLLBACK_EXPIRE_MIN * 60) {
    try { fs.unlinkSync(flag); } catch {}
    return false;
  }
  return true;
}

export function getRollbackInfo(projectId = 'default') {
  const flag = flagPath(projectId);
  if (!fs.existsSync(flag)) return { active: false };
  const stat = fs.statSync(flag);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  if (ageSeconds > ROLLBACK_EXPIRE_MIN * 60) {
    try { fs.unlinkSync(flag); } catch {}
    return { active: false };
  }
  const remainingMin = Math.max(1, Math.ceil((ROLLBACK_EXPIRE_MIN * 60 - ageSeconds) / 60));
  const remainingPct = Math.round((remainingMin / ROLLBACK_EXPIRE_MIN) * 100);
  const since = new Date(stat.mtimeMs).toLocaleTimeString('en-GB');
  return { active: true, since, remainingMin, remainingPct };
}

export function sendRollback(projectId = 'default') {
  const flag = flagPath(projectId);
  fs.mkdirSync(path.dirname(flag), { recursive: true });
  fs.writeFileSync(flag, new Date().toISOString(), 'utf8');
}

export function cancelRollback(projectId = 'default') {
  try { fs.unlinkSync(flagPath(projectId)); } catch {}
}
