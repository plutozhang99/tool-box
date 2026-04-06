"""Configuration for doc-rag — parsed from CLI args or env vars."""

import argparse
import re
from dataclasses import dataclass, field
from pathlib import Path


TOOL_DIR = Path(__file__).resolve().parent


def _sanitize_collection_name(name: str) -> str:
    """Sanitize project name for ChromaDB collection (3-63 chars, alphanumeric + _-)."""
    name = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_-")
    return name[:63] if len(name) >= 3 else name.ljust(3, "_")


@dataclass(frozen=True)
class DocRagConfig:
    docs_dir: Path
    project: str
    llm_provider: str = "anthropic"  # "anthropic" or "openrouter"
    llm_model: str | None = None
    chroma_dir: Path = field(default_factory=lambda: TOOL_DIR / ".chroma_db")
    port: int = 8100
    file_extensions: tuple[str, ...] = (".md", ".html", ".txt", ".rst")
    exclude_patterns: tuple[str, ...] = (
        ".venv", "node_modules", ".chroma_db", ".git",
        "__pycache__", ".tox", "dist", "build",
    )

    @property
    def collection_name(self) -> str:
        return _sanitize_collection_name(self.project)

    @property
    def default_model(self) -> str:
        if self.llm_model:
            return self.llm_model
        if self.llm_provider == "openrouter":
            return "anthropic/claude-sonnet-4"
        return "claude-sonnet-4-20250514"

    @classmethod
    def from_args(cls, argv: list[str] | None = None) -> "DocRagConfig":
        parser = argparse.ArgumentParser(description="doc-rag: RAG over any docs directory")
        parser.add_argument("--docs-dir", required=True, help="Path to documentation directory")
        parser.add_argument("--project", required=True, help="Project name (used as collection namespace)")
        parser.add_argument("--llm-provider", default="anthropic", choices=["anthropic", "openrouter"])
        parser.add_argument("--llm-model", default=None, help="Override default model")
        parser.add_argument("--chroma-dir", default=None, help="Override ChromaDB storage dir")
        parser.add_argument("--port", type=int, default=8100, help="FastAPI server port")
        args = parser.parse_args(argv)

        docs_dir = Path(args.docs_dir).resolve()
        if not docs_dir.is_dir():
            parser.error(f"--docs-dir does not exist: {docs_dir}")

        chroma_dir = Path(args.chroma_dir).resolve() if args.chroma_dir else TOOL_DIR / ".chroma_db"

        return cls(
            docs_dir=docs_dir,
            project=args.project,
            llm_provider=args.llm_provider,
            llm_model=args.llm_model,
            chroma_dir=chroma_dir,
            port=args.port,
        )

    @classmethod
    def from_env(cls) -> "DocRagConfig":
        """Create config from environment variables (for FastAPI/uvicorn)."""
        import os
        docs_dir_raw = os.environ.get("DOC_RAG_DOCS_DIR")
        project = os.environ.get("DOC_RAG_PROJECT")
        if not docs_dir_raw or not project:
            raise ValueError("DOC_RAG_DOCS_DIR and DOC_RAG_PROJECT env vars are required")
        docs_dir = Path(docs_dir_raw).resolve()
        if not docs_dir.is_dir():
            raise ValueError(f"DOC_RAG_DOCS_DIR does not exist or is not a directory: {docs_dir}")
        return cls(
            docs_dir=docs_dir,
            project=project,
            llm_provider=os.environ.get("DOC_RAG_LLM_PROVIDER", "anthropic"),
            llm_model=os.environ.get("DOC_RAG_LLM_MODEL"),
            chroma_dir=Path(os.environ.get("DOC_RAG_CHROMA_DIR", str(TOOL_DIR / ".chroma_db"))),
            port=int(os.environ.get("DOC_RAG_PORT", "8100")),
        )
