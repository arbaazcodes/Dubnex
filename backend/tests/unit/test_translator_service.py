"""Unit tests for translation helpers (model generate mocked)."""

from unittest.mock import MagicMock

import pytest


@pytest.fixture
def translator(monkeypatch):
    import services.translator_service as ts

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "nllb")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "")
    # Avoid real GPU/CPU generate in unit tests
    monkeypatch.setattr(
        ts,
        "_translate_batch_nllb",
        lambda texts, src, tgt: [f"[{tgt}]{t}" for t in texts],
    )
    return ts


def test_translate_text(translator):
    out = translator.translate_text("hello", "en", "hi")
    assert out == "[hi]hello"


def test_translate_segments_preserves_timing(translator):
    segs = [
        {"id": 0, "start": 0.0, "end": 1.2, "duration": 1.2, "text": "one"},
        {"id": 1, "start": 1.2, "end": 2.0, "duration": 0.8, "text": "two"},
    ]
    out = translator.translate_segments(segs, "en", "hi")
    assert len(out) == 2
    assert out[0]["start"] == 0.0 and out[0]["translated"] == "[hi]one"
    assert out[1]["id"] == 1 and out[1]["original"] == "two"


def test_unsupported_language(translator):
    with pytest.raises(ValueError, match="Unsupported source"):
        translator.translate_text("x", "xx", "hi")
    with pytest.raises(ValueError, match="Unsupported target"):
        translator.translate_text("x", "en", "zz")


def test_batch_empty_strings(monkeypatch):
    import services.translator_service as ts

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "nllb")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "")
    mock_model = MagicMock()
    mock_tokenizer = MagicMock()
    mock_tokenizer.convert_tokens_to_ids = MagicMock(return_value=1)
    mock_tokenizer.batch_decode = MagicMock(return_value=["ok"])
    monkeypatch.setattr(ts, "_model", mock_model)
    monkeypatch.setattr(ts, "_tokenizer", mock_tokenizer)
    monkeypatch.setattr(ts, "_device", "cpu")

    out = ts._translate_batch(["", "  "], "en", "hi")
    assert out == ["", ""]
    mock_model.generate.assert_not_called()


def test_auto_falls_back_to_nllb_on_gemini_error(monkeypatch):
    """auto mode: when Gemini fails (quota/429), switch to NLLB and remember."""
    import services.translator_service as ts
    import services.gemini_service as gs

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "auto")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "not-empty")
    monkeypatch.setattr(ts, "_gemini_degraded", False)
    monkeypatch.setattr(ts, "_translate_batch_nllb", lambda texts, src, tgt: [f"[nllb]{t}" for t in texts])

    original = gs.translate_text
    def boom(*a, **k):
        raise gs.GeminiError("quota exceeded", retryable=True)
    monkeypatch.setattr(gs, "translate_text", boom)
    try:
        out = ts.translate_text("hello", "en", "hi")
    finally:
        monkeypatch.setattr(gs, "translate_text", original)

    assert out == "[nllb]hello"
    assert ts._gemini_degraded is True
    # Subsequent calls go straight to NLLB without attempting Gemini again
    out2 = ts.translate_text("world", "en", "es")
    assert out2 == "[nllb]world"


def test_explicit_gemini_does_not_fallback(monkeypatch):
    """TRANSLATION_PROVIDER=gemini must propagate Gemini errors (no NLLB fallback)."""
    import services.translator_service as ts
    import services.gemini_service as gs

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "gemini")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "not-empty")
    monkeypatch.setattr(ts, "_gemini_degraded", False)
    monkeypatch.setattr(ts, "_translate_batch_nllb", lambda texts, src, tgt: ["WRONG"])

    original = gs.translate_text
    def boom(*a, **k):
        raise gs.GeminiError("quota exceeded", retryable=True)
    monkeypatch.setattr(gs, "translate_text", boom)
    try:
        with pytest.raises(gs.GeminiError):
            ts.translate_text("hello", "en", "hi")
    finally:
        monkeypatch.setattr(gs, "translate_text", original)
