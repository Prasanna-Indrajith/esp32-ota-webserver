// public/js/components/rollbackBanner.js
// Top banner (when rollback active) + button area inside rollback card

export function renderRollbackBanner(rollback) {
  const banner = document.getElementById('rollback-banner');
  if (!banner) return;

  if (!rollback.active) {
    banner.classList.remove('rb-active');
    // Clear inner content after slide-out
    banner.addEventListener('transitionend', () => {
      if (!banner.classList.contains('rb-active')) banner.innerHTML = '';
    }, { once: true });
    return;
  }

  // Build with DOM API to avoid XSS
  banner.innerHTML = '';
  banner.classList.add('rb-active');

  // Inner wrapper required for grid-template-rows animation
  const inner = document.createElement('div');
  inner.className = 'rollback-banner';

  const icon = document.createElement('div');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

  const info = document.createElement('div');
  info.style.flex = '1';

  const label = document.createElement('span');
  label.className = 'rb-label';
  label.textContent = 'Rollback active — devices rolling back now';

  const sub = document.createElement('span');
  sub.className = 'rb-sub';
  sub.textContent = `Sent: ${rollback.since} · Expires in ~${rollback.remainingMin} min`;

  const ttl = document.createElement('div');
  ttl.className = 'rb-ttl';

  const ttlFill = document.createElement('div');
  ttlFill.className = 'rb-ttl-fill';
  ttlFill.style.width = `${rollback.remainingPct}%`;
  ttl.appendChild(ttlFill);
  info.append(label, sub, ttl);

  inner.append(icon, info);
  banner.appendChild(inner);
}

export function renderRollbackCard(rollback, onSend, onCancel) {
  const area = document.getElementById('rollback-btn-area');
  if (!area) return;
  area.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = rollback.active ? 'btn btn-primary btn-full' : 'btn btn-amber btn-full';
  btn.id = rollback.active ? 'cancel-rollback-btn' : 'send-rollback-btn';

  if (rollback.active) {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Cancel Rollback`;
    btn.addEventListener('click', onCancel);
  } else {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Rollback All Devices`;
    btn.addEventListener('click', () => showRollbackConfirmDialog(onSend));
  }

  area.appendChild(btn);
}

// ── Rollback confirmation dialog ─────────────────────────────────────────────
function showRollbackConfirmDialog(onConfirm) {
  // Remove any stale dialog
  document.getElementById('rollback-dialog')?.remove();

  const dialog = document.createElement('dialog');
  dialog.id = 'rollback-dialog';
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('aria-labelledby', 'rb-dialog-title');
  dialog.setAttribute('aria-describedby', 'rb-dialog-desc');
  dialog.innerHTML = `
    <div class="confirm-dialog-inner">
      <div class="confirm-dialog-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="confirm-dialog-title" id="rb-dialog-title">Rollback All Devices?</h2>
      <p class="confirm-dialog-desc" id="rb-dialog-desc">
        All registered devices will <strong>immediately reboot</strong> to their previously saved flash partition.<br>
        This cannot be undone — you can only cancel within <strong>15&nbsp;min</strong>.
      </p>
      <div class="confirm-dialog-actions">
        <button class="btn btn-ghost" id="rb-cancel-btn">Cancel</button>
        <button class="btn btn-amber" id="rb-confirm-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
          </svg>
          Send Rollback
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.querySelector('#rb-confirm-btn').focus();

  const close = () => {
    dialog.classList.add('dialog-hiding');
    dialog.addEventListener('animationend', () => dialog.remove(), { once: true });
  };

  dialog.querySelector('#rb-cancel-btn').addEventListener('click', close);
  dialog.querySelector('#rb-confirm-btn').addEventListener('click', () => {
    close();
    onConfirm();
  });

  // Backdrop click closes
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  // Escape is handled natively by <dialog>
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
}
