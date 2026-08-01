from services.tts_service import generate_speech
from fastapi.responses import FileResponse
from services.pipeline_service import process_video
from fastapi import FastAPI, UploadFile, File
import tempfile
import shutil
import os
from services.translator_service import translate_text
from services.video_renderer_service import replace_audio
from services.whisper_service import detect_language, transcribe_audio
from services.ffmpeg_service import extract_audio
from fastapi.responses import FileResponse
from services.elevenlabs_service import get_all_voices
from fastapi.responses import FileResponse
from services.elevenlabs_service import generate_speech

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

@app.post("/generate-audio")
async def generate_audio(text: str):
    filepath = await generate_speech(text)
    return FileResponse(
        filepath,
        media_type="audio/mpeg",
        filename="translated.mp3"
    )

@app.post("/process-video")
async def process_video_api(
    target_lang: str,
    voice: str = "george",
    file: UploadFile = File(...)
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        shutil.copyfileobj(file.file, temp)
        video_path = temp.name

    try:
        result = await process_video(
    video_path=video_path,
    target_language=target_lang,
    voice=voice,
)

        return FileResponse(
    path=result["output_video"],
    media_type="video/mp4",
    filename="translated_video.mp4"
)

    finally:
        if os.path.exists(video_path):
            os.remove(video_path)


@app.get("/voices")
def voices():
    return {
        "voices": get_all_voices()
    }

@app.get("/eleven-test")
def eleven_test():

    filepath = generate_speech(
        text="Hello Arbaaz. This is ElevenLabs speaking.",
        filename="eleven_test.mp3"
    )

    return FileResponse(
        path=filepath,
        media_type="audio/mpeg",
        filename="eleven_test.mp3"
    )

@app.post("/render-video")
async def render_video(
    video: UploadFile = File(...),
    audio: UploadFile = File(...)
):
    import os
    import shutil
    import uuid

    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)

    video_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{video.filename}")
    audio_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{audio.filename}")

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)

    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    output_video = replace_audio(video_path, audio_path)

    return FileResponse(
        output_video,
        media_type="video/mp4",
        filename="translated_video.mp4"
    ),