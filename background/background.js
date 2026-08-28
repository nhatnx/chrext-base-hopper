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

// ── Re-login ─────────────────────────────────────────────────────────────────
// Re-authenticating one stale account without disturbing the others: wipe only
// the browser's live Supabase state, log in, then write the result back into
// that same account record (keeping its name, colour and access token).

const SIGN_IN_URL = 'https://supabase.com/dashboard/sign-in';
const RELOGIN_TIMEOUT_MS = 30 * 60 * 1000;

// An abandoned re-login shouldn't capture a session half an hour later
async function getPendingRelogin() {
  const { pendingRelogin } = await chrome.storage.local.get('pendingRelogin');
  if (!pendingRelogin) return null;
  if (Date.now() - (pendingRelogin.startedAt || 0) > RELOGIN_TIMEOUT_MS) {
    await chrome.storage.local.set({ pendingRelogin: null });
    await setReloginBadge(false);
    return null;
  }
  return pendingRelogin;
}

function hasLiveAuth(lsEntries) {
  for (const raw of Object.values(lsEntries || {})) {
    try {
      const val = JSON.parse(raw);
      const session = val?.currentSession || val;
      if (session?.refresh_token) return true;
    } catch { /* not a JSON auth entry */ }
  }
  return false;
}

async function captureSession(tabId) {
  const [cookies, lsEntries] = await Promise.all([
    getSupabaseCookies(),
    getAuthStorage(tabId),
  ]);
  return { cookies, lsEntries };
}

async function updateAccount(accountId, patch) {
  const { accounts = [] } = await chrome.storage.local.get('accounts');
  const updated = accounts.map(a => (a.id === accountId ? { ...a, ...patch } : a));
  await chrome.storage.local.set({ accounts: updated });
  return updated.find(a => a.id === accountId) || null;
}

async function setReloginBadge(on) {
  try {
    await chrome.action.setBadgeText({ text: on ? '•' : '' });
    if (on) await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  } catch { /* action API unavailable */ }
}

async function findSupabaseTab() {
  const tabs = await chrome.tabs.query({ url: ['https://supabase.com/*', 'https://*.supabase.com/*'] });
  return tabs[0] || null;
}

function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise(resolve => {
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(ok);
    };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish(true); };
    const timer = setTimeout(() => finish(false), timeout);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function startRelogin(accountId, tabId) {
  const { accounts = [], activeAccountId } = await chrome.storage.local.get(['accounts', 'activeAccountId']);
  const account = accounts.find(a => a.id === accountId);
  if (!account) return { success: false, error: 'Account not found' };

  // Don't lose the account that is logged in right now
  if (activeAccountId && activeAccountId !== accountId) {
    const snapshot = await captureSession(tabId);
    if (hasLiveAuth(snapshot.lsEntries)) {
      await updateAccount(activeAccountId, { ...snapshot, lastSaved: Date.now() });
    }
  }

  // Clearing localStorage needs a supabase.com tab — that's where the session lives
  let tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  if (!tab?.url?.includes('supabase.com')) tab = await findSupabaseTab();
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    // The content script can only answer once the page has finished loading
    if (tab.status !== 'complete') await waitForTabLoad(tab.id);
  } else {
    tab = await chrome.tabs.create({ url: SIGN_IN_URL, active: true });
    await waitForTabLoad(tab.id);
  }

  await clearSupabaseCookies();
  await setAuthStorage(tab.id, {});

  await chrome.storage.local.set({
    activeAccountId: accountId,
    pendingRelogin: { accountId, name: account.name, email: account.email || '', startedAt: Date.now() },
    reloginResult: null,
  });
  await setReloginBadge(true);

  // Land on a clean sign-in page now that cookies and localStorage are gone
  await chrome.tabs.update(tab.id, { url: SIGN_IN_URL });
  try { await chrome.windows.update(tab.windowId, { focused: true }); } catch { /* no window */ }

  return { success: true, tabId: tab.id };
}

async function finishRelogin(tabId) {
  const pendingRelogin = await getPendingRelogin();
  if (!pendingRelogin) return { success: false, error: 'No re-login in progress' };

  const snapshot = await captureSession(tabId);
  if (!hasLiveAuth(snapshot.lsEntries)) return { success: false, error: 'NOT_LOGGED_IN' };

  let email = '';
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'GET_CURRENT_USER' });
    email = resp?.email || '';
  } catch { /* content script not reachable */ }

  // Refuse to write someone else's session into this account
  const expected = (pendingRelogin.email || '').toLowerCase();
  if (expected && email && email.toLowerCase() !== expected) {
    return { success: false, error: 'EMAIL_MISMATCH', email, expected: pendingRelogin.email };
  }

  const account = await updateAccount(pendingRelogin.accountId, {
    ...snapshot,
    email: email || pendingRelogin.email,
    lastSaved: Date.now(),
  });

  await chrome.storage.local.set({
    activeAccountId: pendingRelogin.accountId,
    pendingRelogin: null,
    reloginResult: { ok: true, accountId: pendingRelogin.accountId, name: account?.name || '', at: Date.now() },
  });
  await setReloginBadge(false);

  return { success: true, account };
}

async function cancelRelogin() {
  await chrome.storage.local.set({ pendingRelogin: null });
  await setReloginBadge(false);
  return { success: true };
}

// Supabase redirects away from /sign-in once login succeeds — capture it there.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.includes('supabase.com')) return;
  if (tab.url.includes('/sign-in') || tab.url.includes('/sign-up')) return;

  if (!await getPendingRelogin()) return;

  const res = await finishRelogin(tabId);
  if (res.success) {
    console.log('[BaseHopper] Re-login captured for', res.account?.name);
  } else if (res.error === 'EMAIL_MISMATCH') {
    // Logged in as somebody else — leave the stored account untouched
    await chrome.storage.local.set({
      pendingRelogin: null,
      reloginResult: { ok: false, error: 'EMAIL_MISMATCH', email: res.email, expected: res.expected, at: Date.now() },
    });
    await setReloginBadge(false);
  }
  // NOT_LOGGED_IN: still on the way through the login flow, keep waiting
});

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

  // Switching elsewhere abandons any re-login that was waiting on this browser state
  const { pendingRelogin } = await chrome.storage.local.get('pendingRelogin');
  if (pendingRelogin && pendingRelogin.accountId !== accountId) await cancelRelogin();

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
// `prune` drops bookkeeping for projects missing from `projects` — only safe
// when `projects` is the account's full list, not a single refreshed project.
async function trackPausedProjects(accountId, projects, { prune = true } = {}) {
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
  if (prune) {
    for (const key of Object.keys(pausedSince)) {
      if (key.startsWith(prefix) && !seen.has(key)) { delete pausedSince[key]; changed = true; }
    }
  }

  if (changed) await chrome.storage.local.set({ pausedSince });
  return pausedSince;
}

function enrichProject(project, orgs) {
  const org = orgs[project.organization_id];
  return {
    ...project,
    organization_name: org?.name || '',
    plan: project.plan || org?.plan || '',
  };
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
          const { activeAccountId } = await chrome.storage.local.get('activeAccountId');
          if (!activeAccountId) { sendResponse({ success: false, error: 'No active account' }); break; }
          const snapshot = await captureSession(message.tabId);
          const patch = { cookies: snapshot.cookies, lastSaved: Date.now() };
          // Only overwrite the stored session when we actually read one back
          if (hasLiveAuth(snapshot.lsEntries)) patch.lsEntries = snapshot.lsEntries;
          await updateAccount(activeAccountId, patch);
          sendResponse({ success: true, capturedSession: !!patch.lsEntries });
          break;
        }

        case 'RELOGIN_ACCOUNT': {
          sendResponse(await startRelogin(message.accountId, message.tabId));
          break;
        }
        case 'FINISH_RELOGIN': {
          const tab = message.tabId
            ? await chrome.tabs.get(message.tabId).catch(() => null)
            : await findSupabaseTab();
          if (!tab) { sendResponse({ success: false, error: 'Open supabase.com first' }); break; }
          sendResponse(await finishRelogin(tab.id));
          break;
        }
        case 'CANCEL_RELOGIN': {
          sendResponse(await cancelRelogin());
          break;
        }
        case 'GET_RELOGIN_STATE': {
          const pendingRelogin = await getPendingRelogin();
          const { reloginResult = null } = await chrome.storage.local.get('reloginResult');
          // Results are consumed once, by whichever surface asks first
          if (reloginResult) await chrome.storage.local.set({ reloginResult: null });
          sendResponse({ success: true, pendingRelogin, reloginResult });
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
          const pausedSince = await trackPausedProjects(message.accountId, projects);

          sendResponse({
            success: true,
            projects: projects.map(p => enrichProject(p, orgs)),
            pausedSince,
            graceDays: PAUSE_GRACE_DAYS,
          });
          break;
        }

        case 'MGMT_GET_PROJECT': {
          const account = await getAccount(message.accountId);
          if (!account) { sendResponse({ success: false, error: 'Account not found' }); break; }
          if (!account.accessToken) { sendResponse({ success: false, error: 'NO_TOKEN' }); break; }

          // /projects/{ref} is not served by every API version — fall back to the list
          let res = await mgmtFetch(account.accessToken, `/projects/${message.projectRef}`);
          if (res.status === 401 || res.status === 403) { sendResponse({ success: false, error: 'BAD_TOKEN' }); break; }

          let project = res.ok && res.body && typeof res.body === 'object' ? res.body : null;
          if (!project) {
            res = await mgmtFetch(account.accessToken, '/projects');
            if (res.status === 401 || res.status === 403) { sendResponse({ success: false, error: 'BAD_TOKEN' }); break; }
            if (!res.ok) { sendResponse({ success: false, error: mgmtError(res) }); break; }
            const list = Array.isArray(res.body) ? res.body : [];
            project = list.find(p => (p.id || p.ref) === message.projectRef) || null;
          }
          if (!project) { sendResponse({ success: false, error: 'Project not found' }); break; }

          const orgs = await listOrganizations(account.accessToken);
          const pausedSince = await trackPausedProjects(message.accountId, [project], { prune: false });

          sendResponse({
            success: true,
            project: enrichProject(project, orgs),
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
