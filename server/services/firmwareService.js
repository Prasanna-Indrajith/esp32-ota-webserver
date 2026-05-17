// server/services/firmwareService.js
// Handles: list, upload (multi-layer validation), delete, clean old versions
import fs from 'fs';
import path from 'path';
import { FIRMWARE_DIR, MAX_FIRMWARE_MB, KEEP_OLD_VERSIONS } from '../config/constants.js';

const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

// ─── Strict version sanitizer ──────────────────────────────────────────────
export function sanitizeVersion(v) {
  if (typeof v !== 'string') throw new Error('Invalid version type');
  const trimmed = v.trim();
  if (!VERSION_RE.test(trimmed)) throw new Error('Version must be X.Y.Z (digits only)');
  return trimmed;
}

// ─── Magic-byte check: real ESP32 .bin starts with 0xE9 ────────────────────
export function validateBinaryFile(tmpPath) {
  const buf = fs.readFileSync(tmpPath);
  if (buf.length < 4) throw new Error('File too small to be a valid firmware binary');

  // Check if the file looks like plain text (script, HTML, PHP…)
  const sample = buf.slice(0, 512);
  const isPrintableText = sample.every(b =>
    (b >= 0x09 && b <= 0x0D) || (b >= 0x20 && b <= 0x7E)
  );
  if (isPrintableText) {
    throw new Error('Rejected: file appears to be plain text or script, not a binary firmware');
  }

  // ESP32 IDF image magic byte check (preferred, but not mandatory for generic .bin)
  // 0xE9 = ESP32 image magic
  if (buf[0] !== 0xE9) {
    // Still allow — some custom bootloaders differ — but reject obvious non-binaries above
    // Log a warning without blocking
    console.warn(`[firmware] Warning: first byte is 0x${buf[0].toString(16)} (expected 0xE9 for ESP-IDF)`);
  }
  return true;
}

// ─── Firmware filename <→> version ─────────────────────────────────────────
export function versionToFilename(version) {
  return `firmware_${sanitizeVersion(version)}.bin`;
}
export function firmwarePath(version) {
  return path.join(FIRMWARE_DIR, versionToFilename(version));
}
export function firmwareExists(version) {
  return fs.existsSync(firmwarePath(version));
}

// ─── List all firmware files (sorted newest first) ─────────────────────────
export function listFirmwares(activeVersion) {
  fs.mkdirSync(FIRMWARE_DIR, { recursive: true });
  const files = fs.readdirSync(FIRMWARE_DIR).filter(f => /^firmware_[\d.]+\.bin$/.test(f));
  return files
    .map(name => {
      const fp   = path.join(FIRMWARE_DIR, name);
      const stat = fs.statSync(fp);
      const match = name.match(/^firmware_(.+)\.bin$/);
      const version = match ? match[1] : '?';
      return {
        version,
        filename: name,
        sizeKB: Math.round(stat.size / 1024 * 10) / 10,
        uploaded: stat.mtime.toISOString(),
        active: version === activeVersion,
      };
    })
    .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
}

// ─── Finalise upload: move tmp → firmware dir ───────────────────────────────
export function commitUpload(tmpPath, version) {
  const safe = sanitizeVersion(version);
  fs.mkdirSync(FIRMWARE_DIR, { recursive: true });
  const dest = firmwarePath(safe);
  fs.renameSync(tmpPath, dest);
  return dest;
}

// ─── Delete a single version ────────────────────────────────────────────────
export function deleteFirmware(version) {
  const fp = firmwarePath(sanitizeVersion(version));
  if (!fs.existsSync(fp)) throw new Error(`firmware_${version}.bin not found`);
  fs.unlinkSync(fp);
}

// ─── Auto-prune: keep only KEEP_OLD_VERSIONS newest (excluding active) ──────
export function cleanOldVersions(keepVersion) {
  const safe = sanitizeVersion(keepVersion);
  const all = listFirmwares(safe)
    .filter(f => f.version !== safe)        // don't delete active
    .slice(KEEP_OLD_VERSIONS - 1);          // keep top N-1 old ones
  for (const f of all) {
    try { fs.unlinkSync(path.join(FIRMWARE_DIR, f.filename)); } catch {}
  }
}
