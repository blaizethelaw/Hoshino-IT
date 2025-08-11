import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

async function callGemini(prompt, apiKey) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
      apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("internal", "Gemini API request failed: " + text);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export const agentAssistSummarize = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  if (request.auth?.token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
  const { text } = request.data;
  if (!text) {
    throw new HttpsError("invalid-argument", "text is required");
  }
  const apiKey = GEMINI_API_KEY.value();
  const summary = await callGemini(`Summarize the following text:\n${text}`, apiKey);
  return { summary };
});

export const agentAssistSuggestFix = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
  if (request.auth?.token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
  const { issue } = request.data;
  if (!issue) {
    throw new HttpsError("invalid-argument", "issue is required");
  }
  const apiKey = GEMINI_API_KEY.value();
  const suggestion = await callGemini(`Provide a step-by-step fix for the following IT issue:\n${issue}`, apiKey);
  return { suggestion };
});
