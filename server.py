# ===============================================================
#      Jobstronaut™ Backend
#      Author: Alise McNiel
#      Copyright (c) 2025 Alise McNiel. All rights reserved.
#      This software is part of the Jobstronaut™ project.
#      Unauthorized copying, modification, or distribution is prohibited.
# ===============================================================

# ===============================================================
#      Jobstronaut™ Backend (waitlist + alias enabled)
# ===============================================================

# ===============================================================
# Jobstronaut™ Backend — healthz + waitlist (region-aware S3)
# ===============================================================

import os, json, time, traceback
from datetime import datetime, timezone
from flask import Flask, request, jsonify
import boto3
from botocore.config import Config

# ---- Flask app FIRST (before any @app.route) -------------------
app = Flask(__name__)

# ---- CORS (multi-origin allow-list, no newline crashes) --------
ALLOWED_ORIGINS = {
    "https://jobstronaut.dev",
    "https://jobstronaut-frontend.onrender.com",
    "http://127.0.0.1:5000",
    "http://localhost:5000",
}
def _sanitize_origin(val: str) -> str:
    if not val:
        return ""
    return val.split(",")[0].splitlines()[0].strip()

@app.after_request
def add_cors(resp):
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
    else:
        fallback = _sanitize_origin(os.getenv("CORS_ALLOWED_ORIGIN", "https://jobstronaut.dev"))
        resp.headers["Access-Control-Allow-Origin"] = fallback or "https://jobstronaut.dev"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return resp

# ---- Config -----------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET", "jobstronaut-resumes").strip()
DEFAULT_REGION = os.getenv("AWS_DEFAULT_REGION", os.getenv("AWS_REGION", "us-east-1"))

def _s3(region=None):
    return boto3.client(
        "s3",
        region_name=region or DEFAULT_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )

def s3_for_bucket(bucket_name: str):
    """Return a client bound to the bucket's real region to avoid SignatureDoesNotMatch."""
    b = (bucket_name or "").strip()
    probe = _s3(DEFAULT_REGION)
    loc = probe.get_bucket_location(Bucket=b).get("LocationConstraint")
    real = loc or "us-east-1"   # AWS returns None for us-east-1
    if real == DEFAULT_REGION:
        return probe, real
    return _s3(real), real

# ---- Health -----------------------------------------------------
@app.get("/healthz")
def healthz():
    return jsonify(ok=True), 200

# ---- Waitlist ---------------------------------------------------
@app.route("/waitlist", methods=["POST", "OPTIONS"])
def waitlist():
    if request.method == "OPTIONS":
        return ("", 204)

    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip()
        if not email:
            return jsonify(error="email required"), 400

        record = {
            "email": email,
            "ts": int(time.time()),
            "iso": datetime.now(timezone.utc).isoformat(),
        }
        key = f"waitlist/{record['ts']}_{email.replace('@','_at_')}.json"

        s3, real_region = s3_for_bucket(S3_BUCKET)
        app.logger.info("Waitlist PUT bucket=%s region=%s key=%s", S3_BUCKET, real_region, key)

        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(record).encode("utf-8"),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )

        return jsonify(ok=True, bucket=S3_BUCKET, region=real_region, key=key), 200

    except Exception as e:
        app.logger.error("waitlist failed: %s", e)
        app.logger.error(traceback.format_exc())
        return jsonify(error=str(e)), 500

# ---- Local run --------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)

