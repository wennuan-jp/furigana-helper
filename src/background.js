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

// Process with Yahoo Cloud API
async function processWithYahoo(text, clientId) {
  const url = "https://jlp.yahooapis.jp/FuriganaService/V2/furigana";
  const payload = {
    id: "1234-1",
    jsonrpc: "2.0",
    method: "jlp.furiganaservice.furigana",
    params: {
      q: text,
      grade: 1 // Get furigana for all kanji
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `Yahoo AppID: ${clientId}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Yahoo API HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }

  let htmlResult = "";
  for (const word of data.result.word) {
    if (word.furigana && word.surface !== word.furigana) {
      htmlResult += `<ruby>${word.surface}<rt>${word.furigana}</rt></ruby>`;
    } else {
      htmlResult += word.surface;
    }
  }
  return htmlResult;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROCESS_FURIGANA") {
    
    // Process asynchronously
    (async () => {
      try {
        const items = await chrome.storage.sync.get({ useYahooApi: false, yahooClientId: '' });
        let resultHtml = "";
        
        if (items.useYahooApi && items.yahooClientId) {
          try {
            resultHtml = await processWithYahoo(request.text, items.yahooClientId);
          } catch (e) {
            console.warn("Yahoo API failed or rejected, falling back to local Kuroshiro:", e);
            resultHtml = await processWithKuroshiro(request.text);
          }
        } else {
          resultHtml = await processWithKuroshiro(request.text);
        }
        
        sendResponse({ success: true, data: resultHtml });
        
      } catch (err) {
        console.error("Background Processing Error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    
    return true; // Keep the message channel open for async sendResponse
  }
});
