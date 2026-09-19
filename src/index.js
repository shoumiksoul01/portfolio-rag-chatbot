export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Ingest-Secret",
        },
      });
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      return handleIngest(request, env);
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function embed(env, text) {
  const result = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [text],
  });
  return result.data[0];
}

async function handleIngest(request, env) {
  const secretHeader = request.headers.get("X-Ingest-Secret");
  if (secretHeader !== env.INGEST_SECRET) {
    return new Response("Unauthorized", { status: 401 });
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
    { headers: { "Content-Type": "application/json" } }
  );
}

async function handleChat(request, env) {
  const { query } = await request.json();

  const queryVector = await embed(env, query);

  const matches = await env.VECTORIZE.query(queryVector, {
    topK: 4,
    returnMetadata: true,
  });

  const contextChunks = matches.matches.map((m) => m.metadata.text);

  return new Response(
    JSON.stringify({ contextChunks }),
    { headers: { "Content-Type": "application/json" } }
  );
}