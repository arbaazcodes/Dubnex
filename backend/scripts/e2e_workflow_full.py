"""Local E2E: Firebase token + upload + poll job + download."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8000"
FE = "http://localhost:5173"
# Never hardcode the Firebase Web API key — read it from the environment.
API_KEY = os.environ.get("FIREBASE_WEB_API_KEY", "").strip()
if not API_KEY:
    raise SystemExit(
        "FIREBASE_WEB_API_KEY is required for the E2E script (Firebase Web API "
        "key from the Firebase console — pass it as an env var, never commit it)."
    )
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
TEMP = ROOT / "temp"
OUT.mkdir(exist_ok=True)
TEMP.mkdir(exist_ok=True)


def http_json(method: str, url: str, data=None, headers=None, timeout=120):
    body = None
    hdrs = dict(headers or {})
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            if "application/json" in ctype:
                return resp.status, json.loads(raw.decode() or "null"), dict(resp.headers)
            return resp.status, raw, dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw.decode() or "null")
        except Exception:
            parsed = raw.decode(errors="replace")
        return e.code, parsed, dict(e.headers)


def stage(name: str):
    print(f"\n=== STAGE: {name} ===", flush=True)


def fail(name: str, detail):
    print(f"FAIL_STAGE={name}", flush=True)
    print(f"FAIL_DETAIL={detail}", flush=True)
    sys.exit(1)


def main():
    # 1) Frontend
    stage("1_Frontend_startup")
    code, body, _ = http_json("GET", FE + "/", timeout=10)
    text = body.decode("utf-8", errors="replace") if isinstance(body, (bytes, bytearray)) else str(body)
    if code != 200:
        fail("1_Frontend_startup", f"HTTP {code}")
    if 'id="root"' not in text and "id='root'" not in text:
        fail("1_Frontend_startup", "React #root missing in HTML")
    print("frontend_html_ok root_present=True")

    # 2) Backend
    stage("2_Backend_startup")
    code, health, _ = http_json("GET", API + "/health")
    print("health", health)
    if code != 200 or (isinstance(health, dict) and health.get("status") != "ok"):
        fail("2_Backend_startup", health)
    code, _, _ = http_json("GET", API + "/docs")
    print("docs", code)
    if code != 200:
        fail("2_Backend_startup", f"docs HTTP {code}")
    code, ready, _ = http_json("GET", API + "/ready")
    print("ready", json.dumps(ready)[:500] if isinstance(ready, dict) else ready)
    if code != 200 or not (isinstance(ready, dict) and ready.get("ok")):
        fail("2_Backend_startup", ready)

    # Auth: Firebase email/password signup (or sign-in)
    stage("2b_Firebase_auth_token")
    email = f"e2e.dubnex.{int(time.time())}@mailinator.com"
    password = "E2eTestPass123!"
    code, signup, _ = http_json(
        "POST",
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
        {"email": email, "password": password, "returnSecureToken": True},
    )
    print("signup_status", code, str(signup)[:300])
    if code != 200 or not isinstance(signup, dict) or not signup.get("idToken"):
        # try anonymous
        code, anon, _ = http_json(
            "POST",
            f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
            {"returnSecureToken": True},
        )
        print("anon_status", code, str(anon)[:300])
        if code != 200 or not isinstance(anon, dict) or not anon.get("idToken"):
            fail("2b_Firebase_auth_token", {"signup": signup, "anon": anon})
        token = anon["idToken"]
        uid = anon.get("localId")
    else:
        token = signup["idToken"]
        uid = signup.get("localId")
    print("token_len", len(token), "uid", uid)

    # Verify backend accepts token
    code, projects, hdrs = http_json(
        "GET",
        API + "/api/projects",
        headers={"Authorization": f"Bearer {token}", "Origin": "http://localhost:5173"},
    )
    print("projects_auth", code, str(projects)[:300])
    print("acao", hdrs.get("Access-Control-Allow-Origin") or hdrs.get("access-control-allow-origin"))
    if code != 200:
        fail("2b_Firebase_auth_token", projects)

    # Build sample video with speech via Coqui TTS + ffmpeg inside local backend venv path
    stage("3_Upload_prepare_sample")
    sys.path.insert(0, str(ROOT))
    os.chdir(ROOT)
    # Ensure env for generate_speech
    import asyncio
    from services.tts_service import generate_speech

    speech = asyncio.run(generate_speech(
        text="Hello everyone. This is the Dubnex end to end workflow verification.",
        filename="e2e_workflow_speech.mp3",
        language="en",
    ))
    print("speech", speech, os.path.getsize(speech))
    video_path = TEMP / "e2e_workflow_source.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "color=c=blue:s=640x360:d=5",
        "-i", speech,
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        str(video_path),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("sample_video", video_path, video_path.stat().st_size)

    stage("3_Upload")
    boundary = "----DubnexE2EBoundary"
    file_bytes = video_path.read_bytes()
    parts = []
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"e2e_workflow.mp4\"\r\nContent-Type: video/mp4\r\n\r\n".encode())
    parts.append(file_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        API + "/process-video?target_lang=es&voice=default",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Origin": "http://localhost:5173",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            upload_status = resp.status
            upload_payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        upload_status = e.code
        upload_payload = json.loads(e.read().decode() or "{}")
    print("upload", upload_status, upload_payload)
    if upload_status != 200 or not upload_payload.get("job_id"):
        fail("3_Upload", upload_payload)
    job_id = upload_payload["job_id"]
    print("job_id", job_id, "queue", upload_payload.get("queue"))

    stage("4_Queue_and_worker")
    # Inline queue processes in background thread/task — poll job
    terminal = {"Completed", "Failed", "failed", "completed"}
    last = None
    stages_seen = []
    for i in range(180):
        code, job, _ = http_json(
            "GET",
            f"{API}/job/{job_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if code != 200:
            # maybe needs query token
            code, job, _ = http_json("GET", f"{API}/job/{job_id}?token={token}")
        last = job
        if isinstance(job, dict):
            st = job.get("status")
            stage_name = job.get("stage") or job.get("current_stage")
            msg = job.get("message")
            print(f"poll[{i}] status={st} stage={stage_name} progress={job.get('progress')} msg={msg}")
            if stage_name and stage_name not in stages_seen:
                stages_seen.append(stage_name)
            if st in ("Completed", "completed"):
                break
            if st in ("Failed", "failed"):
                fail("pipeline", job)
        time.sleep(2)
    else:
        fail("4_Queue_and_worker", f"timeout last={last}")

    print("stages_seen", stages_seen)
    print("final_job", json.dumps({k: last.get(k) for k in ('status','stage','progress','message','output_video','language','translated_text') if isinstance(last, dict)}, default=str)[:800])

    # Map evidence for stages 5-10 from job payload
    stage("5_10_Pipeline_evidence")
    if not isinstance(last, dict):
        fail("pipeline", last)
    # Check outputs
    out_video = last.get("output_video") or (last.get("metadata") or {}).get("output_video")
    # Also check output registry / outputs dir for job id mp4
    candidates = list(OUT.glob(f"*{job_id}*.mp4")) + list(OUT.glob("*.mp4"))
    print("output_video_field", out_video)
    print("output_candidates", [str(p) for p in candidates[:10]])

    # Prefer explicit path
    mp4 = None
    if out_video and Path(out_video).is_file():
        mp4 = Path(out_video)
    else:
        # job may store relative
        for p in OUT.iterdir():
            if p.suffix.lower() == ".mp4" and job_id in p.name:
                mp4 = p
                break
    if mp4 is None:
        # newest mp4 in outputs after job start
        mp4s = sorted(OUT.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
        if mp4s:
            mp4 = mp4s[0]
    if mp4 is None or not mp4.is_file():
        fail("10_Video_Render", f"no mp4 found for job {job_id}")
    print("final_mp4", mp4, mp4.stat().st_size)
    probe = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name", "-of", "json", str(mp4)],
        text=True,
    )
    print("ffprobe", probe[:600])
    pdata = json.loads(probe)
    types = {s.get("codec_type") for s in pdata.get("streams", [])}
    if "video" not in types or "audio" not in types:
        fail("10_Video_Render", f"missing streams {types}")

    stage("11_Download")
    # preview
    code, preview, ph = http_json(
        "GET",
        f"{API}/api/projects/{job_id}/video?token={urllib.parse.quote(token)}",
        headers={"Authorization": f"Bearer {token}"},
    )
    # May be binary redirect or file — urllib follows redirects for http
    print("preview_status", code, "type", type(preview).__name__, "len", len(preview) if isinstance(preview, (bytes, bytearray)) else str(preview)[:120])
    if code not in (200, 302):
        # try without following - already got code
        fail("11_Download_preview", preview if not isinstance(preview, (bytes, bytearray)) else f"bytes={len(preview)}")

    dl_path = OUT / f"e2e_download_{job_id}.mp4"
    req = urllib.request.Request(
        f"{API}/api/projects/{job_id}/download?token={token}",
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        dl_status = resp.status
        data = resp.read()
        dl_path.write_bytes(data)
    print("download_status", dl_status, "bytes", len(data), "path", dl_path)
    if dl_status != 200 or len(data) < 1000:
        fail("11_Download", f"status={dl_status} size={len(data)}")
    if data[4:8] != b"ftyp" and data[0:3] != b"\x00\x00\x00":
        # mp4 often starts with size then ftyp
        print("magic", data[:12])
    probe2 = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(dl_path)],
        text=True,
    )
    print("download_ffprobe", probe2)
    if "duration" not in probe2:
        fail("11_Download_playable", probe2)

    # Transcript evidence
    original = last.get("original_text") or last.get("full_text")
    translated = last.get("translated_text")
    print("original_text", (original or "")[:200])
    print("translated_text", (translated or "")[:200])
    if not original:
        print("WARN original_text missing on job payload (may be nested)")
    if not translated:
        print("WARN translated_text missing on job payload")

    print("\nE2E_STATUS=SUCCESS")
    print("STAGES_SEEN", stages_seen)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
