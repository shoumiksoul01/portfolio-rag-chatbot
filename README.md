# Portfolio RAG Chatbot

A RAG (Retrieval-Augmented Generation) chatbot embedded in my personal
portfolio website. Visitors can ask questions about my background,
skills, research, and projects, and get answers generated only from
my real portfolio content.

## Stack
- Cloudflare Workers — serverless backend
- Cloudflare Workers AI — embeddings
- Cloudflare Vectorize — vector database
- Google Gemini API — answer generation (free tier)

## Live Worker

Deployed at: https://portfolio-rag.sheikhshoumik64.workers.dev

Endpoints:
- `POST /ingest` — re-embed and upsert all chunks from `data/content.json` into Vectorize. Protected by `X-Ingest-Secret` header.
- `POST /chat` — takes `{"query": "..."}`, returns `{"answer": "...", "sources": [...]}`.