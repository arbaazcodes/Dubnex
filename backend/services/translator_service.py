from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

MODEL_NAME = "facebook/nllb-200-distilled-600M"

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


def translate_text(text: str, source_language: str, target_language: str):

    source_language = source_language.lower().strip()
    target_language = target_language.lower().strip()

    if source_language not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported source language: {source_language}")

    if target_language not in LANGUAGE_CODES:
        raise ValueError(f"Unsupported target language: {target_language}")

    tokenizer.src_lang = LANGUAGE_CODES[source_language]

    inputs = tokenizer(text, return_tensors="pt")

    if DEVICE == "cuda":
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    generated_tokens = model.generate(
        **inputs,
        forced_bos_token_id=tokenizer.convert_tokens_to_ids(
    LANGUAGE_CODES[target_language]
),
        max_new_tokens=256,
    )

    translated = tokenizer.batch_decode(
        generated_tokens,
        skip_special_tokens=True,
    )[0]

    print("=" * 50)
    print("Input :", text)
    print("Output:", translated)
    print("=" * 50)

    return translated

def translate_segments(
    segments: list,
    source_language: str,
    target_language: str
):
    """
    Translate Whisper segments one by one while preserving timing.
    """

    translated_segments = []

    for segment in segments:

        translated_text = translate_text(
            text=segment["text"],
            source_language=source_language,
            target_language=target_language
        )

        translated_segments.append({
            "id": segment["id"],
            "start": segment["start"],
            "end": segment["end"],
            "duration": segment["duration"],
            "original": segment["text"],
            "translated": translated_text
        })

    return translated_segments