#!/bin/bash
# Start the doc-rag web UI for a specific project.
# Usage: ./serve.sh --docs-dir /path/to/docs --project my_project [--llm-provider openrouter] [--port 8100]
set -e

cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    echo "Run ./setup.sh first."
    exit 1
fi

source .venv/bin/activate

# Load .env
if [ -f .env ]; then
    set -a; source .env; set +a
fi

# Parse args into env vars for uvicorn
while [[ $# -gt 0 ]]; do
    case $1 in
        --docs-dir) export DOC_RAG_DOCS_DIR="$2"; shift 2 ;;
        --project) export DOC_RAG_PROJECT="$2"; shift 2 ;;
        --llm-provider) export DOC_RAG_LLM_PROVIDER="$2"; shift 2 ;;
        --llm-model) export DOC_RAG_LLM_MODEL="$2"; shift 2 ;;
        --port) export DOC_RAG_PORT="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

if [ -z "$DOC_RAG_DOCS_DIR" ] || [ -z "$DOC_RAG_PROJECT" ]; then
    echo "Usage: ./serve.sh --docs-dir /path/to/docs --project my_project"
    exit 1
fi

PORT="${DOC_RAG_PORT:-8100}"

# Ingest on startup
echo "Indexing ${DOC_RAG_DOCS_DIR}..."
python chroma_store.py --help 2>/dev/null || true
python -c "
from config import DocRagConfig
import chroma_store
config = DocRagConfig.from_env()
chroma_store.ingest_docs(config)
"

echo ""
echo "Starting ${DOC_RAG_PROJECT} docs Q&A at http://localhost:${PORT}"
echo ""
python -m uvicorn api.main:app --reload --port "$PORT"
