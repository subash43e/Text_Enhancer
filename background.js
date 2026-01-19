let activeController = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "rephrase") {
    // Abort previous request if exists
    if (activeController) {
      activeController.abort();
    }
    activeController = new AbortController();

    handleRephrase(message, activeController.signal)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          sendResponse({ error: "Request aborted." });
        } else {
          console.error("Error in handleRephrase:", error);
          sendResponse({ error: error.message || "Unknown error occurred." });
        }
      })
      .finally(() => {
        activeController = null;
      });
    return true; // Keep the message channel open for async response
  } else if (message.type === "abort") {
    if (activeController) {
      activeController.abort();
      activeController = null;
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: "No active request." });
    }
  }
});

function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

function setStorage(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function handleRephrase(message, signal) {
  try {
    const storage = await getStorage([
      "selectedProvider",
      "geminiApiKey",
      "mistralApiKey",
      "apiKey",
    ]);
    const provider = storage.selectedProvider || "gemini";

    let apiKey;
    let apiUrl;
    let requestBody;
    let headers;

    if (provider === "mistral") {
      apiKey = storage.mistralApiKey;
      if (!apiKey) return { error: "Mistral API Key not set." };

      apiUrl = "https://codestral.mistral.ai/v1/chat/completions";
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };

      const prompt = `You are a helpful dictionary assistant.
Your task is to provide the definition/meaning and Tamil translation for the English word/text provided below.

Strictly output a valid JSON object with a single key "suggestions" containing an array of exactly two strings:
1. The English definition.
2. The Tamil translation.

Example format:
{
  "suggestions": [
    "Definition: [Insert definition here]",
    "Tamil Translation: [Insert Tamil translation here]"
  ]
}

The text to process is: "${message.text}"`;

      requestBody = {
        model: "codestral-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      };
    } else {
      apiKey = storage.geminiApiKey || storage.apiKey;
      if (!apiKey) return { error: "Gemini API Key not set." };

      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      headers = {
        "Content-Type": "application/json",
      };

      const prompt = `You are a helpful dictionary assistant.
Your task is to provide the definition/meaning and Tamil translation for the English word/text provided below.

Strictly output a valid JSON object with a single key "suggestions" containing an array of exactly two strings:
1. The English definition.
2. The Tamil translation.

Example format:
{
  "suggestions": [
    "Definition: [Insert definition here]",
    "Tamil Translation: [Insert Tamil translation here]"
  ]
}

The text to process is: "${message.text}"`;

      requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" },
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Details:", errorText);
      throw new Error(
        `API call failed with status: ${response.status}. Details: ${errorText}`,
      );
    }

    const data = await response.json();

    let jsonResponseText;

    if (provider === "mistral") {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        jsonResponseText = data.choices[0].message.content;
      }
    } else {
      const candidate = data.candidates && data.candidates[0];
      if (
        candidate &&
        candidate.content &&
        candidate.content.parts &&
        candidate.content.parts[0]
      ) {
        jsonResponseText = candidate.content.parts[0].text;
      }
    }

    if (jsonResponseText) {
      jsonResponseText = jsonResponseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let suggestions;
      try {
        suggestions = JSON.parse(jsonResponseText);

        if (!Array.isArray(suggestions) && suggestions.suggestions) {
          suggestions = suggestions.suggestions;
        }
      } catch (e) {
        console.error("Failed to parse JSON response:", jsonResponseText);
        return { error: "Failed to parse AI response." };
      }

      if (!Array.isArray(suggestions)) {
        suggestions = [];
      }

      return { suggestions: suggestions };
    } else {
      return { suggestions: [] };
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    console.error("Error in handleRephrase logic:", error);
    return { error: "Failed to get suggestions: " + error.message };
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "rephrase-selection") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const tab = tabs[0];

    // Filter out restricted URLs to prevent errors
    if (
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("https://chrome.google.com/webstore")
    ) {
      return;
    }

    // Try sending message first
    chrome.tabs.sendMessage(
      tab.id,
      { action: "rephraseSelection" },
      (response) => {
        // Check if message failed (likely because content script is missing)
        if (chrome.runtime.lastError) {
          console.log(
            "Script not ready, injecting...",
            chrome.runtime.lastError.message,
          );

          // Dynamically inject script and css
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              files: ["content.js"],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Injection failed:",
                  chrome.runtime.lastError.message,
                );
                return;
              }

              // Inject CSS as well
              chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ["content.css"],
              });

              // Retry sending message
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                  action: "rephraseSelection",
                });
              }, 100);
            },
          );
        }
      },
    );
  }
});
