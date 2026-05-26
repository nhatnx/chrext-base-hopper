// Content Script - Runs on web pages

console.log('Chrome Extension Template content script loaded');

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'getPageContent') {
    // Example: Get page content
    const content = {
      title: document.title,
      url: window.location.href,
      bodyText: document.body.innerText.substring(0, 200)
    };
    sendResponse({ success: true, content });
  }
  
  if (request.action === 'highlightText') {
    // Example: Highlight text on page
    highlightText(request.text);
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open for async response
});

// Example function: Highlight specific text
function highlightText(searchText) {
  if (!searchText) return;
  
  // Use TreeWalker to safely highlight text without destroying DOM structure
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const nodesToProcess = [];
  let node;
  
  while (node = walker.nextNode()) {
    if (node.nodeValue.toLowerCase().includes(searchText.toLowerCase())) {
      nodesToProcess.push(node);
    }
  }
  
  nodesToProcess.forEach(textNode => {
    const regex = new RegExp(`(${searchText})`, 'gi');
    const fragment = document.createDocumentFragment();
    const parts = textNode.nodeValue.split(regex);
    
    parts.forEach(part => {
      if (part.toLowerCase() === searchText.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.style.backgroundColor = 'yellow';
        mark.textContent = part;
        fragment.appendChild(mark);
      } else if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });
    
    textNode.parentNode.replaceChild(fragment, textNode);
  });
}

// Example: Add a floating indicator
function addExtensionIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'chrome-ext-indicator';
  indicator.textContent = 'Extension Active';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 20px;
    font-size: 12px;
    font-family: sans-serif;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: opacity 0.3s;
  `;
  
  // Remove indicator on click
  indicator.addEventListener('click', () => {
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  });
  
  document.body.appendChild(indicator);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentElement) {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }
  }, 3000);
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded - Extension ready');
  });
} else {
  console.log('Page already loaded - Extension ready');
}

// Uncomment to show indicator on every page
// addExtensionIndicator();
