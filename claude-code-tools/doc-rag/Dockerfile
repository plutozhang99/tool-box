FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8100

# Docs dir is mounted at /docs at runtime
# Environment variables required:
#   DOC_RAG_DOCS_DIR=/docs
#   DOC_RAG_PROJECT=your_project_name
#   ANTHROPIC_API_KEY or OPENROUTER_API_KEY

CMD ["sh", "-c", "\
    python -c '\
import logging; logging.basicConfig(level=logging.INFO); \
from config import DocRagConfig; import chroma_store; \
config = DocRagConfig.from_env(); \
chroma_store.ingest_docs(config)' \
    && python -m uvicorn api.main:app --host 0.0.0.0 --port ${DOC_RAG_PORT:-8100}"]
