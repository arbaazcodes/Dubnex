"""Unit tests for Whisper service (stubbed model in conftest)."""

from services import whisper_service


def test_whisper_model_present():
    assert whisper_service.model is not None


def test_transcribe_audio_returns_segments(tmp_path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"RIFF....")
    result = whisper_service.transcribe_audio(str(audio))
    assert result["language"] == "en"
    assert result["full_text"]
    assert isinstance(result["segments"], list)
    assert result["segments"][0]["text"]


def test_detect_language(tmp_path):
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"RIFF....")
    info = whisper_service.detect_language(str(audio))
    assert "language" in info
    assert "confidence" in info
