import OpenAI from "openai";

// Missing AI settings must not stop the whole app (e.g. a church that has not
// added an OpenAI key yet): AI calls then fail and their callers fall back.
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.warn("AI_INTEGRATIONS_OPENAI_API_KEY is not set; AI features are disabled until it is.");
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "not-configured",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
});
