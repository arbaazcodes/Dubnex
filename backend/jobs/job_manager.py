import uuid

jobs = {}

def create_job():
    job_id = str(uuid.uuid4())

    jobs[job_id] = {
        "status": "created",
        "progress": 0,
        "result": None
    }

    return job_id


def update_job(job_id, status, progress):
    jobs[job_id]["status"] = status
    jobs[job_id]["progress"] = progress


def finish_job(job_id, result):
    jobs[job_id]["status"] = "completed"
    jobs[job_id]["progress"] = 100
    jobs[job_id]["result"] = result


def get_job(job_id):
    return jobs.get(job_id)