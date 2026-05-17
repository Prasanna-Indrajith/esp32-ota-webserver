// public/js/upload.js
// XHR-based upload with real progress bar

export function setupUploadForm(onSuccess) {
  const form     = document.getElementById('upload-form');
  const input    = document.getElementById('firmware-input');
  const dropZone = document.getElementById('drop-zone');
  const fileName = document.getElementById('upload-filename');
  const progWrap = document.getElementById('upload-progress-wrap');
  const progFill = document.getElementById('upload-progress-fill');
  const progLbl  = document.getElementById('upload-progress-label');
  const btn      = document.getElementById('upload-btn');

  if (!form) return;

  // ── File selection display ──────────────────────────────────
  function setFile(file) {
    if (!file) return;
    fileName.textContent = file.name;
    dropZone.classList.add('has-file');
  }

  input.addEventListener('change', () => setFile(input.files[0]));

  // ── Drag-and-drop ───────────────────────────────────────────
  dropZone.addEventListener('click', () => input.click());
  dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });

  ['dragenter','dragover'].forEach(ev => {
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(ev => {
    dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });
  dropZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) {
      // Transfer dropped file to the hidden input
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      setFile(file);
    }
  });

  // ── Form submit ─────────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    const file    = input.files[0];
    const version = document.getElementById('upload-version').value.trim();

    if (!file) { showGlobalAlert('Please select a .bin file first', 'error'); return; }
    if (!/^\d+\.\d+\.\d+$/.test(version)) { showGlobalAlert('Version must be X.Y.Z (e.g. 1.2.3)', 'error'); return; }

    const formData = new FormData();
    formData.append('firmware', file);
    formData.append('version', version);

    const xhr = new XMLHttpRequest();

    // ── Real upload progress ──────────────────────────────────
    xhr.upload.addEventListener('progress', e => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 90); // reserve last 10% for server processing
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
        form.reset();
        fileName.textContent = 'Max 10 MB · ESP32 binary only';
        dropZone.classList.remove('has-file');
        onSuccess();
      } else {
        showGlobalAlert(data.error || 'Upload failed', 'error');
      }
      setUploadUI(false);
    });

    xhr.addEventListener('error', () => {
      showGlobalAlert('Network error during upload', 'error');
      setUploadUI(false);
    });

    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    setUploadUI(true);
    xhr.send(formData);
  });

  function setUploadUI(loading) {
    progWrap.classList.toggle('hidden', !loading);
    if (!loading) { progFill.style.width = '0%'; progLbl.textContent = '0%'; }
    btn.disabled = loading;
    btn.querySelector('.btn-text').classList.toggle('hidden', loading);
    btn.querySelector('.btn-spinner').classList.toggle('hidden', !loading);
  }
}

// Shared alert helper used by upload and dashboard
export function showGlobalAlert(msg, type = 'success') {
  const el = document.getElementById('global-alert');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;        // textContent — never innerHTML
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 5000);
}
