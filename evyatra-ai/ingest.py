"""
Ingestion script for EVYatra AI RAG knowledge base.
Rebuilds ./db from markdown documents in ./data/*.md.
Prefixes each chunk with its file title, stores metadata {car, source},
and embeds using FastEmbed (BAAI/bge-small-en-v1.5) with langchain_chroma.
Builds all metadata automatically from data files with zero hardcoding.
"""

import os
import glob
import shutil
from pathlib import Path
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_chroma import Chroma

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_DIR = BASE_DIR / "db"
MODEL_NAME = "BAAI/bge-small-en-v1.5"

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

def ingest():
    print(f"Starting EVYatra ingestion...")
    print(f"Data directory: {DATA_DIR}")
    print(f"Database directory: {DB_DIR}")

    # 1. Delete and rebuild ./db
    if DB_DIR.exists():
        print(f"Deleting existing database directory at {DB_DIR}...")
        shutil.rmtree(DB_DIR, ignore_errors=True)
    DB_DIR.mkdir(parents=True, exist_ok=True)
    print("Clean ./db directory prepared.")

    # 2. Discover markdown files
    md_files = glob.glob(str(DATA_DIR / "*.md"))
    if not md_files:
        print(f"No .md files found in {DATA_DIR}")
        return

    # Text splitter: chunk_size 1200, overlap 150 (preserves complete car spec sections)
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
            # Prefix each chunk with its file title
            chunk.page_content = f"{title}\n\n{chunk.page_content.strip()}"
            # Store metadata {car, source} dynamically
            chunk.metadata["car"] = title
            chunk.metadata["source"] = filename

        all_chunks.extend(file_chunks)

    # Print chunk count
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
