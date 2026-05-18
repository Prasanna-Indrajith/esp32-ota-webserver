// public/js/components/projectSwitcher.js
// Renders the project dropdown in the topbar and the "New Project" modal.
// Emits a custom 'project:change' event on window when the active project changes.

let _projects = [];
let _currentId = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getCurrentProjectId() {
  return _currentId || 'default';
}

export function getCurrentProject() {
  return _projects.find(p => p.id === _currentId) || { id: 'default', name: 'Default Project' };
}

function emit() {
  window.dispatchEvent(new CustomEvent('project:change', { detail: { projectId: _currentId } }));
}

// ── Fetch project list ────────────────────────────────────────────────────────

export async function fetchProjects(API) {
  const r = await API('/api/projects');
  if (!r.ok) return;
  _projects = await r.json();
  if (!_currentId || !_projects.find(p => p.id === _currentId)) {
    _currentId = _projects[0]?.id || 'default';
  }
  renderDropdown();
}

// ── Render dropdown ───────────────────────────────────────────────────────────

function renderDropdown() {
  const wrap = document.getElementById('project-switcher');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Trigger button
  const btn = document.createElement('button');
  btn.className = 'project-btn';
  btn.id = 'project-dropdown-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const cur = getCurrentProject();
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="7" width="20" height="15" rx="2"/>
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
    </svg>
    <span id="project-label">${escHtml(cur.name)}</span>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;

  // Dropdown list
  const list = document.createElement('ul');
  list.className = 'project-list hidden';
  list.setAttribute('role', 'listbox');
  list.id = 'project-list';

  _projects.forEach(p => {
    const li = document.createElement('li');
    li.className = 'project-item' + (p.id === _currentId ? ' active' : '');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', p.id === _currentId);
    li.dataset.id = p.id;

    const dot = document.createElement('span');
    dot.className = 'project-item-dot';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'project-item-name';
    nameSpan.textContent = p.name;

    const idSpan = document.createElement('span');
    idSpan.className = 'project-item-id';
    idSpan.textContent = p.id;

    li.append(dot, nameSpan, idSpan);
    li.addEventListener('click', () => selectProject(p.id));
    list.appendChild(li);
  });

  // Separator + delete option (for non-default projects)
  if (_currentId !== 'default') {
    const sep = document.createElement('li');
    sep.className = 'project-sep';
    list.appendChild(sep);

    const delLi = document.createElement('li');
    delLi.className = 'project-item project-item-danger';
    delLi.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
      </svg>
      <span>Delete "${escHtml(cur.name)}"</span>
    `;
    delLi.addEventListener('click', () => deleteCurrentProject());
    list.appendChild(delLi);
  }

  wrap.appendChild(btn);
  wrap.appendChild(list);

  // Toggle
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !list.classList.contains('hidden');
    list.classList.toggle('hidden', open);
    btn.setAttribute('aria-expanded', !open);
  });

  // Close on outside click
  document.addEventListener('click', () => {
    list.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  });
}

// ── Select project ────────────────────────────────────────────────────────────

function selectProject(id) {
  if (id === _currentId) return;
  _currentId = id;
  renderDropdown();
  emit();
}

// ── Delete project ────────────────────────────────────────────────────────────

let _API = null;

async function deleteCurrentProject() {
  const cur = getCurrentProject();
  if (!confirm(`Delete project "${cur.name}" (${cur.id})?\n\nThis removes ALL firmware files for this project. This cannot be undone.`)) return;

  try {
    const r = await _API(`/api/projects/${encodeURIComponent(cur.id)}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }

    _projects = _projects.filter(p => p.id !== cur.id);
    _currentId = _projects[0]?.id || 'default';
    renderDropdown();
    emit();
  } catch (e) {
    alert('Failed to delete project: ' + e.message);
  }
}

// ── New project modal ─────────────────────────────────────────────────────────

function buildModal() {
  if (document.getElementById('new-project-modal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'new-project-modal';
  overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">New Project</h3>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">&times;</button>
      </div>
      <form id="new-project-form" novalidate>
        <div class="field-group">
          <label for="np-id" class="field-label">Project ID <span style="color:var(--red)">*</span></label>
          <div class="field-wrapper">
            <input id="np-id" type="text" class="field-input" placeholder="e.g. smart-meter"
              pattern="[a-z0-9][a-z0-9-]{0,47}[a-z0-9]|[a-z0-9]" required
              style="padding-left:12px" autocomplete="off" spellcheck="false">
          </div>
          <p class="field-hint">Lowercase letters, digits, hyphens. Used in OTA URL.</p>
        </div>
        <div class="field-group">
          <label for="np-name" class="field-label">Display Name <span style="color:var(--red)">*</span></label>
          <div class="field-wrapper">
            <input id="np-name" type="text" class="field-input" placeholder="e.g. Smart Meter" required
              style="padding-left:12px" maxlength="80">
          </div>
        </div>
        <div class="field-group" style="margin-bottom:0">
          <label for="np-desc" class="field-label">Description</label>
          <div class="field-wrapper">
            <input id="np-desc" type="text" class="field-input" placeholder="Optional description"
              style="padding-left:12px" maxlength="255">
          </div>
        </div>
        <div id="modal-alert" class="alert alert-error hidden" style="margin-top:12px"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary" id="modal-create-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Create Project
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // Auto-generate ID slug from name
  const idInput   = overlay.querySelector('#np-id');
  const nameInput = overlay.querySelector('#np-name');
  let idTouched = false;
  idInput.addEventListener('input', () => { idTouched = true; });
  nameInput.addEventListener('input', () => {
    if (idTouched) return;
    idInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  });

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  overlay.querySelector('#new-project-form').addEventListener('submit', async e => {
    e.preventDefault();
    const alertEl = overlay.querySelector('#modal-alert');
    alertEl.classList.add('hidden');

    const id   = idInput.value.trim();
    const name = nameInput.value.trim();
    const desc = overlay.querySelector('#np-desc').value.trim();

    if (!id || !name) { alertEl.textContent = 'ID and Name are required'; alertEl.classList.remove('hidden'); return; }

    const createBtn = overlay.querySelector('#modal-create-btn');
    createBtn.disabled = true;
    try {
      const r = await _API('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ id, name, description: desc }),
      });
      const d = await r.json();
      if (!r.ok) { alertEl.textContent = d.error; alertEl.classList.remove('hidden'); return; }
      _projects.push(d.project);
      _currentId = d.project.id;
      renderDropdown();
      emit();
      closeModal();
    } catch (ex) {
      alertEl.textContent = 'Network error: ' + ex.message;
      alertEl.classList.remove('hidden');
    } finally {
      createBtn.disabled = false;
    }
  });
}

function openModal()  { document.getElementById('new-project-modal')?.classList.remove('hidden'); }
function closeModal() {
  const m = document.getElementById('new-project-modal');
  if (!m) return;
  m.classList.add('hidden');
  m.querySelector('#new-project-form')?.reset();
  m.querySelector('#modal-alert')?.classList.add('hidden');
  const idInput = m.querySelector('#np-id');
  if (idInput) { idInput.dataset.touched = ''; }
}

// ── Setup "New Project" button ────────────────────────────────────────────────

export function setupProjectSwitcher(API) {
  _API = API;
  buildModal();

  document.getElementById('new-project-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    openModal();
  });
}

// ── XSS-safe escape ───────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
