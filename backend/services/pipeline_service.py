import os

from services.ffmpeg_service import extract_audio
from services.whisper_service import transcribe_audio
from services.translator_service import (
    translate_text,
    translate_segments,
)
from services.tts_service import (
    generate_speech,
    generate_segment_speech,
)
from services.audio_stitcher_service import merge_audio_segments
from services.video_renderer_service import replace_audio


async def process_video(
    video_path,
    target_language,
    voice="george",
):

    # Step 1 - Extract audio
    audio_path = extract_audio(video_path)

    # Step 2 - Speech to text
    result = transcribe_audio(audio_path)

    # Step 3 - Translate complete text
    translated_text = translate_text(
        result["full_text"],
        result["language"],
        target_language,
    )

    # Step 4 - Translate every segment
    translated_segments = translate_segments(
        result["segments"],
        result["language"],
        target_language,
    )

    # Step 5 - Generate segment audio
    audio_segments = await generate_segment_speech(
        translated_segments,
        language=target_language,
        voice=voice,
    )

    # Step 6 - Merge all generated audio
    final_audio = merge_audio_segments(audio_segments)

    # Step 7 - Replace original video audio
    final_video = replace_audio(
        video_path,
        final_audio,
    )

    # Cleanup
    if os.path.exists(audio_path):
        os.remove(audio_path)

    return {
        "success": True,
        "language": result["language"],
        "original_text": result["full_text"],
        "translated_text": translated_text,
        "output_video": final_video,
    }