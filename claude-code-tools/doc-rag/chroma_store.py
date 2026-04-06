"""ChromaDB vector store — generic, works with any docs directory."""

import hashlib
import logging
import os
import re
import subprocess
from pathlib import Path

import chromadb

from config import DocRagConfig

logger = logging.getLogger(__name__)

# Chunk config
CHUNK_SIZE = 800
CHUNK_OVERLAP = 200


def get_client(config: DocRagConfig) -> chromadb.ClientAPI:
    return chromadb.PersistentClient(path=str(config.chroma_dir))


def get_collection(config: DocRagConfig, client: chromadb.ClientAPI | None = None):
    if client is None:
        client = get_client(config)
    return client.get_or_create_collection(
        name=config.collection_name,
        metadata={"hnsw:space": "cosine"},
    )


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


def _doc_id(docs_dir: Path, file_path: str, chunk_idx: int) -> str:
    rel = os.path.relpath(file_path, docs_dir)
    return hashlib.sha256(f"{rel}::{chunk_idx}".encode()).hexdigest()[:32]


def _read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError as e:
        logger.warning("Could not read %s: %s", path, e)
        return ""


def _extract_title(content: str, file_path: Path) -> str:
    match = re.search(r"^#\s+(.+)", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return file_path.stem.replace("_", " ").title()


def _should_exclude(path: Path, exclude_patterns: tuple[str, ...]) -> bool:
    parts = path.parts
    return any(pattern in parts for pattern in exclude_patterns)


def ingest_docs(config: DocRagConfig, verbose: bool = True) -> dict:
    """Index all docs from config.docs_dir into ChromaDB."""
    client = get_client(config)
    collection = get_collection(config, client)

    doc_files = [
        p for p in config.docs_dir.rglob("*")
        if p.suffix in config.file_extensions
        and p.is_file()
        and not _should_exclude(p, config.exclude_patterns)
    ]

    total_chunks = 0
    total_files = 0

    batch_ids: list[str] = []
    batch_docs: list[str] = []
    batch_metas: list[dict] = []
    BATCH_SIZE = 100

    for file_path in doc_files:
        content = _read_file(file_path)
        if not content.strip():
            continue

        rel_path = str(file_path.relative_to(config.docs_dir))
        title = _extract_title(content, file_path)
        chunks = _chunk_text(content)

        for idx, chunk in enumerate(chunks):
            doc_id = _doc_id(config.docs_dir, str(file_path), idx)
            batch_ids.append(doc_id)
            batch_docs.append(chunk)
            batch_metas.append({
                "source": rel_path,
                "title": title,
                "chunk_index": idx,
                "total_chunks": len(chunks),
            })

            if len(batch_ids) >= BATCH_SIZE:
                collection.upsert(ids=batch_ids, documents=batch_docs, metadatas=batch_metas)
                total_chunks += len(batch_ids)
                batch_ids, batch_docs, batch_metas = [], [], []

        total_files += 1
        if verbose:
            logger.info("[%d/%d] %s -> %d chunks", total_files, len(doc_files), rel_path, len(chunks))

    if batch_ids:
        collection.upsert(ids=batch_ids, documents=batch_docs, metadatas=batch_metas)
        total_chunks += len(batch_ids)

    stats = {
        "files_indexed": total_files,
        "total_chunks": total_chunks,
        "collection_count": collection.count(),
    }
    if verbose:
        logger.info("Done: %d files, %d chunks indexed.", stats["files_indexed"], stats["total_chunks"])
    return stats


def git_pull(config: DocRagConfig) -> dict:
    """Pull latest changes from the docs git repo. Returns pull result."""
    git_dir = config.docs_dir / ".git"
    if not git_dir.is_dir():
        return {"status": "skipped", "message": f"{config.docs_dir} is not a git repository"}

    try:
        result = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=config.docs_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return {
                "status": "error",
                "message": result.stderr.strip() or result.stdout.strip(),
            }

        output = result.stdout.strip()
        already_up_to_date = "Already up to date" in output or "Already up-to-date" in output
        return {
            "status": "unchanged" if already_up_to_date else "updated",
            "message": output,
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "git pull timed out after 60s"}
    except FileNotFoundError:
        return {"status": "error", "message": "git not found on PATH"}


def sync_and_ingest(config: DocRagConfig, verbose: bool = True) -> dict:
    """Pull latest from git, then re-index. Returns combined result."""
    pull_result = git_pull(config)
    if verbose:
        logger.info("git pull: %s — %s", pull_result["status"], pull_result["message"])

    ingest_result = ingest_docs(config, verbose=verbose)
    return {
        "git_pull": pull_result,
        "ingest": ingest_result,
    }


def search(config: DocRagConfig, query: str, n_results: int = 5, source_filter: str | None = None) -> list[dict]:
    collection = get_collection(config)

    where = None
    if source_filter:
        where = {"source": {"$contains": source_filter}}

    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
        where=where,
    )

    items = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        items.append({
            "content": doc,
            "source": meta.get("source", ""),
            "title": meta.get("title", ""),
            "chunk_index": meta.get("chunk_index", 0),
            "distance": round(dist, 4),
        })
    return items
