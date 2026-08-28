// Background service worker for BaseHopper

const SUPABASE_DOMAIN = 'supabase.com';
const SUPABASE_DASHBOARD = 'https://supabase.com/dashboard/projects';
const MGMT_API = 'https://api.supabase.com/v1';

async function getSupabaseCookies() {
  return chrome.cookies.getAll({ domain: SUPABASE_DOMAIN });
}

async function clearSupabaseCookies() {
  const cookies = await getSupabaseCookies();
  await Promise.all(cookies.map(cookie => {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return chrome.cookies.remove({ url: `https://${domain}${cookie.path}`, name: cookie.name });
  }));
}

async function restoreCookies(savedCookies) {
  await Promise.all(savedCookies.map(cookie => {
    const domain = cookie.domain
      ? (cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain)
      : SUPABASE_DOMAIN;
    const cookieDetails = {
      url: `https://${domain}${cookie.path}`,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
    };
    if (cookie.expirationDate) cookieDetails.expirationDate = cookie.expirationDate;
    if (cookie.domain) cookieDetails.domain = domain;
    return chrome.cookies.set(cookieDetails).catch(e => {
      console.warn('[BaseHopper] Could not set cookie:', cookie.name, e.message);
    });
  }));
}

async function getAuthStorage(tabId) {
  if (!tabId) return {};
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'GET_AUTH_STORAGE' });
    return resp?.entries || {};
  } catch {
    return {};
  }
}

async function setAuthStorage(tabId, entries) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SET_AUTH_STORAGE', entries });
  } catch (e) {
    console.warn('[BaseHopper] Could not set localStorage:', e.message);
  }
}

async function switchToAccount(accountId, tabId) {
  const { accounts = [] } = await chrome.storage.local.get('accounts');
  const account = accounts.find(a => a.id === accountId);
  if (!account) return { success: false, error: 'Account not found' };

  // Auto-save current account's latest state before switching
  const { activeAccountId } = await chrome.storage.local.get('activeAccountId');
  if (activeAccountId && activeAccountId !== accountId) {
    const [currentCookies, currentLs] = await Promise.all([
      getSupabaseCookies(),
      getAuthStorage(tabId),
    ]);
    const updatedAccounts = accounts.map(a =>
      a.id === activeAccountId
        ? { ...a, cookies: currentCookies, lsEntries: currentLs, lastSaved: Date.now() }
        : a
    );
    await chrome.storage.local.set({ accounts: updatedAccounts });
  }

  // Swap cookies
  await clearSupabaseCookies();
  if (account.cookies?.length > 0) await restoreCookies(account.cookies);

  // Swap localStorage auth entries (this is where the real session lives)
  await setAuthStorage(tabId, account.lsEntries || {});

  await chrome.storage.local.set({ activeAccountId: accountId });
  return { success: true };
}

async function saveCurrentSession(name, email, tabId) {
  const [cookies, lsEntries] = await Promise.all([
    getSupabaseCookies(),
    getAuthStorage(tabId),
  ]);

  console.log('[BaseHopper] Saving session — ls keys:', Object.keys(lsEntries));

  const { accounts = [] } = await chrome.storage.local.get('accounts');
  const newAccount = {
    id: `account_${Date.now()}`,
    name,
    email,
    cookies,
    lsEntries,
    createdAt: Date.now(),
    lastSaved: Date.now(),
    avatar: name.charAt(0).toUpperCase(),
  };

  await chrome.storage.local.set({
    accounts: [...accounts, newAccount],
    activeAccountId: newAccount.id,
  });

  return { success: true, account: newAccount };
}

// ── Management API helpers ───────────────────────────────────────────────────

// Supabase deletes a paused project's data after this many days.
const PAUSE_GRACE_DAYS = 90;

async function getAccount(accountId) {
  const { accounts = [] } = await chrome.storage.local.get('accounts');
  return accounts.find(a => a.id === accountId) || null;
}

async function mgmtFetch(token, path, opts = {}) {
  const res = await fetch(`${MGMT_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { ok: res.ok, status: res.status, body };
}

function mgmtError(res) {
  if (res.body && typeof res.body === 'object' && res.body.message) return res.body.message;
  if (typeof res.body === 'string' && res.body.length < 120) return res.body;
  return `API ${res.status}`;
}

function isPausedStatus(status) {
  const st = String(status || '').toUpperCase();
  return st === 'INACTIVE' || st.includes('PAUS') || st === 'GOING_DOWN' || st === 'RESTORE_FAILED';
}

// The Management API does not expose when a project was paused, so we remember
// the first time we saw it paused and use that to estimate the 90-day deadline.
async function trackPausedProjects(accountId, projects) {
  const { pausedSince = {} } = await chrome.storage.local.get('pausedSince');
  const prefix = `${accountId}:`;
  const now = Date.now();
  const seen = new Set();
  let changed = false;

  for (const project of projects) {
    const ref = project.id || project.ref;
    if (!ref) continue;
    const key = prefix + ref;
    seen.add(key);
    if (isPausedStatus(project.status)) {
      if (!pausedSince[key]) { pausedSince[key] = now; changed = true; }
    } else if (pausedSince[key]) {
      delete pausedSince[key];
      changed = true;
    }
  }

  // Forget projects that no longer exist in this account
  for (const key of Object.keys(pausedSince)) {
    if (key.startsWith(prefix) && !seen.has(key)) { delete pausedSince[key]; changed = true; }
  }

  if (changed) await chrome.storage.local.set({ pausedSince });
  return pausedSince;
}

// Org name / plan are not part of /projects — fetch them separately, best effort.
async function listOrganizations(token) {
  try {
    const res = await mgmtFetch(token, '/organizations');
    if (!res.ok || !Array.isArray(res.body)) return {};
    return Object.fromEntries(res.body.map(org => [org.id, org]));
  } catch {
    return {};
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_ACCOUNTS': {
          const data = await chrome.storage.local.get(['accounts', 'activeAccountId']);
          sendResponse({ success: true, ...data });
          break;
        }
        case 'SAVE_SESSION': {
          const result = await saveCurrentSession(message.name, message.email, message.tabId);
          sendResponse(result);
          break;
        }
        case 'SWITCH_ACCOUNT': {
          const result = await switchToAccount(message.accountId, message.tabId);
          sendResponse(result);
          break;
        }
        case 'DELETE_ACCOUNT': {
          const { accounts = [], activeAccountId } = await chrome.storage.local.get(['accounts', 'activeAccountId']);
          const updated = accounts.filter(a => a.id !== message.accountId);
          const updates = { accounts: updated };
          if (activeAccountId === message.accountId) updates.activeAccountId = null;
          await chrome.storage.local.set(updates);
          // Drop the paused-project bookkeeping for this account
          const { pausedSince = {} } = await chrome.storage.local.get('pausedSince');
          const prefix = `${message.accountId}:`;
          const kept = Object.fromEntries(Object.entries(pausedSince).filter(([k]) => !k.startsWith(prefix)));
          await chrome.storage.local.set({ pausedSince: kept });
          sendResponse({ success: true });
          break;
        }
        case 'UPDATE_CURRENT_COOKIES': {
          const { accounts = [], activeAccountId } = await chrome.storage.local.get(['accounts', 'activeAccountId']);
          if (!activeAccountId) { sendResponse({ success: false }); break; }
          const currentCookies = await getSupabaseCookies();
          const updated = accounts.map(a =>
            a.id === activeAccountId ? { ...a, cookies: currentCookies, lastSaved: Date.now() } : a
          );
          await chrome.storage.local.set({ accounts: updated });
          sendResponse({ success: true });
          break;
        }
        case 'GET_CURRENT_COOKIES': {
          const cookies = await getSupabaseCookies();
          sendResponse({ success: true, cookies, count: cookies.length });
          break;
        }

        case 'OPEN_DASHBOARD': {
          const url = chrome.runtime.getURL('dashboard/dashboard.html');
          // Focus existing dashboard tab if one is open
          const tabs = await chrome.tabs.query({ url });
          if (tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { active: true });
            await chrome.windows.update(tabs[0].windowId, { focused: true });
          } else {
            await chrome.tabs.create({ url });
          }
          sendResponse({ success: true });
          break;
        }

        // ── Management API ────────────────────────────────────────
        case 'UPDATE_ACCOUNT': {
          const { accounts = [] } = await chrome.storage.local.get('accounts');
          const index = accounts.findIndex(a => a.id === message.accountId);
          if (index === -1) { sendResponse({ success: false, error: 'Account not found' }); break; }
          const patch = {};
          if (message.accessToken !== undefined) patch.accessToken = message.accessToken.trim();
          if (message.name !== undefined) patch.name = message.name;
          if (message.email !== undefined) patch.email = message.email;
          const updated = accounts.map((a, i) => (i === index ? { ...a, ...patch } : a));
          await chrome.storage.local.set({ accounts: updated });
          sendResponse({ success: true, account: updated[index] });
          break;
        }

        case 'MGMT_LIST_PROJECTS': {
          const account = await getAccount(message.accountId);
          if (!account) { sendResponse({ success: false, error: 'Account not found' }); break; }
          if (!account.accessToken) { sendResponse({ success: false, error: 'NO_TOKEN' }); break; }

          const res = await mgmtFetch(account.accessToken, '/projects');
          if (res.status === 401 || res.status === 403) { sendResponse({ success: false, error: 'BAD_TOKEN' }); break; }
          if (!res.ok) { sendResponse({ success: false, error: mgmtError(res) }); break; }

          const projects = Array.isArray(res.body) ? res.body : [];
          const orgs = await listOrganizations(account.accessToken);
          const enriched = projects.map(p => ({
            ...p,
            organization_name: orgs[p.organization_id]?.name || '',
            plan: p.plan || orgs[p.organization_id]?.plan || '',
          }));
          const pausedSince = await trackPausedProjects(message.accountId, projects);

          sendResponse({
            success: true,
            projects: enriched,
            pausedSince,
            graceDays: PAUSE_GRACE_DAYS,
          });
          break;
        }

        case 'MGMT_RESUME_PROJECT': {
          const account = await getAccount(message.accountId);
          if (!account?.accessToken) { sendResponse({ success: false, error: 'NO_TOKEN' }); break; }
          const res = await mgmtFetch(account.accessToken, `/projects/${message.projectRef}/restore`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
          if (res.status === 401 || res.status === 403) { sendResponse({ success: false, error: 'BAD_TOKEN' }); break; }
          if (!res.ok) { sendResponse({ success: false, error: mgmtError(res) }); break; }
          sendResponse({ success: true });
          break;
        }

        case 'MGMT_PAUSE_PROJECT': {
          const account = await getAccount(message.accountId);
          if (!account?.accessToken) { sendResponse({ success: false, error: 'NO_TOKEN' }); break; }
          const res = await mgmtFetch(account.accessToken, `/projects/${message.projectRef}/pause`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
          if (res.status === 401 || res.status === 403) { sendResponse({ success: false, error: 'BAD_TOKEN' }); break; }
          if (!res.ok) { sendResponse({ success: false, error: mgmtError(res) }); break; }
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('[BaseHopper] Background error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true;
});
