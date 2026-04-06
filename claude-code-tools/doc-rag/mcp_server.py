"""MCP Server for doc-rag — generic docs RAG, use with Claude Code."""

import sys

from config import DocRagConfig
import chroma_store
from mcp.server.fastmcp import FastMCP

# Parse config from CLI args (MCP server receives these via settings.local.json)
config = DocRagConfig.from_args(sys.argv[1:])

mcp = FastMCP(
    f"{config.project} Docs",
    instructions=(
        f"Search and query the {config.project} documentation. "
        "Use search_docs to find relevant information, "
        "and get_stats to check indexing status."
    ),
)


@mcp.tool()
def search_docs(query: str, n_results: int = 5, source_filter: str | None = None) -> list[dict]:
    """Search the documentation vector database.

    Args:
        query: Natural language search query
        n_results: Number of results to return (1-20)
        source_filter: Optional substring filter on source path
    """
    n_results = max(1, min(20, n_results))
    return chroma_store.search(config, query, n_results=n_results, source_filter=source_filter)


@mcp.tool()
def ingest_docs() -> dict:
    """Re-index all documents from the documentation directory."""
    return chroma_store.ingest_docs(config, verbose=False)


@mcp.tool()
def sync_docs() -> dict:
    """Pull latest changes from git and re-index documents.

    Runs `git pull --ff-only` in the docs directory, then re-indexes.
    Safe to call even if docs_dir is not a git repo (will skip pull, still re-index).
    """
    return chroma_store.sync_and_ingest(config, verbose=False)


@mcp.tool()
def get_stats() -> dict:
    """Get statistics about the indexed document collection."""
    collection = chroma_store.get_collection(config)
    return {
        "project": config.project,
        "collection_name": config.collection_name,
        "total_documents": collection.count(),
        "docs_dir": str(config.docs_dir),
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
