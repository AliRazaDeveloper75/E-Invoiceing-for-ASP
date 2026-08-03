"""
Thin wrapper around the OpenAI client.

Keeps all AI-provider-specific code in ONE place — orchestrator.py never
talks to the OpenAI SDK directly, only to this module. Switching providers
later means changing only this file.
"""
from django.conf import settings
from openai import OpenAI

_client = None


def get_client() -> OpenAI:
    """Lazily initialize and cache a single OpenAI client instance."""
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def get_completion(*, messages: list[dict], tools: list[dict] | None = None) -> dict:
    """
    Calls the chat completion endpoint.

    Args:
        messages: list of {"role": ..., "content": ...} dicts (OpenAI format)
        tools: optional list of tool schemas (added in a later step)

    Returns:
        The raw OpenAI response's first choice message, as a dict-like object.
    """
    client = get_client()
    kwargs = {
        "model": settings.AI_OPENAI_CHAT_MODEL,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools

    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message
