/**
 * app.js — main application controller: navigation, initialization, utilities
 */

// ── Utility functions ──
const fmt  = (n) => Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (n, d = 3) => Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc  = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const CAT_LABELS = {
  sale: 'Sale',
  purchase_jewelry: 'Purchase Jewelry',
  purchase_scrap: 'Purchase Scrap',
  supplier_payment: 'Supplier Payment',
  expense: 'Expense',
};

const KARAT_COLORS = {
  24: '#E8C45A',
  21: '#C9A227',
  18: '#A9822E',
  S:  '#B9C2C7',
};

function calcConv21(inv) {
  return (inv.weight_21k || 0)
    + (inv.weight_18k || 0) * (18/21)
    + (inv.weight_24k || 0) * (24/21);
}

function fmtDT(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ── Toast ──
let _toastTimer;
function toast(msg, duration = 3600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ── Navigation ──
let _currentView = null;

function navigate(viewId) {
  if (_currentView === viewId) return;
  _currentView = viewId;

  // Update sections
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${viewId}`));
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === viewId));

  // Load view data
  const loaders = {
    dashboard:   loadDashboard,
    entry:       loadEntryView,
    history:     loadHistory,
    activity:    loadActivityLog,
    analytics:   loadAnalytics,
    reports:     loadReports,
    contacts:    loadContacts,
    profit:      loadProfitCalculator,
    settings:    loadSettings,
  };
  if (loaders[viewId]) loaders[viewId]();
}

// ── App init ──
async function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').classList.add('active');

  // Populate user info in sidebar
  document.getElementById('sidebarUserName').textContent = Auth.fullName;
  document.getElementById('sidebarUserRole').textContent = Auth.role.toUpperCase();
  document.getElementById('sidebarUserInitials').textContent = Auth.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  applyRoleVisibility();
  navigate('dashboard');
}

// ── Theme toggle ──
function toggleTheme() {
  const sw = document.getElementById('themeSwitch');
  const isLight = document.documentElement.dataset.theme === 'light';
  if (isLight) {
    delete document.documentElement.dataset.theme;
    sw.classList.remove('on');
  } else {
    document.documentElement.dataset.theme = 'light';
    sw.classList.add('on');
  }
}

// ── Modal helpers ──
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) closeAllModals(); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
  });
});

// ── Entry point ──
document.addEventListener('DOMContentLoaded', async () => {
  const loggedIn = Auth.init();
  if (loggedIn) {
    // Verify token still valid
    try {
      const me = await api.me();
      Auth.user = { ...Auth.user, ...me };
      showApp();
    } catch {
      Auth.clear();
    }
  }
  // Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    await doLogin(username, password);
  });
});

window.navigate = navigate;
window.toast = toast;
window.fmt = fmt;
window.fmtD = fmtD;
window.esc = esc;
window.CAT_LABELS = CAT_LABELS;
window.KARAT_COLORS = KARAT_COLORS;
window.calcConv21 = calcConv21;
window.fmtDT = fmtDT;
window.openModal = openModal;
window.closeModal = closeModal;
window.closeAllModals = closeAllModals;
window.toggleTheme = toggleTheme;
