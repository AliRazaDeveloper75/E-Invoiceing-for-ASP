"""
Abstract AI Provider Interface.

All AI providers (Anthropic Claude, OpenAI, local) implement this interface.
This gives us full vendor-agnostic AI calls with drop-in provider switching.

Usage:
  provider = get_ai_provider()
  reply    = provider.chat(messages, system=SYSTEM_PROMPT)
  result   = provider.vision(image_bytes, prompt, mime_type='image/png')
  embed    = provider.embed(text)
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


# ─── Data Transfer Objects ─────────────────────────────────────────────────────

@dataclass
class AIMessage:
    role: str        # 'user' | 'assistant' | 'system'
    content: str


@dataclass
class AIChatResponse:
    content: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    provider: str = ''
    raw: dict = field(default_factory=dict)

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass
class AIVisionResponse:
    content: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    provider: str = ''


@dataclass
class AIEmbedResponse:
    embedding: list[float]
    model: str
    provider: str = ''
    dimensions: int = 0

    def __post_init__(self):
        self.dimensions = len(self.embedding)


# ─── Abstract Provider ─────────────────────────────────────────────────────────

class AIProvider(abc.ABC):
    """
    Abstract base class for all AI providers.
    Implement all three methods for full capability support.
    """

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """Provider identifier (e.g. 'anthropic', 'openai')."""

    @property
    @abc.abstractmethod
    def supports_vision(self) -> bool:
        """True if this provider can process images/PDFs."""

    @property
    @abc.abstractmethod
    def supports_embeddings(self) -> bool:
        """True if this provider can generate embeddings."""

    @abc.abstractmethod
    def chat(
        self,
        messages: list[AIMessage],
        system: str = '',
        max_tokens: int = 2048,
        temperature: float = 0.3,
        **kwargs: Any,
    ) -> AIChatResponse:
        """
        Send a conversation to the model and return a response.

        Args:
            messages:    List of AIMessage objects (role + content).
            system:      Optional system prompt prepended to the conversation.
            max_tokens:  Maximum tokens in the response.
            temperature: Sampling temperature (0.0 = deterministic).
        """

    @abc.abstractmethod
    def vision(
        self,
        image_data: bytes,
        prompt: str,
        mime_type: str = 'image/png',
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> AIVisionResponse:
        """
        Process an image or PDF and return text output.

        Args:
            image_data: Raw bytes of the image or PDF.
            prompt:     Instruction for the model (e.g. 'Extract invoice data').
            mime_type:  MIME type: 'image/png', 'image/jpeg', 'application/pdf'.
            max_tokens: Maximum tokens in the response.
        """

    def embed(self, text: str, **kwargs: Any) -> AIEmbedResponse:
        """
        Generate a text embedding vector (optional capability).
        Default raises NotImplementedError — override in providers that support it.
        """
        raise NotImplementedError(f'{self.name} provider does not support embeddings.')

    def is_available(self) -> bool:
        """
        Health-check: returns True if the provider is configured and reachable.
        Subclasses can override for a real ping; default checks for API key.
        """
        return True
