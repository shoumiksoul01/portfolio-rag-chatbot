export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/ingest") {
      return new Response(JSON.stringify({ message: "ingest endpoint - not yet implemented" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      return new Response(JSON.stringify({ message: "chat endpoint - not yet implemented" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};