from faster_whisper import WhisperModel

model = WhisperModel(
    "large-v3",
    device="cpu",
    compute_type="int8"
),

def detect_language(audio_path):

    segments, info = model.transcribe(audio_path)

    return {
        "language": info.language,
        "confidence": float(info.language_probability)
    }
def transcribe_audio(audio_path):

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True
    )

    transcript = []
    full_text = ""

    for segment in segments:

        transcript.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip()
        })

        full_text += segment.text + " "

    return {
        "language": info.language,
        "confidence": float(info.language_probability),
        "text": full_text.strip(),
        "segments": transcript
    }