# Portfolio RAG Chatbot

A hand-built Retrieval-Augmented Generation (RAG) chatbot embedded in
my personal portfolio site. Visitors can ask natural-language
questions — *"What's Shoumik's CGPA?"*, *"Tell me about his
research"* — and get answers generated strictly from my real
portfolio content, not from the model's general knowledge or
hallucinated guesses.

**Live demo:** https://shoumiksoul01.github.io (chat bubble, bottom-right)
**Live API:** https://portfolio-rag.sheikhshoumik64.workers.dev

---

## Why I built it this way

Most "add AI to your site" tutorials point you at a managed
auto-RAG service where you upload a document and get an endpoint
back. I deliberately avoided that. I wanted to own every layer —
chunking strategy, embedding model, vector search, prompt
construction, generation — so I could explain and defend each
decision in an interview, not just say "I used a RAG API."

That also means the whole thing runs on infrastructure I can
reason about end to end: one serverless backend, one vector
database, one LLM call, no hidden orchestration layer.

---

## Architecture

```
Visitor types a question
        │
        ▼
Embed the question           (Cloudflare Workers AI)
        │
        ▼
Vector similarity search      (Cloudflare Vectorize)
        │  → top 4 most relevant content chunks
        ▼
Build a grounded prompt       (context + guardrails)
        │
        ▼
Generate an answer            (Google Gemini API)
        │
        ▼
Return {answer, sources} → rendered in the chat widget
```

Two Worker routes handle everything:

| Route | Method | Purpose |
|---|---|---|
| `/ingest` | POST | Embeds every chunk in `data/content.json` and upserts it into Vectorize. Protected by an `X-Ingest-Secret` header so only I can re-index content. |
| `/chat` | POST | Takes `{"query": "..."}`, retrieves the top-4 relevant chunks, and returns `{"answer": "...", "sources": [...]}`. |

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Cloudflare Workers | Serverless, no infra to manage, generous free tier |
| Embeddings | Workers AI — `@cf/baai/bge-base-en-v1.5` (768-dim) | Free, colocated with the Worker, no extra network hop |
| Vector store | Cloudflare Vectorize (`portfolio-index`, cosine metric) | Same ecosystem as the Worker, free tier covers this easily |
| Generation | Google Gemini API — `gemini-3.5-flash-lite` | Originally planned around Claude's Haiku model, but pivoted after confirming the Claude API has no free tier — Gemini's free tier keeps the whole project at $0/month for portfolio-scale traffic |
| Frontend | Vanilla HTML/CSS/JS widget | No framework overhead for a single floating chat bubble; matches the portfolio's existing navy/blue theme natively |

---

## Content & retrieval design

- `data/content.json` holds 22 hand-written chunks — one fact per
  chunk (bio, education, skills, projects, experience,
  certifications) — rather than dumping raw resume text and letting
  the model figure out chunk boundaries. This keeps retrieval
  precise and avoids awkward mid-sentence splits.
- Research directions that aren't finalized yet (ongoing thesis
  topics) are deliberately **excluded** from the public content set
  until confirmed — the chatbot should never state something about
  me that isn't settled.
- Retrieval uses `topK=4`. This is a known trade-off: broad,
  multi-part questions ("list *all* your projects") can miss chunks
  outside the top 4 nearest matches. A fix worth exploring later:
  raising `topK` for certain question patterns, or reranking.
- The system prompt explicitly constrains the model to answer only
  from retrieved context, respond in third person, stay to 2–4
  sentences, and redirect to email when the answer isn't in scope —
  plus guardrails against prompt-injection attempts from visitors
  trying to get it to ignore its instructions.

---

## Project structure

```
portfolio-rag-chatbot/
├── data/
│   └── content.json       # 22 portfolio content chunks (id, category, text)
├── src/
│   └── index.js            # Worker: /ingest + /chat routes
├── widget/
│   └── chat-widget.html    # Self-contained chat bubble (HTML+CSS+JS)
├── wrangler.toml            # Cloudflare Worker config
├── package.json
├── .gitignore
└── README.md
```

---

## Setup from scratch

**1. Install dependencies**
```
npm install
```

**2. Create the Vectorize index**
```
npx wrangler vectorize create portfolio-index --dimensions=768 --metric=cosine
```

**3. Register a workers.dev subdomain** (one-time, only needed if your Cloudflare account doesn't have one yet)
Deploy any Worker via the Cloudflare dashboard once, or just run `wrangler deploy` — it'll prompt you to set one up if missing.

**4. Get a free Gemini API key**
https://aistudio.google.com/apikey

**5. Set local secrets** — create a `.dev.vars` file in the project root (gitignored, never committed):
```
GEMINI_API_KEY=your-key-here
INGEST_SECRET=any-random-string
```

**6. Run locally**
Vectorize can't be fully simulated locally, so local dev needs `--remote` to hit real Cloudflare resources:
```
npm run dev -- --remote
```

**7. Set production secrets**
```
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put INGEST_SECRET
```

**8. Deploy**
```
npm run deploy
```

**9. Ingest your content**
Run once, and again anytime `data/content.json` changes:
```
curl -X POST https://your-worker-url/ingest -H "X-Ingest-Secret: your-secret" -H "Content-Type: application/json" --data "@data/content.json"
```
*(On Windows PowerShell, use `curl.exe` — the built-in `curl` alias doesn't support this syntax.)*

**10. Wire the widget into your site**
Paste the contents of `widget/chat-widget.html` into your site's HTML, just before `</body>`. Update the `WORKER_URL` constant in the script if your deployed Worker URL differs.

**11. Lock down CORS**
Before going live, set `ALLOWED_ORIGIN` in `wrangler.toml` to your real domain (not `*`), then redeploy with `npm run deploy`.

---

## Known limitations / future improvements

- **`topK=4` retrieval ceiling** — broad questions can miss relevant chunks outside the top 4 matches. Worth experimenting with dynamic `topK` or a lightweight reranking step.
- **No conversation memory** — each question is answered independently with no chat history in the prompt. Fine for quick Q&A, but multi-turn follow-ups ("what about his other ones?") can lose context.
- **No rate limiting on `/chat`** — currently open to any origin matching `ALLOWED_ORIGIN`. Low risk at portfolio scale, but a production version would add basic rate limiting to control Gemini API usage.
- **Occasional minor factual drift** — the model can sometimes lightly embellish beyond the literal context (e.g. slightly altering a date). Tightening the system prompt's strictness is an open task.

---

## Cost

Entirely free at portfolio-scale traffic:
- Cloudflare Workers, Workers AI, and Vectorize — free tier
- Google Gemini API — free tier (`gemini-3.5-flash-lite`)

No paid services required to run this project.