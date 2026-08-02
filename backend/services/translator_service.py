from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

from config import TRANSLATION_MODEL, TRANSLATION_BATCH_SIZE

MODEL_NAME = TRANSLATION_MODEL

print("Loading Translation Model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)

if torch.cuda.is_available():
    model = model.to("cuda")
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

print(f"Translation Model Loaded ({DEVICE})")


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


def _normalize_langs(source_language: str, target_language: str) -> tuple[str, str]:
    source_language = source_language.lower().strip()
    target_language = target_language.lower().strip()
    if source_language not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported source language: {source_language}")
    if target_language not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported target language: {target_language}")
    return source_language, target_language


def translate_text(text: str, source_language: str, target_language: str):
    source_language, target_language = _normalize_langs(source_language, target_language)
    return _translate_batch([text], source_language, target_language)[0]


def _translate_batch(texts: list[str], source_language: str, target_language: str) -> list[str]:
    """
    Batched NLLB generate. Same forced BOS / max_new_tokens as single-item path.
    Empty strings short-circuit to empty outputs (matches prior per-segment behavior).
    """
    if not texts:
        return []

    tokenizer.src_lang = LANGUAGE_CODES[source_language]
    bos_id = tokenizer.convert_tokens_to_ids(LANGUAGE_CODES[target_language])

    # Preserve empties without burning GPU
    outputs: list[str | None] = [None] * len(texts)
    nonempty_idx = [i for i, t in enumerate(texts) if (t or "").strip()]
    for i, t in enumerate(texts):
        if not (t or "").strip():
            outputs[i] = ""

    if not nonempty_idx:
        return ["" for _ in texts]

    batch_inputs = [texts[i] for i in nonempty_idx]
    inputs = tokenizer(
        batch_inputs,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )
    if DEVICE == "cuda":
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    with torch.inference_mode():
        generated_tokens = model.generate(
            **inputs,
            forced_bos_token_id=bos_id,
            max_new_tokens=256,
        )

    decoded = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
    for idx, text in zip(nonempty_idx, decoded):
        outputs[idx] = text
    return [o if o is not None else "" for o in outputs]


def translate_segments(
    segments: list,
    source_language: str,
    target_language: str
):
    """
    Translate Whisper segments while preserving timing.
    Uses configurable batching (TRANSLATION_BATCH_SIZE) for throughput.
    """
    source_language, target_language = _normalize_langs(source_language, target_language)
    if not segments:
        return []

    batch_size = TRANSLATION_BATCH_SIZE
    translated_segments = []

    for start in range(0, len(segments), batch_size):
        chunk = segments[start : start + batch_size]
        texts = [seg.get("text") or "" for seg in chunk]
        translated_texts = _translate_batch(texts, source_language, target_language)
        for segment, translated_text in zip(chunk, translated_texts):
            translated_segments.append({
                "id": segment["id"],
                "start": segment["start"],
                "end": segment["end"],
                "duration": segment["duration"],
                "original": segment["text"],
                "translated": translated_text,
            })

    return translated_segments
