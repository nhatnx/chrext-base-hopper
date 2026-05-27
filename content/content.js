// Content script — runs on supabase.com

(function () {
  function tryGetEmail() {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') || key.includes('sb-')) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if (val?.user?.email) return val.user.email;
          if (val?.email) return val.email;
          if (val?.currentSession?.user?.email) return val.currentSession.user.email;
        } catch {}
      }
    }
    const emailEl = document.querySelector('[data-testid="user-email"]') ||
      document.querySelector('.user-email') ||
      document.querySelector('[aria-label*="email"]');
    if (emailEl) return emailEl.textContent?.trim();
    return null;
  }

  function getAuthStorage() {
    const entries = {};
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') || key.startsWith('sb-')) {
        entries[key] = localStorage.getItem(key);
      }
    }
    return entries;
  }

  function setAuthStorage(entries) {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') || key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    }
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CURRENT_USER') {
      sendResponse({ email: tryGetEmail() });
    } else if (message.type === 'GET_AUTH_STORAGE') {
      sendResponse({ entries: getAuthStorage() });
    } else if (message.type === 'SET_AUTH_STORAGE') {
      setAuthStorage(message.entries || {});
      sendResponse({ success: true });
    }
  });
})();
