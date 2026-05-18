// server/services/projectService.js
// Manages the project registry (projects.json) and per-project directory trees.
import fs from 'fs';
import path from 'path';
import {
  PROJECTS_REGISTRY, PROJECTS_DIR, MAX_PROJECTS,
  projectDir, projectStateFile, projectFirmwareDir, projectRollbackFlag,
  BASE_URL,
} from '../config/constants.js';

// ─── Slug validation: URL-safe, lowercase, no path chars ─────────────────────
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}[a-z0-9]$|^[a-z0-9]$/;

export function validateProjectId(id) {
  if (typeof id !== 'string') throw new Error('Project ID must be a string');
  const clean = id.trim().toLowerCase();
  if (!SLUG_RE.test(clean)) {
    throw new Error('Project ID must be 1–50 lowercase letters, digits, or hyphens (no leading/trailing hyphens)');
  }
  // Extra path-traversal guard
  if (clean !== path.basename(clean) || clean.includes('..')) {
    throw new Error('Invalid project ID');
  }
  return clean;
}

// ─── Registry helpers ─────────────────────────────────────────────────────────
function readRegistry() {
  try {
    if (!fs.existsSync(PROJECTS_REGISTRY)) return [];
    return JSON.parse(fs.readFileSync(PROJECTS_REGISTRY, 'utf8'));
  } catch {
    return [];
  }
}

function writeRegistry(projects) {
  fs.mkdirSync(path.dirname(PROJECTS_REGISTRY), { recursive: true });
  fs.writeFileSync(PROJECTS_REGISTRY, JSON.stringify(projects, null, 2), 'utf8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listProjects() {
  return readRegistry();
}

export function getProject(id) {
  const safe = validateProjectId(id);
  const projects = readRegistry();
  const p = projects.find(x => x.id === safe);
  if (!p) throw Object.assign(new Error(`Project "${safe}" not found`), { status: 404 });
  return p;
}

export function projectExists(id) {
  try {
    const safe = validateProjectId(id);
    return readRegistry().some(x => x.id === safe);
  } catch {
    return false;
  }
}

/**
 * Create a new project.
 * @param {{ id: string, name: string, description?: string }} opts
 */
export function createProject({ id, name, description = '' }) {
  const safe = validateProjectId(id);

  const projects = readRegistry();
  if (projects.length >= MAX_PROJECTS) {
    throw Object.assign(new Error(`Maximum number of projects (${MAX_PROJECTS}) reached`), { status: 400 });
  }
  if (projects.some(p => p.id === safe)) {
    throw Object.assign(new Error(`Project "${safe}" already exists`), { status: 409 });
  }

  const displayName = String(name || safe).slice(0, 80).trim() || safe;
  const desc        = String(description || '').slice(0, 255);
  const now         = new Date().toISOString();

  // Create directory tree
  fs.mkdirSync(projectFirmwareDir(safe), { recursive: true });

  // Write initial state.json for the project
  const stateFile = projectStateFile(safe);
  const initialState = {
    version: '0.0.0',
    url: `${BASE_URL}/ota/${safe}/download?ver=0.0.0`,
  };
  fs.writeFileSync(stateFile, JSON.stringify(initialState, null, 2), 'utf8');

  const entry = { id: safe, name: displayName, description: desc, createdAt: now };
  projects.push(entry);
  writeRegistry(projects);
  return entry;
}

/**
 * Delete a project.
 * Refuses if rollback flag is active for that project.
 */
export function deleteProject(id) {
  const safe = validateProjectId(id);
  if (safe === 'default') {
    throw Object.assign(new Error('Cannot delete the default project'), { status: 400 });
  }

  const projects = readRegistry();
  const idx = projects.findIndex(p => p.id === safe);
  if (idx === -1) throw Object.assign(new Error(`Project "${safe}" not found`), { status: 404 });

  // Guard: don't delete while rollback is active (devices still need the endpoint)
  const flag = projectRollbackFlag(safe);
  if (fs.existsSync(flag)) {
    throw Object.assign(new Error(`Cannot delete "${safe}" while rollback is active. Cancel rollback first.`), { status: 409 });
  }

  // Remove directory tree
  const dir = projectDir(safe);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  // Remove from registry
  projects.splice(idx, 1);
  writeRegistry(projects);
}

/**
 * Ensure the "default" project exists in the registry.
 * Called once on server startup.
 */
export function ensureDefaultProject() {
  const projects = readRegistry();
  if (!projects.some(p => p.id === 'default')) {
    // Create directory if missing (migration may have already created it)
    fs.mkdirSync(projectFirmwareDir('default'), { recursive: true });
    const stateFile = projectStateFile('default');
    if (!fs.existsSync(stateFile)) {
      const initial = { version: '0.0.0', url: `${BASE_URL}/ota/default/download?ver=0.0.0` };
      fs.writeFileSync(stateFile, JSON.stringify(initial, null, 2), 'utf8');
    }
    projects.unshift({
      id: 'default',
      name: 'Default Project',
      description: 'Original single-project OTA endpoint',
      createdAt: new Date().toISOString(),
    });
    writeRegistry(projects);
  }
}
