// public/js/components/statusBar.js
// Renders the 4 stat cards in the left rail (vertical stack)

export function renderStatusBar(status) {
  const grid = document.getElementById('stat-grid');
  if (!grid) return;

  const { version, fileExists, rollback, count } = status;

  grid.innerHTML = '';

  const cards = [
    {
      label: 'Active Version',
      value: `v${version}`,
      sub: 'Currently serving',
      cls: '',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>`,
    },
    {
      label: 'Firmware File',
      value: fileExists ? 'Ready' : 'Missing',
      sub: fileExists ? `firmware_${version}.bin` : 'File not found',
      cls: fileExists ? 'green' : 'red',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>`,
    },
    {
      label: 'Rollback',
      value: rollback.active ? 'Active' : 'None',
      sub: rollback.active ? `~${rollback.remainingMin} min left` : 'No rollback pending',
      cls: rollback.active ? 'amber' : 'green',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
      </svg>`,
    },
    {
      label: 'Stored Versions',
      value: count,
      sub: 'Firmware files on disk',
      cls: '',
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>`,
    },
  ];

  cards.forEach(c => {
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = `
      <div class="stat-card-left">
        <div class="stat-label" style="display:flex;align-items:center;gap:5px;">
          <span style="opacity:0.5;display:flex;align-items:center;">${c.icon}</span>
          ${c.label}
        </div>
        <div class="stat-sub">${c.sub}</div>
      </div>
      <div class="stat-card-right">
        <div class="stat-value ${c.cls}">${c.value}</div>
      </div>
    `;
    grid.appendChild(div);
  });
}
