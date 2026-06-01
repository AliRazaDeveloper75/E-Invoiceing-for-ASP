"""
Anthropic Claude AI Provider.

Implements AIProvider using the Anthropic Python SDK.
Supports: chat, vision (images + PDFs), embeddings (via voyage-3).

Environment:
  ANTHROPIC_API_KEY     — required
  AI_CLAUDE_MODEL       — default: claude-sonnet-4-6
  AI_CLAUDE_VISION_MODEL— default: claude-sonnet-4-6 (same model handles vision)
"""
from __future__ import annotations

import base64
import logging
from typing import Any

from django.conf import settings

from ..base import AIProvider, AIMessage, AIChatResponse, AIVisionResponse, AIEmbedResponse

logger = logging.getLogger(__name__)


class AnthropicProvider(AIProvider):
    """Claude provider via the official Anthropic Python SDK."""

    DEFAULT_MODEL        = 'claude-sonnet-4-6'
    DEFAULT_VISION_MODEL = 'claude-sonnet-4-6'

    def __init__(self) -> None:
        self._client = None

    @property
    def name(self) -> str:
        return 'anthropic'

    @property
    def supports_vision(self) -> bool:
        return True

    @property
    def supports_embeddings(self) -> bool:
        return False   # Use voyage-3 separately if needed

    def _get_client(self):
        if self._client is None:
            import anthropic
            api_key = getattr(settings, 'ANTHROPIC_API_KEY', '') or ''
            if not api_key:
                raise RuntimeError('ANTHROPIC_API_KEY is not set.')
            self._client = anthropic.Anthropic(api_key=api_key)
        return self._client

    def is_available(self) -> bool:
        return bool(getattr(settings, 'ANTHROPIC_API_KEY', ''))

    def chat(
        self,
        messages: list[AIMessage],
        system: str = '',
        max_tokens: int = 2048,
        temperature: float = 0.3,
        **kwargs: Any,
    ) -> AIChatResponse:
        client = self._get_client()
        model  = getattr(settings, 'AI_CLAUDE_MODEL', self.DEFAULT_MODEL)

        api_messages = [
            {'role': m.role, 'content': m.content}
            for m in messages
            if m.role in ('user', 'assistant')
        ]

        params: dict[str, Any] = {
            'model':      model,
            'max_tokens': max_tokens,
            'messages':   api_messages,
        }
        if system:
            params['system'] = system
        if temperature != 1.0:
            params['temperature'] = temperature

        response = client.messages.create(**params)

        return AIChatResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            provider=self.name,
            raw={'id': response.id, 'stop_reason': response.stop_reason},
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
        model  = getattr(settings, 'AI_CLAUDE_VISION_MODEL', self.DEFAULT_VISION_MODEL)

        b64 = base64.standard_b64encode(image_data).decode()

        # Claude supports PDF natively as a document source
        if mime_type == 'application/pdf':
            content = [
                {
                    'type': 'document',
                    'source': {
                        'type': 'base64',
                        'media_type': 'application/pdf',
                        'data': b64,
                    },
                },
                {'type': 'text', 'text': prompt},
            ]
        else:
            content = [
                {
                    'type': 'image',
                    'source': {
                        'type': 'base64',
                        'media_type': mime_type,
                        'data': b64,
                    },
                },
                {'type': 'text', 'text': prompt},
            ]

        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{'role': 'user', 'content': content}],
        )

        return AIVisionResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            provider=self.name,
        )
