import asyncio
import json
import os
import tempfile
from typing import Any, Callable

from config import (
    OUTPUT_DIR,
    TEMP_DIR,
    TTS_CONCURRENCY,
    TTS_PROVIDER,
    TTS_MODEL,
    TTS_DEVICE,
    TTS_LANGUAGE,
    TTS_SPEAKER_WAV,
    TTS_SPEED,
    TTS_CONCURRENCY_MIN,
    TTS_REQUEST_TIMEOUT_SECONDS,
)
from services.tts_provider import (
    TTSProvider,
    TTSProviderConfig,
    TTSError,
    TTSErrorKind,
    create_provider,
)
from services.logging_service import get_job_id, get_logger

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

logger = get_logger("screen_ai.tts")

MANIFEST_NAME = "manifest.json"


# Global provider instance (initialized on first use)
_provider: TTSProvider | None = None


def _get_provider() -> TTSProvider:
    """Get or create the global TTS provider instance."""
    global _provider
    if _provider is None:
        config = TTSProviderConfig(
            model=TTS_MODEL,
            device=TTS_DEVICE,
            language=TTS_LANGUAGE,
            speaker_wav=TTS_SPEAKER_WAV,
            speed=TTS_SPEED,
            concurrency=TTS_CONCURRENCY,
            request_timeout_seconds=TTS_REQUEST_TIMEOUT_SECONDS,
        )
        _provider = create_provider(TTS_PROVIDER, config)
    return _provider


def _kind_value(kind) -> str:
    return getattr(kind, "value", str(kind))


def tts_job_dir(job_id: str) -> str:
    path = os.path.join(TEMP_DIR, "tts_jobs", job_id)
    os.makedirs(path, exist_ok=True)
    return path


def manifest_path(job_dir: str) -> str:
    return os.path.join(job_dir, MANIFEST_NAME)


def segment_filename(segment_id: int) -> str:
    return f"segment_{int(segment_id):03d}.mp3"


def load_manifest(job_dir: str) -> dict[str, Any]:
    path = manifest_path(job_dir)
    if not os.path.isfile(path):
        return {"version": 1, "segments": {}}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"version": 1, "segments": {}}
        data.setdefault("version", 1)
        data.setdefault("segments", {})
        return data
    except (OSError, json.JSONDecodeError):
        return {"version": 1, "segments": {}}


def save_manifest(job_dir: str, manifest: dict[str, Any]) -> None:
    path = manifest_path(job_dir)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
    os.replace(tmp, path)


def _segment_done_on_disk(job_dir: str, segment_id: int, entry: dict | None) -> str | None:
    """Return audio path if this segment can be skipped (resume)."""
    filename = segment_filename(segment_id)
    path = os.path.join(job_dir, filename)
    if entry and entry.get("status") == "done" and entry.get("path"):
        candidate = entry["path"]
        if os.path.isfile(candidate) and os.path.getsize(candidate) > 0:
            return candidate
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return path
    return None


async def generate_speech(
    text: str,
    language: str = "en",
    filename: str = "speech.mp3",
    voice: str = "default",
):
    """
    Generate a single MP3 using the configured TTS provider.
    """
    provider = _get_provider()
    filepath = os.path.join(OUTPUT_DIR, filename)
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)

    def _sync_synthesize():
        return provider.synthesize(
            text=text,
            output_path=filepath,
            language=language,
            speaker_wav=None,  # Use default from config
            speed=None,  # Use default from config
        )

    return await asyncio.to_thread(_sync_synthesize)


async def generate_segment_speech(
    segments: list,
    language: str = "en",
    voice: str = "default",
    work_dir: str | None = None,
    job_id: str | None = None,
    on_progress: Callable[[str, str], None] | None = None,
):
    """
    Generate one MP3 file for every translated segment.

    Phase 1:
      - per-job checkpoint manifest under TEMP_DIR/tts_jobs/{job_id}/
      - simple concurrency control (local TTS is CPU-bound, keep low)
      - resume completed segments
    """
    if not segments:
        return []

    provider = _get_provider()
    resolved_job_id = job_id or get_job_id()
    if work_dir:
        segment_dir = work_dir
        os.makedirs(segment_dir, exist_ok=True)
    elif resolved_job_id:
        segment_dir = tts_job_dir(resolved_job_id)
    else:
        segment_dir = tempfile.mkdtemp(prefix="tts_segments_", dir=TEMP_DIR)

    manifest = load_manifest(segment_dir)
    if resolved_job_id:
        manifest["job_id"] = resolved_job_id
    segments_meta: dict[str, Any] = manifest.setdefault("segments", {})

    results_by_id: dict[int, dict] = {}
    pending: list[dict] = []

    for segment in segments:
        sid = int(segment["id"])
        key = str(sid)
        entry = segments_meta.get(key)
        existing = _segment_done_on_disk(segment_dir, sid, entry if isinstance(entry, dict) else None)
        if existing:
            logger.info(
                "TTS resume skip segment",
                extra={
                    "event": "tts_resume_skipped",
                    "segment_id": sid,
                    "path": existing,
                    "job_id": resolved_job_id,
                },
            )
            segments_meta[key] = {
                "status": "done",
                "path": existing,
                "attempts": int((entry or {}).get("attempts") or 0),
            }
            results_by_id[sid] = {
                "id": sid,
                "start": segment["start"],
                "end": segment["end"],
                "duration": segment["duration"],
                "text": segment["translated"],
                "audio": existing,
            }
        else:
            pending.append(segment)

    save_manifest(segment_dir, manifest)

    total = len(segments)
    done_count = len(results_by_id)

    def _report():
        if on_progress:
            on_progress(
                "TTS",
                f"Segments {done_count}/{total} (concurrency={TTS_CONCURRENCY})",
            )

    _report()

    if not pending:
        return [results_by_id[int(s["id"])] for s in segments]

    queue: asyncio.Queue[dict | None] = asyncio.Queue()
    for seg in pending:
        await queue.put(seg)

    worker_count = max(1, TTS_CONCURRENCY)
    for _ in range(worker_count):
        await queue.put(None)  # sentinel per worker

    manifest_lock = asyncio.Lock()
    failures: list[str] = []

    async def _persist_done(seg: dict, filepath: str, attempts: int) -> None:
        nonlocal done_count
        sid = int(seg["id"])
        async with manifest_lock:
            segments_meta[str(sid)] = {
                "status": "done",
                "path": filepath,
                "attempts": attempts,
            }
            save_manifest(segment_dir, manifest)
            results_by_id[sid] = {
                "id": sid,
                "start": seg["start"],
                "end": seg["end"],
                "duration": seg["duration"],
                "text": seg["translated"],
                "audio": filepath,
            }
            done_count += 1
        _report()

    async def _persist_failed(seg: dict, attempts: int, error: str) -> None:
        sid = int(seg["id"])
        async with manifest_lock:
            segments_meta[str(sid)] = {
                "status": "failed",
                "attempts": attempts,
                "error": error,
            }
            save_manifest(segment_dir, manifest)

    async def _one_segment(seg: dict) -> None:
        sid = int(seg["id"])
        dest = os.path.join(segment_dir, segment_filename(sid))
        attempts = 0
        last_exc: BaseException | None = None
        max_retries = 3  # Local TTS: simple retry for transient failures

        logger.info(
            "TTS segment start",
            extra={"event": "tts_segment_start", "segment_id": sid, "job_id": resolved_job_id},
        )

        while attempts <= max_retries:
            attempts += 1
            try:
                filepath = await asyncio.to_thread(
                    provider.synthesize,
                    text=seg["translated"],
                    output_path=dest,
                    language=language,
                    speaker_wav=None,  # Use default from config
                    speed=None,  # Use default from config
                )
                await _persist_done(seg, filepath, attempts)
                logger.info(
                    "TTS segment done",
                    extra={
                        "event": "tts_segment_done",
                        "segment_id": sid,
                        "attempts": attempts,
                        "job_id": resolved_job_id,
                    },
                )
                return
            except TTSError as exc:
                last_exc = exc
                if exc.kind == TTSErrorKind.FATAL or _kind_value(exc.kind) == "fatal" or attempts > max_retries:
                    await _persist_failed(seg, attempts, str(exc))
                    failures.append(f"segment {sid}: {exc}")
                    logger.error(
                        "TTS segment failed",
                        extra={
                            "event": "tts_segment_fail",
                            "segment_id": sid,
                            "attempts": attempts,
                            "kind": _kind_value(exc.kind),
                            "error": str(exc),
                            "job_id": resolved_job_id,
                        },
                    )
                    return

                # Retryable error - wait and retry
                wait_time = min(2 ** (attempts - 1), 30)  # Exponential backoff: 1, 2, 4... max 30s
                logger.warning(
                    "TTS segment retry",
                    extra={
                        "event": "tts_segment_retry",
                        "segment_id": sid,
                        "attempts": attempts,
                        "wait_time_seconds": wait_time,
                        "kind": _kind_value(exc.kind),
                        "job_id": resolved_job_id,
                    },
                )
                await asyncio.sleep(wait_time)
            except Exception as exc:
                last_exc = exc
                await _persist_failed(seg, attempts, str(exc))
                failures.append(f"segment {sid}: {exc}")
                logger.error(
                    "TTS segment failed",
                    extra={
                        "event": "tts_segment_fail",
                        "segment_id": sid,
                        "attempts": attempts,
                        "error": str(exc),
                        "job_id": resolved_job_id,
                    },
                )
                return

        if last_exc is not None:
            await _persist_failed(seg, attempts, str(last_exc))
            failures.append(f"segment {sid}: {last_exc}")

    async def _worker() -> None:
        while True:
            item = await queue.get()
            try:
                if item is None:
                    return
                await _one_segment(item)
            finally:
                queue.task_done()

    await asyncio.gather(*[_worker() for _ in range(worker_count)])

    if failures:
        raise RuntimeError(
            "TTS failed for one or more segments (completed segments preserved for resume): "
            + "; ".join(failures)
        )

    # Preserve input order
    return [results_by_id[int(s["id"])] for s in segments]