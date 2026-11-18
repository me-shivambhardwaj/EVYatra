from dotenv import load_dotenv
from pathlib import Path

# load_dotenv() first before any env access or model imports
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
load_dotenv()

import os
import re
import json
import math
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
CARS_SUMMARY_FILE = BASE_DIR / "cars_summary.json"
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
    car: Optional[str] = "all"
    user_name: Optional[str] = "there"
    expenses: Optional[List[Dict[str, Any]]] = []

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]

# Global caches
_vector_store = None
_embeddings = None
_cars_summary_cache = None

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

# Explicit short aliases mapping to data filenames
SHORT_ALIASES: Dict[str, str] = {
    "tiago": "tata-tiago-ev.md",
    "curvv": "tata-curvv-ev.md",
    "windsor": "mg-windsor-ev.md",
    "atto": "byd-atto-3.md",
    "atto 3": "byd-atto-3.md",
    "seal": "byd-seal.md",
    "comet": "mg-comet-ev.md",
    "be 6": "mahindra-be-6e.md",
    "be 6e": "mahindra-be-6e.md",
    "be6": "mahindra-be-6e.md",
    "xuv400": "mahindra-xuv400.md",
    "xuv 400": "mahindra-xuv400.md",
    "creta": "hyundai-creta-electric.md",
    "ev6": "kia-ev6.md",
    "ev 6": "kia-ev6.md",
    "punch": "punch-ev.md",
    "nexon": "nexon-ev.md",
    "ioniq": "ioniq-5.md",
    "ioniq 5": "ioniq-5.md",
    "zs": "mg-zs-ev.md",
    "zs ev": "mg-zs-ev.md",
    "kona": "hyundai-kona-electric.md",
    "ec3": "citroen-ec3.md",
    "e-c3": "citroen-ec3.md",
    "taycan": "porsche-taycan.md",
    "i4": "bmw-i4.md",
    "ix": "bmw-ix.md",
    "ix1": "bmw-ix1.md",
    "eqs": "mercedes-benz-eqs.md",
    "eqe": "mercedes-benz-eqe.md",
    "eqb": "mercedes-benz-eqb.md",
    "ev9": "kia-ev9.md",
}

def get_car_registry() -> Tuple[Dict[str, str], List[Dict[str, Any]], Dict[str, Tuple[str, str]]]:
    """
    Builds the car -> file mapping automatically from /data filenames,
    along with an auto-built alias dictionary mapping alias -> (canonical_title, filename).
    """
    generic_files = {"charger-types.md", "charging-cost-tips.md", "ev-knowledge.md"}
    car_file_map: Dict[str, str] = {}
    detection_list: List[Dict[str, Any]] = []
    alias_map: Dict[str, Tuple[str, str]] = {}

    if not DATA_DIR.exists():
        return car_file_map, detection_list, alias_map

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

        # Automatic stem tokens
        stem_parts = md_path.stem.split("-")
        for token in stem_parts:
            token_clean = token.lower().strip()
            if len(token_clean) >= 3 and token_clean not in GENERIC_WORDS and not token_clean.isdigit():
                keywords.add(token_clean)

        cleaned_kw = [k.strip() for k in keywords if k.strip() not in GENERIC_WORDS and len(k.strip()) >= 2]
        cleaned_kw.sort(key=lambda x: -len(x))

        for kw in cleaned_kw:
            if kw not in alias_map or len(title) > len(alias_map[kw][0]):
                alias_map[kw] = (title, fname)

        detection_list.append({
            "canonical": title,
            "file": fname,
            "keywords": cleaned_kw,
        })

    # Overlay explicit short aliases
    for alias, target_file in SHORT_ALIASES.items():
        canonical_name = next((t for t, f in car_file_map.items() if f == target_file), target_file.replace(".md", "").title())
        alias_map[alias.lower()] = (canonical_name, target_file)

    return car_file_map, detection_list, alias_map

def detect_car_in_text(text: str) -> Optional[Tuple[str, str]]:
    """
    Detects if any registered EV or known alias is mentioned in the input text.
    Matches longer aliases first to avoid substring confusion.
    """
    if not text:
        return None
    _, _, alias_map = get_car_registry()
    t_norm = text.lower().replace("ë", "e")

    # Sort aliases by length descending
    for alias in sorted(alias_map.keys(), key=lambda a: -len(a)):
        pattern = r'\b' + re.escape(alias) + r'\b'
        if re.search(pattern, t_norm):
            return alias_map[alias]

    return None

def load_cars_summary() -> Tuple[List[Dict[str, Any]], str, Dict[str, Dict[str, Any]]]:
    """Loads cars_summary.json and produces a markdown comparison table."""
    global _cars_summary_cache
    if _cars_summary_cache is not None:
        return _cars_summary_cache

    summary_list = []
    if CARS_SUMMARY_FILE.exists():
        try:
            with open(CARS_SUMMARY_FILE, "r", encoding="utf-8") as f:
                summary_list = json.load(f)
        except Exception as e:
            logger.error(f"Error reading cars_summary.json: {e}")

    # Build markdown table
    md_lines = [
        "| EV Model | Ex-Showroom Price | Battery | Claimed Range | Real-World Range |",
        "|---|---|---|---|---|"
    ]
    lookup_by_file: Dict[str, Dict[str, Any]] = {}
    for item in summary_list:
        name = item.get("name", "Unknown EV")
        price = item.get("price", "N/A")
        battery = item.get("battery", "N/A")
        claimed = item.get("claimed_range", "N/A")
        real = item.get("real_range", "N/A")
        f = item.get("file", "")
        if f:
            lookup_by_file[f] = item
        md_lines.append(f"| {name} | {price} | {battery} | {claimed} | {real} |")

    table_md = "\n".join(md_lines)
    _cars_summary_cache = (summary_list, table_md, lookup_by_file)
    return _cars_summary_cache

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

def is_expense_query(question: str) -> bool:
    """Checks if the query is asking about personal saved expenses, spending, or trip expense breakdown."""
    q = question.lower()
    patterns = [
        r'\b(my expense|my expenses|saved expense|saved expenses)\b',
        r'\b(my trip|my trips|saved trip|saved trips)\b',
        r'\b(total spend|how much did i spend|what did i spend|my spending)\b',
        r'\b(toll vs charging|toll and charging|split between toll)\b',
        r'\b(recorded expense|recorded trips|logged expense)\b'
    ]
    for p in patterns:
        if re.search(p, q):
            return True

    # Standalone "expenses", "expense breakdown", "toll cost" when not asking about general EV specs
    if ("expense" in q or "expenses" in q) and not any(k in q for k in ["buy", "ex-showroom", "on-road", "variant", "nexon", "punch", "ioniq"]):
        return True

    return False

def handle_expense_query(question: str, expenses: Optional[List[Dict[str, Any]]], user_name: str) -> ChatResponse:
    """Handles expense queries strictly from the provided user expense records."""
    if not expenses or len(expenses) == 0:
        return ChatResponse(
            answer="You don't have any saved trips or expenses yet. Once you record your trips and charging sessions in EVYatra, I can summarize your total spend, per-trip breakdown, and toll vs. charging splits!",
            sources=[]
        )

    total_cost = 0.0
    total_toll = 0.0
    total_charging = 0.0
    trip_summaries = []

    for idx, item in enumerate(expenses, 1):
        trip_name = item.get("trip") or item.get("title") or item.get("destination") or item.get("name") or f"Trip #{idx}"
        cost = float(item.get("cost") or item.get("amount") or 0.0)
        toll = float(item.get("toll") or item.get("toll_cost") or 0.0)
        charging = float(item.get("charging") or item.get("charging_cost") or 0.0)

        # If total cost is 0 but toll + charging exist
        if cost == 0.0 and (toll > 0 or charging > 0):
            cost = toll + charging

        # If toll + charging are 0 but cost is given, attribute to charging by default
        if toll == 0.0 and charging == 0.0 and cost > 0:
            charging = cost

        total_cost += cost
        total_toll += toll
        total_charging += charging
        trip_summaries.append(f"- **{trip_name}**: ₹{cost:,.2f} (Charging: ₹{charging:,.2f}, Toll: ₹{toll:,.2f})")

    toll_pct = (total_toll / total_cost * 100) if total_cost > 0 else 0
    charging_pct = (total_charging / total_cost * 100) if total_cost > 0 else 0

    answer_parts = [
        f"Hi {user_name}! Here is the breakdown from your saved trip and expense records:",
        f"- **Total Recorded Spend**: ₹{total_cost:,.2f}",
        f"- **Charging Cost**: ₹{total_charging:,.2f} ({charging_pct:.1f}% of total)",
        f"- **Toll Charges**: ₹{total_toll:,.2f} ({toll_pct:.1f}% of total)",
        f"\n**Per-Trip Breakdown ({len(expenses)} recorded):**\n" + "\n".join(trip_summaries),
        f"\nTip: Monitoring your toll-to-charging ratio helps budget long highway road trips effectively in India."
    ]

    return ChatResponse(
        answer="\n".join(answer_parts),
        sources=["user-expenses"]
    )

def is_trip_query(question: str) -> bool:
    """Detects if question is inquiring about trip planning, routes, stops, or distances."""
    q = question.lower()
    trip_keywords = [
        r'\b(trip|route|distance|stops|charging stops|road trip|drive from|plan a trip)\b',
        r'\bto\b.*\b(trip|route|stops|drive|reach|distance|highway)\b',
        r'\bfrom\b.+\bto\b'
    ]
    for p in trip_keywords:
        if re.search(p, q):
            return True

    # Check for direct corridor mentions like "delhi to agra"
    if re.search(r'\b[a-z]{3,}\s+to\s+[a-z]{3,}\b', q):
        return True

    return False

# Common Indian Highway Corridors Database
# (distance_km, approx_toll, corridor_name, charging_stations)
CORRIDOR_TABLE: Dict[Tuple[str, str], Tuple[int, int, str, List[str]]] = {
    ("delhi", "agra"): (215, 415, "Yamuna Expressway", ["Jewar Rest Area (Tata Power 60 kW)", "Mathura Expressway Plaza (Jio-bp 120 kW)"]),
    ("delhi", "jaipur"): (275, 500, "NH48 / NE4 Delhi-Mumbai Expy", ["Neemrana Midway (Statiq 60 kW)", "Behror Food Hub (ChargeZone 120 kW)"]),
    ("delhi", "chandigarh"): (245, 350, "NH44 Grand Trunk Road", ["Murthal Haveli (Tata Power 60 kW)", "Karnal Lake Oasis (Jio-bp 60 kW)"]),
    ("delhi", "dehradun"): (255, 300, "Delhi-Dehradun Expy / NH334", ["Muzaffarnagar Bypass (Statiq 50 kW)", "Roorkee Rest Plaza (Zeon 60 kW)"]),
    ("mumbai", "pune"): (150, 320, "Mumbai-Pune Expressway", ["Khalapur Food Plaza (Tata Power 60 kW)", "Talegaon Expressway Stop (Zeon 50 kW)"]),
    ("mumbai", "surat"): (285, 420, "NH48 Western Corridor", ["Manor Highway Hub (ChargeZone 60 kW)", "Vapi Central (Tata Power 60 kW)"]),
    ("bengaluru", "mysuru"): (145, 330, "Bengaluru-Mysuru Expressway", ["Ramanagara Rest Stop (Tata Power 60 kW)", "Mandya Food Plaza (ChargeZone 60 kW)"]),
    ("bangalore", "mysore"): (145, 330, "Bengaluru-Mysuru Expressway", ["Ramanagara Rest Stop (Tata Power 60 kW)", "Mandya Food Plaza (ChargeZone 60 kW)"]),
    ("bengaluru", "chennai"): (345, 480, "NH48 Southern Highway", ["Krishnagiri Plaza (Zeon 50 kW)", "Vellore Toll Hub (Tata Power 60 kW)"]),
    ("bangalore", "chennai"): (345, 480, "NH48 Southern Highway", ["Krishnagiri Plaza (Zeon 50 kW)", "Vellore Toll Hub (Tata Power 60 kW)"]),
    ("bengaluru", "hyderabad"): (570, 850, "NH44 Hyderabad Highway", ["Anantapur Highway Stop (Tata Power 60 kW)", "Kurnool Oasis (ChargeZone 120 kW)", "Jadcherla Plaza (Zeon 60 kW)"]),
    ("bangalore", "hyderabad"): (570, 850, "NH44 Hyderabad Highway", ["Anantapur Highway Stop (Tata Power 60 kW)", "Kurnool Oasis (ChargeZone 120 kW)", "Jadcherla Plaza (Zeon 60 kW)"]),
    ("hyderabad", "vijayawada"): (275, 450, "NH65 Andhra Corridor", ["Suryapet Food Court (Tata Power 60 kW)", "Kodad Toll Plaza (ChargeZone 60 kW)"]),
    ("chennai", "puducherry"): (155, 120, "East Coast Road (ECR)", ["Mahabalipuram Hub (Statiq 50 kW)", "Marakkanam Rest Stop (Zeon 50 kW)"]),
    ("chennai", "pondicherry"): (155, 120, "East Coast Road (ECR)", ["Mahabalipuram Hub (Statiq 50 kW)", "Marakkanam Rest Stop (Zeon 50 kW)"]),
}

def extract_origin_destination(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extracts origin and destination city names from trip query text."""
    q = text.lower()
    # Normalize common abbreviations
    q = q.replace("bangalore", "bengaluru").replace("mysore", "mysuru").replace("pondicherry", "puducherry")

    # Match "from <origin> to <destination>"
    m = re.search(r'\bfrom\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:\s+in|\s+with|\s+by|\s+using|\.|\?|$)', q)
    if m:
        orig = m.group(1).strip()
        dest = m.group(2).strip()
        return orig, dest

    # Match "<origin> to <destination>"
    m = re.search(r'\b([a-z]+)\s+to\s+([a-z]+)\b', q)
    if m:
        orig = m.group(1).strip()
        dest = m.group(2).strip()
        return orig, dest

    return None, None

def handle_trip_query(question: str, car_param: Optional[str], user_name: str) -> ChatResponse:
    """
    Executes trip planning calculations using car's real usable range (80% usable)
    and corridor stations, giving approx distance, stops, stop names, charging cost, and toll.
    """
    # 1. Resolve car: question first, then car_param (unless "all" / empty)
    car_match = detect_car_in_text(question)
    target_car = None
    target_file = None

    if car_match:
        target_car, target_file = car_match
    elif car_param and car_param.lower() not in ["all", "all cars", "none", ""]:
        # Match dropdown selection
        car_file_map, _, _ = get_car_registry()
        for title, fname in car_file_map.items():
            if title.lower() == car_param.lower():
                target_car = title
                target_file = fname
                break
        if not target_car:
            target_match = detect_car_in_text(car_param)
            if target_match:
                target_car, target_file = target_match

    # If no car is provided or resolved and "all" is selected
    if not target_car:
        return ChatResponse(
            answer="Which EV should I plan this for? (e.g. Tata Nexon EV, Hyundai Ioniq 5, MG ZS EV)",
            sources=[]
        )

    # 2. Extract origin and destination
    origin, destination = extract_origin_destination(question)
    if not origin or not destination:
        return ChatResponse(
            answer=f"Could you please specify your starting city and destination for planning the trip with {target_car}? (e.g. 'Delhi to Agra in {target_car}')",
            sources=[]
        )

    # Look up corridor (bidirectional check)
    key_forward = (origin.lower(), destination.lower())
    key_backward = (destination.lower(), origin.lower())

    corridor_data = CORRIDOR_TABLE.get(key_forward) or CORRIDOR_TABLE.get(key_backward)
    if not corridor_data:
        return ChatResponse(
            answer=f"I couldn't identify the route between {origin.title()} and {destination.title()}. Could you please check the spelling or specify popular Indian highway cities (e.g. Delhi to Agra, Mumbai to Pune, Bengaluru to Mysuru)?",
            sources=[]
        )

    distance_km, toll_cost, corridor_name, charging_stations = corridor_data

    # 3. Determine real range and usable range (80% usable range)
    _, _, summary_lookup = load_cars_summary()
    car_info = summary_lookup.get(target_file, {}) if target_file else {}
    real_range_text = car_info.get("real_range", "")

    # Parse real range number
    real_range_num = 250.0  # Safe default if parsing fails
    nums = [float(n) for n in re.findall(r'\b\d+(?:\.\d+)?\b', real_range_text)]
    if nums:
        # Use average or lower bound of range
        real_range_num = min(nums) if len(nums) == 1 else (sum(nums[:2]) / 2)

    usable_range_km = real_range_num * 0.80

    # Stops calculation:
    if distance_km <= usable_range_km:
        num_stops = 0
        recommended_stops = ["No mandatory charging stops needed (direct drive). Optional 15-min top-up buffer recommended."]
    else:
        # Number of stops needed
        remaining_km = distance_km - usable_range_km
        num_stops = max(1, math.ceil(remaining_km / (usable_range_km * 0.75)))
        recommended_stops = charging_stations[:num_stops]

    # Approx charging cost (assume 0.16 kWh/km consumption @ ₹18/kWh)
    total_energy_kwh = distance_km * 0.16
    charging_cost = round(total_energy_kwh * 18.0)
    total_journey_cost = charging_cost + toll_cost

    response_text = (
        f"Here is your road trip plan for **{origin.title()} to {destination.title()}** in the **{target_car}**:\n\n"
        f"- **Route**: {corridor_name}\n"
        f"- **Distance**: approx {distance_km} km\n"
        f"- **Usable Range (80% buffer)**: approx {usable_range_km:.0f} km (based on {real_range_num:.0f} km real-world range)\n"
        f"- **Charging Stops Needed**: approx {num_stops} stop{'s' if num_stops != 1 else ''}\n"
        f"- **Recommended Charging Stops**: {', '.join(recommended_stops)}\n"
        f"- **Approx Charging Cost**: approx ₹{charging_cost} (calculated at standard ₹18/kWh highway tariff)\n"
        f"- **Approx Toll Charges**: approx ₹{toll_cost}\n"
        f"- **Total Approx Travel Cost**: approx ₹{total_journey_cost}\n\n"
        f"Tip: Maintain speeds below 90 km/h on expressways and charge between 10% and 80% SoC to optimize fast-charging curve speeds."
    )

    sources = ["route-planner"]
    if target_file:
        sources.append(target_file)

    return ChatResponse(answer=response_text, sources=sources)

def is_compare_or_recommend_query(question: str) -> bool:
    """Detects if query is a recommendation, budget filter, comparison, or price-band query."""
    q = question.lower()
    keywords = [
        r'\bbest\b', r'\bunder\b', r'\bbudget\b', r'\bvs\b', r'\bversus\b',
        r'\bwhich ev\b', r'\bwhich car\b', r'\bcheapest\b', r'\brecommend\b',
        r'\bcompare\b', r'\bcomparison\b', r'\btop ev\b',
        r'under\s*₹?\s*\d+\s*(?:lakh|l)?',
        r'₹?\s*\d+\s*-\s*\d+\s*(?:lakh|l)?',
        r'₹?\s*\d+\s*(?:lakh|l)\s*\+'
    ]
    for p in keywords:
        if re.search(p, q):
            return True
    return False

def is_general_charging_query(question: str) -> bool:
    """Detects general questions about chargers, connectors, tariffs, or charging tips."""
    q = question.lower()
    keywords = [
        r'\bcharger\b', r'\bchargers\b', r'\bconnector\b', r'\bconnectors\b',
        r'\bccs2\b', r'\btype 2\b', r'\bac vs dc\b', r'\btariff\b',
        r'\bcharging tips\b', r'\bcharging cost tips\b', r'\bunit rate\b',
        r'\bslow charging\b', r'\bfast charging speed\b'
    ]
    for p in keywords:
        if re.search(p, q):
            return True
    return False

@app.get("/health")
def health():
    db_ready = DB_DIR.exists() and any(DB_DIR.iterdir()) if DB_DIR.exists() else False
    has_groq = bool(GROQ_API_KEY and not GROQ_API_KEY.startswith("gsk_your"))
    car_file_map, _, alias_map = get_car_registry()
    return {
        "status": "ok",
        "service": "evyatra-ai",
        "db_indexed": db_ready,
        "groq_configured": has_groq,
        "model": GROQ_MODEL,
        "cars_registered": len(car_file_map),
        "aliases_registered": len(alias_map),
    }

@app.get("/cars")
def list_cars():
    """Returns all cars discovered automatically from /data."""
    car_file_map, _, _ = get_car_registry()
    return {"cars": list(car_file_map.keys()), "count": len(car_file_map)}

@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    try:
        raw_question = payload.question.strip()
        if not raw_question:
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        user_name = (payload.user_name or "there").strip() or "there"
        selected_car_param = (payload.car or "all").strip()
        is_all_cars = selected_car_param.lower() in ["all", "all cars", "none", ""]

        # ---------------------------------------------------------------------
        # 1. Greetings / thanks: reply warmly with the name, no retrieval
        # ---------------------------------------------------------------------
        greet_type = check_greeting_or_thanks(raw_question)
        if greet_type == "greeting":
            greeting_msg = (
                f"Hi {user_name}! I'm EVYatra Assistant. Ask me about any EV, or pick one above."
                if is_all_cars
                else f"Hi {user_name}! I'm EVYatra Assistant. How can I help you today with {selected_car_param} specs, charging, or road trip planning?"
            )
            return ChatResponse(answer=greeting_msg, sources=[])
        elif greet_type == "thanks":
            return ChatResponse(
                answer=f"You're very welcome, {user_name}! If you have any other questions about electric vehicles or charging in India, feel free to ask. Safe travels! ⚡",
                sources=[]
            )

        # ---------------------------------------------------------------------
        # 2. Expense question -> expense tool
        # ---------------------------------------------------------------------
        if is_expense_query(raw_question):
            return handle_expense_query(raw_question, payload.expenses, user_name)

        # ---------------------------------------------------------------------
        # 3. Trip question -> trip tool
        # ---------------------------------------------------------------------
        if is_trip_query(raw_question):
            return handle_trip_query(raw_question, selected_car_param, user_name)

        # ---------------------------------------------------------------------
        # 4. Routing Before Retrieval:
        #    - Car named in question -> filter strictly to that car
        #    - Compare / recommend -> unfiltered k=8 + cars_summary table
        #    - General topic -> filter charger-types.md & charging-cost-tips.md
        #    - Else -> dropdown car or unfiltered k=8 if "all"
        # ---------------------------------------------------------------------
        store = get_vector_store()
        if store is None:
            return ChatResponse(
                answer="I don't have that info. The EV knowledge base has not been indexed yet. Please run ingest.py.",
                sources=[]
            )

        car_file_map, _, _ = get_car_registry()
        _, cars_summary_md, _ = load_cars_summary()

        # Check if question explicitly names an EV
        car_in_question = detect_car_in_text(raw_question)

        filter_dict = None
        retrieval_k = 6
        target_car_label = selected_car_param
        search_query = raw_question
        inject_summary_table = False

        if car_in_question:
            # Question explicitly named an EV (takes precedence over dropdown!)
            canonical_name, mapped_file = car_in_question
            target_car_label = canonical_name
            filter_dict = {"source": mapped_file}
            search_query = f"{canonical_name} {raw_question}"
            retrieval_k = 6

        elif is_compare_or_recommend_query(raw_question):
            # Compare / recommend: no filter, k=8, inject cars_summary table
            filter_dict = None
            retrieval_k = 8
            target_car_label = "EV Comparison"
            search_query = raw_question
            inject_summary_table = True

        elif is_general_charging_query(raw_question):
            # General charging topic: search only charger-types and charging-cost-tips
            filter_dict = {"source": {"$in": ["charger-types.md", "charging-cost-tips.md"]}}
            retrieval_k = 5
            target_car_label = "General EV Charging"
            search_query = raw_question

        elif is_all_cars:
            # "all" selected and no car named in question -> unfiltered k=8 + summary table
            filter_dict = None
            retrieval_k = 8
            target_car_label = "All EVs in India"
            search_query = raw_question
            inject_summary_table = True

        else:
            # Dropdown car selected and no other car named
            matched_file = car_file_map.get(selected_car_param)
            if not matched_file:
                # Try finding in alias map
                detected = detect_car_in_text(selected_car_param)
                if detected:
                    target_car_label, matched_file = detected

            if matched_file:
                filter_dict = {"source": matched_file}
                search_query = f"{target_car_label} {raw_question}"
                retrieval_k = 6
            else:
                filter_dict = None
                retrieval_k = 6

        # Perform similarity search with Chroma
        docs = []
        try:
            if filter_dict:
                docs = store.similarity_search(search_query, k=retrieval_k, filter=filter_dict)
            else:
                docs = store.similarity_search(search_query, k=retrieval_k)
        except Exception as filter_err:
            logger.warning(f"Chroma filtered search failed ({filter_err}). Falling back to unfiltered search.")
            docs = store.similarity_search(search_query, k=retrieval_k)

        if not docs and not inject_summary_table:
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
            best_chunk = docs[0].page_content if docs else "Verified vehicle catalog."
            return ChatResponse(
                answer=f"Based on verified guides for {target_car_label}:\n\n{best_chunk}",
                sources=sources
            )

        # ---------------------------------------------------------------------
        # 5. Call Groq LLM with strict grounding prompt
        # ---------------------------------------------------------------------
        try:
            from langchain_groq import ChatGroq
            from langchain_core.prompts import PromptTemplate

            llm = ChatGroq(
                groq_api_key=groq_key,
                model=groq_model,
                temperature=0.1
            )

            context_snippets = [
                f"[Source: {d.metadata.get('source', 'doc')}]:\n{d.page_content}"
                for d in docs
            ]

            if inject_summary_table:
                context_snippets.append(
                    f"[Verified EV Specification & Price Database]:\n{cars_summary_md}"
                )

            context_text = "\n\n---\n\n".join(context_snippets)

            system_prompt = (
                "You are EVYatra Assistant, a friendly and concise AI expert on electric vehicles and charging in India.\n"
                "The user's name is {user_name}.\n\n"
                "STRICT GROUNDING & RECOMMENDATION RULES:\n"
                "1. Answer ONLY using the facts present in the Context provided below.\n"
                "2. When comparing or recommending EVs based on budget or range:\n"
                "   - Check each vehicle against the user's budget and range requirements.\n"
                "   - ONLY recommend vehicles that strictly match the criteria (for example, if the user asks for EVs under ₹15 Lakh, do NOT recommend cars priced above ₹15 Lakh like Hyundai Ioniq 5 or Kia EV6).\n"
                "   - Give the prices, battery sizes, and real-world ranges clearly and directly.\n"
                "   - If no vehicle in the context matches the user's criteria, say plainly that none match.\n"
                "3. If the answer cannot be found in the Context, respond EXACTLY: 'I don't have that info.'\n"
                "4. Never invent specs, prices, or numbers.\n"
                "5. Keep the response friendly, clear, and concise.\n"
                "6. Always add exactly one helpful follow-up tip related to the vehicle or charging topic.\n\n"
                "Context:\n{context}\n\n"
                "Target Topic / EV: {car}\n"
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
                "car": target_car_label,
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
            fallback_text = docs[0].page_content if docs else "Verified vehicle catalog."
            return ChatResponse(
                answer=f"Based on verified records for {target_car_label}:\n\n{fallback_text}",
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
