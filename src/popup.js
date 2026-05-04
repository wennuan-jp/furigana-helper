document.addEventListener('DOMContentLoaded', () => {
  const engineToggle = document.getElementById('engine-toggle');
  const apiKeyGroup = document.getElementById('api-key-group');
  const yahooClientIdInput = document.getElementById('yahoo-client-id');
  const saveBtn = document.getElementById('save-btn');
  const statusMsg = document.getElementById('status-msg');

  // Load existing settings from Chrome storage
  chrome.storage.sync.get({
    useYahooApi: false,
    yahooClientId: ''
  }, (items) => {
    engineToggle.checked = items.useYahooApi;
    yahooClientIdInput.value = items.yahooClientId;
    
    // Set initial visibility of the API key group
    updateApiKeyVisibility(items.useYahooApi);
  });

  // Toggle API key input visibility when the switch is clicked
  engineToggle.addEventListener('change', (e) => {
    updateApiKeyVisibility(e.target.checked);
  });

  // Save settings when button is clicked
  saveBtn.addEventListener('click', () => {
    const useYahooApi = engineToggle.checked;
    const yahooClientId = yahooClientIdInput.value.trim();

    // Prevent saving if Yahoo API is selected but no key is provided
    if (useYahooApi && !yahooClientId) {
      showStatus('Please enter a Yahoo Client ID', '#ef4444'); // Red error color
      yahooClientIdInput.focus();
      return;
    }

    chrome.storage.sync.set({
      useYahooApi: useYahooApi,
      yahooClientId: yahooClientId
    }, () => {
      // Show success message
      showStatus('Settings saved successfully!', '#10b981'); // Green success color
    });
  });

  // Helper function to animate visibility of the API key input
  function updateApiKeyVisibility(isVisible) {
    if (isVisible) {
      apiKeyGroup.style.display = 'flex';
      // Slight delay to allow display:flex to apply before setting opacity for transition if we had one
    } else {
      apiKeyGroup.style.display = 'none';
    }
  }

  // Helper function to show temporary status messages
  let statusTimeout;
  function showStatus(message, color) {
    statusMsg.textContent = message;
    statusMsg.style.color = color;
    statusMsg.classList.add('show');
    
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusMsg.classList.remove('show');
    }, 2500);
  }
});
