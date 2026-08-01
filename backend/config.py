import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TEMP_DIR = os.path.join(BASE_DIR, "temp")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Whisper Settings
WHISPER_MODEL = "large-v3"
DEVICE = "cuda"
COMPUTE_TYPE = "float16"

# ElevenLabs
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# ElevenLabs Default Voices
DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"

VOICE_MAP = {
    "george": "JBFqnCBsd6RMkjVDRZzb",
    "bunty": "YOUR_BUNTY_VOICE_ID",
    "jessica": "YOUR_JESSICA_VOICE_ID",
}