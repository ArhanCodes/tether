// Copy this file to config.ts and fill in your API key.
// config.ts is gitignored so your key stays local.

export const AI_CONFIG = {
  apiKey: "", // Set your ANTHROPIC_API_KEY here
  model: "claude-sonnet-4-20250514",
  maxTokens: 512,
} as const;

export function isAIConfigured(): boolean {
  return AI_CONFIG.apiKey.length > 0;
}
