/**
 * dashboard.js — Exhibition Overview / Dashboard view
 */

async function loadDashboard() {
  try {
    const [summary, daily] = await Promise.all([
      api.getSummary().catch(() => null),
      api.getDailyRevenue().catch(() => []),
    ]);

    if (!summary) {
      document.getElementById('dashCards').innerHTML = '<div class="loading"><div class="spinner"></div>Failed to load dashboard data.</div>';
      return;
    }

    renderDashStats(summary, daily);
  } catch (e) {
    toast('Dashboard load failed: ' + e.message);
  }
}

function renderDashStats(s, daily) {
  const cards = [
    { label: 'Total Revenue', cls: 'gold',    val: 'SAR ' + fmt(s.total_revenue),   sub: `${s.total_sale_invoices} sale invoices` },
    { label: 'Total Purchases', cls: 'red',   val: 'SAR ' + fmt(s.total_purchases), sub: `All active purchase invoices` },
    { label: 'Cash In',  cls: 'emerald',      val: 'SAR ' + fmt(s.cash_total),      sub: 'Cash receipts from sales' },
    { label: 'Card / Bank', cls: 'silver',    val: 'SAR ' + fmt(s.card_total),      sub: 'Card / transfer receipts' },
    { label: 'Gold Sold', cls: 'gold',        val: fmtD(s.total_gold_sold_grams) + 'g', sub: fmtD(s.equivalent_21k_grams) + 'g 21K-equivalent' },
    { label: 'Exhibition Days', cls: 'silver',val: s.exhibition_days,                sub: s.total_invoices + ' total invoices' },
  ];

  document.getElementById('dashCards').innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value mono">${c.val}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>
  `).join('');

  // Net P&L
  const net = s.total_revenue - s.total_purchases;
  document.getElementById('netPL').textContent = 'SAR ' + fmt(net);
  document.getElementById('netPL').style.color = net >= 0 ? '#7FBF9B' : '#D68E7A';

  // Balance breakdown
  document.getElementById('balanceList').innerHTML = `
    <div class="bal-list">
      ${balRow('Total Revenue', 'SAR ' + fmt(s.total_revenue), '#7FBF9B')}
      ${balRow('− Total Purchases', '− SAR ' + fmt(s.total_purchases), '#D68E7A')}
      ${balRow('Net Margin', 'SAR ' + fmt(net), net >= 0 ? 'var(--gold-24)' : 'var(--red)', true)}
      ${balRow('Cash Total', 'SAR ' + fmt(s.cash_total), 'var(--cream-dim)')}
      ${balRow('Card / Bank Total', 'SAR ' + fmt(s.card_total), 'var(--cream-dim)')}
    </div>
  `;

  // Daily revenue trend
  renderDailyTrend(daily);
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
      },
      scales: {
        x: { grid: { color: GRID }, ticks: { color: TEXT } },
        y: { grid: { color: GRID }, ticks: { color: TEXT, callback: v => 'SAR ' + fmt(v) } },
      },
    },
  });
}

window.loadDashboard = loadDashboard;
