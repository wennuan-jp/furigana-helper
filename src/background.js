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
  
  // Retry mechanism for offscreen communication
  // This handles the race condition where the document is created but scripts haven't finished loading.
  for (let i = 0; i < 5; i++) {
    try {
      return await new Promise((resolve, reject) => {
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
    } catch (err) {
      // If we've tried several times, or the error isn't about the message channel, give up.
      if (i === 4 || !err.message.includes("Could not establish connection")) {
        throw err;
      }
      console.log(`Furigana Helper: Offscreen message failed, retrying (${i + 1}/5)...`);
      await new Promise(r => setTimeout(r, 200 * (i + 1))); // Exponential backoff
    }
  }
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

// Preload the offscreen document when the extension is installed or the browser starts
chrome.runtime.onInstalled.addListener(setupOffscreenDocument);
chrome.runtime.onStartup.addListener(setupOffscreenDocument);

// Also try to setup whenever the service worker wakes up
setupOffscreenDocument();
