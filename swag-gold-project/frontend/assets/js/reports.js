/**
 * reports.js — Daily and summary report views
 */

async function loadReports() {
  if (!Auth.canAccessAnalytics) {
    document.getElementById('view-reports').innerHTML = '<div class="panel"><div class="alert error"><span class="alert-icon">⛔</span><span>Reports access requires Supervisor or Admin role.</span></div></div>';
    return;
  }
  document.getElementById('reportPreview').innerHTML = '';
  document.getElementById('reportDateInput').value = new Date().toISOString().slice(0, 10);
}

async function loadDailyReport() {
  const date = document.getElementById('reportDateInput').value;
  if (!date) { toast('Please select a date.'); return; }
  const preview = document.getElementById('reportPreview');
  preview.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';
  try {
    const r = await api.getDailyReport(date);
    preview.innerHTML = renderDailyReportHTML(r);
  } catch (e) {
    preview.innerHTML = `<div class="alert error"><span class="alert-icon">⚠</span><span>${e.message}</span></div>`;
  }
}

function renderDailyReportHTML(r) {
  const s = r.summary;
  return `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">Daily Report — ${r.date}</div>
        <button class="btn small" onclick="window.print()">⎙ Print</button>
      </div>
      <div class="stats-grid" style="margin-bottom:16px;">
        <div class="stat-card emerald"><div class="stat-label">Revenue</div><div class="stat-value mono">SAR ${fmt(s.total_revenue)}</div><div class="stat-sub">${r.sales.length} invoices</div></div>
        <div class="stat-card red"><div class="stat-label">Purchases</div><div class="stat-value mono">SAR ${fmt(s.total_purchases)}</div></div>
        <div class="stat-card gold"><div class="stat-label">Cash In</div><div class="stat-value mono">SAR ${fmt(s.cash_in)}</div></div>
        <div class="stat-card silver"><div class="stat-label">Net Cash</div><div class="stat-value mono">SAR ${fmt(s.net_cash)}</div></div>
      </div>
      ${r.sales.length ? `
      <div class="panel-title" style="margin-bottom:10px;">Sales</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Contact</th><th>21K</th><th>18K</th><th>Total</th><th>Cash</th><th>Card</th></tr></thead>
          <tbody>
            ${r.sales.map(i => `<tr>
              <td class="mono" style="color:var(--gold-24);">${esc(i.invoice_no)}</td>
              <td>${esc(i.contact || '—')}</td>
              <td class="mono">${i.weight_21k ? fmtD(i.weight_21k) + 'g' : '—'}</td>
              <td class="mono">${i.weight_18k ? fmtD(i.weight_18k) + 'g' : '—'}</td>
              <td class="mono" style="font-weight:700;">SAR ${fmt(i.total)}</td>
              <td class="mono">SAR ${fmt(i.cash)}</td>
              <td class="mono">SAR ${fmt(i.card)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p style="color:var(--cream-dim);">No sales on this day.</p>'}
      ${r.purchases.length ? `
      <div class="panel-title" style="margin:16px 0 10px;">Purchases</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Type</th><th>Contact</th><th>Total</th></tr></thead>
          <tbody>
            ${r.purchases.map(i => `<tr>
              <td class="mono">${esc(i.invoice_no)}</td>
              <td><span class="cat-tag cat-${i.category}">${CAT_LABELS[i.category]||i.category}</span></td>
              <td>${esc(i.contact || '—')}</td>
              <td class="mono" style="font-weight:700;">SAR ${fmt(i.total)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
      ${r.expenses.length ? `
      <div class="panel-title" style="margin:16px 0 10px;">Expenses</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Description</th><th>Total</th></tr></thead>
          <tbody>
            ${r.expenses.map(e => `<tr>
              <td class="mono">${esc(e.invoice_no)}</td>
              <td>${esc(e.description || '—')}</td>
              <td class="mono">SAR ${fmt(e.total)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>
  `;
}

async function loadSummaryReport() {
  const startDate = document.getElementById('reportStartDate')?.value || '';
  const endDate   = document.getElementById('reportEndDate')?.value || '';
  const preview   = document.getElementById('reportPreview');
  preview.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';
  try {
    const r = await api.getSummaryReport({ start_date: startDate || undefined, end_date: endDate || undefined });
    preview.innerHTML = `
      <div class="panel">
        <div class="panel-title" style="margin-bottom:16px;">Summary Report${r.period.start ? ' — ' + r.period.start + ' to ' + (r.period.end || 'today') : ''}</div>
        <div class="stats-grid">
          <div class="stat-card emerald"><div class="stat-label">Total Revenue</div><div class="stat-value mono">SAR ${fmt(r.total_revenue)}</div><div class="stat-sub">${r.sale_invoices} sale invoices</div></div>
          <div class="stat-card red"><div class="stat-label">Total Purchases</div><div class="stat-value mono">SAR ${fmt(r.total_purchases)}</div></div>
          <div class="stat-card gold"><div class="stat-label">Net</div><div class="stat-value mono">SAR ${fmt(r.total_revenue - r.total_purchases)}</div></div>
          <div class="stat-card silver"><div class="stat-label">Gold Sold</div><div class="stat-value mono">${fmtD(r.total_gold_grams)}g</div></div>
        </div>
      </div>
    `;
  } catch (e) {
    preview.innerHTML = `<div class="alert error"><span class="alert-icon">⚠</span><span>${e.message}</span></div>`;
  }
}

window.loadReports = loadReports;
window.loadDailyReport = loadDailyReport;
window.loadSummaryReport = loadSummaryReport;
