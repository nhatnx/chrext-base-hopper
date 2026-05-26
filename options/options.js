// Options Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
  const enabledToggle = document.getElementById('enabledToggle');
  const themeSelect = document.getElementById('themeSelect');
  const notificationsToggle = document.getElementById('notificationsToggle');
  const customUrl = document.getElementById('customUrl');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusMessage = document.getElementById('statusMessage');

  // Load saved settings
  loadSettings();

  // Save button click
  saveBtn.addEventListener('click', saveSettings);

  // Reset button click
  resetBtn.addEventListener('click', resetSettings);

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get({
      enabled: true,
      theme: 'light',
      notifications: true,
      customUrl: ''
    }, (items) => {
      enabledToggle.checked = items.enabled;
      themeSelect.value = items.theme;
      notificationsToggle.checked = items.notifications;
      customUrl.value = items.customUrl;
    });
  }

  // Save settings to storage
  function saveSettings() {
    const settings = {
      enabled: enabledToggle.checked,
      theme: themeSelect.value,
      notifications: notificationsToggle.checked,
      customUrl: customUrl.value
    };

    chrome.storage.sync.set(settings, () => {
      showStatus('Settings saved successfully!', 'success');
      
      // Notify background script of settings change
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        settings: settings
      });
    });
  }

  // Reset to default settings
  function resetSettings() {
    const defaultSettings = {
      enabled: true,
      theme: 'light',
      notifications: true,
      customUrl: ''
    };

    chrome.storage.sync.set(defaultSettings, () => {
      loadSettings();
      showStatus('Settings reset to defaults!', 'success');
    });
  }

  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message show ${type}`;
    
    setTimeout(() => {
      statusMessage.classList.remove('show');
    }, 3000);
  }

  // Auto-save on toggle changes
  enabledToggle.addEventListener('change', () => {
    saveSettings();
  });

  notificationsToggle.addEventListener('change', () => {
    saveSettings();
  });
});
