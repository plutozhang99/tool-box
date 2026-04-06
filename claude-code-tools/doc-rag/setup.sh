#!/bin/bash
# Setup doc-rag: create venv, install deps, print config snippet
set -e

cd "$(dirname "$0")"
TOOL_DIR="$(pwd)"

echo "=== doc-rag setup ==="
echo ""

# 1. Create venv
if [ ! -d .venv ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# 2. Install deps
echo "Installing dependencies..."
pip install -q -r requirements.txt

# 3. Check .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "Created .env from .env.example"
    echo "Edit .env to add your API key(s)."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "To use as MCP server in a project, add to .claude/settings.local.json:"
echo ""
cat <<EOF
{
  "mcpServers": {
    "doc-rag": {
      "command": "${TOOL_DIR}/.venv/bin/python",
      "args": [
        "${TOOL_DIR}/mcp_server.py",
        "--docs-dir", "/path/to/your/docs",
        "--project", "your_project_name"
      ]
    }
  }
}
EOF
echo ""
echo "To start the web UI:"
echo ""
echo "  DOC_RAG_DOCS_DIR=/path/to/docs DOC_RAG_PROJECT=my_project \\"
echo "    ${TOOL_DIR}/.venv/bin/python -m uvicorn api.main:app --port 8100"
echo ""
