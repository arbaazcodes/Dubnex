"""Voice-ID resolution tests against the REAL elevenlabs_service module.

conftest stubs `services.elevenlabs_service` for API tests, so here we load the
real module under an alias and stub the network (account voice index + SDK).
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest


@pytest.fixture
def real_el(monkeypatch):
    """Load the real elevenlabs_service module with a fake ElevenLabs SDK and
    an empty account voice index (no network)."""
    # Fake SDK so module import never constructs/validates a real client.
    fake_client_mod = types.ModuleType("elevenlabs.client")

    class _FakeElevenLabs:
        def __init__(self, api_key=None):
            self.api_key = api_key

    fake_client_mod.ElevenLabs = _FakeElevenLabs
    monkeypatch.setitem(sys.modules, "elevenlabs.client", fake_client_mod)

    path = Path(__file__).resolve().parents[2] / "services" / "elevenlabs_service.py"
    spec = importlib.util.spec_from_file_location("real_elevenlabs_service", path)
    mod = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, spec.name, mod)
    spec.loader.exec_module(mod)

    # Empty account voice index: no network calls during resolution.
    monkeypatch.setattr(
        mod,
        "_account_voice_index",
        lambda: ({}, {}),
    )
    return mod


@pytest.mark.parametrize("voice", ["bunty", "jessica", "bella"])
def test_voice_map_ids_are_real_not_placeholders(real_el, voice):
    """Fix2: the built-in voice keys must resolve to concrete IDs, not YOUR_/PLACEHOLDER_."""
    vid = real_el._resolve_voice_id(voice)
    assert isinstance(vid, str) and len(vid) >= 20, f"{voice} -> {vid!r}"
    assert not vid.startswith(("YOUR_", "PLACEHOLDER_"))


def test_raw_voice_id_passes_through(real_el):
    raw = "a" * 22
    assert real_el._resolve_voice_id(raw) == raw


def test_account_name_fallback_used_when_unmapped(real_el, monkeypatch):
    """A voice name absent from VOICE_MAP resolves via the account's real voices."""
    account_id = "b" * 22
    monkeypatch.setattr(real_el, "_account_voice_index", lambda: ({"charlotte": account_id}, {}))
    assert real_el._resolve_voice_id("charlotte") == account_id


def test_unconfigured_voice_raises_fatal(real_el):
    with pytest.raises(real_el.TtsRequestError) as exc_info:
        real_el._resolve_voice_id("nonexistentvoice")
    assert exc_info.value.kind == real_el.TtsErrorKind.FATAL


def test_placeholder_value_raises_fatal(real_el, monkeypatch):
    monkeypatch.setattr(
        real_el,
        "VOICE_MAP",
        {**real_el.VOICE_MAP, "testvoice": "PLACEHOLDER_API_KEY_GOES_HERE"},
    )
    with pytest.raises(real_el.TtsRequestError) as exc_info:
        real_el._resolve_voice_id("testvoice")
    assert exc_info.value.kind == real_el.TtsErrorKind.FATAL
