// public/js/dashboard.js
// Main dashboard controller — wires all components together

import { renderStatusBar }                        from './components/statusBar.js';
import { renderFirmwareTable }                    from './components/firmwareTable.js';
import { renderRollbackBanner, renderRollbackCard } from './components/rollbackBanner.js';
import { setupUploadForm, showGlobalAlert }       from './upload.js';
import { renderActivityGraph }                    from './components/activityGraph.js';

const API = (path, opts = {}) =>
  fetch(path, {
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });

// ── Auth guard ──────────────────────────────────────────────────
async function checkAuth() {
  try {
    const r = await fetch('/api/auth');
    const d = await r.json();
    if (!d.authenticated) window.location.replace('/');
  } catch {
    window.location.replace('/');
  }
}

// ── Fetch & render all dashboard data ──────────────────────────
let refreshTimer = null;

async function refresh() {
  try {
    const [statusRes, firmwareRes] = await Promise.all([
      API('/api/status'),
      API('/api/firmwares'),
    ]);
    if (statusRes.status === 401) { window.location.replace('/'); return; }

    const status    = await statusRes.json();
    const firmwares = await firmwareRes.json();

    renderStatusBar(status);
    renderRollbackBanner(status.rollback);
    renderRollbackCard(status.rollback, handleRollbackSend, handleRollbackCancel);
    renderFirmwareTable(firmwares, handleDeleteFirmware);
    renderActivityGraph(firmwares);
    renderConstants(status);

    document.getElementById('connection-dot')?.classList.remove('offline');
  } catch {
    document.getElementById('connection-dot')?.classList.add('offline');
  }
}

// ── Constants block ─────────────────────────────────────────────
function renderConstants(status) {
  const block = document.getElementById('constants-block');
  if (!block) return;
  // textContent only — never innerHTML with server data
  block.textContent =
    `const char* CURRENT_VER = "${status.version}";\n` +
    `#define DEFAULT_OTA_URL "${location.origin}/ota/check"`;
}

// ── Copy constants ───────────────────────────────────────────────
function setupCopyBtn() {
  document.getElementById('copy-constants-btn')?.addEventListener('click', async () => {
    const text = document.getElementById('constants-block')?.textContent || '';
    await navigator.clipboard.writeText(text).catch(() => {});
    const btn = document.getElementById('copy-constants-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
}

// ── Switch version ───────────────────────────────────────────────
function setupSwitchForm() {
  document.getElementById('switch-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const version = document.getElementById('switch-version').value.trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      showGlobalAlert('Version must be X.Y.Z', 'error'); return;
    }
    const btn = document.getElementById('switch-btn');
    btn.disabled = true;
    try {
      const r = await API('/api/switch', { method: 'POST', body: JSON.stringify({ version }) });
      const d = await r.json();
      showGlobalAlert(d.message || d.error, r.ok ? 'success' : 'error');
      if (r.ok) { document.getElementById('switch-form').reset(); await refresh(); }
    } finally { btn.disabled = false; }
  });
}

// ── Rollback actions ─────────────────────────────────────────────
async function handleRollbackSend() {
  const r = await API('/api/rollback/send', { method: 'POST' });
  const d = await r.json();
  showGlobalAlert(d.message || d.error, r.ok ? 'success' : 'error');
  await refresh();
}
async function handleRollbackCancel() {
  const r = await API('/api/rollback/cancel', { method: 'POST' });
  const d = await r.json();
  showGlobalAlert(d.message || d.error, r.ok ? 'success' : 'error');
  await refresh();
}

// ── Delete firmware ──────────────────────────────────────────────
async function handleDeleteFirmware(version) {
  const r = await API(`/api/firmware/${encodeURIComponent(version)}`, { method: 'DELETE' });
  const d = await r.json();
  showGlobalAlert(d.message || d.error, r.ok ? 'success' : 'error');
  await refresh();
}

// ── Logout ───────────────────────────────────────────────────────
function setupLogout() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await API('/api/logout', { method: 'POST' });
    window.location.replace('/');
  });
}

// ── Auto-refresh every 30 s ──────────────────────────────────────
function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refresh, 30_000);
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await refresh();
  setupUploadForm(refresh);
  setupSwitchForm();
  setupCopyBtn();
  setupLogout();
  startAutoRefresh();
});
