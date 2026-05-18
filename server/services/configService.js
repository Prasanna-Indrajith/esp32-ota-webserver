// server/services/configService.js
// Reads/writes per-project state.json files.
import fs from 'fs';
import path from 'path';
import { projectStateFile, BASE_URL } from '../config/constants.js';

const DEFAULT_STATE = { version: '0.0.0', url: '' };

/**
 * Read the active version & OTA URL for a project.
 * @param {string} projectId
 */
export function readState(projectId = 'default') {
  try {
    const file = projectStateFile(projectId);
    if (!fs.existsSync(file)) return { ...DEFAULT_STATE };
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Write the active version for a project.
 * Generates the project-scoped download URL automatically.
 * @param {string} projectId
 * @param {string} version
 */
export function writeState(projectId = 'default', version) {
  const url = `${BASE_URL}/ota/${projectId}/download?ver=${version}`;
  const state = { version, url };
  const file = projectStateFile(projectId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  return state;
}
