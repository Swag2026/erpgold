/**
 * api.js — centralized API client for Swag Gold backend
 * All fetch() calls go through here. Auth token injected automatically.
 *
 * FIX: Removed hardcoded Railway URL. Now uses window.API_BASE if set,
 *      otherwise falls back to relative '/api' so it works on any host
 *      (Netlify, Railway, localhost) without code changes.
 */

const API_BASE = window.API_BASE || '/api';

const api = {
  _token: null,

  setToken(token) { this._token = token; },
  clearToken() { this._token = null; },

  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  },

  async _request(method, path, body = null, opts = {}) {
    const options = {
      method,
      headers: this._headers(opts.headers || {}),
    };
    if (body !== null) options.body = JSON.stringify(body);
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    const resp = await fetch(url, options);
    if (resp.status === 204) return null;
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = data?.detail || `HTTP ${resp.status}`;
      throw new Error(Array.isArray(msg) ? msg.map(e => e.msg).join('; ') : msg);
    }
    return data;
  },

  get: (path, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''))
    ).toString();
    return api._request('GET', qs ? `${path}?${qs}` : path);
  },
  post:   (path, body) => api._request('POST',   path, body),
  put:    (path, body) => api._request('PUT',    path, body),
  delete: (path)       => api._request('DELETE', path),

  // ── Auth ──
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: ()                       => api.get('/auth/me'),

  // ── Contacts ──
  getContacts:    (p = {}) => api.get('/contacts', p),
  createContact:  (d)      => api.post('/contacts', d),
  updateContact:  (id, d)  => api._request('PUT', `/contacts/${id}`, d),
  deleteContact:  (id)     => api.delete(`/contacts/${id}`),

  // ── Invoices ──
  getInvoices:    (p = {}) => api.get('/invoices', p),
  getInvoice:     (id)     => api.get(`/invoices/${id}`),
  createInvoice:  (d)      => api.post('/invoices', d),
  updateInvoice:  (id, d)  => api._request('PUT', `/invoices/${id}`, d),
  cancelInvoice:  (id, note) => api.post(`/invoices/${id}/cancel`, { note }),

  // ── Analytics ──
  getSummary:         () => api.get('/analytics/summary'),
  getDailyRevenue:    () => api.get('/analytics/daily-revenue'),
  getKaratBreakdown:  () => api.get('/analytics/karat-breakdown'),
  getCashVsCard:      () => api.get('/analytics/cash-vs-card'),
  getSalesVsPurchases:() => api.get('/analytics/sales-vs-purchases'),

  // ── Cost Rates ──
  getCostRates:    () => api.get('/cost-rates'),
  createCostRate:  (d) => api.post('/cost-rates', d),
  updateCostRate:  (id, d) => api._request('PUT', `/cost-rates/${id}`, d),

  // ── Activity Logs ──
  getActivityLogs: (p = {}) => api.get('/activity-logs', p),

  // ── Reports ──
  getDailyReport:   (date) => api.get('/reports/daily', { report_date: date }),
  getSummaryReport: (p = {}) => api.get('/reports/summary', p),

  // ── Settings ──
  getSettings:    () => api.get('/settings'),
  updateSettings: (d) => api._request('PUT', '/settings', { settings: d }),

  // ── Backup ──
  exportBackup: async () => {
    const resp = await fetch(`${API_BASE}/backup/export`, {
      headers: api._headers(),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || 'Backup failed'); }
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'swag-gold-backup.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ── Health ──
  health: () => api.get('/health'),
};

window.api = api;
