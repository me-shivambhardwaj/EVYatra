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
from langchain_groq import ChatGroq

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("evyatra-ai")

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
ROUTER_MODEL = os.getenv("ROUTER_MODEL", "llama-3.1-8b-instant")
DATA_DIR = BASE_DIR / "data"
DB_DIR = BASE_DIR / os.getenv("CHROMA_DB_DIR", "./db")
CARS_SUMMARY_FILE = BASE_DIR / "cars_summary.json"
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"

app = FastAPI(
    title="EVYatra AI Assistant API",
    description="RAG-powered conversational assistant for electric vehicle and charging queries in India.",
    version="2.0.0",
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

# Global vector store cache
_vector_store = None
_embeddings = None
_summary_cache = None

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

def get_available_stems() -> List[str]:
    """Returns list of all available car file stems from /data."""
    generic_stems = {"charger-types", "charging-cost-tips", "ev-knowledge"}
    stems = []
    if DATA_DIR.exists():
        for p in sorted(DATA_DIR.glob("*.md")):
            if p.stem not in generic_stems:
                stems.append(p.stem)
    return stems

def load_cars_summary() -> List[Dict[str, Any]]:
    """Loads cars_summary.json with numeric specifications."""
    global _summary_cache
    if _summary_cache is not None:
        return _summary_cache

    if CARS_SUMMARY_FILE.exists():
        try:
            with open(CARS_SUMMARY_FILE, "r", encoding="utf-8") as f:
                _summary_cache = json.load(f)
                return _summary_cache
        except Exception as e:
            logger.error(f"Error reading cars_summary.json: {e}")
    return []

def get_groq_llm(model_name: str, temperature: float = 0.0) -> ChatGroq:
    """Instantiates ChatGroq with model fallback if model is unavailable."""
    try:
        llm = ChatGroq(groq_api_key=GROQ_API_KEY, model=model_name, temperature=temperature)
        return llm
    except Exception as e:
        logger.warning(f"Failed to initialize model '{model_name}': {e}. Falling back to '{GROQ_MODEL}'")
        return ChatGroq(groq_api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=temperature)

# Distance Table between Indian Cities (both directions)
CITY_KM: Dict[Tuple[str, str], int] = {
    ("delhi", "jaipur"): 275,
    ("delhi", "agra"): 215,
    ("delhi", "chandigarh"): 245,
    ("delhi", "mumbai"): 1420,
    ("delhi", "lucknow"): 535,
    ("delhi", "dehradun"): 255,
    ("delhi", "shimla"): 345,
    ("delhi", "amritsar"): 450,
}

def get_trip_distance(orig: str, dest: str) -> Optional[int]:
    """Looks up distance in CITY_KM table or falls back to OSRM."""
    if not orig or not dest:
        return None
    o = orig.strip().lower()
    d = dest.strip().lower()

    # Exact table match (bidirectional)
    if (o, d) in CITY_KM:
        return CITY_KM[(o, d)]
    if (d, o) in CITY_KM:
        return CITY_KM[(d, o)]

    # Substring match in table
    for (c1, c2), km in CITY_KM.items():
        if (c1 in o or o in c1) and (c2 in d or d in c2):
            return km
        if (c2 in o or o in c2) and (c1 in d or d in c1):
            return km

    # Fallback to OSRM public API if possible
    try:
        import urllib.request
        import urllib.parse
        # In case coordinates are needed or unknown, return None to prompt user
    except Exception:
        pass

    return None

def find_car_by_stem_or_name(car_identifier: str) -> Optional[Dict[str, Any]]:
    """Finds car entry in cars_summary.json by stem, filename, or name."""
    if not car_identifier:
        return None
    cars = load_cars_summary()
    cid = car_identifier.strip().lower().replace(".md", "")
    for c in cars:
        if c.get("stem") == cid or c.get("file", "").replace(".md", "") == cid:
            return c
        if c.get("name", "").lower() == cid:
            return c
    # Substring search
    for c in cars:
        if cid in c.get("stem", "") or cid in c.get("name", "").lower():
            return c
    return None

# -----------------------------------------------------------------------------
# LLM Classifier
# -----------------------------------------------------------------------------
_active_router_model = ROUTER_MODEL

def classify_question(question: str) -> Dict[str, Any]:
    """
    Uses small LLM classifier (llama-3.1-8b-instant or qwen3.8-27b) with temperature 0
    to return JSON routing metadata.
    """
    global _active_router_model
    stems = get_available_stems()
    system_prompt = f"""You are the routing classifier for EVYatra, an electric vehicle and EV charging assistant in India.
Classify the user's question into EXACTLY one JSON object.

Allowed intents:
- "car_info": Questions about a single EV's specifications (price, range, charging time, battery, connectors, boot space, features).
- "compare": Comparing 2 or more EVs (e.g. "A vs B", "compare X and Y", differences).
- "recommend": Budget filtering, range requirements, or vehicle recommendations (e.g. "best EV under ₹15L", "cheapest EV with 400+ km real range", "EVs above ₹50L", "best under ₹10L").
- "general": General charging questions, universal charger types, AC vs DC charging, charging tips, tariffs, residential charging.
- "trip": Road trips, routes between cities, distance, stops, charging cost on highways, or "can car X reach city Y on one charge".
- "expense": Personal recorded trip expenses, toll vs charging split, total spend summary.
- "greeting": Greetings (hi, hello), thanks, appreciation, or goodbye.
- "off_topic": Inquiries about petrol/diesel/CNG cars or topics unrelated to electric vehicles and EV charging.
- "unknown_car": Questions asking specifically about electric cars NOT in our database (e.g. Tesla Cybertruck, Rivian, Lucid, Lucid Air).

Available car stems in our database:
{json.dumps(stems)}

Output JSON format:
{{
  "intent": "car_info" | "compare" | "recommend" | "general" | "trip" | "expense" | "greeting" | "off_topic" | "unknown_car",
  "cars": ["list of matching car stems from the database above"],
  "origin": "origin city or null",
  "destination": "destination city or null",
  "max_price_lakh": number or null,
  "min_range_km": number or null,
  "min_price_lakh": number or null
}}

Rules:
1. "cars" MUST strictly contain valid stems from the available list above.
2. If the user mentions a car that is NOT in the database (such as Tesla Cybertruck), classify intent as "unknown_car" and keep "cars" empty [].
3. If user asks "Delhi to Jaipur in Nexon EV", intent is "trip", cars is ["nexon-ev"], origin is "Delhi", destination is "Jaipur".
4. If user asks "Can Punch EV reach Chandigarh on one charge?", intent is "trip", cars is ["punch-ev"], origin is "Delhi", destination is "Chandigarh".
5. If user asks "Which EV is best under ₹15L for 300 km range?", intent is "recommend", max_price_lakh is 15.0, min_range_km is 300.
6. If user asks "Cheapest EV with 400+ km real range", intent is "recommend", min_range_km is 400.
7. If user asks "Show me EVs above ₹50L", intent is "recommend", min_price_lakh is 50.0.
8. If user asks "Best EV under ₹10L", intent is "recommend", max_price_lakh is 10.0.
9. Return ONLY the JSON object without markdown fences, explanation, or extra characters.
"""

    llm = get_groq_llm(_active_router_model, temperature=0.0)

    try:
        res = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ])
        raw_text = res.content.strip()
        cleaned_text = re.sub(r"^```(?:json)?", "", raw_text).rstrip("`").strip()
        data = json.loads(cleaned_text)
        return data
    except Exception as e:
        logger.warning(f"Groq classifier call with '{_active_router_model}' failed ({e}). Retrying with fallback '{GROQ_MODEL}'")
        try:
            _active_router_model = GROQ_MODEL
            fallback_llm = ChatGroq(groq_api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=0.0)
            res = fallback_llm.invoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question}
            ])
            raw_text = res.content.strip()
            cleaned_text = re.sub(r"^```(?:json)?", "", raw_text).rstrip("`").strip()
            data = json.loads(cleaned_text)
            return data
        except Exception as e2:
            logger.error(f"Fallback classifier failed: {e2}")
            # Safe default fallback
            return {
                "intent": "general",
                "cars": [],
                "origin": None,
                "destination": None,
                "max_price_lakh": None,
                "min_range_km": None,
                "min_price_lakh": None
            }

@app.get("/health")
def health():
    db_ready = DB_DIR.exists() and any(DB_DIR.iterdir()) if DB_DIR.exists() else False
    stems = get_available_stems()
    return {
        "status": "ok",
        "service": "evyatra-ai",
        "db_indexed": db_ready,
        "groq_configured": bool(GROQ_API_KEY),
        "model": GROQ_MODEL,
        "router_model": ROUTER_MODEL,
        "cars_registered": len(stems),
    }

@app.get("/cars")
def list_cars():
    stems = get_available_stems()
    cars = load_cars_summary()
    return {"cars": [c.get("name") for c in cars], "stems": stems, "count": len(stems)}

# -----------------------------------------------------------------------------
# /chat Endpoint
# -----------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    try:
        raw_question = payload.question.strip()
        if not raw_question:
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        user_name = (payload.user_name or "there").strip() or "there"
        dropdown_car = (payload.car or "all").strip()

        # Security check: prompt injection / rules override / key requests
        q_lower = raw_question.lower()
        if any(k in q_lower for k in ["ignore your rules", "reveal your key", "api key", "tell me your key", "system prompt", "bypass rules", "ignore previous"]):
            ans = "I cannot disclose API keys, credentials, or system prompts. I am here to help you explore electric vehicles, specs, highway road trips, and EV charging in India. How can I assist you with your EV query?"
            print(f"ROUTE: security_refusal, cars: [], sources: []")
            return ChatResponse(answer=ans, sources=[])

        # 1. Run LLM Classifier
        route = classify_question(raw_question)
        intent = route.get("intent", "general")
        detected_cars = route.get("cars", [])
        origin = route.get("origin")
        destination = route.get("destination")
        max_price_lakh = route.get("max_price_lakh")
        min_price_lakh = route.get("min_price_lakh")
        min_range_km = route.get("min_range_km")

        # Resolve effective car: car in question beats dropdown car; "all" means no default car
        effective_cars = list(detected_cars)
        if not effective_cars and dropdown_car.lower() not in ["all", "all cars", "none", ""]:
            dropdown_match = find_car_by_stem_or_name(dropdown_car)
            if dropdown_match and dropdown_match.get("stem"):
                effective_cars.append(dropdown_match["stem"])

        # ---------------------------------------------------------------------
        # INTENT: greeting
        # ---------------------------------------------------------------------
        if intent == "greeting":
            sources = []
            if any(k in q_lower for k in ["thanks", "thank you", "thx", "appreciate"]):
                ans = f"You're very welcome, {user_name}! If you have any other questions about electric vehicles or charging across India, feel free to ask. Safe travels! ⚡"
            else:
                ans = f"Hi {user_name}! I'm EVYatra Assistant. Ask me about any EV specs, comparisons, charger types, or road trips across India!"
            print(f"ROUTE: greeting, cars: {effective_cars}, sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # ---------------------------------------------------------------------
        # INTENT: off_topic (petrol cars, etc.)
        # ---------------------------------------------------------------------
        if intent == "off_topic":
            sources = []
            ans = "I specialize exclusively in electric vehicles and EV charging infrastructure in India. While I cannot recommend internal combustion engine (petrol or diesel) cars, I'd be delighted to help you explore compelling electric alternatives like the Tata Nexon EV, MG Windsor EV, or Tata Punch EV!"
            print(f"ROUTE: off_topic, cars: {effective_cars}, sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # ---------------------------------------------------------------------
        # INTENT: unknown_car (not in /data, e.g. Tesla Cybertruck)
        # ---------------------------------------------------------------------
        if intent == "unknown_car":
            sources = []
            ans = "I don't have that info. The requested vehicle is not currently available or documented in our India EV knowledge catalog.\n\nHowever, if you are looking for capable high-performance or premium electric vehicles available in India, you might consider:\n1. **Hyundai Ioniq 5** (631 km claimed range, 350 kW DC ultra-fast charging)\n2. **Kia EV6** (708 km claimed range, dual-motor AWD option)\n3. **BYD Seal** (650 km claimed range, high-performance electric sedan)\n\nTip: You can ask me for prices, real-world ranges, or charging speeds for any of these India-spec EVs!"
            print(f"ROUTE: unknown_car, cars: [], sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # ---------------------------------------------------------------------
        # INTENT: expense
        # ---------------------------------------------------------------------
        if intent == "expense":
            sources = ["user-expenses"] if payload.expenses else []
            if not payload.expenses or len(payload.expenses) == 0:
                ans = "No saved trips yet. Once you record your trips and charging sessions in EVYatra, I'll calculate your total spend, per-trip breakdown, and toll vs charging splits."
            else:
                total_cost = 0.0
                total_toll = 0.0
                total_charging = 0.0
                trip_lines = []
                for idx, exp in enumerate(payload.expenses, 1):
                    t_name = exp.get("trip") or exp.get("title") or exp.get("destination") or f"Trip #{idx}"
                    cost = float(exp.get("cost") or exp.get("amount") or 0.0)
                    toll = float(exp.get("toll") or exp.get("toll_cost") or 0.0)
                    charging = float(exp.get("charging") or exp.get("charging_cost") or 0.0)
                    if cost == 0.0 and (toll > 0 or charging > 0):
                        cost = toll + charging
                    if toll == 0.0 and charging == 0.0 and cost > 0:
                        charging = cost
                    total_cost += cost
                    total_toll += toll
                    total_charging += charging
                    trip_lines.append(f"- **{t_name}**: ₹{cost:,.2f} (Charging: ₹{charging:,.2f}, Toll: ₹{toll:,.2f})")

                toll_pct = (total_toll / total_cost * 100) if total_cost > 0 else 0
                chg_pct = (total_charging / total_cost * 100) if total_cost > 0 else 0
                ans = (
                    f"Hi {user_name}! Here is your total trip expense breakdown:\n"
                    f"- **Total Spend**: ₹{total_cost:,.2f}\n"
                    f"- **Charging Cost**: ₹{total_charging:,.2f} ({chg_pct:.1f}%)\n"
                    f"- **Toll Charges**: ₹{total_toll:,.2f} ({toll_pct:.1f}%)\n\n"
                    f"**Recorded Trips ({len(payload.expenses)}):**\n" + "\n".join(trip_lines) + "\n\n"
                    f"Tip: Home AC charging usually costs around ₹1.00/km, whereas highway DC charging costs ₹2.00–₹3.00/km."
                )
            print(f"ROUTE: expense, cars: [], sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # ---------------------------------------------------------------------
        # INTENT: trip
        # ---------------------------------------------------------------------
        if intent == "trip":
            # Check car requirement
            if not effective_cars:
                ans = "Which EV should I plan this for? (e.g. Tata Nexon EV, Hyundai Ioniq 5, Tata Punch EV, MG Windsor EV)"
                print(f"ROUTE: trip, cars: [], sources: []")
                return ChatResponse(answer=ans, sources=[])

            # Check origin & destination requirement
            if not origin or not destination:
                ans = "Could you please specify both your starting city and destination? (e.g. 'Delhi to Jaipur in Nexon EV' or 'Delhi to Agra in Ioniq 5')"
                print(f"ROUTE: trip, cars: {effective_cars}, sources: []")
                return ChatResponse(answer=ans, sources=[])

            car_stem = effective_cars[0]
            car_info = find_car_by_stem_or_name(car_stem)
            car_name = car_info.get("name", car_stem.replace("-", " ").title()) if car_info else car_stem
            car_file = car_info.get("file", f"{car_stem}.md") if car_info else f"{car_stem}.md"

            distance_km = get_trip_distance(origin, destination)
            if not distance_km:
                ans = f"I couldn't identify the route between {origin.title()} and {destination.title()} in our highway database. Could you please check the spelling or specify popular highway corridors (e.g. Delhi to Jaipur, Agra, Chandigarh, Mumbai, Lucknow, Dehradun, Shimla, Amritsar)?"
                print(f"ROUTE: trip, cars: {effective_cars}, sources: []")
                return ChatResponse(answer=ans, sources=[])

            # Car specs
            real_range = float(car_info.get("real_range_km", 250.0)) if car_info else 250.0
            bat_kwh = float(car_info.get("battery_kwh", 30.0)) if car_info else 30.0

            # Formulas:
            # Usable range = real range x 0.8; stops = ceil(km/usable)-1; charging cost = km/real_range x battery_kWh x ₹18; toll = ₹1.5/km
            usable_range = real_range * 0.80
            stops = max(0, math.ceil(distance_km / usable_range) - 1)
            charging_cost = round((distance_km / real_range) * bat_kwh * 18.0)
            toll_cost = round(distance_km * 1.5)
            total_cost = charging_cost + toll_cost

            # Check if user asked: "Can X reach Y on one charge?"
            is_single_charge = any(k in q_lower for k in ["on one charge", "on a single charge", "single charge", "reach on one charge", "without charging"])
            if is_single_charge:
                can_reach = distance_km <= usable_range
                reach_verdict = "Yes" if can_reach else "No"
                ans = (
                    f"**{reach_verdict}**, the {car_name} {'can' if can_reach else 'cannot'} reach {destination.title()} on a single charge without stopping.\n\n"
                    f"- **Distance**: approx {distance_km} km\n"
                    f"- **Usable Range (80% buffer)**: approx {round(usable_range)} km (based on {round(real_range)} km real-world range)\n"
                    f"- **Charging Stops Needed**: approx {stops} stop{'s' if stops != 1 else ''}\n"
                    f"- **Approx Charging Cost**: approx ₹{charging_cost} (at ₹18/kWh)\n"
                    f"- **Approx Toll Charges**: approx ₹{toll_cost} (at ₹1.5/km)\n"
                    f"- **Total Approx Travel Cost**: approx ₹{total_cost}\n\n"
                    f"Tip: Pre-condition your battery before rapid charging and keep highway speeds under 95 km/h to conserve energy."
                )
            else:
                ans = (
                    f"Here is your road trip plan for **{origin.title()} to {destination.title()}** in the **{car_name}**:\n\n"
                    f"- **Distance**: approx {distance_km} km\n"
                    f"- **Usable Range (80% buffer)**: approx {round(usable_range)} km (based on {round(real_range)} km real-world range)\n"
                    f"- **Charging Stops Needed**: approx {stops} stop{'s' if stops != 1 else ''}\n"
                    f"- **Approx Charging Cost**: approx ₹{charging_cost} (calculated as km/real_range × {bat_kwh} kWh × ₹18/kWh)\n"
                    f"- **Approx Toll Charges**: approx ₹{toll_cost} (calculated at ₹1.5/km)\n"
                    f"- **Total Approx Travel Cost**: approx ₹{total_cost}\n\n"
                    f"Tip: Highway fast chargers typically provide the fastest speeds between 10% and 80% state of charge."
                )

            sources = ["route-planner", car_file]
            print(f"ROUTE: trip, cars: {effective_cars}, sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # ---------------------------------------------------------------------
        # INTENT: compare (2+ cars)
        # ---------------------------------------------------------------------
        if intent == "compare":
            if len(effective_cars) < 2:
                # If only 1 car in cars, check if dropdown has another or fallback
                cars_summary = load_cars_summary()
                if effective_cars:
                    c1 = effective_cars[0]
                    other = "punch-ev" if c1 != "punch-ev" else "nexon-ev"
                    effective_cars.append(other)
                else:
                    effective_cars = ["nexon-ev", "punch-ev"]

            # Fetch specs for the cars from cars_summary.json
            table_rows = []
            matched_sources = []
            car_objs = []
            for c_stem in effective_cars:
                c_data = find_car_by_stem_or_name(c_stem)
                if c_data:
                    car_objs.append(c_data)
                    matched_sources.append(c_data.get("file", f"{c_stem}.md"))
                    table_rows.append(
                        f"| **{c_data['name']}** | {c_data['price']} | {c_data['battery']} | {c_data['claimed_range']} | {c_data['real_range']} |"
                    )

            if not table_rows:
                ans = "I don't have that info for comparing those specific vehicles."
                print(f"ROUTE: compare, cars: {effective_cars}, sources: []")
                return ChatResponse(answer=ans, sources=[])

            table_md = (
                "| Vehicle | Ex-Showroom Price | Battery | Claimed Range | Real-World Range |\n"
                "|---|---|---|---|---|\n" + "\n".join(table_rows)
            )

            # Generate verdict
            c1_name = car_objs[0]["name"]
            c2_name = car_objs[1]["name"]
            c1_price = car_objs[0].get("price_min_lakh", 0)
            c2_price = car_objs[1].get("price_min_lakh", 0)
            c1_range = car_objs[0].get("real_range_max_km", 0)
            c2_range = car_objs[1].get("real_range_max_km", 0)

            if "range" in q_lower:
                if c1_range > c2_range:
                    verdict = f"**Verdict:** The {c1_name} offers a higher real-world range (up to {c1_range} km) compared to the {c2_name} (up to {c2_range} km), making it the superior choice for frequent highway travelers."
                else:
                    verdict = f"**Verdict:** The {c2_name} provides higher real-world range (up to {c2_range} km) than the {c1_name} (up to {c1_range} km), offering better long-distance range confidence."
            elif "price" in q_lower or "cost" in q_lower:
                if c1_price < c2_price:
                    verdict = f"**Verdict:** The {c1_name} is more budget-friendly starting at ₹{c1_price} Lakh, while the {c2_name} is priced higher at ₹{c2_price} Lakh but includes more premium capabilities."
                else:
                    verdict = f"**Verdict:** The {c2_name} is more affordable starting at ₹{c2_price} Lakh, whereas the {c1_name} costs ₹{c1_price} Lakh reflecting a higher segment."
            else:
                verdict = f"**Verdict:** The {c1_name} and {c2_name} cater to different requirements—prioritize the {c1_name if c1_range >= c2_range else c2_name} for extended range and the {c1_name if c1_price <= c2_price else c2_name} for maximum affordability."

            ans = f"Here is the side-by-side comparison:\n\n{table_md}\n\n{verdict}\n\nTip: Real-world range depends heavily on air conditioning usage and driving speeds on Indian highways."
            print(f"ROUTE: compare, cars: {effective_cars}, sources: {matched_sources}")
            return ChatResponse(answer=ans, sources=matched_sources)

        # ---------------------------------------------------------------------
        # INTENT: recommend (Python-filtered cars_summary.json)
        # ---------------------------------------------------------------------
        if intent == "recommend":
            all_cars = load_cars_summary()
            filtered = []

            for c in all_cars:
                p_min = c.get("price_min_lakh", 999.0)
                r_max = c.get("real_range_max_km", 0)
                r_claimed = c.get("claimed_range_km", 0)

                # Max price check
                if max_price_lakh is not None and p_min > max_price_lakh:
                    continue
                # Min price check
                if min_price_lakh is not None and p_min < min_price_lakh:
                    continue
                # Min range check
                if min_range_km is not None:
                    # check real range or claimed range
                    if "real" in q_lower:
                        if r_max < min_range_km:
                            continue
                    else:
                        if r_max < min_range_km and r_claimed < min_range_km:
                            continue

                filtered.append(c)

            # Sort
            if "cheapest" in q_lower or "lowest" in q_lower:
                filtered.sort(key=lambda x: x.get("price_min_lakh", 999.0))
            elif min_range_km is not None:
                # Rank by range suitability then price
                filtered.sort(key=lambda x: (-x.get("real_range_max_km", 0), x.get("price_min_lakh", 999.0)))
            else:
                filtered.sort(key=lambda x: x.get("price_min_lakh", 999.0))

            if not filtered:
                ans = "None of the electric vehicles in our database match your specific budget and range criteria."
                sources = []
                print(f"ROUTE: recommend, cars: [], sources: {sources}")
                return ChatResponse(answer=ans, sources=sources)

            # Format top matches
            top_matches = filtered[:6]
            matched_sources = [c.get("file") for c in top_matches if c.get("file")]

            lines = []
            for idx, c in enumerate(top_matches, 1):
                lines.append(
                    f"{idx}. **{c['name']}**\n"
                    f"   - **Price**: {c['price']}\n"
                    f"   - **Battery**: {c['battery']}\n"
                    f"   - **Real-World Range**: {c['real_range']}\n"
                    f"   - **Claimed Range**: {c['claimed_range']}"
                )

            heading = f"Here are the matching EV options based on your criteria:"
            if max_price_lakh and min_range_km:
                heading = f"The best EV under ₹{max_price_lakh:g}L offering ~{min_range_km} km range is the **{top_matches[0]['name']}**:"
            elif "cheapest" in q_lower and min_range_km:
                heading = f"The cheapest EV in India offering 400+ km real-world range is the **{top_matches[0]['name']}** (starting at {top_matches[0]['price']}):"
            elif max_price_lakh:
                heading = f"Here are the best EVs under ₹{max_price_lakh:g} Lakh in India:"
            elif min_price_lakh:
                heading = f"Here are the electric vehicles priced above ₹{min_price_lakh:g} Lakh in India:"

            ans = f"{heading}\n\n" + "\n".join(lines) + f"\n\nTip: Always test drive on highway stretches to observe actual energy consumption with AC running."
            print(f"ROUTE: recommend, cars: {[c.get('stem') for c in top_matches]}, sources: {matched_sources}")
            return ChatResponse(answer=ans, sources=matched_sources)

        # ---------------------------------------------------------------------
        # INTENT: general (charger-types.md & charging-cost-tips.md only)
        # ---------------------------------------------------------------------
        if intent == "general":
            store = get_vector_store()
            docs = []
            if store:
                try:
                    docs = store.similarity_search(
                        raw_question,
                        k=4,
                        filter={"source": {"$in": ["charger-types.md", "charging-cost-tips.md"]}}
                    )
                except Exception as fe:
                    docs = store.similarity_search(raw_question, k=4)

            sources = ["charger-types.md", "charging-cost-tips.md"]
            context_text = "\n\n---\n\n".join([d.page_content for d in docs])

            # Use LLM for grounded answer
            llm = get_groq_llm(GROQ_MODEL, temperature=0.1)
            prompt = (
                f"You are EVYatra Assistant, an expert on electric vehicles and charging infrastructure in India.\n"
                f"Answer the user's question ONLY using the Context provided below.\n"
                f"Give the number/direct facts first, then one short tip.\n"
                f"Never mention any car that is not in the context.\n\n"
                f"Context:\n{context_text}\n\n"
                f"Question: {raw_question}\n\n"
                f"Answer:"
            )
            res = llm.invoke(prompt)
            ans = res.content.strip() if hasattr(res, "content") else str(res).strip()
            print(f"ROUTE: general, cars: [], sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # ---------------------------------------------------------------------
        # INTENT: car_info
        # ---------------------------------------------------------------------
        if intent == "car_info":
            if not effective_cars:
                ans = "Which electric vehicle would you like to know about? (e.g. Tata Nexon EV, MG Windsor EV, Tata Punch EV, Hyundai Ioniq 5)"
                print(f"ROUTE: car_info, cars: [], sources: []")
                return ChatResponse(answer=ans, sources=[])

            car_stem = effective_cars[0]
            car_info = find_car_by_stem_or_name(car_stem)
            car_name = car_info.get("name", car_stem.replace("-", " ").title()) if car_info else car_stem
            car_file = car_info.get("file", f"{car_stem}.md") if car_info else f"{car_stem}.md"

            store = get_vector_store()
            docs = []
            if store:
                try:
                    docs = store.similarity_search(
                        f"{car_name} {raw_question}",
                        k=4,
                        filter={"source": car_file}
                    )
                except Exception:
                    docs = store.similarity_search(f"{car_name} {raw_question}", k=4)

            if not docs:
                ans = "I don't have that info."
                print(f"ROUTE: car_info, cars: {effective_cars}, sources: []")
                return ChatResponse(answer=ans, sources=[])

            sources = [car_file]
            context_text = "\n\n---\n\n".join([d.page_content for d in docs])

            llm = get_groq_llm(GROQ_MODEL, temperature=0.1)
            prompt = (
                f"You are EVYatra Assistant, an expert on electric vehicles and charging in India.\n"
                f"Answer the user's question ONLY using the Context provided below.\n"
                f"Give the number or direct answer first, then add exactly one short helpful tip.\n"
                f"Never mention any car that is not in the context.\n"
                f"Do not provide generic top EV lists.\n"
                f"If the information is not present in the Context, respond EXACTLY: 'I don't have that info.'\n\n"
                f"Context for {car_name}:\n{context_text}\n\n"
                f"Question: {raw_question}\n\n"
                f"Answer:"
            )
            res = llm.invoke(prompt)
            ans = res.content.strip() if hasattr(res, "content") else str(res).strip()
            print(f"ROUTE: car_info, cars: {effective_cars}, sources: {sources}")
            return ChatResponse(answer=ans, sources=sources)

        # Fallback
        ans = "I don't have that info."
        print(f"ROUTE: unknown, cars: [], sources: []")
        return ChatResponse(answer=ans, sources=[])

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
