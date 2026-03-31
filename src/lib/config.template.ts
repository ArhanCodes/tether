// Copy this file to config.ts to enable AI features.
// config.ts is gitignored so it doesn't conflict across machines.
//
// The Worker URL below is the shared Tether API — no API key needed.
// The Groq key lives on the Worker as a Cloudflare secret.

export const AI_CONFIG = {
  workerUrl: "https://tether-api.arhan-harchandani.workers.dev",
  apiKey: "", // Not needed — Worker handles auth
  model: "llama-3.3-70b-versatile",
  maxTokens: 512,
} as const;

export function isAIConfigured(): boolean {
  return AI_CONFIG.workerUrl.length > 0 || AI_CONFIG.apiKey.length > 0;
}
