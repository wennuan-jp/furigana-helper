document.addEventListener('DOMContentLoaded', () => {
  const settingRows = document.querySelectorAll('.setting-row');
  const recorderOverlay = document.getElementById('recorder-overlay');
  const overlayHint = document.getElementById('overlay-hint');
  const overlayDisplay = document.getElementById('overlay-display');
  const statusMsg = document.getElementById('status-msg');

  let currentMode = 'double-tap';
  let activationKey = 'Control';
  let shortcutConfig = { ctrl: true, alt: false, shift: false, meta: false, key: 'k' };
  let isListening = false;
  let recordingTargetMode = null;

  // Load existing settings
  chrome.storage.sync.get({
    activationMode: 'double-tap',
    activationKey: 'Control',
    shortcutConfig: { ctrl: true, alt: false, shift: false, meta: false, key: 'k' }
  }, (items) => {
    currentMode = items.activationMode;
    activationKey = items.activationKey;
    shortcutConfig = items.shortcutConfig;
    updateUI();
  });

  function updateUI() {
    settingRows.forEach(row => {
      const mode = row.dataset.mode;
      row.classList.toggle('active', mode === currentMode);
      
      const displayText = mode === 'double-tap' 
        ? activationKey 
        : formatShortcut(shortcutConfig);
      
      row.querySelector('.key-text').textContent = displayText;
    });
  }

  function formatShortcut(config) {
    const parts = [];
    if (config.ctrl) parts.push('Ctrl');
    if (config.alt) parts.push('Alt');
    if (config.shift) parts.push('Shift');
    if (config.meta) parts.push('Meta');
    if (config.key) parts.push(config.key.toUpperCase());
    return parts.join(' + ') || '...';
  }

  // Row selection and recording trigger
  settingRows.forEach(row => {
    row.addEventListener('click', (e) => {
      const mode = row.dataset.mode;
      const isRecorderClick = e.target.closest('.key-recorder-mini');

      // If the clicked row is NOT the current mode, just switch to it and return
      if (mode !== currentMode) {
        currentMode = mode;
        saveSettings();
        updateUI();
        return; // Don't start recording on the first click that just activates the row
      }

      // If the row IS already the current mode AND the recorder area was clicked, start recording
      if (isRecorderClick) {
        startRecording(mode);
      }
    });
  });

  function startRecording(mode) {
    isListening = true;
    recordingTargetMode = mode;
    recorderOverlay.classList.remove('hidden');
    overlayHint.textContent = mode === 'double-tap' ? 'Press any key' : 'Press combination';
    overlayDisplay.textContent = '...';

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (recordingTargetMode === 'double-tap') {
        activationKey = e.key;
        stopRecording();
        saveSettings();
      } else {
        const modifiers = ['Control', 'Alt', 'Shift', 'Meta'];
        if (modifiers.includes(e.key)) {
          renderOverlayIntermediate(e);
        } else {
          shortcutConfig = {
            ctrl: e.ctrlKey,
            alt: e.altKey,
            shift: e.shiftKey,
            meta: e.metaKey,
            key: e.key
          };
          stopRecording();
          saveSettings();
        }
      }
    };

    function renderOverlayIntermediate(e) {
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');
      overlayDisplay.textContent = parts.join(' + ') || '...';
    }

    const stopRecording = () => {
      isListening = false;
      recorderOverlay.classList.add('hidden');
      updateUI();
      document.removeEventListener('keydown', handleKeyDown);
    };

    document.addEventListener('keydown', handleKeyDown);
  }

  function saveSettings() {
    chrome.storage.sync.set({
      activationMode: currentMode,
      activationKey: activationKey,
      shortcutConfig: shortcutConfig
    }, () => {
      showStatus('Saved!', '#10b981');
    });
  }

  let statusTimeout;
  function showStatus(message, color) {
    statusMsg.textContent = message;
    statusMsg.style.color = color;
    statusMsg.classList.add('show');
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => statusMsg.classList.remove('show'), 1500);
  }
});
