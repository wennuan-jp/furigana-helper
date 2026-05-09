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

  // Capture original HTML to restore it later
  const originalContents = range.cloneContents();
  const container = document.createElement('div');
  container.appendChild(originalContents);
  const originalHtml = container.innerHTML;

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
          injectRuby(range, response.data, originalHtml);
        } else {
          lastProcessedText = ""; // Reset to allow retry
        }
      },
    );
  } catch (e) {
    console.log("Furigana Helper: Message failed.");
    lastProcessedText = ""; // Reset to allow retry
  }
}

// Phase 5: UI Injection
function injectRuby(range, htmlString, originalHtml) {
  // Clear the original text in the range (Non-destructive to meaning, but replaces the raw text node)
  range.deleteContents();

  // Create a span to apply styling and allow easy reverting later
  const span = document.createElement('span');
  span.className = 'furigana-helper-injected';
  // Store original HTML and text for different use cases
  span.setAttribute('data-original-text', lastProcessedText);
  // Use a property to store HTML to avoid attribute length limits and complex escaping issues
  span._originalHtml = originalHtml;
  span.innerHTML = htmlString;
  
  // Insert the new span seamlessly into the paragraph
  range.insertNode(span);

  // Clear the selection so the user doesn't accidentally drag-select the new ruby tags
  window.getSelection().removeAllRanges();
}

// Phase 6: Polish and Revert Functionality
document.addEventListener('click', (e) => {
  // Find the closest ancestor that is our injected span
  const injectedSpan = e.target.closest('.furigana-helper-injected');
  if (injectedSpan) {
    const originalHtml = injectedSpan._originalHtml;
    if (originalHtml !== undefined) {
      // Create a temporary container to parse the HTML string back into nodes
      const temp = document.createElement('div');
      temp.innerHTML = originalHtml;
      
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      
      // Revert the span back to the original HTML structure
      injectedSpan.parentNode.replaceChild(fragment, injectedSpan);
    } else {
      // Fallback to text if HTML is not available
      const originalText = injectedSpan.getAttribute('data-original-text');
      if (originalText) {
        const textNode = document.createTextNode(originalText);
        injectedSpan.parentNode.replaceChild(textNode, injectedSpan);
      }
    }
  }
});
