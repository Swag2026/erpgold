/**
 * analytics.js — Analytics view with Chart.js charts
 */

const CHART_GRID = 'rgba(46,42,27,.5)';
const CHART_TEXT = '#6B6351';

let _charts = {};

function destroyCharts() {
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch {} });
  _charts = {};
}

async function loadAnalytics() {
  if (!Auth.canAccessAnalytics) {
    document.getElementById('view-analytics').innerHTML = '<div class="panel"><div class="alert error"><span class="alert-icon">⛔</span><span>Analytics access requires Supervisor or Admin role.</span></div></div>';
    return;
  }
  destroyCharts();

  try {
    const [summary, karat, cashCard, spData, daily] = await Promise.all([
      api.getSummary(),
      api.getKaratBreakdown(),
      api.getCashVsCard(),
      api.getSalesVsPurchases(),
      api.getDailyRevenue(),
    ]);

    renderAnalyticsStats(summary);
    renderKaratChart(karat);
    renderCashCardChart(cashCard);
    renderSPChart(spData);
    renderDailyChart(daily);
  } catch (e) {
    toast('Analytics failed: ' + e.message);
  }
}

function renderAnalyticsStats(s) {
  document.getElementById('an-revenue').textContent = 'SAR ' + fmt(s.total_revenue);
  document.getElementById('an-revenue-sub').textContent = fmt(s.cash_total) + ' cash · ' + fmt(s.card_total) + ' card';
  document.getElementById('an-gold').textContent = fmtD(s.equivalent_21k_grams) + 'g';
  document.getElementById('an-invoices').textContent = s.total_sale_invoices;
  document.getElementById('an-invoices-sub').textContent = s.exhibition_days + ' exhibition days';
  document.getElementById('an-purchases').textContent = 'SAR ' + fmt(s.total_purchases);
}

function renderKaratChart(karat) {
  const ctx = document.getElementById('karatChart');
  if (!ctx) return;
  _charts.karat = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: karat.map(k => k.purity),
      datasets: [{
        label: 'Revenue (SAR)',
        data: karat.map(k => k.amount),
        backgroundColor: [KARAT_COLORS[24], KARAT_COLORS[21], KARAT_COLORS[18], KARAT_COLORS.S],
        borderRadius: 8, borderSkipped: false,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, callback: v => 'SAR ' + fmt(v) } },
      },
    },
  });
}

function renderCashCardChart(cc) {
  const ctx = document.getElementById('cashCardChart');
  if (!ctx) return;
  _charts.cashCard = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Cash Sales', 'Card Sales', 'Cash Purchases', 'Card Purchases'],
      datasets: [{
        data: [cc.cash_sales, cc.card_sales, cc.cash_purchases, cc.card_purchases],
        backgroundColor: ['#C9A227', '#4A7FA5', '#3E7055', '#B5533D'],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: CHART_TEXT, padding: 14 } } },
    },
  });
}

function renderSPChart(sp) {
  const ctx = document.getElementById('spChart');
  if (!ctx || !sp.dates.length) return;
  _charts.sp = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sp.dates,
      datasets: [
        { label: 'Sales', data: sp.sales, backgroundColor: 'rgba(62,112,85,.6)', borderRadius: 5 },
        { label: 'Purchases', data: sp.purchases, backgroundColor: 'rgba(181,83,61,.6)', borderRadius: 5 },
      ],
    },
    options: {
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, callback: v => 'SAR ' + fmt(v) } },
      },
      plugins: { legend: { labels: { color: CHART_TEXT } } },
    },
  });
}

function renderDailyChart(daily) {
  const ctx = document.getElementById('dailyChart');
  if (!ctx || !daily.length) return;
  _charts.daily = new Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date),
      datasets: [{
        label: 'Net',
        data: daily.map(d => d.net),
        borderColor: '#C9A227', backgroundColor: 'rgba(201,162,39,.1)',
        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#C9A227',
      }],
    },
    options: {
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, callback: v => 'SAR ' + fmt(v) } },
      },
      plugins: { legend: { labels: { color: CHART_TEXT } } },
    },
  });
}

window.loadAnalytics = loadAnalytics;
