if (!window.textEnhancerInjected) {
  window.textEnhancerInjected = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "rephraseSelection") {
      handleRephraseSelection();
    }
    // Return true only if you need to send an asynchronous response.
    // Here we don't strictly need it as we don't sendResponse back immediately for this action.
  });

  async function handleRephraseSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text) {
      alert("Please select some text to rephrase.");
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showLoadingUI(rect);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "rephrase",
        text: text,
      });

      if (response && response.suggestions) {
        showSuggestionsUI(rect, response.suggestions);
      } else if (response && response.error) {
        alert("Error: " + response.error);
        removeUI();
      } else {
        removeUI();
      }
    } catch (error) {
      console.error("Rephrase error:", error);
      alert("Error processing request: " + error.message);
      removeUI();
    }
  }

  let activePopup = null;

  function showLoadingUI(rect) {
    removeUI();

    const popup = document.createElement("div");
    popup.id = "ai-rephraser-popup";
    popup.className = "ai-rephraser-popup loading";
    popup.textContent = "Processing...";

    positionPopup(popup, rect);
    document.body.appendChild(popup);
    activePopup = popup;

    document.addEventListener("mousedown", handleOutsideClick);
  }

  function showSuggestionsUI(rect, suggestions) {
    if (!activePopup) return;

    activePopup.innerHTML = "";
    activePopup.classList.remove("loading");

    const title = document.createElement("div");
    title.className = "ai-rephraser-title";
    title.textContent = "Definition & Translation:";
    activePopup.appendChild(title);

    const list = document.createElement("ul");
    list.className = "ai-rephraser-list";

    suggestions.forEach((suggestion) => {
      const item = document.createElement("li");
      item.className = "ai-rephraser-item";
      item.textContent = suggestion;

      item.addEventListener("click", () => {
        replaceSelection(suggestion);
        removeUI();
      });

      list.appendChild(item);
    });

    activePopup.appendChild(list);

    positionPopup(activePopup, rect);
  }

  function positionPopup(popup, rect) {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    let top = rect.bottom + scrollTop + 10;
    let left = rect.left + scrollLeft;

    if (left + 300 > window.innerWidth) {
      left = window.innerWidth - 320;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
  }

  function removeUI() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
      document.removeEventListener("mousedown", handleOutsideClick);
    }
  }

  function handleOutsideClick(e) {
    if (activePopup && !activePopup.contains(e.target)) {
      removeUI();
    }
  }

  function replaceSelection(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA")
    ) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const val = activeElement.value;

      activeElement.value = val.substring(0, start) + text + val.substring(end);

      activeElement.selectionStart = activeElement.selectionEnd =
        start + text.length;
    } else if (activeElement && activeElement.isContentEditable) {
      document.execCommand("insertText", false, text);
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert("Suggestion copied to clipboard!");
      });
    }
  }
}
