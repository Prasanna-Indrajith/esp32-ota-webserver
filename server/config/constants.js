// server/config/constants.js
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export const PORT                = parseInt(process.env.PORT) || 3000;
export const NODE_ENV            = process.env.NODE_ENV || 'development';
export const BASE_URL            = process.env.BASE_URL || `http://localhost:${PORT}`;
export const SESSION_SECRET      = process.env.SESSION_SECRET || 'dev-secret-change-me';
export const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
export const MAX_FIRMWARE_MB     = parseInt(process.env.MAX_FIRMWARE_MB) || 10;
export const KEEP_OLD_VERSIONS   = parseInt(process.env.KEEP_OLD_VERSIONS) || 3;
export const ROLLBACK_EXPIRE_MIN = parseInt(process.env.ROLLBACK_EXPIRE_MIN) || 15;

export const FIRMWARE_DIR        = path.join(ROOT, 'firmware');
export const DATA_DIR            = path.join(ROOT, 'server', 'data');
export const STATE_FILE          = path.join(DATA_DIR, 'state.json');
export const ROLLBACK_FLAG       = path.join(DATA_DIR, 'rollback.flag');
export const UPLOAD_TMP_DIR      = path.join(DATA_DIR, 'tmp');
