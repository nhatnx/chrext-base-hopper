# Chrome Extension Template

A comprehensive Chrome Extension template with modern best practices, ready to use for your next Chrome extension project.

## Features

- ✅ **Manifest V3** - Uses the latest Chrome Extension manifest version
- 🎨 **Popup Interface** - Beautiful, responsive popup with example functionality
- ⚙️ **Background Service Worker** - Handles background tasks and events
- 📝 **Content Scripts** - Interact with web pages
- 🔧 **Options Page** - Full-featured settings page
- 💾 **Chrome Storage API** - Persistent storage examples
- 🎯 **Example Functions** - Ready-to-use examples for common tasks

## Project Structure

```
chrext-template/
├── manifest.json           # Extension configuration
├── package.json           # Project metadata
├── popup/                 # Popup interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── background/            # Background service worker
│   └── background.js
├── content/               # Content scripts
│   ├── content.js
│   └── content.css
├── options/               # Options/settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/                 # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Getting Started

### Prerequisites

- Google Chrome or Chromium-based browser
- Basic knowledge of HTML, CSS, and JavaScript

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <your-repository-url>
   cd chrext-template
   ```

2. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the project directory

3. **Test the extension**
   - Click the extension icon in your browser toolbar
   - Try the example buttons
   - Visit any website to see content script in action
   - Right-click the extension icon → Options to view settings

## Customization

### 1. Update Manifest

Edit `manifest.json` to customize your extension:

```json
{
  "name": "Your Extension Name",
  "description": "Your extension description",
  "version": "1.0.0",
  ...
}
```

### 2. Modify Popup

Edit files in `popup/` directory to customize the popup interface:
- `popup.html` - Structure
- `popup.css` - Styling
- `popup.js` - Functionality

### 3. Background Tasks

Edit `background/background.js` to add background tasks, event listeners, and service worker logic.

### 4. Content Scripts

Modify `content/content.js` and `content/content.css` to interact with web pages.

### 5. Options Page

Customize `options/` directory files to add more settings and preferences.

### 6. Icons

Replace icon files in `icons/` directory with your own:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

## Features Included

### Popup Interface
- Clean, modern UI with gradient header
- Example buttons demonstrating:
  - Executing scripts on active tab
  - Getting tab information
  - Opening options page
- Chrome Storage API integration

### Background Service Worker
- Installation event handler
- Message passing between components
- Tab update monitoring
- Storage API examples

### Content Scripts
- Runs on all web pages
- Message listener for communication
- Example functions (highlight text, add indicators)
- Custom styling injection

### Options Page
- Toggle switches for settings
- Theme selection
- Custom URL patterns
- Auto-save functionality
- Persistent storage

## Permissions

The template includes these permissions in `manifest.json`:

- `storage` - For saving user preferences
- `activeTab` - For interacting with the current tab
- `scripting` - For executing scripts in pages

### Host Permissions
- `http://*/*` and `https://*/*` - For content scripts on all URLs

**Note:** Remove unused permissions before publishing.

## Development

### Making Changes

1. Make your code changes
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension card
4. Test your changes

### Debugging

- **Popup**: Right-click popup → Inspect
- **Background**: Click "service worker" link in extension card
- **Content Script**: Open DevTools on any webpage → Console tab
- **Options Page**: Right-click options page → Inspect

## Publishing

### Before Publishing

1. **Test thoroughly** on different websites
2. **Update icons** with your own design
3. **Remove unused permissions** from manifest.json
4. **Update metadata** (name, description, version)
5. **Add privacy policy** if collecting data
6. **Create promotional images** (screenshots, etc.)

### Chrome Web Store

1. Create a developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 registration fee
3. Zip your extension directory
4. Upload and fill in store listing details
5. Submit for review

## Best Practices

- ✅ Use Manifest V3 (V2 is deprecated)
- ✅ Request minimal permissions
- ✅ Keep background scripts lightweight
- ✅ Use content scripts sparingly
- ✅ Store sensitive data securely
- ✅ Follow Chrome's [extension quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/)

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Web Store](https://chrome.google.com/webstore/category/extensions)
- [Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)

## License

MIT License - Feel free to use this template for your projects!

## Contributing

Contributions, issues, and feature requests are welcome!

## Author

Created as a comprehensive starting point for Chrome Extension development.

---

**Happy Extension Building! 🚀**
