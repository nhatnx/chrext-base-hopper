# BaseHopper

A Chrome extension for switching between multiple [Supabase](https://supabase.com) dashboard accounts without logging out and back in.

## Features

- Save multiple Supabase dashboard sessions
- Switch between them instantly — the active tab reloads into the target account
- Auto-detects the logged-in email when you save a session
- Syncs session state (both cookies and localStorage) on every switch

## Installation

1. Clone this repository
2. Open `chrome://extensions/`, enable **Developer mode**
3. Click **Load unpacked** and select this directory
4. Navigate to [supabase.com](https://supabase.com) and log in

## Usage

1. **Save an account** — while logged into a Supabase account, open the extension and click **Add Account**. The email is auto-filled if detected.
2. **Switch** — click the arrow button next to any saved account. The current tab reloads as that account.
3. **Sync** — click the sync icon in the header to update the active account's saved session to the current state.

> **Re-save required after updating the extension.** Accounts saved before v1.0 only stored tracking cookies, not auth tokens. Delete and re-save them.

## How it works

Supabase stores its dashboard session in `localStorage` (not cookies). On switch, the extension:

1. Snapshots the current account's `localStorage` auth keys + cookies into Chrome storage
2. Clears the active session from the tab
3. Writes the target account's saved session into the tab
4. Reloads the tab

The content script (`content/content.js`) handles reading and writing `localStorage` on the supabase.com page, since the background service worker cannot access page storage directly.

## Project structure

```text
├── manifest.json
├── background/background.js   # service worker — storage, cookie, and message handling
├── content/content.js         # injected into supabase.com — reads/writes localStorage
├── popup/
│   ├── popup.html             # UI + inline styles
│   └── popup.js               # popup logic, talks to background via message passing
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Persist saved accounts |
| `cookies` | Clear and restore Supabase session cookies |
| `tabs` | Detect active tab URL, reload after switch |
| `scripting` | Send messages to content script |

Host permissions are scoped to `https://supabase.com/*` and `https://*.supabase.com/*` only.

## Debugging

- **Popup:** right-click the extension icon → Inspect
- **Service worker:** `chrome://extensions/` → BaseHopper → click "service worker"
- **Content script:** DevTools on supabase.com → Console

## Contributing

Contributions are welcome — bug fixes, new features, and improvements of any size.

1. Fork the repo and create a branch (`git checkout -b feature/my-change`)
2. Load the extension unpacked in Chrome to test locally (no build step)
3. Open a pull request with a short description of what changed and why

For bugs, open an issue with steps to reproduce and your Chrome version. For larger features, opening an issue to discuss first is appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for code guidelines and the testing checklist.

## License

MIT
