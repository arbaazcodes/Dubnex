import edge_tts
import uuid
import os
import asyncio

OUTPUT_DIR = "outputs"

os.makedirs(OUTPUT_DIR, exist_ok=True)

async def generate_speech(text: str):
    filename = f"{uuid.uuid4()}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)

    communicate = edge_tts.Communicate(
        text=text,
        voice="hi-IN-SwaraNeural"
    )

    await communicate.save(filepath)

    return filepath