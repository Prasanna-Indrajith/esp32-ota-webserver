// public/js/upload.js
// XHR-based upload with real progress bar.
// setupUploadForm now accepts an optional PAPI function for project-scoped uploads.

import { getCurrentProjectId } from './components/projectSwitcher.js';

export function setupUploadForm(onSuccess, PAPI) {
  const form = document.getElementById('upload-form');
  if (!form) return;

  // Clone to remove old event listeners when switching projects
  const fresh = form.cloneNode(true);
  form.parentNode.replaceChild(fresh, form);

  const activeForm = document.getElementById('upload-form');
  const dz         = document.getElementById('drop-zone');
  const fileNameEl = document.getElementById('upload-filename');
  const inp        = document.getElementById('firmware-input');

  // ── File selection display ───────────────────────────────────────────────
  function setFile(file) {
    if (!file) return;
    fileNameEl.textContent = file.name;
    dz.classList.add('has-file');
  }

  inp.addEventListener('change', () => setFile(inp.files[0]));

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  dz.addEventListener('click',   () => inp.click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });

  ['dragenter', 'dragover'].forEach(ev =>
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-over'); })
  );
  ['dragleave', 'drop'].forEach(ev =>
    dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag-over'); })
  );
  dz.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
      setFile(file);
    }
  });

  // ── Form submit ───────────────────────────────────────────────────────────
  activeForm.addEventListener('submit', e => {
    e.preventDefault();
    const file    = inp.files[0];
    const version = document.getElementById('upload-version').value.trim();

    if (!file)                             { showGlobalAlert('Please select a .bin file first', 'error'); return; }
    if (!/^\d+\.\d+\.\d+$/.test(version)) { showGlobalAlert('Version must be X.Y.Z (e.g. 1.2.3)', 'error'); return; }

    const formData = new FormData();
    formData.append('firmware', file);
    formData.append('version', version);

    // Build upload URL — project-scoped if PAPI provided, else backward-compat
    const pid       = getCurrentProjectId();
    const uploadUrl = `/api/projects/${encodeURIComponent(pid)}/upload`;

    const xhr      = new XMLHttpRequest();
    const progWrap = document.getElementById('upload-progress-wrap');
    const progFill = document.getElementById('upload-progress-fill');
    const progLbl  = document.getElementById('upload-progress-label');
    const btn      = document.getElementById('upload-btn');

    xhr.upload.addEventListener('progress', ev => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 90);
      progFill.style.width = pct + '%';
      progLbl.textContent  = pct + '%';
    });

    xhr.addEventListener('load', () => {
      progFill.style.width = '100%';
      progLbl.textContent  = '100%';
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
      if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
        showGlobalAlert(data.message || 'Upload successful!', 'success');
        activeForm.reset();
        fileNameEl.textContent = 'Max 10 MB · ESP32 binary only';
        dz.classList.remove('has-file');
        onSuccess();
      } else {
        showGlobalAlert(data.error || 'Upload failed', 'error');
      }
      setUploadUI(false, progWrap, progFill, progLbl, btn);
    });

    xhr.addEventListener('error', () => {
      showGlobalAlert('Network error during upload', 'error');
      setUploadUI(false, progWrap, progFill, progLbl, btn);
    });

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    setUploadUI(true, progWrap, progFill, progLbl, btn);
    xhr.send(formData);
  });
}

function setUploadUI(loading, wrap, fill, lbl, btn) {
  wrap.classList.toggle('hidden', !loading);
  if (!loading) { fill.style.width = '0%'; lbl.textContent = '0%'; }
  btn.disabled = loading;
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-spinner').classList.toggle('hidden', !loading);
}

// ── Shared alert helper — fixed toast, no layout jump ────────────────────────
export function showGlobalAlert(msg, type = 'success') {
  // Reuse existing toast or create one
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    document.body.appendChild(toast);
  }

  // Icon per type
  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  toast.className = `global-toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.success}</span>
    <span class="toast-msg"></span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;
  toast.querySelector('.toast-msg').textContent = msg;
  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

  // Trigger slide-in
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => dismissToast(toast), 5000);
}

function dismissToast(toast) {
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-hiding');
  toast.addEventListener('transitionend', () => toast.classList.remove('toast-hiding'), { once: true });
}
