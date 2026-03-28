// Copy this file to config.ts and fill in your API key.
// Get a free API key at https://console.groq.com
// config.ts is gitignored so your key stays local.

export const AI_CONFIG = {
  apiKey: "", // Set your GROQ_API_KEY here
  model: "llama-3.3-70b-versatile",
  maxTokens: 512,
} as const;

export function isAIConfigured(): boolean {
  return AI_CONFIG.apiKey.length > 0;
}
