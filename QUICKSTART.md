# Quick Start Guide

Get your Chrome Extension up and running in 5 minutes!

## Installation (2 minutes)

1. **Download the template**
   - Clone this repository or download as ZIP
   - Extract to a folder on your computer

2. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle switch in top-right corner)
   - Click "Load unpacked" button
   - Select the project folder (the one containing manifest.json)

3. **Pin the extension** (optional but recommended)
   - Click the puzzle icon in Chrome toolbar
   - Find your extension and click the pin icon

## Test It Out (3 minutes)

### Test the Popup
1. Click the extension icon in your toolbar
2. Click "Change Page Color" - it will change the current tab's background
3. Click "Get Page Info" - it will show current page details
4. Click "Options" link at the bottom

### Test Content Scripts
1. Visit any website
2. Open DevTools (F12)
3. Look in the Console tab for: `Chrome Extension Template content script loaded`

### Test Options Page
1. Right-click extension icon → "Options"
2. Toggle settings on/off
3. Change the theme
4. Click "Save Settings"
5. Check that settings persist after refresh

### Test Background Worker
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "service worker" link
4. See console logs from background.js

## Customization (10 minutes)

### Change Extension Name & Description
Edit `manifest.json`:
```json
{
  "name": "My Awesome Extension",
  "description": "Does amazing things!",
  "version": "1.0.0"
}
```

### Customize Popup
Edit `popup/popup.html` to change the UI:
```html
<h1>My Extension</h1>
<button id="myButton">Click Me!</button>
```

Edit `popup/popup.js` to add functionality:
```javascript
document.getElementById('myButton').addEventListener('click', () => {
  alert('Hello from my extension!');
});
```

### Modify Permissions
Remove unused permissions from `manifest.json`:
```json
"permissions": [
  "storage",      // Keep if you use chrome.storage
  "activeTab"     // Keep if you interact with current tab
]
```

## Common Tasks

### Add a New Permission
1. Edit `manifest.json`
2. Add permission to `permissions` array
3. Reload extension in `chrome://extensions/`

### Change Icons
1. Replace files in `icons/` folder
2. Keep filenames: `icon16.png`, `icon48.png`, `icon128.png`
3. Reload extension

### Debug Issues
- **Popup not working?** Right-click popup → Inspect
- **Content script not running?** Check Console in page DevTools
- **Background issues?** Click "service worker" link in extensions page
- **Manifest errors?** Check for red error messages in extensions page

## Next Steps

1. Read the full [README.md](README.md) for detailed documentation
2. Explore the example code in each file
3. Start building your own features!
4. When ready, follow the publishing guide in README.md

## Troubleshooting

**Extension won't load?**
- Make sure you selected the correct folder (containing manifest.json)
- Check for errors in red text on extensions page
- Verify manifest.json is valid JSON

**Features not working?**
- Reload the extension after making changes
- Check DevTools console for errors
- Verify permissions in manifest.json

**Need help?**
- Check [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- Review example code in the template files
- Open an issue on GitHub

---

**You're ready to build! 🚀**
