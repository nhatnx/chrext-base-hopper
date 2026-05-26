// Popup JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const changeColorBtn = document.getElementById('changeColorBtn');
  const getInfoBtn = document.getElementById('getInfoBtn');
  const optionsLink = document.getElementById('optionsLink');
  const infoDisplay = document.getElementById('infoDisplay');

  // Change page background color
  changeColorBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        infoDisplay.textContent = 'Error: No active tab found';
        return;
      }
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: changePageColor,
      });

      infoDisplay.textContent = 'Page color changed!';
    } catch (error) {
      infoDisplay.textContent = `Error: ${error.message}`;
    }
  });

  // Get page information
  getInfoBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        infoDisplay.textContent = 'Error: No active tab found';
        return;
      }
      
      infoDisplay.innerHTML = `
        <strong>Page Info:</strong><br>
        Title: ${tab.title}<br>
        URL: ${tab.url}<br>
        Tab ID: ${tab.id}
      `;
    } catch (error) {
      infoDisplay.textContent = `Error: ${error.message}`;
    }
  });

  // Open options page
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Load saved settings
  chrome.storage.sync.get(['enabled'], (result) => {
    console.log('Extension enabled:', result.enabled !== false);
  });
});

// Function to be injected into the page
function changePageColor() {
  const colors = ['#fff3cd', '#d1ecf1', '#d4edda', '#f8d7da', '#e2e3e5'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  document.body.style.backgroundColor = randomColor;
}
