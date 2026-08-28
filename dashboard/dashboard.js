// dashboard.js — BaseHopper full-page dashboard

let accounts = [];
let dataByAccount = {};   // { accountId: { status: 'loading'|'ok'|'no_token'|'bad_token'|'error', projects, pausedSince, error } }
let currentFilter = 'all';
let toastTimer = null;

const GRACE_DAYS = 90;          // Supabase deletes a paused project's data after 90 days
const URGENT_DAYS = 30;         // show the ⚠ when this little time is left
const SESSION_WINDOW_DAYS = 30; // a saved session older than this needs a re-login
const DAY = 86400000;

const SIGN_IN_URL = 'https://supabase.com/dashboard/sign-in';
const TOKENS_URL = 'https://supabase.com/dashboard/account/tokens';
const BACKUP_DOCS_URL = 'https://supabase.com/docs/guides/platform/backups';

const $ = id => document.getElementById(id);
const main = $('main');
const toast = $('toast');

function send(msg) { return chrome.runtime.sendMessage(msg); }

function openTab(url) { chrome.tabs.create({ url }); }

function showToast(msg, type = 'ok') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  toastTimer = setTimeout(() => toast.className = 'toast', 2800);
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hexAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

// ── Account colors — same palette/hash as the popup, so avatars match ─────────
const COLOR_PALETTE = ['#3ecf8e', '#60a5fa', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee', '#facc15'];

function accountColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

// ── Session freshness ────────────────────────────────────────────────────────
// Supabase access tokens live ~1h, so an expired one means nothing on its own —
// what matters is whether we still hold a refresh token that was seen recently.
function sessionInfo(account) {
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

  if (!hasRefresh && !(account.cookies || []).length) {
    return { live: false, label: 'No session saved' };
  }

  const now = Date.now();
  if (accessExpiresAt > now) return { live: true, label: 'Session live' };

  const lastSeen = Math.max(accessExpiresAt, account.lastSaved || account.createdAt || 0);
  const live = hasRefresh && (now - lastSeen) < SESSION_WINDOW_DAYS * DAY;
  return {
    live,
    label: live ? 'Session live' : 'Session expired',
    lastSeen,
  };
}

// ── Project status ───────────────────────────────────────────────────────────
// Management API statuses: ACTIVE_HEALTHY, ACTIVE_UNHEALTHY, INACTIVE, PAUSING,
// COMING_UP, GOING_DOWN, RESTORING, RESTARTING, UPGRADING, RESTORE_FAILED, UNKNOWN
const PENDING_STATUSES = ['COMING_UP', 'RESTORING', 'RESTARTING', 'UPGRADING', 'PAUSING', 'GOING_DOWN'];

const STATUS_LABELS = {
  ACTIVE_HEALTHY: 'Active',
  ACTIVE_UNHEALTHY: 'Unhealthy',
  COMING_UP: 'Starting…',
  RESTORING: 'Restoring…',
  RESTARTING: 'Restarting…',
  UPGRADING: 'Upgrading…',
  PAUSING: 'Pausing…',
  GOING_DOWN: 'Stopping…',
  INACTIVE: 'Paused',
  PAUSED: 'Paused',
  RESTORE_FAILED: 'Restore failed',
  UNKNOWN: 'Unknown',
};

function projectRef(project) { return project.id || project.ref || ''; }

// Returns { state, label, pending, daysPaused, daysLeft }
function classify(accountId, project, pausedSince) {
  const raw = String(project.status || '').toUpperCase();
  const label = STATUS_LABELS[raw] || (raw.includes('PAUS') ? 'Paused' : 'Active');
  const pending = PENDING_STATUSES.includes(raw);

  const isPaused = raw === 'INACTIVE' || raw.includes('PAUS') || raw === 'GOING_DOWN' || raw === 'RESTORE_FAILED';
  if (!isPaused) return { state: 'active', label, pending };

  const since = pausedSince?.[`${accountId}:${projectRef(project)}`];
  const daysPaused = since ? Math.floor((Date.now() - since) / DAY) : null;
  const daysLeft = daysPaused === null ? null : Math.max(GRACE_DAYS - daysPaused, 0);

  // Past the grace period Supabase no longer restores in place — backup only.
  if (daysLeft === 0) return { state: 'inactive', label: 'Inactive', pending, daysPaused, daysLeft };
  return { state: 'paused', label, pending, daysPaused, daysLeft };
}

function pausedMeta(info) {
  if (info.daysPaused === null) {
    return 'Paused · deadline unknown';
  }
  const pausedText = info.daysPaused === 0 ? 'Paused today' : `Paused ${plural(info.daysPaused, 'day')} ago`;
  const urgent = info.daysLeft <= URGENT_DAYS;
  const leftText = `${info.daysLeft} days left${urgent ? ' ⚠' : ''}`;
  return `${esc(pausedText)} · <span class="${urgent ? 'warn-text' : ''}">${esc(leftText)}</span>`;
}

// ── Load ─────────────────────────────────────────────────────────────────────

async function loadAccounts() {
  const res = await send({ type: 'GET_ACCOUNTS' });
  accounts = res?.accounts || [];
}

async function loadProjects(accountId) {
  const res = await send({ type: 'MGMT_LIST_PROJECTS', accountId });
  if (res?.success) {
    dataByAccount[accountId] = {
      status: 'ok',
      projects: res.projects || [],
      pausedSince: res.pausedSince || {},
    };
  } else if (res?.error === 'NO_TOKEN') {
    dataByAccount[accountId] = { status: 'no_token', projects: [] };
  } else if (res?.error === 'BAD_TOKEN') {
    dataByAccount[accountId] = { status: 'bad_token', projects: [] };
  } else {
    dataByAccount[accountId] = { status: 'error', error: res?.error || 'Request failed', projects: [] };
  }
}

async function loadAll() {
  await loadAccounts();
  if (accounts.length === 0) { render(); return; }
  for (const account of accounts) {
    if (!dataByAccount[account.id]) dataByAccount[account.id] = { status: 'loading', projects: [] };
  }
  render();
  await Promise.all(accounts.map(a => loadProjects(a.id)));
  render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function allClassified() {
  const out = [];
  for (const account of accounts) {
    const data = dataByAccount[account.id];
    if (data?.status !== 'ok') continue;
    for (const project of data.projects) {
      out.push(classify(account.id, project, data.pausedSince));
    }
  }
  return out;
}

function renderSummary() {
  const classified = allClassified();
  const counts = {
    all: classified.length,
    active: classified.filter(c => c.state === 'active').length,
    paused: classified.filter(c => c.state === 'paused').length,
    inactive: classified.filter(c => c.state === 'inactive').length,
  };

  $('hdr-sub').textContent =
    `${plural(accounts.length, 'account')} · ${plural(counts.all, 'project')}` +
    (counts.paused ? ` · ${counts.paused} paused` : '');

  for (const [key, value] of Object.entries(counts)) {
    const el = document.querySelector(`[data-count="${key}"]`);
    if (el) el.textContent = value ? `· ${value}` : '';
  }
}

function accountHeader(account, data) {
  const color = accountColor(account.id);
  const session = sessionInfo(account);

  let statusHtml;
  if (data.status === 'no_token' || data.status === 'bad_token') {
    statusHtml = `<span class="dot" style="background:${data.status === 'bad_token' ? 'var(--red)' : '#555'}"></span>
      <span style="color:${data.status === 'bad_token' ? 'var(--red)' : 'var(--muted)'}">
        ${data.status === 'bad_token' ? 'Token invalid' : 'Token needed'}</span>`;
  } else if (data.status === 'error') {
    statusHtml = `<span class="dot" style="background:var(--amber)"></span>
      <span style="color:var(--amber)">${esc(data.error)}</span>`;
  } else if (session.live) {
    statusHtml = `<span class="dot" style="background:var(--green)"></span>
      <span style="color:var(--green)">Session live</span>`;
  } else {
    statusHtml = `<span class="dot" style="background:#555"></span>
      <span style="color:var(--muted)">${esc(session.label)} · <button class="link relogin-btn">Re-login</button></span>`;
  }

  const hdr = document.createElement('div');
  hdr.className = 'acct-hdr';
  hdr.innerHTML = `
    <div class="acct-avatar" style="background:${hexAlpha(color, .13)};border-color:${hexAlpha(color, .4)};color:${color}">
      ${esc((account.name || '?').charAt(0).toUpperCase())}
    </div>
    <span class="acct-name">${esc(account.name)}</span>
    <span class="acct-email mono">${esc(account.email || '')}</span>
    <span class="acct-status">${statusHtml}</span>
  `;
  return hdr;
}

function tokenPanel(account, data) {
  const panel = document.createElement('div');
  panel.className = 'token-panel';
  panel.innerHTML = `
    <p>
      ${data.status === 'bad_token' ? '⚠ The saved token was rejected. ' : ''}
      To list and manage this account's projects, paste a
      <strong>personal access token</strong> from
      <a href="${TOKENS_URL}" target="_blank" rel="noopener">supabase.com/dashboard/account/tokens</a>
      (generate it while logged in as <strong>${esc(account.email || account.name)}</strong>).
      The token is stored locally in your browser only.
    </p>
    <div class="token-row">
      <input type="password" class="token-input" placeholder="sbp_xxxxxxxxxxxxxxxxxxxxx" data-acct="${esc(account.id)}" />
      <button class="btn primary sm token-save" data-acct="${esc(account.id)}">Save token</button>
    </div>
  `;
  return panel;
}

function projectCard(accountId, project, info) {
  const ref = projectRef(project);
  const card = document.createElement('div');
  card.className = `card ${info.state}`;

  let meta;
  if (info.state === 'paused') {
    meta = pausedMeta(info);
  } else if (info.state === 'inactive') {
    meta = '90+ days · Restore via backup only';
  } else {
    const plan = project.plan ? `${project.plan} plan` : project.organization_name;
    meta = [esc(project.region || ''), esc(plan || '')].filter(Boolean).join(' · ');
  }

  let actions = '';
  if (info.pending) {
    actions = `<button class="btn sm open-studio" data-ref="${esc(ref)}">Open studio</button>`;
  } else if (info.state === 'paused') {
    actions = `
      <button class="btn warn sm resume-btn" data-acct="${esc(accountId)}" data-ref="${esc(ref)}">▶ Resume</button>
      <button class="btn sm backup-btn" data-ref="${esc(ref)}">Backup</button>`;
  } else if (info.state === 'inactive') {
    actions = `<button class="btn sm docs-btn">Docs</button>`;
  } else {
    actions = `
      <button class="btn sm open-studio" data-ref="${esc(ref)}">Open studio</button>
      <button class="btn sm pause-btn" data-acct="${esc(accountId)}" data-ref="${esc(ref)}">Pause</button>`;
  }

  const badgeClass = info.pending ? 'pending' : info.state;
  card.innerHTML = `
    <div class="card-top">
      <span class="card-name" title="${esc(project.name)} · ${esc(ref)}">${esc(project.name)}</span>
      <span class="badge ${badgeClass}">${esc(info.label)}</span>
    </div>
    <div class="card-meta">${meta}</div>
    <div class="card-actions">${actions}</div>
  `;
  return card;
}

function render() {
  renderSummary();

  if (accounts.length === 0) {
    main.innerHTML = `
      <div class="empty">
        <h2>No accounts yet</h2>
        <p>Open the BaseHopper popup, log in to supabase.com,<br/>and save your first session. Then come back here.</p>
      </div>`;
    return;
  }

  main.innerHTML = '';
  let rendered = 0;

  for (const account of accounts) {
    const data = dataByAccount[account.id] || { status: 'loading', projects: [] };

    let visible = [];
    if (data.status === 'ok') {
      visible = data.projects
        .map(project => ({ project, info: classify(account.id, project, data.pausedSince) }))
        .filter(({ info }) => currentFilter === 'all' || info.state === currentFilter);
    }

    // While filtering, hide accounts with nothing to show (unless they need attention)
    const needsAttention = data.status === 'no_token' || data.status === 'bad_token' || data.status === 'error';
    if (currentFilter !== 'all' && visible.length === 0 && !needsAttention) continue;

    const section = document.createElement('div');
    section.className = 'acct';
    section.dataset.acct = account.id;
    section.appendChild(accountHeader(account, data));

    if (needsAttention && data.status !== 'error') {
      section.appendChild(tokenPanel(account, data));
    } else if (data.status === 'error') {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = `Could not load projects: ${data.error}`;
      section.appendChild(note);
    } else if (data.status === 'loading') {
      const note = document.createElement('p');
      note.className = 'note';
      note.innerHTML = '<span class="spinner"></span> Loading projects…';
      section.appendChild(note);
    } else if (data.projects.length === 0) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = 'No projects in this account.';
      section.appendChild(note);
    } else if (visible.length === 0) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = `No ${currentFilter} projects in this account.`;
      section.appendChild(note);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const { project, info } of visible) grid.appendChild(projectCard(account.id, project, info));
      section.appendChild(grid);
    }

    main.appendChild(section);
    rendered++;
  }

  if (rendered === 0) {
    main.innerHTML = `
      <div class="empty">
        <h2>Nothing here</h2>
        <p>No ${esc(currentFilter)} projects across your accounts.</p>
      </div>`;
  }
}

// ── Event handlers (delegated, so re-renders never lose them) ────────────────

main.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const accountId = btn.dataset.acct;
  const ref = btn.dataset.ref;

  if (btn.classList.contains('open-studio')) {
    openTab(`https://supabase.com/dashboard/project/${ref}`);
  } else if (btn.classList.contains('backup-btn')) {
    openTab(`https://supabase.com/dashboard/project/${ref}/database/backups/scheduled`);
  } else if (btn.classList.contains('docs-btn')) {
    openTab(BACKUP_DOCS_URL);
  } else if (btn.classList.contains('relogin-btn')) {
    openTab(SIGN_IN_URL);
    showToast('Log in, then hit Sync in the BaseHopper popup');
  } else if (btn.classList.contains('token-save')) {
    await saveToken(accountId, btn);
  } else if (btn.classList.contains('resume-btn')) {
    await resumeProject(accountId, ref, btn);
  } else if (btn.classList.contains('pause-btn')) {
    await pauseProject(accountId, ref, btn);
  }
});

async function saveToken(accountId, btn) {
  const input = main.querySelector(`.token-input[data-acct="${accountId}"]`);
  const token = input?.value.trim();
  if (!token) { showToast('Paste a token first', 'err'); return; }

  btn.disabled = true;
  const res = await send({ type: 'UPDATE_ACCOUNT', accountId, accessToken: token });
  if (!res?.success) {
    showToast('Could not save token: ' + (res?.error || 'unknown error'), 'err');
    btn.disabled = false;
    return;
  }
  await loadProjects(accountId);
  render();
  const status = dataByAccount[accountId]?.status;
  showToast(
    status === 'ok' ? 'Token saved — projects loaded' : 'Token rejected by Supabase',
    status === 'ok' ? 'ok' : 'err'
  );
}

async function resumeProject(accountId, ref, btn) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:1.5px"></span> Resuming…';
  const res = await send({ type: 'MGMT_RESUME_PROJECT', accountId, projectRef: ref });
  if (res?.success) {
    showToast('Resume requested — this can take a few minutes');
    setTimeout(async () => { await loadProjects(accountId); render(); }, 3000);
  } else {
    showToast('Resume failed: ' + (res?.error || 'unknown error'), 'err');
    btn.disabled = false;
    btn.textContent = '▶ Resume';
  }
}

async function pauseProject(accountId, ref, btn) {
  if (!confirm(`Pause project ${ref}?\n\nPaused projects stop serving requests and are deleted after ${GRACE_DAYS} days if not resumed.`)) return;
  btn.disabled = true;
  const res = await send({ type: 'MGMT_PAUSE_PROJECT', accountId, projectRef: ref });
  if (res?.success) {
    showToast('Pause requested');
    setTimeout(async () => { await loadProjects(accountId); render(); }, 3000);
  } else {
    showToast('Pause failed: ' + (res?.error || 'unknown error'), 'err');
    btn.disabled = false;
  }
}

// ── Filters ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.filter;
    render();
  });
});

// ── Header actions ───────────────────────────────────────────────────────────
$('btn-refresh').addEventListener('click', async () => {
  const btn = $('btn-refresh');
  btn.disabled = true;
  dataByAccount = {};
  await loadAll();
  btn.disabled = false;
  showToast('Refreshed');
});

$('btn-add').addEventListener('click', () => {
  openTab(SIGN_IN_URL);
  showToast('Log in, then save the session from the BaseHopper popup');
});

// ── Init ─────────────────────────────────────────────────────────────────────
loadAll();
