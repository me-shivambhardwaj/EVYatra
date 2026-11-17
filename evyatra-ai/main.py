from dotenv import load_dotenv
from pathlib import Path

# load_dotenv() first before any env access or model imports
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

import os
import re
import logging
import traceback
from typing import List, Optional, Tuple, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langchain_chroma import Chroma
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("evyatra-ai")

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
DATA_DIR = BASE_DIR / "data"
DB_DIR = BASE_DIR / os.getenv("CHROMA_DB_DIR", "./db")
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"

app = FastAPI(
    title="EVYatra AI Assistant API",
    description="RAG-powered conversational assistant for electric vehicle and charging queries in India.",
    version="1.0.0",
)

# CORS Middleware (allows Next.js frontend calls)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request / Response Schemas
class ChatRequest(BaseModel):
    question: str
    car: Optional[str] = "Hyundai Ioniq 5"
    user_name: Optional[str] = "there"

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

# Global vector store cache
_vector_store = None
_embeddings = None

def get_vector_store():
    global _vector_store, _embeddings
    if _vector_store is not None:
        return _vector_store

    if not DB_DIR.exists():
        return None

    if _embeddings is None:
        _embeddings = FastEmbedEmbeddings(model_name=EMBEDDING_MODEL_NAME)

    _vector_store = Chroma(
        persist_directory=str(DB_DIR),
        embedding_function=_embeddings,
        collection_name="evyatra_knowledge"
    )
    return _vector_store

def extract_file_title(filepath: Path) -> str:
    """Extracts markdown H1 header as title or cleans filename."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if s.startswith("# "):
                    return s[2:].strip()
    except Exception:
        pass
    return filepath.stem.replace("-", " ").title()

GENERIC_WORDS = {
    "ev", "electric", "car", "suv", "sedan", "vehicle",
    "the", "in", "india", "e-tron", "etron"
}

def get_car_registry() -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    """
    Builds the car -> file mapping automatically from the /data filenames,
    with zero hardcoding.
    """
    generic_files = {"charger-types.md", "charging-cost-tips.md", "ev-knowledge.md"}
    car_file_map: Dict[str, str] = {}
    detection_list: List[Dict[str, Any]] = []

    if not DATA_DIR.exists():
        return car_file_map, detection_list

    for md_path in sorted(DATA_DIR.glob("*.md")):
        fname = md_path.name
        if fname in generic_files:
            continue

        title = extract_file_title(md_path)
        car_file_map[title] = fname

        title_norm = title.lower().replace("ë", "e")
        stem_norm = md_path.stem.lower().replace("-", " ").replace("ë", "e")

        keywords = {title_norm, stem_norm}

        parts = title_norm.split()
        if len(parts) >= 2:
            without_brand = " ".join(parts[1:])
            keywords.add(without_brand)
            for w in parts[1:]:
                keywords.add(w)

        # Filter out generic stopwords when standalone
        cleaned_kw = [k.strip() for k in keywords if k.strip() not in GENERIC_WORDS and len(k.strip()) >= 2]
        cleaned_kw.sort(key=lambda x: -len(x))

        detection_list.append({
            "canonical": title,
            "file": fname,
            "keywords": cleaned_kw,
        })

    return car_file_map, detection_list

def resolve_ev_and_file(question: str, selected_car: Optional[str]) -> Tuple[str, Optional[str]]:
    """
    Identifies the target EV and mapped data file automatically from the data registry.
    If the question explicitly names another EV, uses that one over the dropdown selection.
    """
    car_file_map, registry = get_car_registry()
    q_norm = question.lower().replace("ë", "e")

    def match_car(target_str: Optional[str]) -> Optional[Tuple[str, str]]:
        if not target_str:
            return None
        t_norm = target_str.lower().replace("ë", "e")
        for title, fname in car_file_map.items():
            if title.lower() == t_norm:
                return title, fname
        for item in registry:
            for kw in item["keywords"]:
                pattern = r'\b' + re.escape(kw) + r'\b'
                if re.search(pattern, t_norm):
                    return item["canonical"], item["file"]
        return None

    current_match = match_car(selected_car)
    current_canonical = current_match[0] if current_match else None

    # Check if the question explicitly names ANOTHER EV (different from current)
    best_other_match = None
    best_len = 0

    for item in registry:
        if current_canonical and item["canonical"] == current_canonical:
            continue
        for kw in item["keywords"]:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, q_norm):
                if len(kw) > best_len:
                    best_len = len(kw)
                    best_other_match = (item["canonical"], item["file"])

    if best_other_match:
        return best_other_match

    if current_match:
        return current_match

    # If neither, match the question itself against any car
    for item in registry:
        for kw in item["keywords"]:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, q_norm):
                if len(kw) > best_len:
                    best_len = len(kw)
                    best_other_match = (item["canonical"], item["file"])

    if best_other_match:
        return best_other_match

    return (selected_car or "General EV"), None

def check_greeting_or_thanks(question: str) -> Optional[str]:
    """Detects simple greetings or thank-you messages."""
    cleaned = re.sub(r"[^\w\s]", "", question.strip().lower())
    words = cleaned.split()
    if not words:
        return None

    greetings = {
        "hi", "hello", "hey", "namaste", "vanakkam", "greetings",
        "good morning", "good afternoon", "good evening", "howdy", "sup", "yo"
    }
    thanks = {
        "thanks", "thank you", "thx", "appreciate it", "dhanyawad",
        "dhanyavaad", "thank you so much", "many thanks", "thanks a lot"
    }

    if cleaned in greetings:
        return "greeting"
    if cleaned in thanks:
        return "thanks"

    if len(words) <= 3:
        if words[0] in {"hi", "hello", "hey", "namaste", "greetings"}:
            return "greeting"
        if words[0] in {"thanks", "thx"} or "thank you" in cleaned:
            return "thanks"

    return None

@app.get("/health")
def health():
    db_ready = DB_DIR.exists() and any(DB_DIR.iterdir()) if DB_DIR.exists() else False
    has_groq = bool(GROQ_API_KEY and not GROQ_API_KEY.startswith("gsk_your"))
    car_file_map, _ = get_car_registry()
    return {
        "status": "ok",
        "service": "evyatra-ai",
        "db_indexed": db_ready,
        "groq_configured": has_groq,
        "model": GROQ_MODEL,
        "cars_registered": len(car_file_map),
    }

@app.get("/cars")
def list_cars():
    """Returns all cars discovered automatically from /data."""
    car_file_map, _ = get_car_registry()
    return {"cars": list(car_file_map.keys()), "count": len(car_file_map)}

@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    try:
        raw_question = payload.question.strip()
        if not raw_question:
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        user_name = (payload.user_name or "there").strip() or "there"

        # 1. Greetings / thanks: reply warmly with the name, no retrieval
        greet_type = check_greeting_or_thanks(raw_question)
        if greet_type == "greeting":
            return ChatResponse(
                answer=f"Hi {user_name}! I'm EVYatra Assistant. How can I help you today with electric vehicle specs, prices, charging speeds, or road trip planning?",
                sources=[]
            )
        elif greet_type == "thanks":
            return ChatResponse(
                answer=f"You're very welcome, {user_name}! If you have any other questions about EVs or charging, feel free to ask. Safe travels! ⚡",
                sources=[]
            )

        # 2. Map car to its data file, or switch if the question names another EV
        target_car, mapped_file = resolve_ev_and_file(raw_question, payload.car)

        store = get_vector_store()
        if store is None:
            return ChatResponse(
                answer="I don't have that info. The EV knowledge base has not been indexed yet. Please run ingest.py.",
                sources=[]
            )

        # 3. Search f"{car} {question}" with k=6 filtered to that file (fall back to unfiltered if empty)
        search_query = f"{target_car} {raw_question}"
        docs = []
        if mapped_file:
            docs = store.similarity_search(search_query, k=6, filter={"source": mapped_file})

        if not docs:
            docs = store.similarity_search(search_query, k=6)

        if not docs:
            return ChatResponse(
                answer="I don't have that info.",
                sources=[]
            )

        # Collect unique source filenames
        sources = list(dict.fromkeys([
            d.metadata.get("source") for d in docs if d.metadata.get("source")
        ]))

        groq_key = os.getenv("GROQ_API_KEY", "").strip()
        groq_model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()

        # If Groq is not configured or placeholder, return grounded excerpt directly
        if not groq_key or groq_key.startswith("gsk_your"):
            best_chunk = docs[0].page_content
            return ChatResponse(
                answer=f"Based on verified guides for {target_car}:\n\n{best_chunk}",
                sources=sources
            )

        # 4. Call Groq LLM with prompt: friendly, concise, answer only from context, give number directly, add one follow-up tip, never invent specs
        try:
            from langchain_groq import ChatGroq
            from langchain_core.prompts import PromptTemplate

            llm = ChatGroq(
                groq_api_key=groq_key,
                model=groq_model,
                temperature=0.1
            )

            context_text = "\n\n---\n\n".join([
                f"[Source: {d.metadata.get('source', 'doc')}]:\n{d.page_content}"
                for d in docs
            ])

            system_prompt = (
                "You are EVYatra Assistant, a friendly and concise AI expert on electric vehicles and charging in India.\n"
                "The user's name is {user_name}.\n\n"
                "RULES:\n"
                "1. Answer ONLY using the facts present in the Context provided below.\n"
                "2. If the answer cannot be found in the Context, respond EXACTLY: 'I don't have that info.'\n"
                "3. Never invent specs, prices, or numbers.\n"
                "4. When answering questions about prices, ranges, batteries, connectors, or charging speeds, give the numbers directly and clearly.\n"
                "5. Keep the response friendly and concise.\n"
                "6. Always add exactly one helpful follow-up tip related to the vehicle or charging topic.\n\n"
                "Context:\n{context}\n\n"
                "Target EV: {car}\n"
                "User Question: {question}\n\n"
                "Answer:"
            )

            prompt = PromptTemplate(
                template=system_prompt,
                input_variables=["context", "car", "question", "user_name"]
            )

            chain = prompt | llm
            result = chain.invoke({
                "context": context_text,
                "car": target_car,
                "question": raw_question,
                "user_name": user_name
            })

            answer_text = result.content if hasattr(result, "content") else str(result)
            return ChatResponse(
                answer=answer_text.strip(),
                sources=sources
            )

        except Exception as llm_err:
            tb = traceback.format_exc()
            logger.error(f"Error during LLM generation: {tb}")
            return ChatResponse(
                answer=f"Based on verified records for {target_car}:\n\n{docs[0].page_content}",
                sources=sources
            )

    except HTTPException:
        raise
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error(f"Unhandled error in /chat endpoint: {tb}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "Failed to process chat request.",
                "detail": str(exc),
            }
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
