# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BaseHopper** is a Chrome extension (Manifest V3) that lets users switch between multiple Supabase dashboard accounts by saving and restoring session cookies. It has zero dependencies and no build step — plain HTML/CSS/JS loaded directly into Chrome.

## Development Commands

```powershell
# No build step needed — load the extension folder directly in Chrome
# chrome://extensions/ → Enable Developer Mode → Load Unpacked → select this folder

# After editing any file, reload the extension:
# chrome://extensions/ → click the reload icon for BaseHopper
```

To debug each component:
- **Popup:** Right-click the extension icon → Inspect
- **Service worker:** chrome://extensions/ → click "service worker" link under BaseHopper
- **Content script:** Open supabase.com, F12 → Sources → Content Scripts

## Architecture

The extension follows the standard MV3 three-component model with message passing:

```
popup.js  ──────────────►  background.js  ◄──────────────  content.js
(UI/UX)    chrome.runtime    (service worker)   chrome.tabs    (supabase.com only)
            .sendMessage      chrome.storage      .sendMessage
                              chrome.cookies
```

### Component Responsibilities

**[background/background.js](background/background.js)** — Service worker, owns all business logic:
- Manages accounts in `chrome.storage.local` (keyed as `{ accounts: [...] }`)
- Reads/writes Supabase session cookies (`sb-access-token`, `sb-refresh-token`, `__session`, and `sb-*-auth-token` patterns)
- Handles all `chrome.runtime.onMessage` messages: `GET_ACCOUNTS`, `SAVE_SESSION`, `SWITCH_ACCOUNT`, `DELETE_ACCOUNT`, `UPDATE_CURRENT_COOKIES`, `GET_CURRENT_COOKIES`
- `switchToAccount()` clears current cookies, restores saved ones, then reloads the active Supabase tab

**[content/content.js](content/content.js)** — Injected into supabase.com pages:
- Responds to `GET_CURRENT_USER` message
- Detects the logged-in email from `localStorage` keys (`supabase.*`, `sb-*`) or DOM inspection

**[popup/popup.js](popup/popup.js)** — UI logic (236 lines):
- Sends messages to background for all data operations; never touches storage or cookies directly
- Auto-populates email by querying the active tab's content script on open
- Manages form show/hide, account list rendering, toast notifications, and delete confirmation flow

**[popup/popup.html](popup/popup.html)** — Self-contained UI (447 lines):
- Inline CSS with dark Supabase-inspired theme (`#3ecf8e` green accent)
- No external CSS files; Google Fonts loaded via `<link>`

### Permissions & Host Scope

Declared in [manifest.json](manifest.json):
- Permissions: `storage`, `cookies`, `tabs`, `scripting`
- Host permissions: `https://supabase.com/*` and `https://*.supabase.com/*` only
- Cookie operations and content script injection are scoped to these origins
