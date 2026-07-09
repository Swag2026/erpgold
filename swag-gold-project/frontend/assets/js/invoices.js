/**
 * invoices.js — New Entry form, History table, and invoice detail/edit/cancel
 */

// ─── Entry Form ──────────────────────────────────────────────────────────────
let _entryCategory = 'sale';
let _editingInvoiceId = null;
let _contacts = [];

async function loadEntryView() {
  _editingInvoiceId = null;
  setEntryCategory('sale');
  resetEntryForm();
  document.getElementById('entryFormTitle').textContent = 'New Entry';
  document.getElementById('btnSaveEntry').textContent = '✓ Save Entry';

  // Load contacts for dropdown
  try {
    _contacts = await api.getContacts();
    populateContactDropdown();
  } catch { /* silent */ }

  // Set default date to today
  document.getElementById('fDate').value = new Date().toISOString().slice(0, 10);
  generateInvoiceNo();
}

async function generateInvoiceNo() {
  try {
    const invoices = await api.getInvoices({ limit: 1 });
    // Simple sequential: SG-{count+1}
  } catch { /* silent */ }
  const ts = Date.now().toString().slice(-6);
  document.getElementById('fInvoiceNo').value = `SG-${ts}`;
}

function populateContactDropdown() {
  const sel = document.getElementById('fContact');
  if (!sel) return;
  sel.innerHTML = '<option value="">— No contact —</option>' +
    _contacts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

function setEntryCategory(cat) {
  _entryCategory = cat;
  document.querySelectorAll('[data-cat-btn]').forEach(btn => {
    btn.classList.toggle('gold', btn.dataset.catBtn === cat);
  });
  const usesKarats = ['sale', 'purchase_jewelry', 'purchase_scrap'].includes(cat);
  document.getElementById('karatSection').style.display = usesKarats ? '' : 'none';
  document.getElementById('descriptionSection').style.display = usesKarats ? 'none' : '';
  recalcEntry();
}

function recalcEntry() {
  const w21 = parseFloat(document.getElementById('w21').value) || 0;
  const r21 = parseFloat(document.getElementById('r21').value) || 0;
  const w18 = parseFloat(document.getElementById('w18').value) || 0;
  const r18 = parseFloat(document.getElementById('r18').value) || 0;
  const w24 = parseFloat(document.getElementById('w24').value) || 0;
  const r24 = parseFloat(document.getElementById('r24').value) || 0;
  const wS  = parseFloat(document.getElementById('wS').value)  || 0;
  const rS  = parseFloat(document.getElementById('rS').value)  || 0;

  const a21 = w21 * r21, a18 = w18 * r18, a24 = w24 * r24, aS = wS * rS;
  document.getElementById('t21').textContent = 'SAR ' + fmt(a21);
  document.getElementById('t18').textContent = 'SAR ' + fmt(a18);
  document.getElementById('t24').textContent = 'SAR ' + fmt(a24);
  document.getElementById('tS').textContent  = 'SAR ' + fmt(aS);

  const usesKarats = ['sale', 'purchase_jewelry', 'purchase_scrap'].includes(_entryCategory);
  let total = 0;
  if (usesKarats) {
    total = a21 + a18 + a24 + aS;
  } else {
    total = parseFloat(document.getElementById('fDirectAmount').value) || 0;
  }

  document.getElementById('entryTotal').textContent = 'SAR ' + fmt(total);
  return { w21, r21, a21, w18, r18, a18, w24, r24, a24, wS, rS, aS, total };
}

function resetEntryForm() {
  ['w21','r21','w18','r18','w24','r24','wS','rS'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['t21','t18','t24','tS'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'SAR 0.00';
  });
  const fields = ['fInvoiceNo','fDate','fNote','fDirectAmount','fDescription','fCash','fCard'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('entryTotal').textContent = 'SAR 0.00';
  document.getElementById('entryError').textContent = '';
}

async function submitEntry() {
  const errEl = document.getElementById('entryError');
  errEl.textContent = '';

  const calc = recalcEntry();
  const invoice_no = document.getElementById('fInvoiceNo').value.trim();
  const invoice_date = document.getElementById('fDate').value;
  const contact_id = document.getElementById('fContact')?.value || null;
  const cash_amount = parseFloat(document.getElementById('fCash').value) || 0;
  const card_amount = parseFloat(document.getElementById('fCard').value) || 0;
  const note = document.getElementById('fNote').value.trim();

  if (!invoice_no) { errEl.textContent = 'Invoice number is required.'; return; }
  if (!invoice_date) { errEl.textContent = 'Date is required.'; return; }

  const usesKarats = ['sale', 'purchase_jewelry', 'purchase_scrap'].includes(_entryCategory);
  let total_amount = usesKarats ? calc.total : (parseFloat(document.getElementById('fDirectAmount').value) || 0);

  if (total_amount <= 0) { errEl.textContent = 'Amount must be greater than zero.'; return; }

  const payload = {
    invoice_no,
    invoice_date,
    category: _entryCategory,
    contact_id: contact_id ? parseInt(contact_id) : null,
    weight_21k: calc.w21,
    weight_18k: calc.w18,
    weight_24k: calc.w24,
    weight_silver: calc.wS,
    amount_21k: calc.a21,
    amount_18k: calc.a18,
    amount_24k: calc.a24,
    amount_silver: calc.aS,
    cash_amount,
    card_amount,
    total_amount,
    note,
    description: document.getElementById('fDescription')?.value?.trim() || '',
  };

  try {
    const btn = document.getElementById('btnSaveEntry');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    if (_editingInvoiceId) {
      // Supervisor must supply note
      if (Auth.isSupervisor && !note) { errEl.textContent = 'A note is required when editing.'; btn.disabled = false; btn.textContent = '✓ Save Entry'; return; }
      await api.updateInvoice(_editingInvoiceId, payload);
      toast('Invoice updated successfully.');
    } else {
      await api.createInvoice(payload);
      toast('Invoice saved successfully.');
    }

    btn.disabled = false;
    btn.textContent = '✓ Save Entry';
    resetEntryForm();
    generateInvoiceNo();
    _editingInvoiceId = null;
    document.getElementById('entryFormTitle').textContent = 'New Entry';
  } catch (e) {
    errEl.textContent = e.message;
    document.getElementById('btnSaveEntry').disabled = false;
    document.getElementById('btnSaveEntry').textContent = '✓ Save Entry';
  }
}

// ─── History ──────────────────────────────────────────────────────────────────
let _histInvoices = [];

async function loadHistory() {
  const wrap = document.getElementById('historyBody');
  wrap.innerHTML = '<tr><td colspan="15"><div class="loading"><div class="spinner"></div>Loading…</div></td></tr>';
  try {
    _histInvoices = await api.getInvoices({ limit: 500 });
    renderHistoryTable();
  } catch (e) {
    wrap.innerHTML = `<tr><td colspan="15" style="color:var(--red);padding:20px;">${e.message}</td></tr>`;
  }
}

function renderHistoryTable() {
  const search  = (document.getElementById('histSearch')?.value || '').toLowerCase();
  const catF    = document.getElementById('histCatFilter')?.value || 'all';
  const statusF = document.getElementById('histStatusFilter')?.value || 'all';
  const dateF   = document.getElementById('histDateFilter')?.value || '';

  const filtered = _histInvoices.filter(inv => {
    if (catF !== 'all' && inv.category !== catF) return false;
    if (statusF !== 'all' && inv.status !== statusF) return false;
    if (dateF && inv.invoice_date !== dateF) return false;
    if (search && !inv.invoice_no.toLowerCase().includes(search) &&
        !(inv.contact_name || '').toLowerCase().includes(search)) return false;
    return true;
  });

  const canAct = Auth.canEdit;

  const rows = filtered.map(inv => {
    const conv = calcConv21(inv);
    const catLabel = CAT_LABELS[inv.category] || inv.category;
    return `<tr>
      <td class="mono" style="color:var(--gold-24);">${esc(inv.invoice_no)}</td>
      <td>${esc(inv.invoice_date)}</td>
      <td><span class="cat-tag cat-${inv.category}">${catLabel}</span></td>
      <td>${esc(inv.contact_name || '—')}</td>
      <td class="mono">${inv.weight_21k ? fmtD(inv.weight_21k) + 'g' : '—'}</td>
      <td class="mono">${inv.weight_18k ? fmtD(inv.weight_18k) + 'g' : '—'}</td>
      <td class="mono">${inv.weight_24k ? fmtD(inv.weight_24k) + 'g' : '—'}</td>
      <td class="mono">${inv.weight_silver ? fmtD(inv.weight_silver) + 'g' : '—'}</td>
      <td class="mono">${fmtD(conv, 2)}</td>
      <td class="mono" style="font-weight:700;color:var(--cream);">SAR ${fmt(inv.total_amount)}</td>
      <td class="mono">${inv.cash_amount ? 'SAR ' + fmt(inv.cash_amount) : '—'}</td>
      <td class="mono">${inv.card_amount ? 'SAR ' + fmt(inv.card_amount) : '—'}</td>
      <td><span class="tag status-${inv.status}">${inv.status === 'active' ? 'Active' : 'Canceled'}</span></td>
      <td>${inv.validity === 'Edited' ? '<span class="tag valid-edited">Edited</span>' : '—'}</td>
      <td>
        <div style="display:flex;gap:4px;">
          <button class="icon-btn" title="View Detail" onclick="openInvoiceDetail(${inv.id})">⊕</button>
          ${canAct ? `<button class="icon-btn" title="Edit" onclick="startEditInvoice(${inv.id})">✎</button>` : ''}
          ${canAct && inv.status !== 'canceled' ? `<button class="icon-btn del" title="Cancel" onclick="confirmCancel(${inv.id})">✕</button>` : ''}
        </div>
      </td>
    </tr>`;
  });

  document.getElementById('historyBody').innerHTML = rows.join('') ||
    '<tr><td colspan="15" style="text-align:center;color:var(--cream-dim);padding:40px;">No entries match filters.</td></tr>';

  // Footer totals
  const active = filtered.filter(i => i.status === 'active');
  const totW21 = active.reduce((s,i) => s + (i.weight_21k || 0), 0);
  const totW18 = active.reduce((s,i) => s + (i.weight_18k || 0), 0);
  const totW24 = active.reduce((s,i) => s + (i.weight_24k || 0), 0);
  const totWS  = active.reduce((s,i) => s + (i.weight_silver || 0), 0);
  const totAmt = active.reduce((s,i) => s + (i.total_amount || 0), 0);
  const totCash= active.reduce((s,i) => s + (i.cash_amount || 0), 0);
  const totCard= active.reduce((s,i) => s + (i.card_amount || 0), 0);
  const totConv= active.reduce((s,i) => s + calcConv21(i), 0);

  document.getElementById('historyFoot').innerHTML = active.length ? `<tr>
    <td colspan="4" style="font-weight:700;color:var(--cream);">Totals (${active.length} active)</td>
    <td class="mono">${fmtD(totW21)}g</td>
    <td class="mono">${fmtD(totW18)}g</td>
    <td class="mono">${fmtD(totW24)}g</td>
    <td class="mono">${fmtD(totWS)}g</td>
    <td class="mono">${fmtD(totConv, 2)}</td>
    <td class="mono" style="font-weight:700;">SAR ${fmt(totAmt)}</td>
    <td class="mono">SAR ${fmt(totCash)}</td>
    <td class="mono">SAR ${fmt(totCard)}</td>
    <td colspan="3"></td>
  </tr>` : '';
}

// ─── Invoice Detail Modal ─────────────────────────────────────────────────────
async function openInvoiceDetail(id) {
  const inv = _histInvoices.find(i => i.id === id) || await api.getInvoice(id);
  if (!inv) { toast('Invoice not found.'); return; }

  document.getElementById('detailContent').innerHTML = `
    ${dRow('Invoice #', inv.invoice_no)}
    ${dRow('Date', inv.invoice_date)}
    ${dRow('Category', CAT_LABELS[inv.category] || inv.category)}
    ${dRow('Contact', inv.contact_name || '—')}
    ${inv.weight_21k ? dRow('21K Weight', fmtD(inv.weight_21k) + ' g') : ''}
    ${inv.weight_21k ? dRow('21K Amount', 'SAR ' + fmt(inv.amount_21k)) : ''}
    ${inv.weight_18k ? dRow('18K Weight', fmtD(inv.weight_18k) + ' g') : ''}
    ${inv.weight_18k ? dRow('18K Amount', 'SAR ' + fmt(inv.amount_18k)) : ''}
    ${inv.weight_24k ? dRow('24K Weight', fmtD(inv.weight_24k) + ' g') : ''}
    ${inv.weight_24k ? dRow('24K Amount', 'SAR ' + fmt(inv.amount_24k)) : ''}
    ${inv.weight_silver ? dRow('Silver Weight', fmtD(inv.weight_silver) + ' g') : ''}
    ${inv.weight_silver ? dRow('Silver Amount', 'SAR ' + fmt(inv.amount_silver)) : ''}
    ${dRow('Cash', 'SAR ' + fmt(inv.cash_amount))}
    ${dRow('Card / Transfer', 'SAR ' + fmt(inv.card_amount))}
    ${dRow('Total', 'SAR ' + fmt(inv.total_amount))}
    ${dRow('Status', inv.status.toUpperCase())}
    ${dRow('Validity', inv.validity)}
    ${inv.note ? dRow('Note', inv.note) : ''}
    ${dRow('Created By', inv.created_by_name || '—')}
    ${inv.updated_by_name ? dRow('Updated By', inv.updated_by_name) : ''}
  `;
  openModal('detailModal');
}

function dRow(label, val) {
  return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-val">${esc(String(val))}</span></div>`;
}

// ─── Edit Invoice ─────────────────────────────────────────────────────────────
async function startEditInvoice(id) {
  if (!Auth.canEdit) { toast('You do not have permission to edit invoices.'); return; }
  const inv = _histInvoices.find(i => i.id === id) || await api.getInvoice(id);
  if (!inv) { toast('Invoice not found.'); return; }

  _editingInvoiceId = id;
  navigate('entry');

  setTimeout(() => {
    document.getElementById('entryFormTitle').textContent = 'Edit Invoice — ' + inv.invoice_no;
    document.getElementById('btnSaveEntry').textContent = '✓ Update Invoice';
    setEntryCategory(inv.category);

    document.getElementById('fInvoiceNo').value = inv.invoice_no;
    document.getElementById('fDate').value = inv.invoice_date;
    document.getElementById('fCash').value = inv.cash_amount || '';
    document.getElementById('fCard').value = inv.card_amount || '';
    document.getElementById('fNote').value = inv.note || '';

    if (inv.weight_21k) { document.getElementById('w21').value = inv.weight_21k; document.getElementById('r21').value = inv.weight_21k ? (inv.amount_21k / inv.weight_21k).toFixed(2) : ''; }
    if (inv.weight_18k) { document.getElementById('w18').value = inv.weight_18k; document.getElementById('r18').value = inv.weight_18k ? (inv.amount_18k / inv.weight_18k).toFixed(2) : ''; }
    if (inv.weight_24k) { document.getElementById('w24').value = inv.weight_24k; document.getElementById('r24').value = inv.weight_24k ? (inv.amount_24k / inv.weight_24k).toFixed(2) : ''; }
    if (inv.weight_silver) { document.getElementById('wS').value = inv.weight_silver; document.getElementById('rS').value = inv.weight_silver ? (inv.amount_silver / inv.weight_silver).toFixed(2) : ''; }

    if (inv.contact_id) document.getElementById('fContact').value = inv.contact_id;
    recalcEntry();
  }, 100);
}

// ─── Cancel Invoice ───────────────────────────────────────────────────────────
let _cancelTargetId = null;

function confirmCancel(id) {
  if (!Auth.canEdit) { toast('Insufficient permissions.'); return; }
  _cancelTargetId = id;
  const inv = _histInvoices.find(i => i.id === id);
  document.getElementById('cancelInvRef').textContent = inv ? inv.invoice_no : id;
  document.getElementById('cancelNote').value = '';
  document.getElementById('cancelNoteWrap').style.display = Auth.isSupervisor ? '' : 'none';
  openModal('cancelModal');
}

async function doCancel() {
  if (!_cancelTargetId) return;
  const note = document.getElementById('cancelNote').value.trim();
  if (Auth.isSupervisor && !note) { toast('Note is required for supervisors.'); return; }
  try {
    await api.cancelInvoice(_cancelTargetId, note);
    closeAllModals();
    toast('Invoice canceled.');
    _cancelTargetId = null;
    loadHistory();
  } catch (e) {
    toast('Cancel failed: ' + e.message);
  }
}

window.loadEntryView = loadEntryView;
window.setEntryCategory = setEntryCategory;
window.recalcEntry = recalcEntry;
window.submitEntry = submitEntry;
window.loadHistory = loadHistory;
window.renderHistoryTable = renderHistoryTable;
window.openInvoiceDetail = openInvoiceDetail;
window.startEditInvoice = startEditInvoice;
window.confirmCancel = confirmCancel;
window.doCancel = doCancel;
