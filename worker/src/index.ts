// @ts-expect-error — wasm import handled by wrangler bundler
import wasmModule from "../wasm/tether_biomarker_bg.wasm";
import { __wbg_set_wasm, analyze_audio, __wbindgen_init_externref_table } from "../wasm/tether_biomarker_bg.js";

// Initialize the WASM module
const instance = new WebAssembly.Instance(wasmModule, {
  "./tether_biomarker_bg.js": { __wbindgen_init_externref_table },
});
__wbg_set_wasm(instance.exports);
__wbindgen_init_externref_table();

export interface Env {
  GROQ_API_KEY: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    systemPrompt: string;
    userMessage: string;
    model?: string;
    maxTokens?: number;
  };

  if (!body.systemPrompt || !body.userMessage) {
    return jsonResponse({ error: "Missing systemPrompt or userMessage" }, 400);
  }

  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: body.model ?? "llama-3.3-70b-versatile",
        max_tokens: body.maxTokens ?? 512,
        messages: [
          { role: "system", content: body.systemPrompt },
          { role: "user", content: body.userMessage },
        ],
      }),
    },
  );

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    return jsonResponse(
      { error: `Groq API error (${groqResponse.status})`, details: errorText },
      502,
    );
  }

  const data = await groqResponse.json();
  return jsonResponse(data);
}

async function handleAnalyze(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    samples: number[];
    sampleRate: number;
  };

  if (!body.samples || !body.sampleRate) {
    return jsonResponse({ error: "Missing samples or sampleRate" }, 400);
  }

  const samples = new Int16Array(body.samples);
  const resultJson = analyze_audio(samples, body.sampleRate);
  const report = JSON.parse(resultJson);

  return jsonResponse(report);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case "/chat":
          return await handleChat(request, env);
        case "/analyze":
          return await handleAnalyze(request);
        default:
          return jsonResponse({ error: "Not found" }, 404);
      }
    } catch (error) {
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
};
