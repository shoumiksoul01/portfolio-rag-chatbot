export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Secret",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      return handleIngest(request, env, corsHeaders);
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChat(request, env, corsHeaders);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
};

async function embed(env, text) {
  const result = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [text],
  });
  return result.data[0];
}

async function handleIngest(request, env, corsHeaders) {
  const secretHeader = request.headers.get("X-Ingest-Secret");
  if (secretHeader !== env.INGEST_SECRET) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const chunks = await request.json();

  const vectors = [];
  for (const chunk of chunks) {
    const vector = await embed(env, chunk.text);
    vectors.push({
      id: chunk.id,
      values: vector,
      metadata: {
        text: chunk.text,
        category: chunk.category,
      },
    });
  }

  await env.VECTORIZE.upsert(vectors);

  return new Response(
    JSON.stringify({ ingested: vectors.length }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

async function handleChat(request, env, corsHeaders) {
  const { query } = await request.json();

  const queryVector = await embed(env, query);

  const matches = await env.VECTORIZE.query(queryVector, {
    topK: 4,
    returnMetadata: true,
  });

  const sources = matches.matches.map((m) => m.metadata.category);
  const contextText = matches.matches
    .map((m) => m.metadata.text)
    .join("\n");

  const systemPrompt = `You are a portfolio assistant answering questions about Shoumik (Sheikh Shoumik Haque) for visitors to his website.
Answer ONLY using the context below. Speak in third person about Shoumik.
Keep answers to 2-4 sentences.
If the answer is not contained in the context, say you don't have that information and suggest emailing sheikhshoumik64@gmail.com.

Context:
${contextText}`;

  const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: query }] }],
      }),
    }
  );

  const geminiData = await geminiResponse.json();
  const answer =
    geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Sorry, something went wrong.";

  return new Response(
    JSON.stringify({ answer, sources }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}