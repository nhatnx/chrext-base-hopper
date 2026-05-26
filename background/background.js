// Background Service Worker

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings on installation
    chrome.storage.sync.set({
      enabled: true,
      theme: 'light'
    });
    
    // Optionally open welcome page or options page on first install
    // chrome.runtime.openOptionsPage();
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  if (request.action === 'getData') {
    // Example: Fetch data and send back
    chrome.storage.sync.get(['enabled', 'theme'], (result) => {
      sendResponse({ success: true, data: result });
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'updateSettings') {
    // Example: Update settings
    chrome.storage.sync.set(request.settings, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url);
    // You can perform actions when a tab is fully loaded
  }
});

// Listen for browser action clicks
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
});

// Periodic tasks using alarms (optional)
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('Alarm triggered:', alarm.name);
  // Perform periodic tasks here
});

// Example: Create an alarm that fires every hour
// chrome.alarms.create('hourlyUpdate', { periodInMinutes: 60 });
