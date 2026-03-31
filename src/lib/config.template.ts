// Copy this file to config.ts and fill in your settings.
// config.ts is gitignored so your secrets stay local.
//
// Option A (recommended): Deploy the Cloudflare Worker and set workerUrl.
//   cd worker && npm install && npx wrangler secret put GROQ_API_KEY && npm run deploy
//
// Option B: Set apiKey directly (key lives on device — dev only).

export const AI_CONFIG = {
  workerUrl: "", // e.g. "https://tether-api.your-subdomain.workers.dev"
  apiKey: "", // Direct Groq key (fallback if no worker)
  model: "llama-3.3-70b-versatile",
  maxTokens: 512,
} as const;

export function isAIConfigured(): boolean {
  return AI_CONFIG.workerUrl.length > 0 || AI_CONFIG.apiKey.length > 0;
}
