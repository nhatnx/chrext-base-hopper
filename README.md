# BaseHopper

A Chrome extension for switching between multiple [Supabase](https://supabase.com) dashboard accounts without logging out and back in — plus a full-page dashboard that shows every project across every account.

## Features

- Save multiple Supabase dashboard sessions and switch between them instantly
- Auto-detects the logged-in email when you save a session
- Syncs session state (both cookies and localStorage) on every switch
- **Re-login one stale account** without disturbing the others
- **Dashboard** — every project from every account on one page, with status, region, plan, and the 90-day pause countdown
- Resume or pause projects directly from the dashboard
- Refresh a single project, a single account, or everything

## Installation

1. Clone this repository
2. Open `chrome://extensions/`, enable **Developer mode**
3. Click **Load unpacked** and select this directory
4. Navigate to [supabase.com](https://supabase.com) and log in

## Usage

### Popup — account switching

1. **Save an account** — while logged into a Supabase account, open the extension and click **Add Account**. The email is auto-filled if detected.
2. **Switch** — click the arrow button next to any saved account. The current tab reloads as that account.
3. **Sync** — click the sync icon in the header to update the active account's saved session to the current state.
4. **Re-login** — an amber **Re-login** chip appears on any account whose session has gone stale. See below.

### Dashboard — all projects at a glance

Click **Dashboard** in the popup footer. Each account becomes a section listing its projects.

To load projects, each account needs a **personal access token** — Supabase's Management API is authenticated by PAT, not by your dashboard session. The dashboard shows a paste box per account; generate the token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) **while logged in as that account**. Tokens are stored in `chrome.storage.local` and never leave your browser except in requests to `api.supabase.com`.

- **Filter pills** — All / Active / Paused / Inactive, with counts
- **Paused cards** get an amber border, a **▶ Resume** button, and a countdown of days left before Supabase deletes the project's data (⚠ under 30 days)
- **Inactive cards** — past the 90-day grace period — are dimmed and link to the backup-restore docs, since Supabase can no longer restore in place
- **Refresh** — the icon on a card re-polls that one project; the icon in an account header re-polls that account; **Refresh all** does everything

### Re-logging in a single account

When a saved session expires, you used to have to clear every account and set them all up again. Now:

1. Click **Re-login** on the stale account (popup chip, or the link in the dashboard's account header)
2. BaseHopper saves whatever account is currently logged in, then clears **only** the live browser session — Supabase cookies and the `sb-*` localStorage keys — and drops you on a clean sign-in page. Other accounts' saved sessions are untouched.
3. Log in. The new session is written back into that same account record, keeping its name, colour, and access token.

If the email you log in as doesn't match the account's, the capture is refused and the stored session is left alone — a mis-login can't silently overwrite the wrong account. A pending re-login expires after 30 minutes, and is cancelled if you switch accounts in the meantime. The popup's re-login bar has a manual **I'm logged in** button if the automatic capture doesn't fire.

> **Re-save required after updating from an old version.** Accounts saved before v1.0 only stored tracking cookies, not auth tokens. Delete and re-save them.

## How it works

Supabase stores its dashboard session in `localStorage` (not cookies). On switch, the extension:

1. Snapshots the current account's `localStorage` auth keys + cookies into Chrome storage
2. Clears the active session from the tab
3. Writes the target account's saved session into the tab
4. Reloads the tab

The content script (`content/content.js`) handles reading and writing `localStorage` on the supabase.com page, since the background service worker cannot access page storage directly.

**Session freshness** is a heuristic ([lib/session.js](lib/session.js)), shared by the popup and dashboard. Supabase access tokens live about an hour, so an expired access token proves nothing on its own; an account counts as live if its access token is still valid, or if it holds a refresh token last seen within 30 days.

**The pause countdown** is estimated locally. The Management API doesn't report *when* a project was paused, so the service worker records the first time it sees a project in a paused state and counts from there. For projects already paused before you installed the extension, day 0 is the first refresh — the countdown starts generous and only becomes accurate for projects paused while BaseHopper is watching.

## Project structure

```text
├── manifest.json
├── background/background.js   # service worker — storage, cookies, Management API, re-login
├── content/content.js         # injected into supabase.com — reads/writes localStorage
├── lib/session.js             # shared session-freshness heuristic
├── popup/
│   ├── popup.html             # UI + inline styles
│   └── popup.js               # popup logic, talks to background via message passing
├── dashboard/
│   ├── dashboard.html         # full-page project dashboard + inline styles
│   └── dashboard.js           # project rendering, filters, resume/pause/refresh
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

All UI talks to the service worker via `chrome.runtime.sendMessage`; nothing else touches storage or cookies directly.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Persist saved accounts and access tokens |
| `cookies` | Clear and restore Supabase session cookies |
| `tabs` | Detect active tab URL, reload after switch, drive the re-login flow |
| `scripting` | Send messages to content script |

Host permissions are scoped to `https://supabase.com/*`, `https://*.supabase.com/*`, and `https://api.supabase.com/*` (the Management API) only.

## Debugging

- **Popup:** right-click the extension icon → Inspect
- **Service worker:** `chrome://extensions/` → BaseHopper → click "service worker"
- **Content script:** DevTools on supabase.com → Console
- **Dashboard:** it's a normal page — F12 on the dashboard tab

## Contributing

Contributions are welcome — bug fixes, new features, and improvements of any size.

1. Fork the repo and create a branch (`git checkout -b feature/my-change`)
2. Load the extension unpacked in Chrome to test locally (no build step)
3. Open a pull request with a short description of what changed and why

For bugs, open an issue with steps to reproduce and your Chrome version. For larger features, opening an issue to discuss first is appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for code guidelines and the testing checklist.

## License

MIT
