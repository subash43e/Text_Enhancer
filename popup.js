document.addEventListener("DOMContentLoaded", () => {
  // --- Tabs & Navigation ---
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const settingsBtn = document.getElementById("settings-btn");
  const goToSettingsBtn = document.getElementById("go-to-settings-btn");

  function openTab(tabName) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    tabContents.forEach((content) => {
      content.style.display = content.id === tabName ? "block" : "none";
    });
    if (tabName === "History") loadHistory();
  }

  tabButtons.forEach((btn) =>
    btn.addEventListener("click", () => openTab(btn.dataset.tab)),
  );
  settingsBtn.addEventListener("click", () => openTab("Settings"));
  if (goToSettingsBtn)
    goToSettingsBtn.addEventListener("click", () => openTab("Settings"));

  // --- Settings & API Management ---
  const providerSelect = document.getElementById("provider-select");
  const homeProviderSelect = document.getElementById("home-provider-select");
  const rephraseConfigured = document.getElementById("rephrase-configured");
  const rephraseNotConfigured = document.getElementById(
    "rephrase-not-configured",
  );
  const globalStatus = document.getElementById("global-status");
  const offlineIndicator = document.getElementById("offline-indicator");
  const offlineModeToggle = document.getElementById("offline-mode-toggle");

  // Elements for Rephrasing
  const rephraseBtn = document.getElementById("rephrase-btn");
  const searchWebBtn = document.getElementById("search-web-btn");
  const stopBtn = document.getElementById("stop-btn");
  const rephraseInput = document.getElementById("rephrase-input");
  const rephraseOutput = document.getElementById("rephrase-output");

  // Elements for Search Settings
  const homeSearchProviderSelect = document.getElementById(
    "home-search-provider-select",
  );
  const settingsSearchProviderSelect = document.getElementById(
    "settings-search-provider-select",
  );
  const customSearchSettingsGroup = document.getElementById(
    "custom-search-settings-group",
  );
  const customSearchUrlInput = document.getElementById("custom-search-url");
  const saveSearchSettingsBtn = document.getElementById(
    "save-search-settings-btn",
  );

  // Elements for Gemini
  const geminiInput = document.getElementById("gemini-key-input");
  const saveGeminiBtn = document.getElementById("save-gemini-btn");
  const deleteGeminiBtn = document.getElementById("delete-gemini-btn");
  const geminiStatusBadge = document.getElementById("gemini-status-badge");
  const geminiInputContainer = document.getElementById(
    "gemini-input-container",
  );
  const geminiActions = document.getElementById("gemini-actions");
  const geminiCard = document.getElementById("gemini-card");

  // Elements for Mistral
  const mistralInput = document.getElementById("mistral-key-input");
  const saveMistralBtn = document.getElementById("save-mistral-btn");
  const deleteMistralBtn = document.getElementById("delete-mistral-btn");
  const mistralStatusBadge = document.getElementById("mistral-status-badge");
  const mistralInputContainer = document.getElementById(
    "mistral-input-container",
  );
  const mistralActions = document.getElementById("mistral-actions");
  const mistralCard = document.getElementById("mistral-card");

  function updateSettingsUI() {
    chrome.storage.local.get(
      [
        "geminiApiKey",
        "mistralApiKey",
        "selectedProvider",
        "forceOffline",
        "searchProvider",
        "customSearchUrl",
      ],
      (result) => {
        const currentProvider = result.selectedProvider || "gemini";
        providerSelect.value = currentProvider;
        if (homeProviderSelect) homeProviderSelect.value = currentProvider;

        // Update Toggle
        offlineModeToggle.checked = result.forceOffline || false;

        // Update Search Settings
        const searchProvider = result.searchProvider || "google";
        const customUrl = result.customSearchUrl || "";

        if (homeSearchProviderSelect) {
          homeSearchProviderSelect.value = searchProvider;
        }
        if (settingsSearchProviderSelect) {
          settingsSearchProviderSelect.value = searchProvider;
        }

        if (searchProvider === "custom") {
          if (customSearchSettingsGroup)
            customSearchSettingsGroup.style.display = "block";
          customSearchUrlInput.value = customUrl;
        } else {
          if (customSearchSettingsGroup)
            customSearchSettingsGroup.style.display = "none";
        }

        // Highlight active provider card
        geminiCard.classList.toggle(
          "active-provider",
          currentProvider === "gemini",
        );
        mistralCard.classList.toggle(
          "active-provider",
          currentProvider === "mistral",
        );

        // Check if current provider is ready
        const currentKey =
          currentProvider === "mistral"
            ? result.mistralApiKey
            : result.geminiApiKey;
        if (currentKey) {
          rephraseConfigured.style.display = "block";
          rephraseNotConfigured.style.display = "none";
        } else {
          rephraseConfigured.style.display = "none";
          rephraseNotConfigured.style.display = "block";
        }

        // Update Gemini UI
        if (result.geminiApiKey) {
          geminiStatusBadge.textContent = "Configured";
          geminiStatusBadge.classList.add("configured");
          geminiInputContainer.style.display = "none";
          geminiActions.style.display = "block";
        } else {
          geminiStatusBadge.textContent = "Not Configured";
          geminiStatusBadge.classList.remove("configured");
          geminiInputContainer.style.display = "block";
          geminiActions.style.display = "none";
        }

        // Update Mistral UI
        if (result.mistralApiKey) {
          mistralStatusBadge.textContent = "Configured";
          mistralStatusBadge.classList.add("configured");
          mistralInputContainer.style.display = "none";
          mistralActions.style.display = "block";
        } else {
          mistralStatusBadge.textContent = "Not Configured";
          mistralStatusBadge.classList.remove("configured");
          mistralInputContainer.style.display = "block";
          mistralActions.style.display = "none";
        }
      },
    );
  }

  // Toggle Handler
  offlineModeToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ forceOffline: e.target.checked }, () => {
      updateOnlineStatus(); // Immediately reflect change
      showStatus(
        e.target.checked ? "Offline Mode Enabled" : "Offline Mode Disabled",
        "success",
      );
    });
  });

  // Search Settings Handlers
  function handleSearchProviderChange(provider) {
    chrome.storage.local.set({ searchProvider: provider }, () => {
      updateSettingsUI();
      showStatus(
        `Web Search set to ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
        "success",
      );
    });
  }

  if (homeSearchProviderSelect) {
    homeSearchProviderSelect.addEventListener("change", () => {
      handleSearchProviderChange(homeSearchProviderSelect.value);
    });
  }

  if (settingsSearchProviderSelect) {
    settingsSearchProviderSelect.addEventListener("change", () => {
      handleSearchProviderChange(settingsSearchProviderSelect.value);
    });
  }

  if (saveSearchSettingsBtn) {
    saveSearchSettingsBtn.addEventListener("click", () => {
      const customUrl = customSearchUrlInput.value.trim();
      if (!customUrl) {
        showStatus("Please enter a custom URL", "error");
        return;
      }
      if (!customUrl.includes("%s")) {
        showStatus("URL must contain '%s' for query", "warning");
        // Allow saving anyway, but warn
      }

      chrome.storage.local.set(
        {
          searchProvider: "custom",
          customSearchUrl: customUrl,
        },
        () => {
          showStatus("Custom search settings saved", "success");
        },
      );
    });
  }

  // Save Handlers
  saveGeminiBtn.addEventListener("click", () => {
    const key = geminiInput.value.trim();
    if (key) {
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        geminiInput.value = "";
        updateSettingsUI();
        showStatus("Gemini API Key saved!", "success");
      });
    }
  });

  saveMistralBtn.addEventListener("click", () => {
    const key = mistralInput.value.trim();
    if (key) {
      chrome.storage.local.set({ mistralApiKey: key }, () => {
        mistralInput.value = "";
        updateSettingsUI();
        showStatus("Mistral API Key saved!", "success");
      });
    }
  });

  // Delete Handlers
  deleteGeminiBtn.addEventListener("click", () => {
    if (confirm("Remove Google Gemini API Key?")) {
      chrome.storage.local.remove("geminiApiKey", () => {
        updateSettingsUI();
        showStatus("Gemini API Key removed.", "success");
      });
    }
  });

  deleteMistralBtn.addEventListener("click", () => {
    if (confirm("Remove Mistral API Key?")) {
      chrome.storage.local.remove("mistralApiKey", () => {
        updateSettingsUI();
        showStatus("Mistral API Key removed.", "success");
      });
    }
  });

  // Provider Switch Handler
  providerSelect.addEventListener("change", () => {
    chrome.storage.local.set({ selectedProvider: providerSelect.value }, () => {
      updateSettingsUI();
      showStatus(
        `Active provider switched to ${providerSelect.options[providerSelect.selectedIndex].text}`,
        "success",
      );
    });
  });

  if (homeProviderSelect) {
    homeProviderSelect.addEventListener("change", () => {
      chrome.storage.local.set(
        { selectedProvider: homeProviderSelect.value },
        () => {
          updateSettingsUI();
        },
      );
    });
  }

  function showStatus(msg, type) {
    globalStatus.textContent = msg;
    globalStatus.style.color =
      type === "error" ? "var(--danger)" : "var(--success)";
    setTimeout(() => (globalStatus.textContent = ""), 3000);
  }

  // --- Offline Detection ---
  let cachedHistory = [];

  function loadCachedHistory() {
    chrome.storage.local.get({ rephraseHistory: [] }, (result) => {
      cachedHistory = result.rephraseHistory;
    });
  }

  function updateOnlineStatus() {
    chrome.storage.local.get(["forceOffline"], (result) => {
      const isForcedOffline = result.forceOffline || false;
      const isActuallyOffline = !navigator.onLine;

      if (isForcedOffline || isActuallyOffline) {
        offlineIndicator.style.display = "block";
        rephraseBtn.textContent = "Search Offline History";
        rephraseInput.placeholder = "Type to search cached words...";
        loadCachedHistory(); // Ensure cache is ready

        if (isForcedOffline) {
          offlineIndicator.innerHTML = `🔒 <strong>Force Offline Enabled:</strong> Searching cache only.`;
        } else {
          offlineIndicator.innerHTML = `⚠️ <strong>No Internet:</strong> Searching cache only.`;
        }
      } else {
        offlineIndicator.style.display = "none";
        rephraseBtn.textContent = "Rephrase Text";
        rephraseInput.placeholder = "Paste or type text to rephrase...";
        document.getElementById("autocomplete-list").style.display = "none"; // Hide autocomplete
      }
    });
  }

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  // Initial check requires waiting for storage
  setTimeout(updateOnlineStatus, 100);

  // --- Autocomplete Logic ---
  const autocompleteList = document.getElementById("autocomplete-list");
  let currentFocus = -1;

  rephraseInput.addEventListener("input", function (e) {
    const val = this.value;
    closeAllLists();

    // Only show autocomplete if we are in offline mode (checked via button text/indicator state for speed)
    // or strictly checking the flags
    if (!val) return false;

    const isOffline = offlineIndicator.style.display === "block";
    if (!isOffline) return;

    currentFocus = -1;

    const matches = cachedHistory.filter((item) =>
      item.original.toLowerCase().includes(val.toLowerCase()),
    );

    if (matches.length === 0) return;

    autocompleteList.style.display = "block";

    // Limit to 5 suggestions
    matches.slice(0, 5).forEach((match) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item";
      // Highlight matching part
      const regex = new RegExp(`(${val})`, "gi");
      div.innerHTML = match.original.replace(regex, "<strong>$1</strong>");

      div.addEventListener("click", function () {
        rephraseInput.value = match.original;
        closeAllLists();
        rephraseBtn.click(); // Trigger search immediately
      });

      autocompleteList.appendChild(div);
    });
  });

  rephraseInput.addEventListener("keydown", function (e) {
    const list = document.getElementById("autocomplete-list");
    if (list.style.display === "none") return;

    let items = list.getElementsByClassName("autocomplete-item");
    if (e.key === "ArrowDown") {
      currentFocus++;
      addActive(items);
    } else if (e.key === "ArrowUp") {
      currentFocus--;
      addActive(items);
    } else if (e.key === "Enter") {
      if (currentFocus > -1) {
        e.preventDefault();
        if (items[currentFocus]) items[currentFocus].click();
      }
    }
  });

  function addActive(items) {
    if (!items) return false;
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("active");
    items[currentFocus].scrollIntoView({ block: "nearest" });
  }

  function removeActive(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove("active");
    }
  }

  function closeAllLists() {
    autocompleteList.innerHTML = "";
    autocompleteList.style.display = "none";
  }

  document.addEventListener("click", function (e) {
    if (e.target !== rephraseInput) {
      closeAllLists();
    }
  });

  // --- Rephrasing Logic ---
  if (rephraseBtn && rephraseInput) {
    if (searchWebBtn) {
      searchWebBtn.addEventListener("click", () => {
        const text = rephraseInput.value.trim();
        if (!text) {
          showStatus("Enter text to search", "error");
          return;
        }

        chrome.storage.local.get(
          ["searchProvider", "customSearchUrl"],
          (result) => {
            const provider = result.searchProvider || "google";
            let url;
            const encodedText = encodeURIComponent(text);

            switch (provider) {
              case "google":
                url = `https://www.google.com/search?q=define:${encodedText}`;
                break;
              case "bing":
                url = `https://www.bing.com/search?q=${encodedText}`;
                break;
              case "duckduckgo":
                url = `https://duckduckgo.com/?q=${encodedText}`;
                break;
              case "yahoo":
                url = `https://search.yahoo.com/search?p=${encodedText}`;
                break;
              case "baidu":
                url = `https://www.baidu.com/s?wd=${encodedText}`;
                break;
              case "yandex":
                url = `https://yandex.com/search/?text=${encodedText}`;
                break;
              case "custom":
                if (result.customSearchUrl) {
                  url = result.customSearchUrl.replace("%s", encodedText);
                } else {
                  showStatus(
                    "Please configure Custom URL in Settings",
                    "error",
                  );
                  return;
                }
                break;
              default:
                url = `https://www.google.com/search?q=${encodedText}`;
            }

            chrome.tabs.create({ url: url });
          },
        );
      });
    }

    rephraseInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        // If autocomplete is open and focused, do nothing (handled above)
        if (autocompleteList.style.display === "block" && currentFocus > -1)
          return;

        e.preventDefault();
        rephraseBtn.click();
      }
    });

    rephraseBtn.addEventListener("click", () => {
      const text = rephraseInput.value.trim();
      closeAllLists(); // Close suggestions on search

      if (!text) {
        rephraseOutput.innerHTML = `<div class="status-box error">Please enter text to search.</div>`;
        return;
      }

      chrome.storage.local.get(["forceOffline"], (result) => {
        const isForcedOffline = result.forceOffline || false;

        // Offline Handling (Actual offline OR Forced offline)
        if (!navigator.onLine || isForcedOffline) {
          rephraseOutput.innerHTML = `<div class="empty-state">Searching local history...</div>`;

          // Re-fetch to be safe
          chrome.storage.local.get({ rephraseHistory: [] }, (result) => {
            const history = result.rephraseHistory;
            const matches = history.filter((item) =>
              item.original.toLowerCase().includes(text.toLowerCase()),
            );

            if (matches.length > 0) {
              rephraseOutput.innerHTML = "";
              const bestMatch = matches[matches.length - 1]; // Most recent
              renderSuggestions(bestMatch.suggestions, true);
              rephraseInput.value = "";
            } else {
              rephraseOutput.innerHTML = `<div class="status-box warning">No cached result found for "${text}". ${isForcedOffline ? "Disable Force Offline" : "Connect to the internet"} to search.</div>`;
            }
          });
          return;
        }

        // Online Handling
        rephraseOutput.innerHTML = `<div class="empty-state">Thinking...</div>`;
        rephraseBtn.style.display = "none";
        if (stopBtn) stopBtn.style.display = "inline-block";

        let isStopped = false;

        if (stopBtn) {
          stopBtn.onclick = () => {
            isStopped = true;
            chrome.runtime.sendMessage({ type: "abort" }, () => {
              rephraseBtn.style.display = "inline-block";
              stopBtn.style.display = "none";
              rephraseOutput.innerHTML = `<div class="status-box warning">Request stopped.</div>`;
            });
          };
        }

        chrome.runtime.sendMessage(
          { type: "rephrase", text: text },
          (response) => {
            if (isStopped) return; // Ignore response if stopped

            rephraseBtn.style.display = "inline-block";
            if (stopBtn) {
              stopBtn.style.display = "none";
            }
            rephraseBtn.textContent = "Rephrase Text";

            if (chrome.runtime.lastError) {
              // Ignore if we manually aborted (handled by stop button logic usually, but good to catch)
              if (
                chrome.runtime.lastError.message !==
                "The message port closed before a response was received."
              ) {
                rephraseOutput.innerHTML = `<div class="status-box error">${chrome.runtime.lastError.message}</div>`;
              }
              return;
            }
            if (response.error) {
              if (response.error === "Request aborted.") {
                rephraseOutput.innerHTML = `<div class="status-box warning">Request stopped by user.</div>`;
              } else {
                rephraseOutput.innerHTML = `<div class="status-box error">${response.error}</div>`;
              }
              return;
            }

            const suggestions = response.suggestions;
            if (suggestions && suggestions.length > 0) {
              saveToHistory(text, suggestions);
              renderSuggestions(suggestions, false);
              rephraseInput.value = "";
            } else {
              rephraseOutput.innerHTML = `<div class="empty-state">No result returned.</div>`;
            }
          },
        );
      });
    });
  }

  function renderSuggestions(suggestions, isOffline) {
    rephraseOutput.innerHTML = "";

    if (isOffline) {
      const offlineBadge = document.createElement("div");
      offlineBadge.className = "status-badge";
      offlineBadge.textContent = "Retrieved from Offline Cache";
      offlineBadge.style.display = "inline-block";
      offlineBadge.style.marginBottom = "8px";
      rephraseOutput.appendChild(offlineBadge);
    }

    suggestions.forEach((s) => {
      const card = document.createElement("div");
      card.className = "suggestion-card";
      card.textContent = s;
      card.title = "Click to copy";
      card.addEventListener("click", () => {
        navigator.clipboard.writeText(s).then(() => {
          const original = card.textContent;
          card.textContent = "Copied!";
          card.style.borderColor = "var(--success)";
          card.style.color = "var(--success)";
          setTimeout(() => {
            card.textContent = original;
            card.style.borderColor = "";
            card.style.color = "";
          }, 1000);
        });
      });
      rephraseOutput.appendChild(card);
    });
  }

  // --- History Logic ---
  function saveToHistory(original, suggestions) {
    chrome.storage.local.get({ rephraseHistory: [] }, (result) => {
      const history = result.rephraseHistory;
      const filteredHistory = history.filter(
        (item) => item.original.toLowerCase() !== original.toLowerCase(),
      );

      filteredHistory.push({
        original,
        suggestions,
        date: new Date().toISOString(),
      });
      if (filteredHistory.length > 100)
        filteredHistory.splice(0, filteredHistory.length - 100);

      chrome.storage.local.set({ rephraseHistory: filteredHistory });

      // Update local cache for autocomplete immediately
      cachedHistory = filteredHistory;
    });
  }

  function loadHistory() {
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = `<div class="empty-state">Loading...</div>`;

    chrome.storage.local.get({ rephraseHistory: [] }, (result) => {
      const history = result.rephraseHistory;
      historyList.innerHTML = "";
      if (history.length === 0) {
        historyList.innerHTML = `<div class="empty-state">No history available.</div>`;
        return;
      }
      history.reverse().forEach((item) => {
        const el = document.createElement("div");
        el.className = "history-item";
        el.innerHTML = `
                    <div class="history-original">Original</div>
                    <div class="history-text">${item.original}</div>
                    <div class="history-suggestions">
                        <ul>${item.suggestions.map((s) => `<li>${s}</li>`).join("")}</ul>
                    </div>
                `;
        historyList.appendChild(el);
      });
    });
  }

  const clearHistoryBtn = document.getElementById("clear-history-btn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      if (confirm("Clear all history? This will remove your offline cache.")) {
        chrome.storage.local.set({ rephraseHistory: [] }, () => {
          loadHistory();
          cachedHistory = []; // Clear cache too
        });
      }
    });
  }

  // Initialize
  openTab("Rephrase");
  updateSettingsUI();

  // Focus input on start
  setTimeout(() => {
    rephraseInput?.focus();
  }, 100);
});
