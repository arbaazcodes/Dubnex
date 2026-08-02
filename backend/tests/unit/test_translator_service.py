"""Unit tests for translation helpers (model generate mocked)."""

from unittest.mock import MagicMock

import pytest


@pytest.fixture
def translator(monkeypatch):
    import services.translator_service as ts

    # Avoid real GPU/CPU generate in unit tests
    monkeypatch.setattr(
        ts,
        "_translate_batch",
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

    mock_generate = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(ts.model, "generate", mock_generate)
    monkeypatch.setattr(ts.tokenizer, "batch_decode", MagicMock(return_value=["ok"]))
    monkeypatch.setattr(ts.tokenizer, "convert_tokens_to_ids", MagicMock(return_value=1))

    out = ts._translate_batch(["", "  "], "en", "hi")
    assert out == ["", ""]
    mock_generate.assert_not_called()
