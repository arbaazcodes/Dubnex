"""
AI provider resolution for chat / analysis / improvement features.

Providers:
  - openai — OpenAI chat/analysis (when OPENAI_API_KEY is set / AI_PROVIDER=openai)
  - gemini — Google Gemini chat/analysis (when GEMINI_API_KEY is set / AI_PROVIDER=gemini)
  - auto   — OpenAI if configured, else Gemini

Translation keeps its own provider facade (translator_service) — this module only
governs the conversational / analytical AI features.
"""

from __future__ import annotations

from config import AI_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY


def resolve_ai_provider() -> str:
    """Return the active chat/analysis provider: 'openai' | 'gemini'."""
    mode = (AI_PROVIDER or "auto").strip().lower()
    if mode == "openai":
        return "openai"
    if mode == "gemini":
        return "gemini"
    # auto
    if OPENAI_API_KEY:
        return "openai"
    return "gemini"
