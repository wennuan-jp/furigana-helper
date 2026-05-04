// This script runs in the public folder, outside of Vite's bundling process.
// `Kuroshiro` and `KuromojiAnalyzer` are loaded via classic `<script>` tags in offscreen.html
// and exist as globals on the `window` object.

let kuroshiroInstance = null;
let kuroshiroInitializing = false;

async function initKuroshiro() {
  if (kuroshiroInstance) return true;
  if (kuroshiroInitializing) {
    while (kuroshiroInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    return !!kuroshiroInstance;
  }
  
  kuroshiroInitializing = true;
  try {
    const k = new window.Kuroshiro();
    // Kuromoji needs a dictionary. We use a public CDN so it doesn't inflate the extension size.
    await k.init(new window.KuromojiAnalyzer({ 
      dictPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/" 
    }));
    kuroshiroInstance = k;
    return true;
  } catch (err) {
    console.error("Failed to initialize Kuroshiro in offscreen:", err);
    return false;
  } finally {
    kuroshiroInitializing = false;
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROCESS_FURIGANA_OFFSCREEN") {
    (async () => {
      try {
        const isReady = await initKuroshiro();
        if (!isReady) throw new Error("Kuroshiro initialization failed in offscreen context");
        
        // mode "furigana" generates <ruby> tags
        const resultHtml = await kuroshiroInstance.convert(request.text, { mode: "furigana", to: "hiragana" });
        sendResponse({ success: true, data: resultHtml });
      } catch (err) {
        console.error("Offscreen processing error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});
