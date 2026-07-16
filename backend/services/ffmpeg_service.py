import ffmpeg
import os
import tempfile


def extract_audio(video_path):

    audio_path = tempfile.mktemp(suffix=".wav")

    (
        ffmpeg
        .input(video_path)
        .output(
            audio_path,
            ac=1,
            ar=16000
        )
        .overwrite_output()
        .run()
    )

    return audio_path