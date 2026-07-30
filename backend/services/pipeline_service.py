from services.ffmpeg_service import extract_audio
from services.whisper_service import transcribe_audio
from services.translator_service import translate_text
import os


def process_video(video_path, target_language):

    audio_path = extract_audio(video_path)

    result = transcribe_audio(audio_path)

    translated = translate_text(
        result["text"],
        result["language"],
        target_language
    )

    os.remove(audio_path)

    return {
        "language": result["language"],
        "original_text": result["text"],
        "translated_text": translated,
        "segments": result["segments"]
    }