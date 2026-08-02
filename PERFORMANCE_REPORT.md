# PERFORMANCE_REPORT.md

**Sprint:** 15 — Performance Optimization  
**Date:** 2026-08-02  
**Scope:** Throughput / latency improvements without changing pipeline stage order, auth, UI, or queue design. AI outputs keep the same schema (transcript segments, dubbed MP4).

---

## Summary

| Area | Change | Measured effect |
|------|--------|-----------------|
| Stage profiling | Per-stage timers → logs + `stage_profile` on job result | Visibility for every job |
| Whisper warm-up | Worker startup silent WAV pass | Avoids cold first-job Whisper cost |
| Translation batching | `TRANSLATION_BATCH_SIZE` (default 8) | **~5.2×** faster on 16 short segments (CPU) |
| TTS concurrency | `TTS_CONCURRENCY` (default 3) | **~2.8×** faster on 9 simulated I/O-bound calls |
| Queue wait | `enqueued_at` → `screen_ai_queue_wait_seconds` | Wait time measurable |
| Worker throughput | `screen_ai_worker_*` metrics | Jobs/min gauge + duration histogram |
| Temp files | Direct upload path; TTS under `TEMP_DIR`; cleanup after mux | Less disk thrash / no OUTPUT_DIR clutter |

---

## 1. Pipeline stage profiling

Every `process_video()` run records milliseconds for:

`ffmpeg` · `whisper` · `translation` · `tts` · `merge` · `render` (+ `total_ms`)

- Emitted as JSON logs (`event=stage_profile`)
- Attached to job result / metadata as `stage_profile` when `PERF_PROFILE=true`
- Existing Prometheus stage histograms (Sprint 13) still apply via job stage transitions

---

## 2. Whisper warm-up (worker)

On `python -m worker` start (`WHISPER_WARMUP=true`):

1. Import Faster-Whisper singleton  
2. Transcribe a 0.5s silent WAV  
3. Tiny NLLB warm translate (`Hello` en→hi)

**Tradeoff:** Longer worker boot; lower latency on the first real job.

---

## 3. Translation batching

**Before:** `translate_segments` called `translate_text` once per segment (N `model.generate` calls).

**After:** Batched tokenize + `generate` with padding (`TRANSLATION_BATCH_SIZE`, default **8**). Same `forced_bos_token_id` / `max_new_tokens=256`. Empty strings short-circuit.

### Bench (CPU, 16 short EN→HI lines)

| Mode | Time |
|------|------|
| Sequential (1× generate each) | **8291.5 ms** |
| Batched (single padded generate) | **1608.8 ms** |
| Speedup | **5.15×** |

**Tradeoff:** Padding can produce tiny wording differences vs pure sequential generate on edge cases. Segment timing / structure unchanged. Set `TRANSLATION_BATCH_SIZE=1` to force legacy one-by-one behavior.

---

## 4. Controlled TTS concurrency

**Before:** Strictly sequential ElevenLabs calls.

**After:** `asyncio.Semaphore(TTS_CONCURRENCY)` + `asyncio.to_thread` (default concurrency **3**). Segment order preserved. Files land under `TEMP_DIR` and are removed after mux.

### Bench (9 segments, 50 ms simulated I/O each)

| Mode | Time |
|------|------|
| Sequential | **506.0 ms** |
| Concurrency=1 | 521.1 ms |
| Concurrency=3 | **183.2 ms** |
| Speedup (3 vs seq) | **2.76×** |

**Tradeoff:** Higher concurrency can hit ElevenLabs rate limits; keep `TTS_CONCURRENCY` modest (2–4) in production.

---

## 5–6. Queue wait & worker throughput

| Metric | Meaning |
|--------|---------|
| `screen_ai_queue_wait_seconds` | Enqueue → worker start |
| `screen_ai_worker_job_duration_seconds` | `process_video` wall time |
| `screen_ai_worker_jobs_completed_total{status}` | Completions / failures |
| `screen_ai_worker_throughput_jobs_per_minute` | Rolling ~5 min estimate |

Payload field `enqueued_at` is set on every enqueue (including retries).

---

## 7. Temporary file handling

| Before | After |
|--------|-------|
| Temp file + `shutil.move` to durable name | Stream upload once to `TEMP_DIR/{job_id}.ext` |
| TTS MP3s in `OUTPUT_DIR` root | TTS under `TEMP_DIR/tts_*`; deleted after merge |
| Extracted audio left until end | Removed after Whisper; merged audio removed after mux |

Safe: final MP4 path unchanged; cleanup only after successful consume.

---

## Configuration

```env
TTS_CONCURRENCY=3
TRANSLATION_BATCH_SIZE=8
WHISPER_WARMUP=true
PERF_PROFILE=true
```

Reproduce benches:

```bash
cd backend
python scripts/bench_performance.py
```

---

## What was not changed

- Stage order / `process_video` contract (segments, voice, output_video)
- Auth, UI, Redis queue protocol (still LPUSH/BRPOP + same payload shape)
- Model IDs / Whisper decode settings / ElevenLabs model id

---

## Recommended production defaults

- CPU workers: `TRANSLATION_BATCH_SIZE=8`, `TTS_CONCURRENCY=3`
- Strict text parity debugging: `TRANSLATION_BATCH_SIZE=1`
- Rate-limit sensitive ElevenLabs: `TTS_CONCURRENCY=2`
