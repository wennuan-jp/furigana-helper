// src/background.js

let creatingOffscreen; // A global promise to avoid race conditions

// Set up the offscreen document safely
async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Handle concurrent calls to setupOffscreenDocument
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  // Create document
  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Requires DOM APIs to run Kuromoji morphological analyzer for Japanese text.'
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

// Proxy the text to the offscreen document
async function processWithKuroshiro(text) {
  await setupOffscreenDocument();
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "PROCESS_FURIGANA_OFFSCREEN", text: text },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || "Unknown error processing text locally"));
        }
      }
    );
  });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROCESS_FURIGANA") {
    // Process asynchronously
    (async () => {
      try {
        const resultHtml = await processWithKuroshiro(request.text);
        sendResponse({ success: true, data: resultHtml });
      } catch (err) {
        console.error("Background Processing Error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep the message channel open for async sendResponse
  }
});
