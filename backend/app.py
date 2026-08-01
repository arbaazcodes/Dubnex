from services.tts_service import generate_speech
from services.pipeline_service import process_video
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Body
import tempfile
import shutil
import os
from services.translator_service import translate_text
from services.video_renderer_service import replace_audio
from services.whisper_service import detect_language, transcribe_audio
from services.ffmpeg_service import extract_audio
from services.elevenlabs_service import get_all_voices, generate_speech
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json

from services.job_service import (
    create_job,
    update_job,
    finish_job,
    fail_job,
    get_job,
)

app = FastAPI(
    
    title="LuminaDub Backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/outputs",
    StaticFiles(directory="outputs"),
    name="outputs",
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
        "job_id": job_id,
        "status": "created"
    }

@app.post("/api/detect-language")
async def detect_language_audio(payload: dict = Body(...)):
    filename = (payload or {}).get("filename", "")
    sample_text = (payload or {}).get("sampleText", "")

    lowered_name = (filename or "").lower()
    lowered_text = (sample_text or "").lower()

    if "french" in lowered_name or "paris" in lowered_name or "bonjour" in lowered_text or "oui" in lowered_text:
        detected = "French"
        confidence = 0.97
    elif "hindi" in lowered_name or "india" in lowered_name or "namaste" in lowered_text or "namaskar" in lowered_text:
        detected = "Hindi"
        confidence = 0.98
    elif "arabic" in lowered_name or "dubai" in lowered_name or "marhaban" in lowered_text or "salam" in lowered_text:
        detected = "Arabic"
        confidence = 0.95
    elif "spanish" in lowered_name or "madrid" in lowered_name or "hola" in lowered_text or "gracias" in lowered_text:
        detected = "Spanish"
        confidence = 0.96
    elif "german" in lowered_name or "berlin" in lowered_name or "hallo" in lowered_text:
        detected = "German"
        confidence = 0.92
    else:
        detected = "English"
        confidence = 0.94

    return {"detected": detected, "confidence": confidence}


@app.post("/detect-language")
async def detect_language_audio_upload(file: UploadFile = File(...)):

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

@app.post("/api/transcribe-audio")
async def transcribe_audio_api(payload: dict = Body(...)):
    audio = (payload or {}).get("audio")
    if not audio:
        return JSONResponse(status_code=400, content={"error": "Audio data is required."})

    return {"text": "This is a FastAPI-backed transcription placeholder. Upload a real audio pipeline implementation to replace this stub."}


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

@app.post("/api/chat")
async def chat_api(payload: dict = Body(...)):
    message = (payload or {}).get("message", "")
    if not message:
        return JSONResponse(status_code=400, content={"error": "Message is required."})

    return {"text": f"FastAPI mock response to: {message}"}


@app.post("/api/analyze-video")
async def analyze_video_api(payload: dict = Body(...)):
    title = (payload or {}).get("title", "Active Video")
    duration = (payload or {}).get("duration", "00:30")
    return {
        "analysis": f"### Analysis\n- Title: {title}\n- Duration: {duration}\n- Source: FastAPI backend"
    }


@app.post("/process-video")
async def process_video_api(
    target_lang: str = "en",
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

        return JSONResponse(
    {
        "success": True,
        "output_video": result["output_video"],
        "language": result["language"],
        "original_text": result["original_text"],
        "translated_text": result["translated_text"],
    }
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

@app.get("/api/pipeline-sse")
async def pipeline_sse(jobId: str):
    async def event_stream():
        payload = {
            "id": jobId,
            "status": "queued",
            "message": "FastAPI pipeline status placeholder",
            "progress": 0,
        }
        yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.websocket("/live")
async def live_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
            await websocket.send_text('{"text":"FastAPI live socket placeholder"}')
    except WebSocketDisconnect:
        pass


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