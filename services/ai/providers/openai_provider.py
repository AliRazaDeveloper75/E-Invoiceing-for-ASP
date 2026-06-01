"""
OpenAI Provider.

Implements AIProvider using the OpenAI Python SDK.
Supports: chat, vision (gpt-4o), embeddings (text-embedding-3-small).

Environment:
  OPENAI_API_KEY         — required
  AI_OPENAI_MODEL        — default: gpt-4o-mini
  AI_OPENAI_VISION_MODEL — default: gpt-4o
  AI_OPENAI_EMBED_MODEL  — default: text-embedding-3-small
"""
from __future__ import annotations

import base64
import logging
from typing import Any

from django.conf import settings

from ..base import AIProvider, AIMessage, AIChatResponse, AIVisionResponse, AIEmbedResponse

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    """OpenAI provider via the official OpenAI Python SDK."""

    DEFAULT_MODEL        = 'gpt-4o-mini'
    DEFAULT_VISION_MODEL = 'gpt-4o'
    DEFAULT_EMBED_MODEL  = 'text-embedding-3-small'

    def __init__(self) -> None:
        self._client = None

    @property
    def name(self) -> str:
        return 'openai'

    @property
    def supports_vision(self) -> bool:
        return True

    @property
    def supports_embeddings(self) -> bool:
        return True

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            api_key = getattr(settings, 'OPENAI_API_KEY', '') or ''
            if not api_key:
                raise RuntimeError('OPENAI_API_KEY is not set.')
            self._client = OpenAI(api_key=api_key)
        return self._client

    def is_available(self) -> bool:
        return bool(getattr(settings, 'OPENAI_API_KEY', ''))

    def chat(
        self,
        messages: list[AIMessage],
        system: str = '',
        max_tokens: int = 2048,
        temperature: float = 0.3,
        **kwargs: Any,
    ) -> AIChatResponse:
        client = self._get_client()
        model  = getattr(settings, 'AI_OPENAI_MODEL', self.DEFAULT_MODEL)

        api_messages = []
        if system:
            api_messages.append({'role': 'system', 'content': system})
        for m in messages:
            if m.role in ('user', 'assistant'):
                api_messages.append({'role': m.role, 'content': m.content})

        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=api_messages,
        )

        choice = response.choices[0]
        return AIChatResponse(
            content=choice.message.content or '',
            model=response.model,
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            provider=self.name,
        )

    def vision(
        self,
        image_data: bytes,
        prompt: str,
        mime_type: str = 'image/png',
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AIVisionResponse:
        client = self._get_client()
        model  = getattr(settings, 'AI_OPENAI_VISION_MODEL', self.DEFAULT_VISION_MODEL)

        b64 = base64.standard_b64encode(image_data).decode()

        if mime_type == 'application/pdf':
            # GPT-4o doesn't natively support PDF; send first-page image instead
            # The OCR service handles PDF→image conversion before calling vision
            mime_type = 'image/jpeg'

        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{
                'role': 'user',
                'content': [
                    {
                        'type':      'image_url',
                        'image_url': {'url': f'data:{mime_type};base64,{b64}'},
                    },
                    {'type': 'text', 'text': prompt},
                ],
            }],
        )

        choice = response.choices[0]
        return AIVisionResponse(
            content=choice.message.content or '',
            model=response.model,
            input_tokens=response.usage.prompt_tokens if response.usage else 0,
            output_tokens=response.usage.completion_tokens if response.usage else 0,
            provider=self.name,
        )

    def embed(self, text: str, **kwargs: Any) -> AIEmbedResponse:
        client = self._get_client()
        model  = getattr(settings, 'AI_OPENAI_EMBED_MODEL', self.DEFAULT_EMBED_MODEL)

        response = client.embeddings.create(input=text, model=model)
        vector   = response.data[0].embedding
        return AIEmbedResponse(embedding=vector, model=model, provider=self.name)
