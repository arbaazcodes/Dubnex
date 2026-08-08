import os
import shutil
import tempfile

from config import (
    PERF_PROFILE,
    TEMP_DIR,
    GEMINI_CLEANUP_TRANSCRIPT,
    GEMINI_TRANSLATION_QA,
)
from services.ffmpeg_service import extract_audio
from services.whisper_service import transcribe_audio
from services.translator_service import (
    translate_text,
    translate_segments,
)
from services.tts_service import (
    generate_segment_speech,
    tts_job_dir,
)
from services.audio_stitcher_service import merge_audio_segments
from services.video_renderer_service import replace_audio
from services.perf_service import stage_timer
from services.logging_service import get_job_id, get_logger

logger = get_logger("screen_ai.pipeline")


async def process_video(
    video_path,
    target_language,
    voice="george",
    on_progress=None,
    job_id=None,
):
    def report(stage, message=""):
        if on_progress:
            on_progress(stage, message or stage)

    profile: dict = {}
    tts_dir = None
    audio_path = None
    resolved_job_id = job_id or get_job_id()
    tts_completed = False

    # Step 1 - Extract audio
    report("Audio Extraction", "Extracting audio with FFmpeg")
    with stage_timer(profile, "ffmpeg"):
        audio_path = extract_audio(video_path)

    # Step 2 - Speech to text
    report("Whisper", "Transcribing speech with Faster-Whisper")
    with stage_timer(profile, "whisper"):
        result = transcribe_audio(audio_path)

    # Optional Gemini transcript cleanup (does not change timing)
    if GEMINI_CLEANUP_TRANSCRIPT:
        try:
            from services import gemini_service

            if gemini_service.is_configured():
                report("Whisper", "Cleaning transcript with Gemini")
                with stage_timer(profile, "gemini_cleanup"):
                    result = gemini_service.cleanup_transcript(result)
            else:
                logger.warning(
                    "GEMINI_CLEANUP_TRANSCRIPT enabled but GEMINI_API_KEY missing",
                    extra={"event": "gemini_cleanup_skipped"},
                )
        except Exception as cleanup_exc:
            logger.warning(
                "Gemini transcript cleanup failed; continuing with raw Whisper output",
                extra={
                    "event": "gemini_cleanup_failed",
                    "error_type": type(cleanup_exc).__name__,
                },
            )

    # Step 3 - Translate complete text
    report("Translation", "Translating transcript")
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

    # Step 4.5 - Optional Gemini translation QA (retries once on serious issues)
    if GEMINI_TRANSLATION_QA:
        try:
            from services import gemini_service

            if gemini_service.is_configured():
                report("Translation QA", "Checking translation quality")
                with stage_timer(profile, "translation_qa"):
                    qa = gemini_service.quality_check_translation(translated_segments)
                issues = qa.get("issues") or []
                if qa.get("has_serious_issues"):
                    logger.warning(
                        "Gemini translation QA found serious issues; retranslating once",
                        extra={
                            "event": "translation_qa_retry",
                            "issue_count": len(issues),
                        },
                    )
                    report("Translation QA", "Issues found; retranslating once")
                    with stage_timer(profile, "translation_retry"):
                        translated_segments = translate_segments(
                            result["segments"],
                            result["language"],
                            target_language,
                        )
                        translated_text = translate_text(
                            result["full_text"],
                            result["language"],
                            target_language,
                        )
                else:
                    logger.info(
                        "Gemini translation QA passed",
                        extra={
                            "event": "translation_qa_passed",
                            "issue_count": len(issues),
                        },
                    )
        except Exception as qa_exc:
            logger.warning(
                "Gemini translation QA failed; continuing with current translation",
                extra={
                    "event": "translation_qa_failed",
                    "error_type": type(qa_exc).__name__,
                },
            )

    # Step 5 - Generate segment audio (controlled concurrency + resume)
    report("TTS", f"Generating speech with Coqui TTS XTTS v2 (voice={voice})")
    if resolved_job_id:
        tts_dir = tts_job_dir(resolved_job_id)
    else:
        tts_dir = tempfile.mkdtemp(prefix="tts_", dir=TEMP_DIR)
    with stage_timer(profile, "tts"):
        audio_segments = await generate_segment_speech(
            translated_segments,
            language=target_language,
            voice=voice,
            work_dir=tts_dir,
            job_id=resolved_job_id,
            on_progress=on_progress,
        )
    tts_completed = True

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
    # Only remove TTS checkpoints after a fully successful TTS+merge+render path.
    if tts_completed and tts_dir and os.path.isdir(tts_dir):
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
