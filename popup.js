document.addEventListener("DOMContentLoaded", () => {

  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const settingsBtn = document.getElementById("settings-btn");
  const apiKeyInput = document.getElementById("api-key");
  const providerSelect = document.getElementById("provider-select");
  const saveButton = document.getElementById("save-btn");
  const deleteButton = document.getElementById("delete-btn");
  const statusDiv = document.getElementById("status");
  const apiStatusDiv = document.getElementById("api-status");
  const apiKeyForm = document.getElementById("api-key-form");
  const apiKeyConfigured = document.getElementById("api-key-configured");
  const rephraseConfigured = document.getElementById("rephrase-configured");
  const rephraseNotConfigured = document.getElementById(
    "rephrase-not-configured",
  );


  function openTab(tabName) {

    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => (content.style.display = "none"));


    const tabButton = document.querySelector(
      `.tab-button[data-tab="${tabName}"]`,
    );
    if (tabButton) {
      tabButton.classList.add("active");
    }
    document.getElementById(tabName).style.display = "block";


    if (tabName === "History") {
      loadHistory();
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openTab(button.dataset.tab);
    });
  });

  settingsBtn.addEventListener("click", () => {
    openTab("Settings");
  });


  function updateApiStatus() {
    const provider = providerSelect.value;
    const storageKey = provider === "mistral" ? "mistralApiKey" : "geminiApiKey";

    chrome.storage.local.get([storageKey], (result) => {
      const key = result[storageKey];
      if (key) {

        let maskedKey =
          key.length > 8
            ? `${key.substring(0, 4)}••••${key.substring(key.length - 4)}`
            : key;

        apiStatusDiv.innerHTML = `Status: <span class="masked-key">${maskedKey}</span> is configured for <strong>${provider}</strong>.`;
        apiStatusDiv.style.color = "green";

        apiKeyForm.style.display = "none";
        apiKeyConfigured.style.display = "block";

        rephraseConfigured.style.display = "block";
        rephraseNotConfigured.style.display = "none";
      } else {

        apiStatusDiv.innerHTML = `Status: No API Key found for <strong>${provider}</strong>.`;
        apiStatusDiv.style.color = "red";

        apiKeyForm.style.display = "block";
        apiKeyConfigured.style.display = "none";


        rephraseConfigured.style.display = "none";
        rephraseNotConfigured.style.display = "block";
      }
    });
  }


  providerSelect.addEventListener("change", () => {
    apiKeyInput.value = "";
    updateApiStatus();

    chrome.storage.local.set({ selectedProvider: providerSelect.value });
  });

  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const provider = providerSelect.value;
    const storageKey = provider === "mistral" ? "mistralApiKey" : "geminiApiKey";

    if (apiKey) {
      chrome.storage.local.set(
        { [storageKey]: apiKey, selectedProvider: provider },
        () => {
          apiKeyInput.value = "";
          updateApiStatus();
          statusDiv.textContent = `API Key for ${provider} saved!`;
          statusDiv.style.color = "green";
          setTimeout(() => {
            statusDiv.textContent = "";
          }, 3000);
        },
      );
    } else {
      statusDiv.textContent = "Please enter an API key to save.";
      statusDiv.style.color = "red";
      setTimeout(() => {
        statusDiv.textContent = "";
      }, 3000);
    }
  });

  deleteButton.addEventListener("click", () => {
    const provider = providerSelect.value;
    const storageKey = provider === "mistral" ? "mistralApiKey" : "geminiApiKey";

    if (
      confirm(
        `Are you sure you want to delete your ${provider} API Key?`,
      )
    ) {
      chrome.storage.local.remove([storageKey], () => {
        updateApiStatus();
        statusDiv.textContent = "API Key deleted.";
        statusDiv.style.color = "green";
        setTimeout(() => {
          statusDiv.textContent = "";
        }, 3000);
      });
    }
  });


  function loadHistory() {
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = "Loading history...";

    chrome.storage.local.get({ rephraseHistory: [] }, (result) => {
      const history = result.rephraseHistory;
      historyList.innerHTML = "";

      if (history.length === 0) {
        historyList.innerHTML =
          "<p>Your rephrasing history will appear here. Try rephrasing some text to get started!</p>";
        return;
      }

      history.reverse().forEach((item) => {
        const historyItem = document.createElement("div");
        historyItem.className = "history-item";
        historyItem.innerHTML = `<p><strong>Original:</strong> ${item.original}</p>`;

        const suggestionsList = document.createElement("ul");
        item.suggestions.forEach((s) => {
          const suggestionItem = document.createElement("li");
          suggestionItem.textContent = s;
          suggestionsList.appendChild(suggestionItem);
        });

        historyItem.appendChild(suggestionsList);
        historyList.appendChild(historyItem);
      });
    });
  }


  openTab("Main");


  chrome.storage.local.get(["selectedProvider"], (result) => {
    if (result.selectedProvider) {
      providerSelect.value = result.selectedProvider;
    }
    updateApiStatus();
  });

  const rephraseBtn = document.getElementById("rephrase-btn");
  const rephraseOutput = document.getElementById("rephrase-output");
  const copyBtn = document.getElementById("copy-btn");

  if (rephraseBtn) {
    rephraseBtn.addEventListener("click", () => {
      const textToRephrase = document.getElementById("rephrase-input").value;
      if (!textToRephrase) {
        rephraseOutput.innerText = "Please enter some text to rephrase.";
        return;
      }


      const historyItem = {
        original: textToRephrase,
        suggestions: [],
        date: new Date().toISOString(),
      };
      chrome.storage.local.get({ rephraseHistory: [] }, (result) => {
        let history = result.rephraseHistory;
        history.push(historyItem);

        if (history.length > 50) {
          history = history.slice(history.length - 50);
        }
        chrome.storage.local.set({ rephraseHistory: history });
      });

      rephraseOutput.innerText = "Rephrasing...";
      copyBtn.style.display = "none";

      chrome.runtime.sendMessage(
        {
          type: "rephrase",
          text: textToRephrase,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            rephraseOutput.innerText =
              "Error: " + chrome.runtime.lastError.message;
            return;
          }
          if (response.error) {
            rephraseOutput.innerText = `Error: ${response.error}`;
          } else {
            const suggestions = response.suggestions;
            if (suggestions && suggestions.length > 0) {
              const suggestionsList = document.createElement("ul");
              suggestions.forEach((s) => {
                const suggestionItem = document.createElement("li");
                suggestionItem.textContent = s;
                suggestionsList.appendChild(suggestionItem);
              });
              rephraseOutput.innerHTML = "";
              rephraseOutput.appendChild(suggestionsList);
              copyBtn.style.display = "block";
            } else {
              rephraseOutput.innerText = "No suggestions found.";
            }
          }
        },
      );
    });
  }



  const clearHistoryBtn = document.getElementById("clear-history-btn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      if (
        confirm(
          "Are you sure you want to clear your entire rephrasing history? This action cannot be undone.",
        )
      ) {
        chrome.storage.local.set({ rephraseHistory: [] }, () => {
          loadHistory();
        });
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const suggestions = Array.from(rephraseOutput.querySelectorAll("li")).map(
        (li) => li.textContent,
      );
      const textToCopy = suggestions.join("\n");
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.innerText = "Copied!";
        setTimeout(() => {
          copyBtn.innerText = "Copy";
        }, 2000);
      });
    });
  }
});
