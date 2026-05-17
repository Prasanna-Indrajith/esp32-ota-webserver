// server/services/configService.js
// Replaces config.php — reads/writes state.json
import fs from 'fs';
import path from 'path';
import { STATE_FILE, BASE_URL } from '../config/constants.js';

const DEFAULT_STATE = { version: '0.0.0', url: '' };

export function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(version) {
  const url = `${BASE_URL}/ota/download?ver=${version}`;
  const state = { version, url };
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}
