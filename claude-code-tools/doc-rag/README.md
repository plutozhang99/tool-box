# doc-rag

Generic RAG (Retrieval-Augmented Generation) tool for any documentation directory. Provides semantic search via ChromaDB, a streaming Q&A web UI, and an MCP server for Claude Code integration.

## Setup

```bash
cd /path/to/claude-code-tools/doc-rag
./setup.sh
# Edit .env — add your API key(s)
```

## Usage

### 1. MCP Server (Claude Code integration)

Add to your project's `.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "doc-rag": {
      "command": "/path/to/doc-rag/.venv/bin/python",
      "args": [
        "/path/to/doc-rag/mcp_server.py",
        "--docs-dir", "/path/to/your/docs",
        "--project", "your_project_name"
      ]
    }
  }
}
```

Available MCP tools:
- `search_docs(query, n_results, source_filter)` — semantic search
- `ingest_docs()` — re-index after doc changes
- `get_stats()` — check index status

### 2. Web UI

```bash
./serve.sh --docs-dir /path/to/docs --project my_project [--port 8100]
# Open http://localhost:8100
```

### 3. Use OpenRouter instead of Anthropic

MCP:
```json
"args": [
  "/path/to/doc-rag/mcp_server.py",
  "--docs-dir", "/path/to/docs",
  "--project", "my_project",
  "--llm-provider", "openrouter"
]
```

Web UI:
```bash
./serve.sh --docs-dir /path/to/docs --project my_project --llm-provider openrouter
```

## Multiple Projects

Each project gets its own ChromaDB collection (namespaced by `--project`). You can use the same doc-rag installation for multiple projects simultaneously.

```
# Project A (MCP in project A's settings.local.json)
--docs-dir /path/to/project-a/docs --project project_a

# Project B (MCP in project B's settings.local.json)
--docs-dir /path/to/project-b/docs --project project_b

# Both stored in doc-rag/.chroma_db/ with separate collections
```

## Architecture

```
doc-rag/
├── config.py           # CLI args + env var parsing
├── chroma_store.py     # Vector store (ChromaDB, cosine similarity)
├── llm/
│   ├── base.py         # LLMClient protocol + factory
│   ├── anthropic_client.py
│   └── openrouter_client.py
├── mcp_server.py       # MCP server (stdio transport)
├── api/main.py         # FastAPI backend (SSE streaming)
└── frontend/index.html # Single-file dark-theme web UI
```

## Tech Stack

- **ChromaDB** — local persistent vector DB with cosine similarity
- **FastAPI** — REST API + SSE streaming for Q&A
- **Anthropic SDK** — Claude API for answer generation
- **OpenAI SDK** — OpenRouter API (OpenAI-compatible)
- **MCP** — Model Context Protocol for Claude Code
- **Vanilla HTML/JS** — zero-dependency frontend
