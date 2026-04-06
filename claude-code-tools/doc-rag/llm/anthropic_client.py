"""Anthropic Claude API client with async streaming."""

import os
from collections.abc import AsyncIterator

import anthropic


class AnthropicClient:
    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY env var is required")
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
