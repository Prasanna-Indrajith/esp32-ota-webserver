// public/js/components/activityGraph.js
// GitHub-style activity heatmap — shows firmware upload dates over 52 weeks

/**
 * Build a map of  dateStr → count  from the firmware list.
 * dateStr = "YYYY-MM-DD"
 */
function buildActivityMap(firmwares) {
  const map = {};
  for (const fw of firmwares) {
    const d = new Date(fw.uploaded);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

/**
 * Return an array of Date objects covering the last 52 full weeks + current partial week,
 * starting on the Sunday that is ≥ 364 days before today.
 */
function buildWeekGrid() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Show ~3 months (13 weeks) of history
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 90); // ~13 weeks back
  // rewind to Sunday of that week
  startDay.setDate(startDay.getDate() - startDay.getDay());

  const weeks = [];
  let cur = new Date(startDay);

  while (cur <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function levelFor(count) {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function renderActivityGraph(firmwares) {
  const container = document.getElementById('activity-graph-panel');
  if (!container) return;

  const actMap = buildActivityMap(firmwares);
  const weeks = buildWeekGrid();

  // ── Summary stats ────────────────────────────────────────────────
  const totalUploads = firmwares.length;
  const activeDays = Object.keys(actMap).length;
  const last30 = (() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    return firmwares.filter(fw => new Date(fw.uploaded) >= cutoff).length;
  })();

  // ── Month label positions ────────────────────────────────────────
  // For each week column, detect month change on first day of week (Sunday)
  const monthLabels = []; // { col, label }
  let prevMonth = -1;
  weeks.forEach((week, col) => {
    const m = week[0].getMonth();
    if (m !== prevMonth) {
      monthLabels.push({ col, label: MONTHS[m] });
      prevMonth = m;
    }
  });

  // ── Build SVG ────────────────────────────────────────────────────
  const CELL = 13;   // cell size px
  const GAP = 3;    // gap between cells
  const STEP = CELL + GAP;
  const PAD_L = 32;   // left pad for day labels
  const PAD_T = 22;   // top pad for month labels
  const W = PAD_L + weeks.length * STEP + GAP;
  const H = PAD_T + 7 * STEP + 4;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-label', 'Firmware upload activity');
  svg.style.cssText = 'width:100%;height:auto;display:block;overflow:visible';

  // ── Month labels ────────────────────────────────────────────────
  for (const { col, label } of monthLabels) {
    const x = PAD_L + col * STEP;
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', PAD_T - 6);
    t.setAttribute('font-size', '10');
    t.setAttribute('fill', 'var(--text-muted)');
    t.setAttribute('font-family', 'var(--font-sans)');
    t.textContent = label;
    svg.appendChild(t);
  }

  // ── Day-of-week labels (Mon, Wed, Fri) ──────────────────────────
  [1, 3, 5].forEach(d => {
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', PAD_L - 4);
    t.setAttribute('y', PAD_T + d * STEP + CELL - 2);
    t.setAttribute('font-size', '9');
    t.setAttribute('fill', 'var(--text-muted)');
    t.setAttribute('font-family', 'var(--font-sans)');
    t.setAttribute('text-anchor', 'end');
    t.textContent = DAYS[d];
    svg.appendChild(t);
  });

  // ── Tooltip element (HTML overlay) ──────────────────────────────
  const tooltip = document.createElement('div');
  tooltip.id = 'ag-tooltip';
  tooltip.style.cssText = `
    position:fixed; pointer-events:none; z-index:999;
    background:var(--text-primary); color:var(--bg-surface);
    font-size:11px; font-family:var(--font-sans);
    padding:5px 9px; border-radius:6px; white-space:nowrap;
    opacity:0; transition:opacity 0.15s; box-shadow:0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(tooltip);

  // ── Grid cells ──────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);

  weeks.forEach((week, col) => {
    week.forEach((day, row) => {
      if (day > today) return; // don't render future cells

      const key = dateKey(day);
      const count = actMap[key] || 0;
      const level = levelFor(count);
      const isFuture = day > today;

      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', PAD_L + col * STEP);
      rect.setAttribute('y', PAD_T + row * STEP);
      rect.setAttribute('width', CELL);
      rect.setAttribute('height', CELL);
      rect.setAttribute('rx', 3);
      rect.setAttribute('ry', 3);
      rect.setAttribute('data-level', level);
      rect.setAttribute('data-date', key);
      rect.setAttribute('data-count', count);
      rect.style.cursor = count ? 'pointer' : 'default';
      rect.style.fill = `var(--ag-level-${level})`;
      rect.style.transition = 'fill 0.2s, transform 0.15s';

      // hover effect
      rect.addEventListener('mouseenter', e => {
        rect.style.transform = `scale(1.35)`;
        rect.style.transformOrigin = `${PAD_L + col * STEP + CELL / 2}px ${PAD_T + row * STEP + CELL / 2}px`;

        const label = count
          ? `${count} upload${count > 1 ? 's' : ''} on ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : `No uploads on ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        tooltip.textContent = label;
        tooltip.style.opacity = '1';
        tooltip.style.left = `${e.clientX + 12}px`;
        tooltip.style.top = `${e.clientY - 28}px`;
      });
      rect.addEventListener('mousemove', e => {
        tooltip.style.left = `${e.clientX + 12}px`;
        tooltip.style.top = `${e.clientY - 28}px`;
      });
      rect.addEventListener('mouseleave', () => {
        rect.style.transform = '';
        tooltip.style.opacity = '0';
      });

      svg.appendChild(rect);
    });
  });

  // ── Legend ──────────────────────────────────────────────────────
  // const legendY = H + 2;
  // const legendLabels = ['Less', '', '', '', 'More'];
  // [0, 1, 2, 3, 4].forEach((lvl, i) => {
  //   const lx = W - (5 - i) * STEP - 8;
  //   const r = document.createElementNS(svgNS, 'rect');
  //   r.setAttribute('x', lx);
  //   r.setAttribute('y', legendY);
  //   r.setAttribute('width', CELL);
  //   r.setAttribute('height', CELL);
  //   r.setAttribute('rx', 3);
  //   r.setAttribute('ry', 3);
  //   r.style.fill = `var(--ag-level-${lvl})`;
  //   svg.appendChild(r);
  // });

  // "Less" label
  // const tLess = document.createElementNS(svgNS, 'text');
  // tLess.setAttribute('x', W - 5 * STEP - 12);
  // tLess.setAttribute('y', legendY + CELL - 2);
  // tLess.setAttribute('font-size', '9');
  // tLess.setAttribute('fill', 'var(--text-muted)');
  // tLess.setAttribute('font-family', 'var(--font-sans)');
  // tLess.setAttribute('text-anchor', 'end');
  // tLess.textContent = 'Less';
  // svg.appendChild(tLess);

  // // "More" label
  // const tMore = document.createElementNS(svgNS, 'text');
  // tMore.setAttribute('x', W - 4 + 4);
  // tMore.setAttribute('y', legendY + CELL - 2);
  // tMore.setAttribute('font-size', '9');
  // tMore.setAttribute('fill', 'var(--text-muted)');
  // tMore.setAttribute('font-family', 'var(--font-sans)');
  // tMore.textContent = 'More';
  // svg.appendChild(tMore);

  // // adjust viewBox height to include legend
  // svg.setAttribute('viewBox', `0 0 ${W} ${H + STEP + 4}`);

  // ── Compose section HTML ─────────────────────────────────────────
  container.innerHTML = `
  <div class="panel-header">
    <div class="panel-icon activity-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    </div>
    <h2 class="panel-title">Upload Activity</h2>
    <span class="panel-badge" id="ag-badge">${totalUploads} total</span>
  </div>

  <div class="ag-stat-wrapper">
    <div class="ag-wrap" id="ag-svg-wrap" style="flex:1;min-height:0;overflow:auto;"></div>

    <div class="ag-stats">
      <div class="ag-stat">
        <span class="ag-stat-val">${totalUploads}</span>
        <span class="ag-stat-lbl">Total</span>
      </div>
      <div class="ag-stat">
        <span class="ag-stat-val">${last30}</span>
        <span class="ag-stat-lbl">Last 30d</span>
      </div>
      <div class="ag-stat">
        <span class="ag-stat-val">${activeDays}</span>
        <span class="ag-stat-lbl">Active Days</span>
      </div>
    </div>
  </div>

  `;

  document.getElementById('ag-svg-wrap').appendChild(svg);
}
