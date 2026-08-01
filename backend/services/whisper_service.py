from faster_whisper import WhisperModel
from config import WHISPER_MODEL, DEVICE, COMPUTE_TYPE

# Load Whisper model once when the application starts
model = WhisperModel(
    WHISPER_MODEL,
    device=DEVICE,
    compute_type=COMPUTE_TYPE
)


def detect_language(audio_path):
    """
    Detect the spoken language from an audio file.
    """

    _, info = model.transcribe(audio_path)

    return {
        "language": info.language,
        "confidence": round(float(info.language_probability), 4)
    }


def transcribe_audio(audio_path):
    """
    Transcribe audio and return timestamped segments.
    """

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True
    )

    transcript = []
    full_text = ""

    for index, segment in enumerate(segments):

        text = segment.text.strip()

        transcript.append({
            "id": index,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "duration": round(segment.end - segment.start, 2),
            "text": text
        })

        full_text += text + " "

    return {
        "language": info.language,
        "confidence": round(float(info.language_probability), 4),
        "full_text": full_text.strip(),
        "segments": transcript
    }