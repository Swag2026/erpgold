/**
 * contacts.js — Contacts Directory
 */

let _contactsList = [];
let _editingContactId = null;

async function loadContacts() {
  const grid = document.getElementById('contactsGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading contacts…</div>';
  try {
    _contactsList = await api.getContacts();
    renderContacts();
  } catch (e) {
    grid.innerHTML = `<div class="contact-empty">Failed to load: ${e.message}</div>`;
  }
}

function renderContacts() {
  const search   = (document.getElementById('contactSearch')?.value || '').toLowerCase();
  const typeF    = document.getElementById('contactTypeFilter')?.value || 'all';

  const filtered = _contactsList.filter(c => {
    if (typeF !== 'all' && c.contact_type !== typeF) return false;
    if (search && !c.name.toLowerCase().includes(search) && !(c.phone || '').includes(search)) return false;
    return true;
  });

  const grid = document.getElementById('contactsGrid');
  if (!filtered.length) { grid.innerHTML = '<div class="contact-empty">No contacts found.</div>'; return; }

  grid.innerHTML = filtered.map(c => {
    const initials = c.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const isSupplier = c.contact_type === 'supplier';
    return `
      <div class="contact-card" onclick="openContactDetail(${c.id})">
        <div class="contact-card-top">
          <div class="contact-avatar${isSupplier ? ' supplier' : ''}">${initials}</div>
          <div>
            <div class="contact-name">${esc(c.name)}</div>
            <div class="contact-type-label">${(c.phone || '')} ${c.contact_type ? '· ' + c.contact_type.toUpperCase() : ''}</div>
          </div>
        </div>
        <div class="contact-stats-row">
          <div class="contact-stat"><div class="cs-label">Invoices</div><div class="cs-value">${c.total_invoices}</div></div>
          <div class="contact-stat"><div class="cs-label">Total</div><div class="cs-value">SAR ${fmt(c.total_amount)}</div></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:6px;align-items:center;justify-content:space-between;">
          <span class="contact-tag ${c.contact_type}">${c.contact_type}</span>
          ${Auth.canEdit ? `<button class="icon-btn small" onclick="event.stopPropagation();openEditContact(${c.id})" title="Edit">✎</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openContactDetail(id) {
  const c = _contactsList.find(x => x.id === id);
  if (!c) return;
  document.getElementById('contactDetailContent').innerHTML = `
    <div class="detail-row"><span class="detail-label">Name</span><span class="detail-val">${esc(c.name)}</span></div>
    <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-val">${esc(c.phone || '—')}</span></div>
    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-val">${esc(c.email || '—')}</span></div>
    <div class="detail-row"><span class="detail-label">Type</span><span class="detail-val">${esc(c.contact_type)}</span></div>
    <div class="detail-row"><span class="detail-label">Total Invoices</span><span class="detail-val">${c.total_invoices}</span></div>
    <div class="detail-row"><span class="detail-label">Total Amount</span><span class="detail-val">SAR ${fmt(c.total_amount)}</span></div>
    ${c.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-val">${esc(c.notes)}</span></div>` : ''}
  `;
  openModal('contactDetailModal');
}

function openContactModal(id = null) {
  _editingContactId = id;
  const existing = id ? _contactsList.find(c => c.id === id) : null;
  document.getElementById('contactModalTitle').textContent = id ? 'Edit Contact' : 'New Contact';
  document.getElementById('cName').value  = existing?.name  || '';
  document.getElementById('cPhone').value = existing?.phone || '';
  document.getElementById('cEmail').value = existing?.email || '';
  document.getElementById('cType').value  = existing?.contact_type || 'customer';
  document.getElementById('cNotes').value = existing?.notes || '';
  document.getElementById('contactFormError').textContent = '';
  openModal('contactModal');
}

function openEditContact(id) {
  openContactModal(id);
}

async function saveContact() {
  const name  = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const type  = document.getElementById('cType').value;
  const notes = document.getElementById('cNotes').value.trim();
  const errEl = document.getElementById('contactFormError');
  errEl.textContent = '';

  if (!name) { errEl.textContent = 'Name is required.'; return; }

  const payload = { name, phone, email, contact_type: type, notes };
  try {
    if (_editingContactId) {
      await api.updateContact(_editingContactId, payload);
      toast('Contact updated.');
    } else {
      await api.createContact(payload);
      toast('Contact added.');
    }
    closeAllModals();
    loadContacts();
  } catch (e) {
    errEl.textContent = e.message;
  }
}

window.loadContacts = loadContacts;
window.renderContacts = renderContacts;
window.openContactModal = openContactModal;
window.openEditContact = openEditContact;
window.openContactDetail = openContactDetail;
window.saveContact = saveContact;
