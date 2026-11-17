# EVYatra AI RAG Backend

Lightweight Retrieval-Augmented Generation (RAG) assistant for electric vehicles and charging in India.

## Stack
- **Framework**: FastAPI (Uvicorn)
- **Vector DB**: ChromaDB (`./db`)
- **Embeddings**: Local FastEmbed (`BAAI/bge-small-en-v1.5`) - runs locally without any embedding API keys
- **LLM**: Groq Cloud (`llama-3.3-70b-versatile` via `langchain-groq`)

## Quickstart

1. **Install Python dependencies**:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Add your GROQ_API_KEY in .env
   ```

3. **Ingest markdown knowledge base**:
   ```bash
   python ingest.py
   ```

4. **Start the server**:
   ```bash
   python main.py
   # Or: uvicorn main:app --port 8001 --reload
   ```

## Endpoints
- `GET /health`: Service and vector index health status.
- `POST /chat`: JSON body `{ "question": "...", "car": "Hyundai Ioniq 5" }` -> Returns `{ "answer": "...", "sources": ["..."] }`.
