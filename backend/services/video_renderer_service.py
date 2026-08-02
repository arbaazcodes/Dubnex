import os
import uuid
import ffmpeg

from config import OUTPUT_DIR

os.makedirs(OUTPUT_DIR, exist_ok=True)


def replace_audio(video_path: str, audio_path: str):
    output_path = os.path.join(
        OUTPUT_DIR,
        f"{uuid.uuid4()}.mp4"
    )

    (
        ffmpeg
        .output(
            ffmpeg.input(video_path).video,
            ffmpeg.input(audio_path).audio,
            output_path,
            vcodec="copy",
            acodec="aac",
            shortest=None
        )
        .overwrite_output()
        .run()
    )

    return output_path
