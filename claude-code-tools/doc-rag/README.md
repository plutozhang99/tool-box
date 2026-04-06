# doc-rag

Generic RAG (Retrieval-Augmented Generation) tool for any documentation directory. Provides semantic search via ChromaDB, a streaming Q&A web UI, and an MCP server for Claude Code integration.

## Setup

```bash
cd /path/to/claude-code-tools/doc-rag
./setup.sh
cp .env.example .env
# Edit .env — add your API key(s) and project config
```

## Usage

### 1. MCP Server (Claude Code integration)

Create a `.mcp.json` file in the **root of your docs project**:

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

Restart your Claude Code session — it will prompt you to approve the MCP server. Once approved, the following tools are available in conversation:

- `search_docs(query, n_results, source_filter)` — semantic search over indexed docs
- `ingest_docs()` — re-index documents (idempotent upsert)
- `sync_docs()` — git pull + re-index (safe if not a git repo)
- `get_stats()` — check index status

### 2. Web UI

```bash
./serve.sh --docs-dir /path/to/docs --project my_project [--port 8100]
# Open http://localhost:8100
```

The web UI provides:
- Streaming Q&A with source citations
- **Sync** button — pulls latest from git and re-indexes
- **Re-index Only** button — re-indexes without git pull
- Search across all indexed documents

### 3. Use OpenRouter instead of Anthropic

MCP (add to args in `.mcp.json`):
```json
"--llm-provider", "openrouter"
```

Web UI:
```bash
./serve.sh --docs-dir /path/to/docs --project my_project --llm-provider openrouter
```

## Server Deployment

For deploying on a server where the docs directory already exists:

### Docker (recommended)

```bash
git clone <this-repo> /opt/doc-rag
cd /opt/doc-rag/doc-rag

cp .env.example .env
# Edit .env:
#   ANTHROPIC_API_KEY=sk-ant-xxx
#   DOC_RAG_DOCS_DIR=/path/to/docs-on-server
#   DOC_RAG_PROJECT=your_project_name

docker compose up -d
# Access at http://your-server:8100
```

The docs directory is bind-mounted into the container. ChromaDB data persists in a Docker volume.

To enable the **Sync** button (git pull from inside the container), remove `:ro` from the volume mount in `docker-compose.yml`.

### Direct (no Docker)

```bash
cd /opt/doc-rag
./setup.sh
cp .env.example .env  # fill in config

./serve.sh \
  --docs-dir /path/to/docs-on-server \
  --project your_project_name \
  --port 8100
```

## Multiple Projects

Each project gets its own ChromaDB collection (namespaced by `--project`). The same doc-rag installation supports multiple projects simultaneously.

```
# Project A — .mcp.json in project A's root
--docs-dir /path/to/project-a/docs --project project_a

# Project B — .mcp.json in project B's root
--docs-dir /path/to/project-b/docs --project project_b

# Both stored in doc-rag/.chroma_db/ with separate collections
```

## Configuration Reference

### CLI args (MCP server + serve.sh)

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `--docs-dir` | yes | — | Path to documentation directory |
| `--project` | yes | — | Project name (ChromaDB collection namespace) |
| `--llm-provider` | no | `anthropic` | `anthropic` or `openrouter` |
| `--llm-model` | no | auto | Override default model |
| `--port` | no | `8100` | FastAPI server port |
| `--chroma-dir` | no | `doc-rag/.chroma_db/` | Override ChromaDB storage location |

### Environment variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | if using anthropic | Claude API key |
| `OPENROUTER_API_KEY` | if using openrouter | OpenRouter API key |
| `DOC_RAG_DOCS_DIR` | for serve.sh / docker | Path to docs directory |
| `DOC_RAG_PROJECT` | for serve.sh / docker | Project name |
| `DOC_RAG_LLM_PROVIDER` | no | `anthropic` (default) or `openrouter` |
| `DOC_RAG_LLM_MODEL` | no | Override default model |
| `DOC_RAG_PORT` | no | Server port (default: `8100`) |

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Status + indexed chunk count |
| `GET` | `/search?q=...&n=5` | Semantic search |
| `POST` | `/ingest` | Re-index documents |
| `POST` | `/sync` | Git pull + re-index |
| `POST` | `/ask` | RAG Q&A (SSE streaming) |
| `GET` | `/` | Web UI |

## Architecture

```
doc-rag/
├── config.py              # CLI args + env var parsing
├── chroma_store.py        # Vector store + git sync (ChromaDB, cosine similarity)
├── llm/
│   ├── base.py            # LLMClient protocol + factory
│   ├── anthropic_client.py
│   └── openrouter_client.py
├── mcp_server.py          # MCP server (stdio transport)
├── api/main.py            # FastAPI backend (SSE streaming)
├── frontend/index.html    # Single-file dark-theme web UI
├── Dockerfile
├── docker-compose.yml
├── setup.sh               # One-time setup (venv + deps)
└── serve.sh               # Start web UI for a project
```
