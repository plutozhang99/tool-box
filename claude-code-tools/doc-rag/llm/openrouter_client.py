"""OpenRouter API client (OpenAI-compatible) with streaming."""

import os
from collections.abc import AsyncIterator

from openai import AsyncOpenAI


class OpenRouterClient:
    def __init__(self, model: str = "anthropic/claude-sonnet-4"):
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY env var is required")
        self._client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self._model = model

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        response = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=4096,
            stream=True,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
