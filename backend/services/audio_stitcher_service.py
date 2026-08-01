import os
import subprocess
from config import OUTPUT_DIR


def merge_audio_segments(segment_files, output_filename="final_audio.mp3"):
    """
    Merge multiple MP3 files into a single MP3 using FFmpeg.
    """

    concat_file = os.path.join(OUTPUT_DIR, "concat.txt")

    with open(concat_file, "w", encoding="utf-8") as f:
        for segment in segment_files:
            path = os.path.abspath(segment["audio"])
            f.write(f"file '{path}'\n")

    output_path = os.path.join(OUTPUT_DIR, output_filename)

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_file,
        "-c",
        "copy",
        output_path,
    ]

    subprocess.run(command, check=True)

    return output_path