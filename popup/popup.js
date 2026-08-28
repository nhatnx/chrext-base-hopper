// popup.js — BaseHopper UI logic

let accounts = [];
let activeAccountId = null;
let isOnSupabase = false;
let currentTabId = null;
let toastTimer = null;

const $ = id => document.getElementById(id);

// DOM refs
const accountList = $('account-list');
const emptyState = $('empty-state');
const formPanel = $('form-panel');
const footer = $('footer');
const addBtn = $('add-btn');
const saveBtn = $('save-btn');
const cancelBtn = $('cancel-btn');
const refreshBtn = $('refresh-btn');
const dashboardBtn = $('dashboard-btn');
const nameInput = $('account-name');
const emailInput = $('account-email');
const toast = $('toast');
const infoBar = $('info-bar');
const infoText = $('info-text');
const reloginBar = $('relogin-bar');
const reloginText = $('relogin-text');
const reloginDone = $('relogin-done');
const reloginCancel = $('relogin-cancel');

// --- Helpers ---
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} visible`;
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2200);
}

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// --- Check if current tab is supabase.com ---
async function checkCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('supabase.com')) {
    isOnSupabase = true;
    currentTabId = tab.id;
    infoBar.style.display = 'none';

    // Try to auto-detect email
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_USER' });
      if (resp?.email) {
        emailInput.value = resp.email;
        const parts = resp.email.split('@');
        if (!nameInput.value) nameInput.value = parts[0];
      }
    } catch { }
  } else {
    isOnSupabase = false;
    currentTabId = null;
    infoBar.style.display = 'flex';
    infoText.textContent = 'Navigate to supabase.com to use switcher';
  }
}

// --- Account color palette ---
const COLOR_PALETTE = [
  { color: '#3ecf8e', bg: '#3ecf8e22', border: '#3ecf8e55' },
  { color: '#60a5fa', bg: '#60a5fa22', border: '#60a5fa55' },
  { color: '#a78bfa', bg: '#a78bfa22', border: '#a78bfa55' },
  { color: '#fb923c', bg: '#fb923c22', border: '#fb923c55' },
  { color: '#f472b6', bg: '#f472b622', border: '#f472b655' },
  { color: '#22d3ee', bg: '#22d3ee22', border: '#22d3ee55' },
  { color: '#facc15', bg: '#facc1522', border: '#facc1555' },
];

function getAccountColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

// --- Render accounts ---
function renderAccounts() {
  // Remove all account items (keep empty state)
  const items = accountList.querySelectorAll('.account-item');
  items.forEach(el => el.remove());

  if (accounts.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  accounts.forEach(account => {
    const isActive = account.id === activeAccountId;
    const ac = getAccountColor(account.id);
    const item = document.createElement('div');
    item.className = `account-item ${isActive ? 'active' : ''}`;
    item.dataset.id = account.id;
    if (isActive) {
      item.style.background = ac.bg;
      item.style.borderColor = ac.color + '88';
    }
    const accountEmail = `${escHtml(account.email || 'No email')} · Saved ${formatDate(account.lastSaved)}`;
    const session = BaseHopperSession.info(account);
    const reloginChip = session.live
      ? ''
      : `<button class="relogin-chip" data-id="${account.id}" title="${escHtml(session.label)} — log in again without touching your other accounts">Re-login</button>`;

    item.innerHTML = `
      <div class="avatar" style="background: linear-gradient(135deg, ${ac.bg}, ${ac.border}); border-color: ${ac.border}; color: ${ac.color};">${account.avatar || account.name.charAt(0).toUpperCase()}</div>
      <div class="account-info">
        <div class="account-name">${escHtml(account.name)}</div>
        <div class="account-email" title="${accountEmail}">${accountEmail}</div>
      </div>
      ${reloginChip}
      ${isActive
        ? `<span class="active-badge" style="color: ${ac.color}; background: ${ac.bg}; border-color: ${ac.color}44;">Active</span>`
        : `<div class="account-actions">
            <button class="action-btn switch-btn" title="Switch to this account" data-id="${account.id}">
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="action-btn delete delete-btn" title="Remove account" data-id="${account.id}">
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6 4.5V3h4v1.5M6.5 7v4.5M9.5 7v4.5M4.5 4.5l.5 8h6l.5-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>`
      }
    `;

    accountList.appendChild(item);
  });

  // Attach events
  accountList.querySelectorAll('.switch-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!isOnSupabase) {
        showToast('Please open supabase.com first', 'error');
        return;
      }
      btn.innerHTML = '<span class="saving-dot"></span>';
      btn.disabled = true;

      const res = await send({ type: 'SWITCH_ACCOUNT', accountId: id, tabId: currentTabId });
      if (res.success) {
        activeAccountId = id;
        renderAccounts();
        showToast('Switched! Reloading…');
        setTimeout(() => {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab) chrome.tabs.reload(tab.id);
          });
        }, 600);
      } else {
        showToast('Switch failed: ' + (res.error || 'Unknown'), 'error');
        await loadAccounts();
      }
    });
  });

  accountList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const account = accounts.find(a => a.id === id);
      if (!confirm(`Remove "${account?.name}"?`)) return;
      const res = await send({ type: 'DELETE_ACCOUNT', accountId: id });
      if (res.success) {
        await loadAccounts();
        showToast('Account removed');
      }
    });
  });

  accountList.querySelectorAll('.relogin-chip').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await startRelogin(btn.dataset.id);
    });
  });
}

// --- Re-login one stale account, leaving the others alone ---
async function startRelogin(accountId) {
  const account = accounts.find(a => a.id === accountId);
  const res = await send({ type: 'RELOGIN_ACCOUNT', accountId, tabId: currentTabId });
  if (!res?.success) {
    showToast('Could not start re-login: ' + (res?.error || 'unknown error'), 'error');
    return;
  }
  // The user now works in the sign-in tab; the bar is waiting when they return
  showReloginBar({ accountId, name: account?.name, email: account?.email });
  window.close();
}

function showReloginBar(pending) {
  if (!pending) { reloginBar.style.display = 'none'; return; }
  reloginText.textContent = `Log in as ${pending.email || pending.name} on supabase.com`;
  reloginBar.style.display = 'flex';
}

async function checkReloginState() {
  const res = await send({ type: 'GET_RELOGIN_STATE' });
  showReloginBar(res?.pendingRelogin);

  const result = res?.reloginResult;
  if (!result) return;
  if (result.ok) {
    showToast(`"${result.name}" re-logged in`);
  } else if (result.error === 'EMAIL_MISMATCH') {
    showToast(`Logged in as ${result.email}, expected ${result.expected}`, 'error');
  }
}

reloginDone.addEventListener('click', async () => {
  const res = await send({ type: 'FINISH_RELOGIN', tabId: currentTabId });
  if (res?.success) {
    showReloginBar(null);
    await loadAccounts();
    showToast(`"${res.account?.name}" re-logged in`);
  } else if (res?.error === 'NOT_LOGGED_IN') {
    showToast('No session found — finish logging in first', 'error');
  } else if (res?.error === 'EMAIL_MISMATCH') {
    showToast(`Logged in as ${res.email}, expected ${res.expected}`, 'error');
  } else {
    showToast(res?.error || 'Could not capture session', 'error');
  }
});

reloginCancel.addEventListener('click', async () => {
  await send({ type: 'CANCEL_RELOGIN' });
  showReloginBar(null);
  showToast('Re-login cancelled');
});

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Load accounts from storage ---
async function loadAccounts() {
  const res = await send({ type: 'GET_ACCOUNTS' });
  accounts = res.accounts || [];
  activeAccountId = res.activeAccountId || null;
  renderAccounts();
}

// --- Show/hide form ---
function showForm() {
  formPanel.classList.add('visible');
  footer.style.display = 'none';
  nameInput.focus();
}

function hideForm() {
  formPanel.classList.remove('visible');
  footer.style.display = 'flex';
  nameInput.value = '';
  emailInput.value = '';
}

// --- Save session ---
async function handleSave() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    showToast('Please enter a name', 'error');
    return;
  }

  if (!isOnSupabase) {
    showToast('Open supabase.com first', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="saving-dot"></span> Saving…';

  const email = emailInput.value.trim();
  const res = await send({ type: 'SAVE_SESSION', name, email, tabId: currentTabId });

  if (res.success) {
    await loadAccounts();
    hideForm();
    showToast(`"${name}" saved!`);
  } else {
    showToast('Save failed: ' + (res.error || 'Unknown'), 'error');
  }

  saveBtn.disabled = false;
  saveBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5L6 12L13.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Save';
}

// --- Refresh/sync current cookies for active account ---
async function handleRefresh() {
  if (!isOnSupabase) {
    showToast('Open supabase.com first', 'error');
    return;
  }
  refreshBtn.style.opacity = '0.4';
  const res = await send({ type: 'UPDATE_CURRENT_COOKIES', tabId: currentTabId });
  refreshBtn.style.opacity = '';
  if (res.success) {
    await loadAccounts();
    showToast('Session synced');
  } else {
    showToast('No active account to sync', 'error');
  }
}

// --- Events ---
addBtn.addEventListener('click', showForm);
cancelBtn.addEventListener('click', hideForm);
refreshBtn.addEventListener('click', handleRefresh);
saveBtn.addEventListener('click', handleSave);
dashboardBtn.addEventListener('click', async () => {
  await send({ type: 'OPEN_DASHBOARD' });
  window.close();
});
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSave(); });
emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSave(); });

// --- Init ---
(async () => {
  await checkCurrentTab();
  await checkReloginState();
  await loadAccounts();
})();
