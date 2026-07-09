/**
 * settings.js — Application settings, backup/restore, and activity log
 */

async function loadSettings() {
  if (!Auth.canAccessSettings) {
    document.getElementById('settingsContent').innerHTML = '<div class="alert error"><span class="alert-icon">⛔</span><span>Settings access is restricted to Admin role only.</span></div>';
    return;
  }
  try {
    const settings = await api.getSettings();
    settings.forEach(s => {
      const el = document.getElementById('setting_' + s.key);
      if (el) el.value = s.value || '';
    });
  } catch { /* ignore if no settings yet */ }
}

async function saveSettings() {
  const keys = ['exhibition_name', 'currency', 'tax_rate'];
  const payload = {};
  keys.forEach(k => {
    const el = document.getElementById('setting_' + k);
    if (el) payload[k] = el.value;
  });
  try {
    await api.updateSettings(payload);
    toast('Settings saved.');
  } catch (e) {
    toast('Failed to save settings: ' + e.message);
  }
}

function downloadBackup() {
  api.exportBackup();
  toast('Backup download started.');
}

async function loadActivityLog() {
  const wrap = document.getElementById('activityList');
  if (!wrap) return;
  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';

  try {
    const typeF   = document.getElementById('actTypeFilter')?.value || 'all';
    const search  = document.getElementById('actSearch')?.value || '';
    const logs = await api.getActivityLogs({ action_type: typeF !== 'all' ? typeF : undefined, search: search || undefined, limit: 300 });

    const ICONS  = { add: '+', edit: '✎', cancel: '✕' };
    const LABELS = { add: 'added', edit: 'edited', cancel: 'canceled' };

    // Stats
    const adds    = logs.filter(l => l.action_type === 'add').length;
    const edits   = logs.filter(l => l.action_type === 'edit').length;
    const cancels = logs.filter(l => l.action_type === 'cancel').length;

    document.getElementById('actStats').innerHTML = `
      <div class="act-stat-pills">
        <div class="act-stat-pill">Total <span class="pill-val">${logs.length}</span> actions</div>
        <div class="act-stat-pill" style="border-color:rgba(62,112,85,.4);">Added <span class="pill-val" style="color:#7FBF9B;">${adds}</span></div>
        <div class="act-stat-pill" style="border-color:rgba(169,130,46,.4);">Edited <span class="pill-val" style="color:#E0BE7E;">${edits}</span></div>
        <div class="act-stat-pill" style="border-color:rgba(181,83,61,.4);">Canceled <span class="pill-val" style="color:#D68E7A;">${cancels}</span></div>
      </div>
    `;

    if (!logs.length) {
      wrap.innerHTML = '<div style="color:var(--cream-dim);padding:40px;text-align:center;">No activity matches the current filters.</div>';
      return;
    }

    wrap.innerHTML = logs.map(l => `
      <div class="activity-item">
        <div class="act-icon ${l.action_type}">${ICONS[l.action_type] || '·'}</div>
        <div class="act-body">
          <div class="act-title">
            <span class="act-user">${esc(l.user_name || 'Unknown')}</span> ${LABELS[l.action_type] || l.action_type}
            <span class="act-inv"> ${esc(CAT_LABELS[l.category] || l.category || '')} #${esc(l.invoice_ref || '—')}</span>
            &nbsp;<span style="color:var(--cream-dim);font-weight:400;">(SAR ${fmt(l.amount)})</span>
          </div>
          <div class="act-meta">
            <span>${esc((l.user_role || '').toUpperCase())}</span>
            <span style="opacity:.4;">·</span>
            <span>${fmtDT(l.timestamp)}</span>
          </div>
          ${l.note ? `<div class="act-note">${esc(l.note)}</div>` : ''}
        </div>
        <div class="act-time">
          ${new Date(l.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}<br>
          ${new Date(l.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    `).join('');
  } catch (e) {
    wrap.innerHTML = `<div style="color:var(--red);padding:20px;">${e.message}</div>`;
  }
}

window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.downloadBackup = downloadBackup;
window.loadActivityLog = loadActivityLog;
