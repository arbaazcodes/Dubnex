from services.pipeline_service import process_video
from fastapi import FastAPI, UploadFile, File
import tempfile
import shutil
import os
from services.translator_service import translate_text

from services.whisper_service import detect_language, transcribe_audio
from services.ffmpeg_service import extract_audio


from jobs.job_manager import (
    create_job,
    update_job,
    finish_job,
    get_job
)

app = FastAPI(
    title="LuminaDub Backend",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "status": "Backend Running",
        "app": "LuminaDub AI"
    }

@app.post("/job")
def new_job():

    job_id = create_job()

    return {
        "job_id": job_id
    }

@app.post("/detect-language")
async def detect_language_audio(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp:

        shutil.copyfileobj(file.file, temp)

        audio_path = temp.name

    result = detect_language(audio_path)

    os.remove(audio_path)

    return result


@app.post("/detect-video-language")
async def detect_video_language(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:

        shutil.copyfileobj(file.file, temp)

        video_path = temp.name

    audio_path = extract_audio(video_path)

    result = detect_language(audio_path)

    os.remove(video_path)

    os.remove(audio_path)

    return result

@app.post("/transcribe-video")
async def transcribe_video(file: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        shutil.copyfileobj(file.file, temp)
        video_path = temp.name

    audio_path = extract_audio(video_path)

    result = transcribe_audio(audio_path)

    os.remove(video_path)
    os.remove(audio_path)

    return result

@app.post("/translate")
async def translate(
    text: str,
    source_lang: str,
    target_lang: str
):
    translated = translate_text(
        text,
        source_lang,
        target_lang
    )

    return {
        "translated_text": translated
    }
@app.get("/job/{job_id}")
def job_status(job_id: str):

    return get_job(job_id)


@app.post("/process-video")
async def process_video_api(
    target_lang: str,
    file: UploadFile = File(...)
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        shutil.copyfileobj(file.file, temp)
        video_path = temp.name

    try:
        result = process_video(video_path, target_lang)
        return result

    finally:
        if os.path.exists(video_path):
            os.remove(video_path)