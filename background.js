
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "rephrase") {
    handleRephrase(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        console.error("Error in handleRephrase:", error);
        sendResponse({ error: error.message || "Unknown error occurred." });
      });
    return true; // Keep the message channel open for async response
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

async function handleRephrase(message) {
  try {

    const storage = await getStorage(["selectedProvider", "geminiApiKey", "mistralApiKey", "apiKey"]);
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
        "Authorization": `Bearer ${apiKey}`
      };

      const prompt = `You are an expert multilingual text assistant. Your task is to correct and improve the following text. The text may be in English, 'Thanglish' (Tamil words written in English script), or Tamil.
1.  Correct all grammatical errors.
2.  Translate any Tamil or Thanglish words into their proper English equivalents.
3.  Provide up to 3 alternative, improved versions of the fully translated and corrected English text.
4.  Return ONLY the suggestions as a JSON array of strings, like this: ["suggestion 1", "suggestion 2", "suggestion 3"]. Do not include the original text or any other explanations.

The text to process is: "${message.text}"`;

      requestBody = {
        model: "codestral-latest",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      };

    } else {

      apiKey = storage.geminiApiKey || storage.apiKey;
      if (!apiKey) return { error: "Gemini API Key not set." };

      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      headers = {
        "Content-Type": "application/json",
      };

      const prompt = `You are an expert multilingual text assistant. Your task is to correct and improve the following text. The text may be in English, 'Thanglish' (Tamil words written in English script), or Tamil.
1.  Correct all grammatical errors.
2.  Translate any Tamil or Thanglish words into their proper English equivalents.
3.  Provide up to 3 alternative, improved versions of the fully translated and corrected English text.
4.  Return ONLY the suggestions as a JSON array of strings, like this: ["suggestion 1", "suggestion 2", "suggestion 3"]. Do not include the original text or any other explanations.

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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Details:", errorText);
      throw new Error(`API call failed with status: ${response.status}. Details: ${errorText}`);
    }

    const data = await response.json();


    let jsonResponseText;

    if (provider === "mistral") {

      if (data.choices && data.choices[0] && data.choices[0].message) {
        jsonResponseText = data.choices[0].message.content;
      }
    } else {

      const candidate = data.candidates && data.candidates[0];
      if (candidate && candidate.content && candidate.content.parts && candidate.content.parts[0]) {
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


      if (suggestions.length > 0) {
        const historyResult = await getStorage({ rephraseHistory: [] });
        let history = historyResult.rephraseHistory;

        const historyItem = history[history.length - 1];
        if (historyItem && historyItem.original === message.text) {
          historyItem.suggestions = suggestions;
          await setStorage({ rephraseHistory: history });
        }
      }

      return { suggestions: suggestions };
    } else {
      return { suggestions: [] };
    }
  } catch (error) {
    console.error("Error in handleRephrase logic:", error);
    return { error: "Failed to get suggestions: " + error.message };
  }
}


chrome.commands.onCommand.addListener((command) => {
  if (command === "rephrase-selection") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "rephraseSelection" });
      }
    });
  }
});
