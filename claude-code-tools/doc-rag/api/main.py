"""FastAPI backend for doc-rag Q&A system."""

import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

_TOOL_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_TOOL_ROOT))

import chroma_store
from config import DocRagConfig
from llm import create_llm_client

load_dotenv(_TOOL_ROOT / ".env")

_config: DocRagConfig | None = None


def _get_config() -> DocRagConfig:
    global _config
    if _config is None:
        _config = DocRagConfig.from_env()
    return _config


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _config
    _config = DocRagConfig.from_env()
    chroma_store.get_collection(_config)
    yield


app = FastAPI(title="doc-rag", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class GitPullResult(BaseModel):
    status: str
    message: str


class IngestResponse(BaseModel):
    files_indexed: int
    total_chunks: int
    collection_count: int


class SyncResponse(BaseModel):
    git_pull: GitPullResult
    ingest: IngestResponse


class SearchResult(BaseModel):
    content: str
    source: str
    title: str
    chunk_index: int
    distance: float


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4096)
    n_context: int = Field(default=5, ge=1, le=20)
    source_filter: str | None = None


@app.get("/health")
async def health():
    cfg = _get_config()
    count = chroma_store.get_collection(cfg).count()
    return {"status": "ok", "project": cfg.project, "docs_indexed": count}


@app.post("/ingest", response_model=IngestResponse)
async def ingest():
    stats = chroma_store.ingest_docs(_get_config(), verbose=False)
    return IngestResponse(**stats)


@app.post("/sync", response_model=SyncResponse)
async def sync():
    """Pull latest from git, then re-index."""
    result = chroma_store.sync_and_ingest(_get_config(), verbose=False)
    return SyncResponse(
        git_pull=GitPullResult(**result["git_pull"]),
        ingest=IngestResponse(**result["ingest"]),
    )


@app.get("/search", response_model=list[SearchResult])
async def search_endpoint(
    q: str = Query(..., description="Search query"),
    n: int = Query(5, ge=1, le=20),
    source: str | None = Query(None, description="Filter by source path substring"),
):
    results = chroma_store.search(_get_config(), q, n_results=n, source_filter=source)
    return [SearchResult(**r) for r in results]


@app.post("/ask")
async def ask(req: AskRequest):
    cfg = _get_config()

    context_results = chroma_store.search(
        cfg, req.question, n_results=req.n_context, source_filter=req.source_filter,
    )

    if not context_results:
        return {"answer": "No relevant documents found. Run /ingest first.", "sources": []}

    context_parts = []
    sources = []
    for r in context_results:
        context_parts.append(f"[Source: {r['source']}]\n{r['content']}")
        if r["source"] not in sources:
            sources.append(r["source"])

    context_text = "\n\n---\n\n".join(context_parts)

    llm = create_llm_client(cfg)

    system_prompt = (
        f"You are a helpful assistant for the {cfg.project} project. "
        "Answer questions based on the provided documentation context. "
        "If the context doesn't contain enough information, say so. "
        "Always cite which source documents you're referencing. "
        "Answer in the same language as the question."
    )

    user_prompt = (
        f"Based on the following documentation:\n\n"
        f"{context_text}\n\n---\n\n"
        f"Question: {req.question}"
    )

    async def generate():
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        async for token in llm.stream(system_prompt, user_prompt):
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/", response_class=HTMLResponse)
async def index():
    cfg = _get_config()
    frontend_path = _TOOL_ROOT / "frontend" / "index.html"
    try:
        html = frontend_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Frontend not found")
    return HTMLResponse(content=html.replace("{{PROJECT_NAME}}", cfg.project))
