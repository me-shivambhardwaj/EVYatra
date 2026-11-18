"""
Ingestion script for EVYatra AI RAG knowledge base.
Rebuilds ./db from markdown documents in ./data/*.md.
Prefixes each chunk with its file title, stores metadata {car, source},
and embeds using FastEmbed (BAAI/bge-small-en-v1.5) with langchain_chroma.
Auto-builds cars_summary.json (name, price, battery, claimed range, real range).
"""

import os
import re
import glob
import json
import shutil
from pathlib import Path
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_chroma import Chroma

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_DIR = BASE_DIR / "db"
SUMMARY_FILE = BASE_DIR / "cars_summary.json"
MODEL_NAME = "BAAI/bge-small-en-v1.5"

GENERIC_FILES = {"charger-types.md", "charging-cost-tips.md", "ev-knowledge.md"}

def extract_file_title(filepath: str, default_name: str) -> str:
    """Extracts the first markdown H1 header as title, or falls back to cleaned filename."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith("# "):
                    return stripped[2:].strip()
    except Exception:
        pass
    return default_name.replace(".md", "").replace("-", " ").title()

def extract_price_lakh(price_str: str) -> float:
    m_lakh = re.search(r'(\d+(?:\.\d+)?)\s*(?:Lakh|L)', price_str, re.IGNORECASE)
    if m_lakh:
        return float(m_lakh.group(1))
    m_cr = re.search(r'(\d+(?:\.\d+)?)\s*(?:Cr|Crore)', price_str, re.IGNORECASE)
    if m_cr:
        return float(m_cr.group(1)) * 100.0
    nums = [float(x) for x in re.findall(r'\d+(?:\.\d+)?', price_str) if float(x) > 0]
    return nums[0] if nums else 999.0

def get_field(text: str, header_pattern: str) -> str:
    pattern = rf"- \*\*{header_pattern}\*\*:\s*([^\n]+(?:\n\s+-[^\n]+)*)"
    m = re.search(pattern, text, re.IGNORECASE)
    if not m:
        return "N/A"
    raw = m.group(1).strip()
    lines = [re.sub(r"^\s*-\s*", "", l).strip() for l in raw.splitlines() if l.strip()]
    return " | ".join(lines)

def build_cars_summary():
    print(f"Building cars_summary.json from {DATA_DIR}...")
    cars = []
    for p in sorted(DATA_DIR.glob("*.md")):
        if p.name in GENERIC_FILES:
            continue
        text = p.read_text(encoding="utf-8")
        title_m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        name = title_m.group(1).strip() if title_m else p.stem.replace("-", " ").title()

        price_str = get_field(text, r"Ex-showroom Price[^*]*")
        min_p = extract_price_lakh(price_str)
        bat_str = get_field(text, r"Battery Capacity[^*]*")
        claimed_str = get_field(text, r"Claimed[^*]*Range[^*]*")
        real_str = get_field(text, r"Real-world[^*]*Range[^*]*")

        # battery kWh numeric
        bat_m = re.findall(r'(\d+(?:\.\d+)?)\s*kWh', bat_str, re.IGNORECASE)
        bats = [float(b) for b in bat_m]
        bat_kwh = bats[-1] if bats else 30.0

        # claimed range numeric
        claim_nums = [int(n) for n in re.findall(r'\b\d+\b', claimed_str)]
        claimed_km = claim_nums[-1] if claim_nums else 300

        # real range numeric
        real_nums = [int(n) for n in re.findall(r'\b\d+\b', real_str)]
        real_min = real_nums[0] if real_nums else int(claimed_km * 0.7)
        real_max = real_nums[-1] if len(real_nums) > 1 else real_min
        real_avg = (real_min + real_max) / 2.0

        cars.append({
            "name": name,
            "file": p.name,
            "stem": p.stem,
            "price": price_str,
            "price_min_lakh": min_p,
            "battery": bat_str,
            "battery_kwh": bat_kwh,
            "claimed_range": claimed_str,
            "claimed_range_km": claimed_km,
            "real_range": real_str,
            "real_range_min_km": real_min,
            "real_range_max_km": real_max,
            "real_range_km": real_avg
        })

    cars.sort(key=lambda x: x["price_min_lakh"])
    SUMMARY_FILE.write_text(json.dumps(cars, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Generated cars_summary.json with {len(cars)} cars at {SUMMARY_FILE}")
    return cars

def ingest():
    print(f"Starting EVYatra ingestion...")
    print(f"Data directory: {DATA_DIR}")
    print(f"Database directory: {DB_DIR}")

    # 1. Build cars summary table
    build_cars_summary()

    # 2. Delete and rebuild ./db
    if DB_DIR.exists():
        print(f"Deleting existing database directory at {DB_DIR}...")
        shutil.rmtree(DB_DIR, ignore_errors=True)
    DB_DIR.mkdir(parents=True, exist_ok=True)
    print("Clean ./db directory prepared.")

    # 3. Discover markdown files
    md_files = glob.glob(str(DATA_DIR / "*.md"))
    if not md_files:
        print(f"No .md files found in {DATA_DIR}")
        return

    # Text splitter: chunk_size 1200, overlap 150
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=150,
        separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""]
    )

    all_chunks = []

    for filepath in md_files:
        filename = os.path.basename(filepath)
        title = extract_file_title(filepath, filename)
        print(f" - Indexing '{filename}' -> Car/Topic: '{title}'")

        loader = TextLoader(filepath, encoding="utf-8")
        docs = loader.load()

        file_chunks = splitter.split_documents(docs)
        for chunk in file_chunks:
            chunk.page_content = f"{title}\n\n{chunk.page_content.strip()}"
            chunk.metadata["car"] = title
            chunk.metadata["source"] = filename

        all_chunks.extend(file_chunks)

    chunk_count = len(all_chunks)
    print(f"Total chunks indexed: {chunk_count}")

    # Initialize FastEmbed embeddings (BAAI/bge-small-en-v1.5)
    print(f"Initializing FastEmbed embeddings with model '{MODEL_NAME}'...")
    embeddings = FastEmbedEmbeddings(model_name=MODEL_NAME)

    # Create Chroma vector store with langchain_chroma
    print(f"Storing chunks in ChromaDB at {DB_DIR}...")
    vector_store = Chroma.from_documents(
        documents=all_chunks,
        embedding=embeddings,
        persist_directory=str(DB_DIR),
        collection_name="evyatra_knowledge"
    )

    print(f"Ingestion successfully completed! Vector store rebuilt with {chunk_count} chunks in ./db")

if __name__ == "__main__":
    ingest()
