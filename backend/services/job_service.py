import uuid
from datetime import datetime

jobs = {}

# Progress percentages for each pipeline stage
STAGE_PROGRESS = {
    "Upload": 10,
    "Audio Extraction": 25,
    "Whisper": 40,
    "Translation": 55,
    "TTS": 70,
    "Audio Merge": 85,
    "Video Rendering": 95,
    "Completed": 100,
}


def create_job(
    title: str = "",
    source_language: str = "",
    target_language: str = "",
    metadata: dict | None = None,
):
    """Create a unique job and return its ID."""
    job_id = str(uuid.uuid4())
    now = datetime.now().isoformat()

    jobs[job_id] = {
        "id": job_id,
        "status": "Upload",
        "stage": "Upload",
        "progress": STAGE_PROGRESS["Upload"],
        "message": "Upload received",
        "result": None,
        "title": title or "Video Job",
        "sourceLanguage": source_language,
        "targetLanguage": target_language,
        "metadata": metadata or {},
        "videoUrl": None,
        "transcript": [],
        "stage_history": ["Upload"],
        "logs": [
            {
                "id": f"log-{job_id[:8]}-0",
                "timestamp": now,
                "level": "info",
                "message": "Job created",
                "step": "Upload",
            }
        ],
        "created_at": now,
        "updated_at": now,
    }

    return job_id


def _append_log(job_id: str, message: str, step: str, level: str = "info"):
    job = jobs.get(job_id)
    if not job:
        return
    job["logs"].append(
        {
            "id": f"log-{uuid.uuid4().hex[:10]}",
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            "step": step,
        }
    )


def update_job(
    job_id: str,
    progress: int | None = None,
    message: str = "",
    stage: str | None = None,
    status: str | None = None,
    **extra,
):
    """Update job progress / stage. Extra keys are merged into the job dict."""
    if job_id not in jobs:
        return

    job = jobs[job_id]

    if stage:
        job["stage"] = stage
        if progress is None:
            progress = STAGE_PROGRESS.get(stage, job.get("progress", 0))
        if not status:
            status = stage
        if not message:
            message = stage
        history = job.setdefault("stage_history", [])
        if not history or history[-1] != stage:
            history.append(stage)

    if progress is not None:
        job["progress"] = progress
    if message:
        job["message"] = message
    if status:
        job["status"] = status

    for key, value in extra.items():
        job[key] = value

    job["updated_at"] = datetime.now().isoformat()

    if message or stage:
        _append_log(job_id, message or (stage or "update"), stage or job.get("stage", ""), "info")


def finish_job(job_id: str, result: dict):
    if job_id not in jobs:
        return

    job = jobs[job_id]
    job["progress"] = 100
    job["stage"] = "Completed"
    job["status"] = "Completed"
    job["message"] = "Completed"
    job["result"] = result
    job["updated_at"] = datetime.now().isoformat()
    history = job.setdefault("stage_history", [])
    if not history or history[-1] != "Completed":
        history.append("Completed")

    output_video = (result or {}).get("output_video") or ""
    filename = output_video.replace("\\", "/").split("/")[-1]
    if filename:
        job["videoUrl"] = f"http://127.0.0.1:8000/outputs/{filename}"

    original = (result or {}).get("original_text") or ""
    translated = (result or {}).get("translated_text") or ""
    if original or translated:
        job["transcript"] = [
            {
                "id": "t1",
                "start": 0,
                "end": 0,
                "text": original,
                "translatedText": translated,
                "speaker": "Voice",
            }
        ]

    if (result or {}).get("language"):
        job["sourceLanguage"] = result["language"]

    _append_log(job_id, "Pipeline completed successfully", "Completed", "info")


def fail_job(job_id: str, error):
    if job_id not in jobs:
        return

    job = jobs[job_id]
    job["status"] = "Failed"
    job["stage"] = "Failed"
    job["message"] = str(error)
    job["updated_at"] = datetime.now().isoformat()
    _append_log(job_id, str(error), job.get("stage", "Failed"), "error")


def get_job(job_id: str):
    return jobs.get(job_id)
