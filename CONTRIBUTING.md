# Contributing to BaseHopper

## Reporting bugs

Open an issue with:

- Steps to reproduce
- Expected vs actual behaviour
- Chrome version and any console errors (service worker + popup DevTools)

## Suggesting enhancements

Open an issue describing:

- What you want to add or change
- Why it would be useful for Supabase account switching
- Any implementation ideas

## Pull requests

1. Fork and create a branch: `git checkout -b feature/my-change`
2. Load the extension unpacked in Chrome — no build step needed
3. Make your changes and test manually (see checklist below)
4. Open a PR with a short description of what changed and why

## Code guidelines

**JavaScript** — ES6+, `const`/`let`, async/await. The extension has three execution contexts that can only communicate via message passing:

| Context | File | Can access |
| --- | --- | --- |
| Service worker | `background/background.js` | `chrome.storage`, `chrome.cookies`, `chrome.tabs` |
| Content script | `content/content.js` | Page `localStorage`, DOM |
| Popup | `popup/popup.js` | Chrome extension APIs, sends messages to background |

Keep business logic (cookie/storage operations) in the background. Keep DOM/localStorage operations in the content script. Keep the popup thin — it should only send messages and render responses.

**HTML/CSS** — Styles live inline in `popup/popup.html`. Follow the existing CSS variables (`--bg`, `--green`, `--border`, etc.) for any new UI elements.

**Manifest** — Do not broaden permissions or host permissions beyond `supabase.com` and `*.supabase.com` without a clear reason.

## Testing checklist

Before submitting:

- [ ] Extension loads in `chrome://extensions/` with no errors
- [ ] Save a session while logged into supabase.com — check the service worker console logs `Saving session — ls keys:` shows auth keys (not empty)
- [ ] Switch between two saved accounts — the tab reloads into the correct account
- [ ] Sync button updates the active account without errors
- [ ] Delete an account — it is removed from the list
- [ ] No console errors in popup DevTools or service worker

## License

By contributing, you agree your work will be licensed under the MIT License.
