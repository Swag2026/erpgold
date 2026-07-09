/**
 * auth.js — handles login, logout, session persistence, and role-based UI visibility
 */

const AUTH_KEY = 'sg_auth';

const Auth = {
  user: null,
  token: null,

  init() {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        const { token, user } = JSON.parse(stored);
        this.token = token;
        this.user = user;
        api.setToken(token);
        return true;
      } catch { this.clear(); }
    }
    return false;
  },

  save(token, user) {
    this.token = token;
    this.user = user;
    api.setToken(token);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
  },

  clear() {
    this.token = null;
    this.user = null;
    api.clearToken();
    localStorage.removeItem(AUTH_KEY);
  },

  get role() { return this.user?.role || ''; },
  get fullName() { return this.user?.full_name || ''; },
  get isAdmin() { return this.role === 'admin'; },
  get isSupervisor() { return this.role === 'supervisor'; },
  get isCashier() { return this.role === 'cashier'; },
  get canEdit() { return !this.isCashier; },
  get canAccessAnalytics() { return !this.isCashier; },
  get canAccessSettings() { return this.isAdmin; },
};

// ── UI visibility helpers ──
function applyRoleVisibility() {
  // Elements requiring a specific minimum role
  document.querySelectorAll('[data-role]').forEach(el => {
    const required = el.dataset.role.split(',').map(s => s.trim());
    el.style.display = required.includes(Auth.role) ? '' : 'none';
  });
  // Elements hidden for cashiers
  document.querySelectorAll('[data-hide-cashier]').forEach(el => {
    el.style.display = Auth.isCashier ? 'none' : '';
  });
  // Nav items
  document.querySelectorAll('[data-nav-role]').forEach(el => {
    const required = el.dataset.navRole.split(',').map(s => s.trim());
    el.style.display = required.includes(Auth.role) ? '' : 'none';
  });
}

// ── Login flow ──
async function doLogin(username, password) {
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const result = await api.login(username, password);
    Auth.save(result.access_token, {
      id: result.user_id,
      username: result.username,
      full_name: result.full_name,
      role: result.role,
    });
    showApp();
  } catch (e) {
    errEl.textContent = e.message || 'Login failed. Check credentials.';
  }
}

function doLogout() {
  Auth.clear();
  location.reload();
}

window.Auth = Auth;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.applyRoleVisibility = applyRoleVisibility;
