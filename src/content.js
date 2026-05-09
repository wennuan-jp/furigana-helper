// src/content.js
import './content.css';

// Regex to check if text contains Kanji characters
const KANJI_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf]/;

// Settings cache
let settings = {
  activationMode: 'double-tap',
  activationKey: 'Control',
  shortcutConfig: { ctrl: true, alt: false, shift: false, meta: false, key: 'k' }
};

// Initial load
chrome.storage.sync.get({
  activationMode: 'double-tap',
  activationKey: 'Control',
  shortcutConfig: { ctrl: true, alt: false, shift: false, meta: false, key: 'k' }
}, (items) => {
  settings = items;
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes) => {
  Object.keys(changes).forEach(key => {
    settings[key] = changes[key].newValue;
  });
});

// Listen for the configured trigger to show furigana
let lastKeyTap = 0;
document.addEventListener('keydown', (e) => {
  if (settings.activationMode === 'double-tap') {
    if (e.key === settings.activationKey) {
      const now = Date.now();
      if (now - lastKeyTap < 300) { // 300ms threshold for double-tap
        processFuriganaForSelection();
      }
      lastKeyTap = now;
    }
  } else if (settings.activationMode === 'shortcut') {
    const config = settings.shortcutConfig;
    if (
      e.ctrlKey === config.ctrl &&
      e.altKey === config.alt &&
      e.shiftKey === config.shift &&
      e.metaKey === config.meta &&
      e.key.toLowerCase() === config.key.toLowerCase()
    ) {
      processFuriganaForSelection();
    }
  }
});

let lastProcessedText = "";

function processFuriganaForSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const text = selection.toString().trim();

  // If no text is selected, or it's the exact same text we just processed, do nothing
  if (!text || text.length === 0 || text === lastProcessedText) {
    if (!text) lastProcessedText = ""; // Reset if selection cleared
    return;
  }

  // Filter out non-Japanese text (must contain at least one Kanji)
  if (!KANJI_REGEX.test(text)) {
    return;
  }

  console.log("Furigana Helper: Kanji detected in selection. Sending to background...", text);

  // Capture the exact DOM range of the user's selection
  const range = selection.getRangeAt(0).cloneRange();

  // Send the selected text to background.js
  try {
    chrome.runtime.sendMessage(
      { action: "PROCESS_FURIGANA", text: text },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log("Furigana Helper: Extension context invalidated or background script not ready.");
          lastProcessedText = ""; // Reset to allow retry
          return;
        }
        
        if (response && response.success && response.data) {
          console.log("Furigana Helper: Received reading, injecting UI...");
          lastProcessedText = text; // Only mark as processed on success
          injectRuby(range, response.data);
        } else {
          lastProcessedText = ""; // Reset to allow retry
        }
      }
    );
  } catch (e) {
    console.log("Furigana Helper: Message failed.");
    lastProcessedText = ""; // Reset to allow retry
  }
}

// Phase 5: UI Injection
function injectRuby(range, htmlString) {
  // Clear the original text in the range (Non-destructive to meaning, but replaces the raw text node)
  range.deleteContents();

  // Create a document fragment from the HTML string
  const template = document.createElement('template');
  // Wrap in a span to apply styling and allow easy reverting later
  template.innerHTML = `<span class="furigana-helper-injected" data-original-text="${lastProcessedText}">${htmlString}</span>`;
  
  // Insert the new <ruby> nodes seamlessly into the paragraph
  range.insertNode(template.content);

  // Clear the selection so the user doesn't accidentally drag-select the new ruby tags
  window.getSelection().removeAllRanges();
}

// Phase 6: Polish and Revert Functionality
document.addEventListener('click', (e) => {
  // Find the closest ancestor that is our injected span
  const injectedSpan = e.target.closest('.furigana-helper-injected');
  if (injectedSpan) {
    const originalText = injectedSpan.getAttribute('data-original-text');
    if (originalText) {
      // Revert the span back to the original raw text
      const textNode = document.createTextNode(originalText);
      injectedSpan.parentNode.replaceChild(textNode, injectedSpan);
    }
  }
});
