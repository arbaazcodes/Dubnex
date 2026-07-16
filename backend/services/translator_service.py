from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_NAME = "facebook/nllb-200-distilled-600M"

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)


LANGUAGE_CODES = {
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
    "malayalam": "mal_Mlym"
}


def translate_text(text, source_language, target_language):

    source = LANGUAGE_CODES[source_language.lower()]
    target = LANGUAGE_CODES[target_language.lower()]

    tokenizer.src_lang = source

    encoded = tokenizer(text, return_tensors="pt")

    generated_tokens = model.generate(
        **encoded,
        forced_bos_token_id=tokenizer.convert_tokens_to_ids(target),
        max_length=1024
    )

    translated = tokenizer.batch_decode(
        generated_tokens,
        skip_special_tokens=True
    )[0]

    return translated