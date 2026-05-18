// scripts/merge-css.js
// Merges public/css/style-project.css into public/css/style.css,
// converts style.css from CRLF to LF in the process, then empties style-project.css.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT       = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAIN_CSS   = path.join(ROOT, 'public', 'css', 'style.css');
const EXTRA_CSS  = path.join(ROOT, 'public', 'css', 'style-project.css');

// Read both, normalise CRLF → LF
let main  = fs.readFileSync(MAIN_CSS,  'utf8').replace(/\r\n/g, '\n');
let extra = fs.readFileSync(EXTRA_CSS, 'utf8').replace(/\r\n/g, '\n');

// Strip the header comment from the extra file (it was only for context)
extra = extra.replace(/^\/\*[\s\S]*?\*\/\s*/m, '').trimStart();

// Append to main (guard against running twice)
if (main.includes('PROJECT SWITCHER') || main.includes('project-switcher')) {
  // Already merged — just ensure dark-mode heatmap tokens are updated
  console.log('⚠  Project switcher CSS already present in style.css');
} else {
  main = main.trimEnd() + '\n\n/* ═══════════════════════════════════════════════════════════════\n   PROJECT SWITCHER + MODAL\n   ═══════════════════════════════════════════════════════════════ */\n\n' + extra + '\n';
  console.log('✓  Appended project switcher CSS to style.css');
}

// Also fix dark-mode heatmap token values inline
main = main
  .replace(/--ag-level-0:\s*#[0-9a-fA-F]+;/, '--ag-level-0: #1a2538;')
  .replace(/--ag-level-1:\s*#[0-9a-fA-F]+;/, '--ag-level-1: #163057;')
  .replace(/--ag-level-2:\s*#[0-9a-fA-F]+;/, '--ag-level-2: #1d4ed8;')
  .replace(/--ag-level-3:\s*#[0-9a-fA-F]+;/, '--ag-level-3: #3b82f6;')
  .replace(/--ag-level-4:\s*#[0-9a-fA-F]+;/, '--ag-level-4: #93c5fd;');
console.log('✓  Dark-mode heatmap tokens set');

// Fix hardcoded light-mode colours that clash with the dark theme
main = main
  .replace(/\.activity-icon\s*\{[^}]*background:\s*#eff6ff;/g, (m) => m.replace('#eff6ff', 'rgba(59,130,246,0.15)'))
  .replace(/\.switch-icon\s*\{[^}]*background:\s*#eff6ff;/g,   (m) => m.replace('#eff6ff', 'rgba(59,130,246,0.12)'))
  .replace(/\.code-icon\s*\{[^}]*background:\s*#eff6ff;/g,     (m) => m.replace('#eff6ff', 'rgba(59,130,246,0.12)'))
  .replace(/\.table-icon\s*\{[^}]*background:\s*#f5f3ff;/g,    (m) => m.replace('#f5f3ff', 'rgba(109,40,217,0.15)'))
  .replace(/\.drop-zone:hover[^}]*background:\s*#eff6ff;/g,    (m) => m.replace('#eff6ff', 'var(--accent-glow)'));
console.log('✓  Dark-mode icon/drop-zone colour overrides applied');

// Write merged style.css (LF line endings)
fs.writeFileSync(MAIN_CSS, main, 'utf8');
console.log('✓  style.css written (LF line endings)');

// Blank out style-project.css (keep file so existing git history is clean)
fs.writeFileSync(EXTRA_CSS, '/* Merged into style.css — this file is intentionally empty. */\n', 'utf8');
console.log('✓  style-project.css cleared');

console.log('\n✅  Done. Hard-refresh the browser (Ctrl+Shift+R).\n');
