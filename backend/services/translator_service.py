"""
Translation facade.

Providers:
  - gemini  — Google Gemini (when GEMINI_API_KEY is set / TRANSLATION_PROVIDER=gemini)
  - nllb    — local Hugging Face NLLB (lazy-loaded)
  - auto    — Gemini if configured, else NLLB
"""

from __future__ import annotations

from config import (
    TRANSLATION_MODEL,
    TRANSLATION_BATCH_SIZE,
    TRANSLATION_PROVIDER,
    GEMINI_API_KEY,
)
from services.logging_service import get_logger

logger = get_logger("screen_ai.translator")

MODEL_NAME = TRANSLATION_MODEL

LANGUAGE_CODES = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "ur": "urd_Arab",
    "ar": "arb_Arab",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "es": "spa_Latn",
    "it": "ita_Latn",
    "pt": "por_Latn",
    "ru": "rus_Cyrl",
    "ja": "jpn_Jpan",
    "ko": "kor_Hang",
    "zh": "zho_Hans",
    "tr": "tur_Latn",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "pa": "pan_Guru",
    "gu": "guj_Gujr",
    "ml": "mal_Mlym",
    "english": "eng_Latn",
    "hindi": "hin_Deva",
    "urdu": "urd_Arab",
    "arabic": "arb_Arab",
    "french": "fra_Latn",
    "german": "deu_Latn",
    "spanish": "spa_Latn",
    "italian": "ita_Latn",
    "portuguese": "por_Latn",
    "russian": "rus_Cyrl",
    "japanese": "jpn_Jpan",
    "korean": "kor_Hang",
    "chinese": "zho_Hans",
    "turkish": "tur_Latn",
    "tamil": "tam_Taml",
    "telugu": "tel_Telu",
    "punjabi": "pan_Guru",
    "gujarati": "guj_Gujr",
    "malayalam": "mal_Mlym",
}

_tokenizer = None
_model = None
_device = "cpu"
_nllb_load_attempted = False


def resolve_translation_provider() -> str:
    mode = (TRANSLATION_PROVIDER or "auto").strip().lower()
    if mode == "gemini":
        return "gemini"
    if mode == "nllb":
        return "nllb"
    # auto
    return "gemini" if GEMINI_API_KEY else "nllb"


def _normalize_langs(source_language: str, target_language: str) -> tuple[str, str]:
    source_language = source_language.lower().strip()
    target_language = target_language.lower().strip()
    if source_language not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported source language: {source_language}")
    if target_language not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported target language: {target_language}")
    return source_language, target_language


def _ensure_nllb():
    global _tokenizer, _model, _device, _nllb_load_attempted
    if _model is not None:
        return
    if _nllb_load_attempted and _model is None:
        raise RuntimeError("NLLB translation model failed to load earlier.")
    _nllb_load_attempted = True
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

    logger.info(
        "Loading NLLB translation model",
        extra={"event": "nllb_load", "model": MODEL_NAME},
    )
    print("Loading Translation Model...")
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    _model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
    if torch.cuda.is_available():
        _model = _model.to("cuda")
        _device = "cuda"
    else:
        _device = "cpu"
    print(f"Translation Model Loaded ({_device})")


def _translate_batch_nllb(
    texts: list[str], source_language: str, target_language: str
) -> list[str]:
    _ensure_nllb()
    assert _tokenizer is not None and _model is not None
    import torch

    if not texts:
        return []

    _tokenizer.src_lang = LANGUAGE_CODES[source_language]
    bos_id = _tokenizer.convert_tokens_to_ids(LANGUAGE_CODES[target_language])

    outputs: list[str | None] = [None] * len(texts)
    nonempty_idx = [i for i, t in enumerate(texts) if (t or "").strip()]
    for i, t in enumerate(texts):
        if not (t or "").strip():
            outputs[i] = ""

    if not nonempty_idx:
        return ["" for _ in texts]

    batch_inputs = [texts[i] for i in nonempty_idx]
    inputs = _tokenizer(
        batch_inputs,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )
    if _device == "cuda":
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    with torch.inference_mode():
        generated_tokens = _model.generate(
            **inputs,
            forced_bos_token_id=bos_id,
            max_new_tokens=256,
        )

    decoded = _tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
    for idx, text in zip(nonempty_idx, decoded):
        outputs[idx] = text
    return [o if o is not None else "" for o in outputs]


def _translate_batch(
    texts: list[str], source_language: str, target_language: str
) -> list[str]:
    provider = resolve_translation_provider()
    if provider == "gemini":
        from services import gemini_service

        if not gemini_service.is_configured():
            raise RuntimeError(
                "TRANSLATION_PROVIDER=gemini but GEMINI_API_KEY is not set."
            )
        return [
            gemini_service.translate_text(t, source_language, target_language)
            if (t or "").strip()
            else ""
            for t in texts
        ]
    return _translate_batch_nllb(texts, source_language, target_language)


def translate_text(text: str, source_language: str, target_language: str):
    source_language, target_language = _normalize_langs(source_language, target_language)
    provider = resolve_translation_provider()
    if provider == "gemini":
        from services import gemini_service

        return gemini_service.translate_text(text, source_language, target_language)
    return _translate_batch([text], source_language, target_language)[0]


def translate_segments(
    segments: list,
    source_language: str,
    target_language: str,
):
    """
    Translate Whisper segments while preserving timing.
    Gemini path returns structured JSON translations; NLLB uses batched local inference.
    """
    source_language, target_language = _normalize_langs(source_language, target_language)
    if not segments:
        return []

    provider = resolve_translation_provider()
    if provider == "gemini":
        from services import gemini_service

        # Process in batches to keep prompts bounded
        batch_size = TRANSLATION_BATCH_SIZE
        out: list[dict] = []
        for start in range(0, len(segments), batch_size):
            chunk = segments[start : start + batch_size]
            out.extend(
                gemini_service.translate_segments(
                    chunk, source_language, target_language
                )
            )
        return out

    batch_size = TRANSLATION_BATCH_SIZE
    translated_segments = []
    for start in range(0, len(segments), batch_size):
        chunk = segments[start : start + batch_size]
        texts = [seg.get("text") or "" for seg in chunk]
        translated_texts = _translate_batch(texts, source_language, target_language)
        for segment, translated_text in zip(chunk, translated_texts):
            translated_segments.append(
                {
                    "id": segment["id"],
                    "start": segment["start"],
                    "end": segment["end"],
                    "duration": segment["duration"],
                    "original": segment["text"],
                    "translated": translated_text,
                }
            )
    return translated_segments
