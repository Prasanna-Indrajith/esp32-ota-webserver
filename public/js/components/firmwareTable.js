// public/js/components/firmwareTable.js
// Renders the firmware files table

export function renderFirmwareTable(firmwares, onDelete) {
  const body  = document.getElementById('firmware-table-body');
  const badge = document.getElementById('firmware-count-badge');
  if (!body) return;

  if (badge) badge.textContent = firmwares.length;

  if (!firmwares.length) {
    body.innerHTML = `<p class="fw-empty">No firmware files found on disk.</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'fw-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Version</th>
        <th>Size</th>
        <th>Uploaded</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  firmwares.forEach(fw => {
    const tr = document.createElement('tr');
    const date = new Date(fw.uploaded).toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });

    tr.innerHTML = `
      <td><strong>v${fw.version}</strong></td>
      <td>${fw.sizeKB} KB</td>
      <td>${date}</td>
      <td>${fw.active
        ? `<span class="badge badge-active">● Active</span>`
        : `<span class="badge badge-old">Old</span>`
      }</td>
      <td></td>
    `;

    // Build delete button safely (no innerHTML with user data)
    const actionTd = tr.querySelector('td:last-child');
    if (!fw.active) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.setAttribute('aria-label', `Delete firmware version ${fw.version}`);
      delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg> Delete`;
      delBtn.addEventListener('click', () => {
        if (confirm(`Delete firmware_${fw.version}.bin?\nThis cannot be undone.`)) {
          onDelete(fw.version);
        }
      });
      actionTd.appendChild(delBtn);
    } else {
      actionTd.innerHTML = `<span style="color:var(--text-muted);font-size:12px">—</span>`;
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  body.innerHTML = '';
  body.appendChild(table);

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:10px';
  hint.textContent = 'Server auto-keeps the 3 newest versions on upload.';
  body.appendChild(hint);
}
