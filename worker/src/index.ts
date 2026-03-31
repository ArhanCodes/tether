export interface Env {
  GROQ_API_KEY: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers: CORS_HEADERS },
      );
    }

    const url = new URL(request.url);
    if (url.pathname !== "/chat") {
      return Response.json(
        { error: "Not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    try {
      const body = (await request.json()) as {
        systemPrompt: string;
        userMessage: string;
        model?: string;
        maxTokens?: number;
      };

      if (!body.systemPrompt || !body.userMessage) {
        return Response.json(
          { error: "Missing systemPrompt or userMessage" },
          { status: 400, headers: CORS_HEADERS },
        );
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
        return Response.json(
          { error: `Groq API error (${groqResponse.status})`, details: errorText },
          { status: 502, headers: CORS_HEADERS },
        );
      }

      const data = await groqResponse.json();
      return Response.json(data, { headers: CORS_HEADERS });
    } catch (error) {
      return Response.json(
        { error: "Internal server error" },
        { status: 500, headers: CORS_HEADERS },
      );
    }
  },
};
