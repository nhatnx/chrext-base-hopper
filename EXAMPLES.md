# Usage Examples

This document provides practical examples of common Chrome Extension tasks using this template.

## Table of Contents
- [Basic Examples](#basic-examples)
- [Storage Examples](#storage-examples)
- [Tab Manipulation](#tab-manipulation)
- [Message Passing](#message-passing)
- [Content Script Examples](#content-script-examples)

## Basic Examples

### 1. Adding a New Button to Popup

**popup/popup.html:**
```html
<button id="myNewButton" class="btn btn-primary">
  My New Feature
</button>
```

**popup/popup.js:**
```javascript
document.getElementById('myNewButton').addEventListener('click', async () => {
  try {
    // Your code here
    console.log('Button clicked!');
    
    // Example: Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab);
    
  } catch (error) {
    console.error('Error:', error);
  }
});
```

### 2. Adding a New Permission

**manifest.json:**
```json
{
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "notifications"  // Add new permission
  ]
}
```

Then reload the extension in Chrome.

## Storage Examples

### Saving Data

```javascript
// Save a single value
chrome.storage.sync.set({ key: 'value' }, () => {
  console.log('Data saved');
});

// Save multiple values
chrome.storage.sync.set({
  username: 'john',
  theme: 'dark',
  lastVisit: Date.now()
}, () => {
  console.log('All data saved');
});
```

### Loading Data

```javascript
// Load a single value
chrome.storage.sync.get(['username'], (result) => {
  console.log('Username:', result.username);
});

// Load multiple values with defaults
chrome.storage.sync.get({
  username: 'guest',
  theme: 'light',
  count: 0
}, (result) => {
  console.log('Settings:', result);
});
```

### Removing Data

```javascript
// Remove one key
chrome.storage.sync.remove('username', () => {
  console.log('Username removed');
});

// Remove multiple keys
chrome.storage.sync.remove(['username', 'theme'], () => {
  console.log('Keys removed');
});

// Clear all data
chrome.storage.sync.clear(() => {
  console.log('All data cleared');
});
```

## Tab Manipulation

### Open a New Tab

```javascript
chrome.tabs.create({
  url: 'https://example.com',
  active: true  // Focus the new tab
});
```

### Update Current Tab

```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.tabs.update(tab.id, {
  url: 'https://example.com'
});
```

### Close a Tab

```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.tabs.remove(tab.id);
```

### Get All Tabs

```javascript
chrome.tabs.query({}, (tabs) => {
  console.log('All tabs:', tabs);
  tabs.forEach(tab => {
    console.log(`${tab.title}: ${tab.url}`);
  });
});
```

## Message Passing

### Send Message from Popup to Background

**popup/popup.js:**
```javascript
chrome.runtime.sendMessage({
  action: 'getData',
  param: 'value'
}, (response) => {
  console.log('Response:', response);
});
```

**background/background.js:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getData') {
    // Do something
    sendResponse({ success: true, data: 'result' });
  }
  return true; // Keep channel open for async response
});
```

### Send Message from Content Script to Background

**content/content.js:**
```javascript
chrome.runtime.sendMessage({
  action: 'pageLoaded',
  url: window.location.href
}, (response) => {
  console.log('Response:', response);
});
```

### Send Message to Content Script

**popup/popup.js or background/background.js:**
```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.tabs.sendMessage(tab.id, {
  action: 'highlightText',
  text: 'example'
}, (response) => {
  console.log('Response:', response);
});
```

## Content Script Examples

### Modify Page Content

```javascript
// Change page title
document.title = 'Modified by Extension';

// Add a banner
const banner = document.createElement('div');
banner.textContent = 'This page is enhanced by our extension';
banner.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: #4CAF50;
  color: white;
  text-align: center;
  z-index: 10000;
`;
document.body.prepend(banner);
```

### Listen for Page Events

```javascript
// Listen for clicks
document.addEventListener('click', (e) => {
  console.log('Clicked:', e.target);
  
  // Send to background
  chrome.runtime.sendMessage({
    action: 'elementClicked',
    tagName: e.target.tagName
  });
});

// Listen for form submissions
document.addEventListener('submit', (e) => {
  console.log('Form submitted:', e.target);
});
```

### Extract Page Data

```javascript
function extractPageData() {
  return {
    title: document.title,
    url: window.location.href,
    links: Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent,
      href: a.href
    })),
    images: Array.from(document.querySelectorAll('img')).map(img => img.src),
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent)
  };
}

// Send to background
chrome.runtime.sendMessage({
  action: 'pageData',
  data: extractPageData()
});
```

## Advanced Examples

### Create a Context Menu

**background/background.js:**
```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'myContextMenu',
    title: 'Do Something',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'myContextMenu') {
    console.log('Selected text:', info.selectionText);
    // Do something with the selected text
  }
});
```

**manifest.json:** (add permission)
```json
{
  "permissions": ["contextMenus"]
}
```

### Show Notifications

```javascript
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Extension Notification',
  message: 'Something happened!',
  priority: 2
});
```

**manifest.json:** (add permission)
```json
{
  "permissions": ["notifications"]
}
```

### Inject CSS into Page

**popup/popup.js:**
```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.scripting.insertCSS({
  target: { tabId: tab.id },
  css: 'body { background-color: lightblue !important; }'
});
```

### Execute Script in Page

```javascript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

chrome.scripting.executeScript({
  target: { tabId: tab.id },
  function: () => {
    // This runs in the page context
    return document.querySelectorAll('a').length;
  }
}, (results) => {
  console.log('Number of links:', results[0].result);
});
```

## Debugging Tips

### Log from Different Contexts

```javascript
// Popup: Right-click popup → Inspect
console.log('From popup');

// Background: Click "service worker" in extensions page
console.log('From background');

// Content Script: Open page DevTools → Console
console.log('From content script');

// Options: Right-click options page → Inspect
console.log('From options');
```

### Check Storage Contents

```javascript
chrome.storage.sync.get(null, (items) => {
  console.log('All storage:', items);
});
```

### Monitor Message Passing

```javascript
// In background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  console.log('From:', sender);
  // ... handle message
});
```

## Best Practices

1. **Always use try-catch** for async operations
2. **Check for null/undefined** before using Chrome API results
3. **Keep background scripts lightweight** - they should be event-driven
4. **Use content scripts sparingly** - they run on every matching page
5. **Request minimal permissions** - only what you actually need
6. **Test on different websites** - ensure compatibility
7. **Handle errors gracefully** - show user-friendly messages

## More Resources

- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Sample Extensions](https://github.com/GoogleChrome/chrome-extensions-samples)
- [Extension Workshop](https://extensionworkshop.com/)

---

Happy coding! 🚀
