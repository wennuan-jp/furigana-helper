# Furigana Helper - Chrome Extension Implementation Plan

## Technology Stack Recommendation

This extension will use a hybrid approach, offering an offline engine by default, with an option to upgrade to the Yahoo Japan API for higher accuracy.

1. **Extension Architecture**: **Chrome Extension Manifest V3**.
2. **Core Languages**: **Vanilla JavaScript (ES6+), HTML, and CSS**.
3. **Build Tool**: **Vite + @crxjs/vite-plugin**. Required to bundle the offline dictionary files and Node modules.
4. **Processing Engines (User Selectable)**:
   - **Engine A: Local Offline (Default)**: Uses `kuroshiro.js` and the `kuromoji` analyzer bundled directly into the extension. It requires no internet and no API keys.
   - **Engine B: Yahoo! JAPAN API (Optional)**: If the user wants higher accuracy, they can enter their own free Yahoo Client ID in the extension's settings popup to switch to cloud processing.

---

## Implementation Tasks

### Phase 1: Foundation and Build Setup
- [x] Initialize the project structure using `npm` and Vite.
- [x] Install `kuroshiro`, `kuroshiro-analyzer-kuromoji`, and `@crxjs/vite-plugin`.
- [x] Create the `manifest.json` (Manifest V3) with necessary permissions (`activeTab`, `scripting`, `storage`, and host permissions).

### Phase 2: Settings Popup UI
- [x] Create `popup.html`, `popup.css`, and `popup.js`.
- [x] Build a UI with a toggle switch: "Use Local Engine" vs "Use Yahoo API".
- [x] Build an input field for the **Yahoo Client ID** (only visible/enabled if Yahoo API is selected).
- [x] Save the user's preferences to `chrome.storage.sync`.

### Phase 3: Content Script & Text Selection
- [x] Inject `content.js` into pages via `manifest.json`.
- [x] Implement a listener for `mouseup` or `selectionchange` events to detect user text selection.
- [x] Filter out non-Japanese text selections (only process text containing Kanji).
- [x] Send the selected text to `background.js` for processing.

### Phase 4: Dual-Engine Background Processing
- [x] In `background.js`, load the user's engine preference from storage.
- [x] **If Local Engine**: Initialize Kuroshiro and use it to process the text.
- [x] **If Yahoo API**: Make a `fetch` request to the Yahoo Furigana endpoint using the user's stored Client ID.
- [x] Return the resulting phonetic reading (Furigana) to `content.js`.

### Phase 5: UI Injection (Non-Destructive Ruby Tags)
- *Crucial Rule: We NEVER replace the original text meaning. We only add phonetic data ABOVE the text.*
- [x] In `content.js`, locate the exact DOM `TextNode` of the user's selection.
- [x] Replace the raw text node with a native HTML `<ruby>` element.
- [x] **Kanji ➔ Furigana**: Transform `漢字` into `<ruby>漢字<rt>かんじ</rt></ruby>`.
- [x] Add CSS (`content.css`) to ensure the `<rt>` tags are clearly legible without breaking the page layout.

### Phase 6: Polish and Edge Cases
- [x] Ensure the DOM manipulation handles complex website layouts gracefully.
- [x] Handle errors (e.g., if the Yahoo API key is invalid, automatically fallback to the local engine and notify the user).
- [x] Provide a way to click the modified text to instantly revert it back to a standard text node.

---

## Future Optional Features
- [ ] **Reverse Conversion (Hiragana ➔ Kanji)**: Support Kana-Kanji conversion (e.g., `きこう` ➔ `<ruby>きこう<rt>気候 / 機構</rt></ruby>`). This is delayed for now to prioritize the core Kanji-to-Furigana experience.
