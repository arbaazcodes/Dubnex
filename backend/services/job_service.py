import uuid

jobs = {}


def create_job():
    job_id = str(uuid.uuid4())

    jobs[job_id] = {
        "status": "created",
        "progress": 0,
        "message": "Job created",
        "result": None,
    }

    return job_id


def update_job(job_id, progress, message):
    if job_id not in jobs:
        return

    jobs[job_id]["progress"] = progress
    jobs[job_id]["message"] = message
    jobs[job_id]["status"] = "processing"


def finish_job(job_id, result):
    if job_id not in jobs:
        return

    jobs[job_id]["progress"] = 100
    jobs[job_id]["message"] = "Completed"
    jobs[job_id]["status"] = "completed"
    jobs[job_id]["result"] = result


def fail_job(job_id, error):
    if job_id not in jobs:
        return

    jobs[job_id]["status"] = "failed"
    jobs[job_id]["message"] = str(error)


def get_job(job_id):
    return jobs.get(job_id)