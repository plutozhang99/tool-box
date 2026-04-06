"""LLM client abstraction — supports Anthropic and OpenRouter."""

from typing import AsyncIterator, Protocol

from config import DocRagConfig


class LLMClient(Protocol):
    def stream(self, system: str, user: str) -> AsyncIterator[str]:
        """Stream response tokens."""
        ...


def create_llm_client(config: DocRagConfig) -> LLMClient:
    if config.llm_provider == "openrouter":
        from llm.openrouter_client import OpenRouterClient
        return OpenRouterClient(model=config.default_model)
    from llm.anthropic_client import AnthropicClient
    return AnthropicClient(model=config.default_model)
