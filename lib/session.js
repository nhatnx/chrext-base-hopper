// lib/session.js — shared session-freshness heuristic, loaded by popup + dashboard.
// Supabase access tokens live ~1h, so an expired access token means nothing on its
// own; what matters is whether we still hold a refresh token that was seen recently.
(function (global) {
  const DAY = 86400000;
  const SESSION_WINDOW_DAYS = 30;

  function readAuth(account) {
    let hasRefresh = false;
    let accessExpiresAt = 0;

    for (const raw of Object.values(account.lsEntries || {})) {
      try {
        const val = JSON.parse(raw);
        const session = val?.currentSession || val;
        if (session?.refresh_token) hasRefresh = true;
        if (typeof session?.expires_at === 'number') {
          accessExpiresAt = Math.max(accessExpiresAt, session.expires_at * 1000);
        }
      } catch { /* not a JSON auth entry */ }
    }
    return { hasRefresh, accessExpiresAt };
  }

  // Returns { live, label, lastSeen }
  function info(account) {
    const { hasRefresh, accessExpiresAt } = readAuth(account);

    if (!hasRefresh && !(account.cookies || []).length) {
      return { live: false, label: 'No session saved', lastSeen: 0 };
    }

    const now = Date.now();
    if (accessExpiresAt > now) return { live: true, label: 'Session live', lastSeen: now };

    const lastSeen = Math.max(accessExpiresAt, account.lastSaved || account.createdAt || 0);
    const live = hasRefresh && (now - lastSeen) < SESSION_WINDOW_DAYS * DAY;
    return { live, label: live ? 'Session live' : 'Session expired', lastSeen };
  }

  global.BaseHopperSession = { info, SESSION_WINDOW_DAYS, DAY };
})(self);
