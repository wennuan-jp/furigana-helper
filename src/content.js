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

const resultCache = new Map(); // Global cache to store text -> furiganaHtml mapping

function processFuriganaForSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  // Check if we are already inside an injected span to prevent nested injection
  const parentElement = selection.anchorNode?.parentElement;
  if (parentElement?.closest('.furigana-helper-injected')) {
    console.log("Furigana Helper: Selection is already inside an injected area. Ignoring.");
    return;
  }

  const text = selection.toString().trim();

  // If no text is selected, do nothing
  if (!text || text.length === 0) {
    return;
  }

  // Filter out non-Japanese text (must contain at least one Kanji)
  if (!KANJI_REGEX.test(text)) {
    return;
  }

  // Capture the exact DOM range of the user's selection
  const range = selection.getRangeAt(0).cloneRange();

  // Capture original HTML to restore it later
  const originalContents = range.cloneContents();
  const container = document.createElement('div');
  container.appendChild(originalContents);
  const originalHtml = container.innerHTML;

  // Optimization: Check if we have a cached result for this exact text
  if (resultCache.has(text)) {
    console.log("Furigana Helper: Cache hit! Using cached reading for:", text);
    const cachedHtml = resultCache.get(text);
    // showDebugLog(text, cachedHtml + " (FROM CACHE)");
    injectRuby(range, cachedHtml, originalHtml, text);
    return;
  }

  console.log("Furigana Helper: Kanji detected. Sending to background...", text);

  // Send the selected text to background.js
  try {
    chrome.runtime.sendMessage(
      { action: "PROCESS_FURIGANA", text: text },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log("Furigana Helper: Extension context invalidated or background script not ready.");
          return;
        }

        if (response && response.success && response.data) {
          console.log("Furigana Helper: Received reading, injecting UI...");
          resultCache.set(text, response.data); // Store in cache for future use
          // showDebugLog(text, response.data);
          injectRuby(range, response.data, originalHtml, text);
        }
      },
    );
  } catch (e) {
    console.log("Furigana Helper: Message failed.");
  }
}

/*
// Debug helper to show logs on screen without taking focus
function showDebugLog(original, result) {
  let logContainer = document.getElementById('furigana-helper-debug-log');
  if (!logContainer) {
    logContainer = document.createElement('div');
    logContainer.id = 'furigana-helper-debug-log';
    document.body.appendChild(logContainer);
  }

  const logEntry = document.createElement('div');
  logEntry.className = 'debug-log-entry';
  logEntry.innerHTML = `
    <div class="debug-label">Selected Text</div>
    <div style="margin-bottom: 8px;">${original}</div>
    <div class="debug-label">Result HTML</div>
    <div class="debug-text-code">${result.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  `;

  logContainer.prepend(logEntry); // Show newest entries at the top

  // Keep only the last 10 entries to avoid performance issues
  if (logContainer.children.length > 10) {
    logContainer.lastElementChild.remove();
  }
}
*/

// Phase 5: UI Injection
function injectRuby(range, htmlString, originalHtml, originalText) {
  // Clear the original text in the range (Non-destructive to meaning, but replaces the raw text node)
  range.deleteContents();

  // Create a span to apply styling and allow easy reverting later
  const span = document.createElement('span');
  span.className = 'furigana-helper-injected';
  // Store original HTML and text for different use cases
  span.setAttribute('data-original-text', originalText);
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
