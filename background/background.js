// Background service worker for BaseHopper

const SUPABASE_DOMAIN = 'supabase.com';

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
