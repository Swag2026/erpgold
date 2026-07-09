/**
 * profit.js — Profit Calculator: cost rates per gram and margin table
 */

let _costRates = {};
let _saleInvoices = [];

async function loadProfitCalculator() {
  try {
    const [rates, invoices] = await Promise.all([
      api.getCostRates(),
      api.getInvoices({ limit: 500 }),
    ]);

    // Map rates by purity
    _costRates = {};
    rates.forEach(r => { _costRates[r.purity] = r; });
    _saleInvoices = invoices.filter(i => i.category === 'sale' && i.status === 'active');

    // Populate inputs
    ['21K','18K','24K','Silver'].forEach(p => {
      const input = document.getElementById('costRate' + p.replace('K','').replace('Silver','S'));
      if (input && _costRates[p]) input.value = _costRates[p].cost_per_gram;
    });

    renderProfitTable();
  } catch (e) {
    toast('Profit calculator load failed: ' + e.message);
  }
}

function renderProfitTable() {
  const r21 = parseFloat(document.getElementById('costRate21')?.value) || 0;
  const r18 = parseFloat(document.getElementById('costRate18')?.value) || 0;
  const r24 = parseFloat(document.getElementById('costRate24')?.value) || 0;
  const rS  = parseFloat(document.getElementById('costRateS')?.value) || 0;

  // Update sub-labels
  if (r21) document.getElementById('costRate21Sub').textContent = 'Cost: SAR ' + fmt(r21) + '/g';
  if (r18) document.getElementById('costRate18Sub').textContent = 'Cost: SAR ' + fmt(r18) + '/g';
  if (r24) document.getElementById('costRate24Sub').textContent = 'Cost: SAR ' + fmt(r24) + '/g';
  if (rS)  document.getElementById('costRateSub').textContent   = 'Cost: SAR ' + fmt(rS) + '/g';

  const hasAnyRate = r21 || r18 || r24 || rS;
  let totRev = 0, totCost = 0, totProfit = 0, rows = 0;

  const tbody = document.getElementById('profitTableBody');
  if (!tbody) return;

  if (!_saleInvoices.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--cream-dim);padding:30px;">No active sale invoices found.</td></tr>';
    return;
  }

  tbody.innerHTML = _saleInvoices.map(inv => {
    const revenue = inv.total_amount || 0;
    const cost    = (inv.weight_21k || 0) * r21
                  + (inv.weight_18k || 0) * r18
                  + (inv.weight_24k || 0) * r24
                  + (inv.weight_silver || 0) * rS;
    const profit  = hasAnyRate ? revenue - cost : null;
    const margin  = (hasAnyRate && cost > 0) ? (profit / cost * 100) : null;

    if (profit !== null) { totRev += revenue; totCost += cost; totProfit += profit; rows++; }

    const pctClass = profit === null ? 'na' : profit >= 0 ? 'pos' : 'neg';
    const pctText  = margin !== null ? fmtD(margin, 1) + '%' : '—';

    return `<tr>
      <td class="mono" style="color:var(--gold-24);">${esc(inv.invoice_no)}</td>
      <td>${esc(inv.invoice_date)}</td>
      <td>${esc(inv.contact_name || '—')}</td>
      <td class="mono">${inv.weight_21k ? fmtD(inv.weight_21k) : '—'}</td>
      <td class="mono">${inv.weight_18k ? fmtD(inv.weight_18k) : '—'}</td>
      <td class="mono">${inv.weight_24k ? fmtD(inv.weight_24k) : '—'}</td>
      <td class="mono" style="font-weight:700;">SAR ${fmt(revenue)}</td>
      <td class="mono" style="color:var(--cream-dim);">${hasAnyRate ? 'SAR ' + fmt(cost) : '—'}</td>
      <td class="mono" style="font-weight:700;color:${profit !== null && profit >= 0 ? '#7FBF9B' : '#D68E7A'};">${profit !== null ? 'SAR ' + fmt(profit) : '—'}</td>
      <td><span class="profit-pct ${pctClass}">${pctText}</span></td>
    </tr>`;
  }).join('');

  // Footer
  const foot = document.getElementById('profitTableFoot');
  if (foot && rows && hasAnyRate) {
    const avgMargin = totCost > 0 ? (totProfit / totCost * 100) : null;
    foot.innerHTML = `<tr style="font-weight:700;background:var(--surface-2);">
      <td colspan="6">Totals</td>
      <td class="mono">SAR ${fmt(totRev)}</td>
      <td class="mono">SAR ${fmt(totCost)}</td>
      <td class="mono" style="color:${totProfit >= 0 ? '#7FBF9B' : '#D68E7A'};">SAR ${fmt(totProfit)}</td>
      <td><span class="profit-pct ${totProfit >= 0 ? 'pos' : 'neg'}">${avgMargin !== null ? fmtD(avgMargin, 1) + '%' : '—'}</span></td>
    </tr>`;
  } else if (foot) { foot.innerHTML = ''; }
}

async function saveProfitRates() {
  const r21 = parseFloat(document.getElementById('costRate21')?.value) || 0;
  const r18 = parseFloat(document.getElementById('costRate18')?.value) || 0;
  const r24 = parseFloat(document.getElementById('costRate24')?.value) || 0;
  const rS  = parseFloat(document.getElementById('costRateS')?.value) || 0;

  try {
    const updates = [
      { purity: '21K', cost_per_gram: r21 },
      { purity: '18K', cost_per_gram: r18 },
      { purity: '24K', cost_per_gram: r24 },
      { purity: 'Silver', cost_per_gram: rS },
    ];
    for (const u of updates) {
      const existing = _costRates[u.purity];
      if (existing) {
        await api.updateCostRate(existing.id, { cost_per_gram: u.cost_per_gram });
      } else {
        await api.createCostRate(u);
      }
    }
    toast('Cost rates saved successfully.');
  } catch (e) {
    toast('Failed to save rates: ' + e.message);
  }
}

window.loadProfitCalculator = loadProfitCalculator;
window.renderProfitTable = renderProfitTable;
window.saveProfitRates = saveProfitRates;
