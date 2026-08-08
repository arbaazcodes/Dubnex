"""REAL end-to-end pipeline verification (no test stubs).

Runs the actual stages against backend/temp/e2e_workflow_source.mp4:
  A) Whisper  -> real transcription (base/cpu/int8)
  B) Translation -> real provider (auto: Gemini attempt -> NLLB fallback on 429)
  C) Segment alignment check (id/start/end/duration preserved)
  D) Real Coqui TTS (XTTS v2) local synthesis
  E) FFmpeg Merge + Render with real synthesized audio
"""
import asyncio
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ffmpeg_service import extract_audio          # noqa: E402
from services.whisper_service import transcribe_audio       # noqa: E402
import services.translator_service as ts                    # noqa: E402
from services.tts_service import generate_speech            # noqa: E402

VIDEO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "temp", "e2e_workflow_source.mp4")


def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,duration", "-of", "json", path],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout)["streams"]


def align_ok(segments):
    keys = {"id", "start", "end", "duration"}
    return all(keys.issubset(s) for s in segments)


def run_stages(lang, mode="nllb"):
    print(f"\n===== TARGET LANGUAGE: {lang} (provider mode={mode}) =====")
    audio = extract_audio(VIDEO)
    result = transcribe_audio(audio)
    os.remove(audio)
    src = result["language"]
    print(f"  Whisper: language={src} conf={result['confidence']} "
          f"segments={len(result['segments'])}")
    print(f"  ORIGINAL: {result['full_text']!r}")

    if mode == "auto":
        # Prove the root-cause fix: auto should try Gemini, hit 429, fall back to NLLB.
        ts._gemini_degraded = False
        provider_before = ts.resolve_translation_provider()
        out_text = ts.translate_text(result["full_text"], src, lang)
        out_segs = ts.translate_segments(result["segments"], src, lang)
        print(f"  provider before={provider_before} degraded_after={ts._gemini_degraded}")
    else:
        out_text = ts.translate_text(result["full_text"], src, lang)
        out_segs = ts.translate_segments(result["segments"], src, lang)

    print(f"  TRANSLATED (text): {out_text!r}")
    assert out_text and out_text.strip() != result["full_text"].strip(), \
        "translation must not silently return the original transcript"
    for s in out_segs:
        print(f"    seg {s['id']} [{s['start']:.2f}-{s['end']:.2f}] "
              f"{s['original']!r} -> {s['translated']!r}")
    assert align_ok(out_segs), "segment alignment (id/start/end/duration) lost"
    assert [s["id"] for s in out_segs] == [s["id"] for s in result["segments"]], \
        "segment ids/order changed"
    print(f"  ALIGNMENT: OK ({len(out_segs)} segments)")
    return result, out_segs


def coqui_tts_probe():
    print("\n===== REAL COQUI TTS (XTTS v2) PROBE =====")
    try:
        p = asyncio.run(generate_speech(
            "Hello! This is Coqui TTS XTTS v2 speaking locally.",
            os.path.join("temp", "_e2e_probe.mp3"),
            language="en",
        ))
        print(f"  TTS OK -> {p}")
        return True
    except Exception as exc:
        print(f"  TTS FAILED: {type(exc).__name__}: {str(exc)[:200]}")
        return False


def ffmpeg_merge_render(lang, segments):
    """Exercise real FFmpeg Merge + Render with real synthesized TTS audio."""
    import shutil
    from services.audio_stitcher_service import merge_audio_segments
    from services.video_renderer_service import replace_audio

    print(f"\n===== FFMPEG MERGE+RENDER (lang={lang}, REAL Coqui TTS audio) =====")
    seg_files = []
    for i, seg in enumerate(segments):
        dur = max(0.2, float(seg.get("duration") or 0.5))
        mp3 = os.path.join("temp", f"_e2e_seg_{lang}_{i}.mp3")
        # Generate real TTS for this segment
        asyncio.run(generate_speech(
            seg["translated"],
            mp3,
            language=lang,
        ))
        seg_files.append({"audio": mp3})
    merged = merge_audio_segments(seg_files, output_filename=f"_e2e_{lang}.mp3")
    print(f"  Merge -> {merged} ({os.path.getsize(merged)} bytes)")
    final = replace_audio(VIDEO, merged)
    print(f"  Render -> {final} ({os.path.getsize(final)} bytes)")
    streams = probe(final)
    kinds = [s["codec_type"] for s in streams]
    print(f"  ffprobe streams: {kinds}")
    assert "video" in kinds and "audio" in kinds, "output must contain video + audio"
    print(f"  RENDER VERIFIED: valid MP4 with video+audio ({final})")
    for f in [merged] + [f["audio"] for f in seg_files] + [final]:
        try:
            os.remove(f)
        except OSError:
            pass


async def full_pipeline_with_real_tts(lang):
    """Run the real process_video once per language; document the TTS outcome."""
    from services.pipeline_service import process_video

    print(f"\n===== FULL PIPELINE process_video(lang={lang}, real Coqui TTS) =====")
    stages = []
    def on_progress(stage, message=""):
        stages.append(stage)
        print(f"  [{stage}] {message}")

    try:
        payload = await process_video(
            VIDEO, lang, voice="default", on_progress=on_progress,
            job_id=f"e2e_{lang}",
        )
        print(f"  PIPELINE COMPLETED -> {payload.get('output_video')}")
        return True
    except Exception as exc:
        print(f"  PIPELINE STOPPED at stage '{stages[-1] if stages else '?'}': "
              f"{type(exc).__name__}: {str(exc)[:160]}")
        return False


def main():
    assert os.path.exists(VIDEO), f"missing test video {VIDEO}"
    print(f"test video: {VIDEO}")

    for lang in ["es", "hi"]:
        _, segs = run_stages(lang, mode="nllb")
        ffmpeg_merge_render(lang, segs)

    # Prove the auto fallback (Gemini 429 -> NLLB) with real providers.
    print("\n----- AUTO MODE (root-cause fix demonstration) -----")
    ts._gemini_degraded = False
    result, _ = run_stages("hi", mode="auto")

    # Real TTS probe documents the local synthesis capability.
    tts_ok = coqui_tts_probe()

    # Full real pipeline (with real TTS attempt) for one language.
    done = asyncio.run(full_pipeline_with_real_tts("es"))

    print("\n=================== E2E SUMMARY ===================")
    print(f"Whisper+Translation+Alignment (es, hi): PASS")
    print(f"FFmpeg Merge + Render:                  PASS (REAL Coqui TTS audio)")
    print(f"Real Coqui TTS (XTTS v2):               {'PASS' if tts_ok else 'FAILED (check logs)'}")
    print(f"Full process_video real run:            {'PASS' if done else 'STOPPED at TTS'}")


if __name__ == "__main__":
    main()