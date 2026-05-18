#!/usr/bin/env node
// scripts/migrate-to-multi-project.js
// ─────────────────────────────────────────────────────────────────────────────
// One-time migration: wraps the existing single-project data into the
// "default" project under server/projects/default/.
//
// Safe to run multiple times — it skips steps already completed.
//
// Usage:  node scripts/migrate-to-multi-project.js
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const OLD_FIRMWARE_DIR  = path.join(ROOT, 'firmware');
const OLD_STATE_FILE    = path.join(ROOT, 'server', 'data', 'state.json');
const OLD_ROLLBACK_FLAG = path.join(ROOT, 'server', 'data', 'rollback.flag');
const DATA_DIR          = path.join(ROOT, 'server', 'data');
const PROJECTS_DIR      = path.join(ROOT, 'server', 'projects');
const DEFAULT_DIR       = path.join(PROJECTS_DIR, 'default');
const DEFAULT_FW_DIR    = path.join(DEFAULT_DIR, 'firmware');
const DEFAULT_STATE     = path.join(DEFAULT_DIR, 'state.json');
const PROJECTS_REGISTRY = path.join(DATA_DIR, 'projects.json');

let steps = 0;

function log(msg)  { console.log(`  ✓  ${msg}`); steps++; }
function skip(msg) { console.log(`  –  ${msg} (already done)`); }
function warn(msg) { console.log(`  ⚠  ${msg}`); }

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║   ESP32 OTA → Multi-Project Migration           ║');
console.log('╚══════════════════════════════════════════════════╝\n');

// ── Step 1: Create default project directory ─────────────────────────────────
if (!fs.existsSync(DEFAULT_FW_DIR)) {
  fs.mkdirSync(DEFAULT_FW_DIR, { recursive: true });
  log('Created server/projects/default/firmware/');
} else {
  skip('server/projects/default/firmware/ exists');
}

// ── Step 2: Migrate state.json ───────────────────────────────────────────────
if (fs.existsSync(OLD_STATE_FILE) && !fs.existsSync(DEFAULT_STATE)) {
  fs.copyFileSync(OLD_STATE_FILE, DEFAULT_STATE);
  log(`Copied server/data/state.json → server/projects/default/state.json`);
} else if (!fs.existsSync(OLD_STATE_FILE) && !fs.existsSync(DEFAULT_STATE)) {
  // Neither exists — write a blank initial state
  const PORT = parseInt(process.env.PORT) || 3000;
  const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
  fs.writeFileSync(DEFAULT_STATE, JSON.stringify({
    version: '0.0.0',
    url: `${BASE_URL}/ota/default/download?ver=0.0.0`,
  }, null, 2), 'utf8');
  log('Created initial state.json for default project');
} else {
  skip('state.json already migrated');
}

// ── Step 3: Migrate rollback.flag ────────────────────────────────────────────
const defaultRollback = path.join(DEFAULT_DIR, 'rollback.flag');
if (fs.existsSync(OLD_ROLLBACK_FLAG) && !fs.existsSync(defaultRollback)) {
  fs.copyFileSync(OLD_ROLLBACK_FLAG, defaultRollback);
  log('Moved rollback.flag → server/projects/default/rollback.flag');
} else {
  skip('rollback.flag migration (no active flag or already done)');
}

// ── Step 4: Migrate firmware .bin files ──────────────────────────────────────
if (fs.existsSync(OLD_FIRMWARE_DIR)) {
  const bins = fs.readdirSync(OLD_FIRMWARE_DIR).filter(f => f.endsWith('.bin'));
  let moved = 0;
  for (const bin of bins) {
    const dest = path.join(DEFAULT_FW_DIR, bin);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(OLD_FIRMWARE_DIR, bin), dest);
      moved++;
    }
  }
  if (moved > 0) {
    log(`Copied ${moved} .bin file(s) → server/projects/default/firmware/`);
    warn(`Old files remain in firmware/ — delete manually when confident: rm -rf firmware/`);
  } else {
    skip('firmware .bin files (already migrated or none found)');
  }
} else {
  skip('firmware/ directory not found (nothing to migrate)');
}

// ── Step 5: Create / update projects.json registry ───────────────────────────
let registry = [];
if (fs.existsSync(PROJECTS_REGISTRY)) {
  try { registry = JSON.parse(fs.readFileSync(PROJECTS_REGISTRY, 'utf8')); } catch {}
}
if (!registry.some(p => p.id === 'default')) {
  registry.unshift({
    id:          'default',
    name:        'Default Project',
    description: 'Original single-project OTA endpoint (migrated)',
    createdAt:   new Date().toISOString(),
  });
  fs.writeFileSync(PROJECTS_REGISTRY, JSON.stringify(registry, null, 2), 'utf8');
  log('Registered "default" project in projects.json');
} else {
  skip('"default" already in projects.json');
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log(`\n✅  Migration complete (${steps} step(s) performed)\n`);
console.log('Next steps:');
console.log('  1. Restart the server:       npm run dev');
console.log('  2. Update ESP32 sketches:');
console.log('     #define DEFAULT_OTA_URL "http://<server>/ota/default/check"');
console.log('     (old /ota/check still works as a backward-compat alias)');
console.log('  3. Create more projects via the Admin UI → "+ New Project"\n');
