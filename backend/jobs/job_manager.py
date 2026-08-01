import uuid
from datetime import datetime

jobs = {}


def create_job():
    job_id = str(uuid.uuid4())

    jobs[job_id] = {
        "id": job_id,
        "status": "created",
        "progress": 0,
        "message": "Job created",
        "result": None,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }

    return job_id


def update_job(job_id, status, progress, message=""):

    if job_id not in jobs:
        return

    jobs[job_id]["status"] = status
    jobs[job_id]["progress"] = progress
    jobs[job_id]["message"] = message
    jobs[job_id]["updated_at"] = datetime.now().isoformat()


def finish_job(job_id, result):

    if job_id not in jobs:
        return

    jobs[job_id]["status"] = "completed"
    jobs[job_id]["progress"] = 100
    jobs[job_id]["message"] = "Completed"
    jobs[job_id]["result"] = result
    jobs[job_id]["updated_at"] = datetime.now().isoformat()


def fail_job(job_id, error):

    if job_id not in jobs:
        return

    jobs[job_id]["status"] = "failed"
    jobs[job_id]["message"] = str(error)
    jobs[job_id]["updated_at"] = datetime.now().isoformat()


def get_job(job_id):
    return jobs.get(job_id, {
        "status": "not_found"
    })