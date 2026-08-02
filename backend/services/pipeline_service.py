import os
import shutil
import tempfile

from config import PERF_PROFILE, TEMP_DIR
from services.ffmpeg_service import extract_audio
from services.whisper_service import transcribe_audio
from services.translator_service import (
    translate_text,
    translate_segments,
)
from services.tts_service import (
    generate_segment_speech,
)
from services.audio_stitcher_service import merge_audio_segments
from services.video_renderer_service import replace_audio
from services.perf_service import stage_timer


async def process_video(
    video_path,
    target_language,
    voice="george",
    on_progress=None,
):
    def report(stage, message=""):
        if on_progress:
            on_progress(stage, message or stage)

    profile: dict = {}
    tts_dir = None
    audio_path = None

    # Step 1 - Extract audio
    report("Audio Extraction", "Extracting audio with FFmpeg")
    with stage_timer(profile, "ffmpeg"):
        audio_path = extract_audio(video_path)

    # Step 2 - Speech to text
    report("Whisper", "Transcribing speech with Faster-Whisper")
    with stage_timer(profile, "whisper"):
        result = transcribe_audio(audio_path)

    # Step 3 - Translate complete text
    report("Translation", "Translating transcript with NLLB")
    with stage_timer(profile, "translation"):
        translated_text = translate_text(
            result["full_text"],
            result["language"],
            target_language,
        )

        # Step 4 - Translate every segment (batched internally)
        translated_segments = translate_segments(
            result["segments"],
            result["language"],
            target_language,
        )

    # Step 5 - Generate segment audio (controlled concurrency)
    report("TTS", f"Generating speech with ElevenLabs (voice={voice})")
    tts_dir = tempfile.mkdtemp(prefix="tts_", dir=TEMP_DIR)
    with stage_timer(profile, "tts"):
        audio_segments = await generate_segment_speech(
            translated_segments,
            language=target_language,
            voice=voice,
            work_dir=tts_dir,
        )

    # Step 6 - Merge all generated audio
    report("Audio Merge", "Merging TTS audio segments")
    with stage_timer(profile, "merge"):
        final_audio = merge_audio_segments(audio_segments)

    # Step 7 - Replace original video audio
    report("Video Rendering", "Muxing translated audio into video")
    with stage_timer(profile, "render"):
        final_video = replace_audio(
            video_path,
            final_audio,
        )

    # Cleanup temp artifacts (safe: originals already muxed)
    if audio_path and os.path.exists(audio_path):
        try:
            os.remove(audio_path)
        except OSError:
            pass
    if tts_dir and os.path.isdir(tts_dir):
        shutil.rmtree(tts_dir, ignore_errors=True)
    # Stitched intermediate audio under OUTPUT_DIR may remain needed? replace_audio
    # consumes paths; remove merged audio if distinct from final video.
    if final_audio and os.path.isfile(final_audio) and os.path.abspath(final_audio) != os.path.abspath(final_video):
        try:
            os.remove(final_audio)
        except OSError:
            pass

    report("Completed", "Pipeline completed")

    payload = {
        "success": True,
        "language": result["language"],
        "original_text": result["full_text"],
        "translated_text": translated_text,
        "segments": translated_segments,
        "voice": voice,
        "output_video": final_video,
    }
    if PERF_PROFILE:
        profile["total_ms"] = round(sum(v for v in profile.values() if isinstance(v, (int, float))), 2)
        payload["stage_profile"] = profile
    return payload
