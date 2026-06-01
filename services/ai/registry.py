"""
AI Provider Registry — factory with fallback chain.

Priority order (configured via AI_PROVIDER in settings):
  1. 'anthropic'  → AnthropicProvider  (Claude Sonnet 4.6 — best for structured extraction)
  2. 'openai'     → OpenAIProvider     (GPT-4o — strong fallback)
  3. auto         → picks first available based on which API key is set

Usage:
  provider = get_ai_provider()
  response = provider.chat(messages, system=PROMPT)

  # For a specific provider:
  provider = get_ai_provider('openai')
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import TYPE_CHECKING

from django.conf import settings

from .base import AIProvider

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_PROVIDER_MAP: dict[str, str] = {
    'anthropic': 'services.ai.providers.anthropic_provider.AnthropicProvider',
    'openai':    'services.ai.providers.openai_provider.OpenAIProvider',
}

_PRIORITY = ['anthropic', 'openai']


class AIRegistry:
    """Thread-safe singleton registry that caches provider instances."""

    _instances: dict[str, AIProvider] = {}

    @classmethod
    def get(cls, provider_name: str | None = None) -> AIProvider:
        name = provider_name or _resolve_provider_name()

        if name not in cls._instances:
            cls._instances[name] = _instantiate(name)

        return cls._instances[name]

    @classmethod
    def clear_cache(cls) -> None:
        """Force re-instantiation on next get() — useful in tests."""
        cls._instances.clear()


def _resolve_provider_name() -> str:
    """Return the configured provider name, auto-detecting if set to 'auto'."""
    configured = getattr(settings, 'AI_PROVIDER', 'auto')

    if configured and configured != 'auto':
        return configured

    # Auto-detect: pick first provider with a key set
    for name in _PRIORITY:
        key_attr = f'{name.upper()}_API_KEY'
        if getattr(settings, key_attr, ''):
            logger.debug('AI provider auto-detected: %s', name)
            return name

    logger.warning('No AI provider API key found — AI features will be degraded.')
    return _PRIORITY[0]


def _instantiate(name: str) -> AIProvider:
    """Import and instantiate the provider class by dotted path."""
    dotted = _PROVIDER_MAP.get(name)
    if not dotted:
        raise ValueError(f'Unknown AI provider: "{name}". Choices: {list(_PROVIDER_MAP)}')

    module_path, class_name = dotted.rsplit('.', 1)
    import importlib
    module = importlib.import_module(module_path)
    klass  = getattr(module, class_name)
    provider: AIProvider = klass()
    logger.info('AI provider instantiated: %s (%s)', name, class_name)
    return provider


def get_ai_provider(name: str | None = None) -> AIProvider:
    """
    Primary factory function.

    Args:
        name: Optional provider name ('anthropic' / 'openai').
              If None, uses AI_PROVIDER setting or auto-detection.

    Returns:
        Configured AIProvider instance (cached per process).
    """
    return AIRegistry.get(name)


def get_vision_provider() -> AIProvider:
    """
    Return a provider guaranteed to support vision.
    Falls back to the first vision-capable provider if the default doesn't support it.
    """
    primary = get_ai_provider()
    if primary.supports_vision:
        return primary

    for name in _PRIORITY:
        provider = AIRegistry.get(name)
        if provider.supports_vision and provider.is_available():
            return provider

    raise RuntimeError('No vision-capable AI provider is available and configured.')


def get_embed_provider() -> AIProvider:
    """
    Return a provider guaranteed to support embeddings.
    """
    for name in _PRIORITY:
        provider = AIRegistry.get(name)
        if provider.supports_embeddings and provider.is_available():
            return provider

    raise RuntimeError('No embedding-capable AI provider is available and configured.')
