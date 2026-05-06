document.addEventListener('DOMContentLoaded', () => {
  const keyRecorder = document.getElementById('key-recorder');
  const keyDisplay = document.getElementById('key-display');
  const recorderHint = document.getElementById('recorder-hint');
  const statusMsg = document.getElementById('status-msg');

  const usageTip = 'Double-tap the key to show furigana'
  recorderHint.textContent = usageTip

  let currentKey = 'Control';
  let isListening = false;

  // Load existing settings from Chrome storage
  chrome.storage.sync.get({
    activationKey: 'Control'
  }, (items) => {
    currentKey = items.activationKey;
    keyDisplay.textContent = currentKey;
  });

  // Key recording logic
  keyRecorder.addEventListener('click', () => {
    if (isListening) return;

    isListening = true;
    keyRecorder.classList.add('listening');
    keyDisplay.textContent = '...';
    recorderHint.textContent = 'Press any key';

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentKey = e.key;
      keyDisplay.textContent = currentKey;

      stopListening();
      saveSettings();
    };

    const stopListening = () => {
      isListening = false;
      keyRecorder.classList.remove('listening');
      recorderHint.textContent = usageTip;
      document.removeEventListener('keydown', handleKeyDown);
    };

    document.addEventListener('keydown', handleKeyDown);
  });

  function saveSettings() {
    chrome.storage.sync.set({
      activationKey: currentKey
    }, () => {
      showStatus('Settings saved!', '#10b981');
    });
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
    }, 1500);
  }
});
