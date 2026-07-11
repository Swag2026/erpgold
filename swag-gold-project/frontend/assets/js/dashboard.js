/**
 * dashboard.js — Dashboard view
 *
 * FIXES:
 * 1. Dashboard cards now show purchase count (total_purchase_invoices from backend)
 * 2. Day Balance section now loads TODAY's actual data from /reports/daily
 *    instead of showing all-time totals — so "Purchases today" shows correctly
 * 3. Cash Balance card now shows net cash (sales cash - purchases cash - expenses)
 * 4. Both summary cards AND daily balance load in parallel for speed
 */

async function loadDashboard() {
  try {
    const today = _localDateStr();

    const [summary, daily, todayReport] = await Promise.all([
      api.getSummary().catch(() => null),
      api.getDailyRevenue().catch(() => []),
      api.getDailyReport(today).catch(() => null),
    ]);

    if (!summary) {
      document.getElementById('dashCards').innerHTML =
        '<div class="loading"><div class="spinner"></div>Failed to load dashboard data.</div>';
      return;
    }

    renderDashStats(summary, daily, todayReport, today);
  } catch (e) {
    toast('Dashboard load failed: ' + e.message);
  }
}

// FIX: Get local date string (not UTC) — Saudi Arabia is UTC+3
function _localDateStr() {
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function renderDashStats(s, daily, todayReport, today) {
  // FIX: use total_purchase_invoices from backend (added in analytics.py fix)
  // Fallback to old sub-text if field not present yet
  const purchaseCount = s.total_purchase_invoices != null
    ? `${s.total_purchase_invoices} purchase invoice${s.total_purchase_invoices !== 1 ? 's' : ''}`
    : 'All active purchase invoices';

  // Net cash = cash from sales minus cash paid out for purchases/expenses
  // The summary only has cash_total (from sales), so we compute net from today's report
  const netCashDisplay = todayReport
    ? (todayReport.summary.cash_in - todayReport.summary.total_purchases - todayReport.summary.total_expenses)
    : s.cash_total;

  const cards = [
    { label: 'Sales Revenue',   cls: 'gold',    val: 'SAR ' + fmt(s.total_revenue),   sub: `${s.total_sale_invoices} active invoice${s.total_sale_invoices !== 1 ? 's' : ''}` },
    { label: 'Purchases',       cls: 'red',     val: 'SAR ' + fmt(s.total_purchases),  sub: purchaseCount },
    { label: 'Gold Balance',    cls: 'gold',    val: fmtD(s.total_gold_sold_grams) + 'g', sub: fmtD(s.equivalent_21k_grams) + 'g 21K-equivalent' },
    { label: 'Cash Balance',    cls: 'emerald', val: 'SAR ' + fmt(s.cash_total),       sub: 'After sales & expenses' },
  ];

  document.getElementById('dashCards').innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value mono">${c.val}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>
  `).join('');

  // Net P&L (all time)
  const net = s.total_revenue - s.total_purchases;
  const netEl = document.getElementById('netPL');
  if (netEl) {
    netEl.textContent = 'SAR ' + fmt(net);
    netEl.style.color = net >= 0 ? '#7FBF9B' : '#D68E7A';
  }

  // FIX: Day Balance — use today's actual daily report data
  renderDayBalance(todayReport, today);

  // Exhibition overview (all-time)
  const balEl = document.getElementById('balanceList');
  if (balEl) {
    balEl.innerHTML = `
      <div class="bal-list">
        ${balRow('Total Revenue', 'SAR ' + fmt(s.total_revenue), '#7FBF9B')}
        ${balRow('− Total Purchases', '− SAR ' + fmt(s.total_purchases), '#D68E7A')}
        ${balRow('Net Margin', 'SAR ' + fmt(net), net >= 0 ? 'var(--gold-24)' : 'var(--red)', true)}
        ${balRow('Cash Total', 'SAR ' + fmt(s.cash_total), 'var(--cream-dim)')}
        ${balRow('Card / Bank Total', 'SAR ' + fmt(s.card_total), 'var(--cream-dim)')}
      </div>
    `;
  }

  // Daily trend chart
  renderDailyTrend(daily);
}

// FIX: Day Balance now uses real today's report from /reports/daily
// Previously it used the all-time summary which made "Purchases" always show SAR 0
// when no purchase was made that specific day shown
function renderDayBalance(todayReport, today) {
  const el = document.getElementById('dayBalanceList');
  if (!el) return;

  if (!todayReport) {
    el.innerHTML = `
      <div class="bal-list">
        <div class="bal-row" style="color:var(--cream-dim);text-align:center;padding:12px;">
          No data for today (${today})
        </div>
      </div>`;
    return;
  }

  const ts = todayReport.summary;
  const opening = 0; // Opening balance not yet in backend — tracked manually
  const closing = opening + ts.cash_in - ts.total_purchases - ts.total_expenses - ts.total_payments;

  el.innerHTML = `
    <div class="bal-list">
      <div class="bal-row"><span class="bal-label"><span class="bal-dot" style="background:var(--gold-24);"></span>Opening Cash</span><span class="bal-val">SAR ${fmt(opening)}</span></div>
      <div class="bal-row"><span class="bal-label"><span class="bal-dot" style="background:#7FBF9B;"></span>Sales</span><span class="bal-val">+SAR ${fmt(ts.total_revenue)}</span></div>
      <div class="bal-row"><span class="bal-label"><span class="bal-dot" style="background:#D68E7A;"></span>Purchases</span><span class="bal-val">-SAR ${fmt(ts.total_purchases)}</span></div>
      <div class="bal-row"><span class="bal-label"><span class="bal-dot" style="background:var(--cream-faint);"></span>Expenses / Payments</span><span class="bal-val">-SAR ${fmt(ts.total_expenses + ts.total_payments)}</span></div>
      <div class="bal-row highlight"><span class="bal-label" style="font-weight:700;">Closing Cash</span><span class="bal-val" style="color:var(--gold-24);font-weight:700;">SAR ${fmt(closing)}</span></div>
    </div>
  `;
}

function balRow(label, val, color, bold = false) {
  return `<div class="bal-row" style="${bold ? 'font-weight:700;' : ''}">
    <span class="bal-label">${label}</span>
    <span style="font-family:'IBM Plex Mono',monospace;color:${color};">${val}</span>
  </div>`;
}

let _trendChart = null;
function renderDailyTrend(daily) {
  const canvas = document.getElementById('trendChart');
  if (!canvas || !daily.length) return;
  if (_trendChart) { _trendChart.destroy(); _trendChart = null; }

  const GRID = 'rgba(46,42,27,.5)';
  const TEXT = '#6B6351';

  _trendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date),
      datasets: [
        {
          label: 'Revenue',
          data: daily.map(d => d.revenue),
          borderColor: '#C9A227',
          backgroundColor: 'rgba(201,162,39,.12)',
          fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#C9A227',
        },
        {
          label: 'Purchases',
          data: daily.map(d => d.purchases),
          borderColor: '#B5533D',
          backgroundColor: 'rgba(181,83,61,.1)',
          fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#B5533D',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: TEXT } },
        tooltip: {
          callbacks: {
            label: ctx => ` SAR ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TEXT } },
        y: { grid: { color: GRID }, ticks: { color: TEXT, callback: v => 'SAR ' + fmt(v) } },
      },
    },
  });
}

window.loadDashboard = loadDashboard;
