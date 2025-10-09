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

import os, re, time, functools, json, uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
from botocore.client import Config

app = Flask(__name__)

# CORS: allow multiple origins via comma-separated env var
_allowed = os.getenv("CORS_ALLOWED_ORIGIN", "https://jobstronaut.dev")
_origins = [o.strip() for o in _allowed.split(",") if o.strip()]
CORS(app, resources={r"/*": {"origins": _origins}})

S3_BUCKET = os.environ["S3_BUCKET"]
S3_REGION = os.environ.get("AWS_REGION", "us-east-1")

s3 = boto3.client("s3", region_name=S3_REGION, config=Config(signature_version="s3v4"))

@app.get("/healthz")
def healthz():
    return {"ok": True}
    
 import traceback, json, time
from datetime import datetime, timezone

def s3_for_bucket(bucket_name: str):
    from botocore.config import Config
    import boto3, os
    default_region = os.getenv("AWS_DEFAULT_REGION", os.getenv("AWS_REGION", "us-east-1"))
    probe = boto3.client("s3", region_name=default_region,
                         config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
    loc = probe.get_bucket_location(Bucket=bucket_name).get("LocationConstraint")
    real_region = loc or "us-east-1"
    if real_region == default_region:
        return probe, real_region
    return boto3.client("s3", region_name=real_region,
                        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"})), real_region

@app.route("/waitlist", methods=["POST","OPTIONS"])
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

        bucket = os.getenv("S3_BUCKET", "jobstronaut-resumes").strip()
        key = f"waitlist/{record['ts']}_{email.replace('@','_at_')}.json"

        s3, real_region = s3_for_bucket(bucket)
        app.logger.info(f"Uploading to {bucket} in {real_region} as {key}")

        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(record).encode("utf-8"),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )

        return jsonify(ok=True, bucket=bucket, region=real_region, key=key), 200
    except Exception as e:
        app.logger.error(traceback.format_exc())
        return jsonify(error=str(e)), 500


# --- rate limit config ---
RATE = {"ip": (30, 600), "email": (10, 600)}  # (count, window_sec)
_rl_ip = {}
_rl_email = {}

def _allow(bucket, key, window, now):
    q = [t for t in bucket.get(key, []) if now - t < window]
    bucket[key] = q
    return q

def ratelimit(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        ip = request.headers.get("CF-Connecting-IP") or request.headers.get("X-Forwarded-For", request.remote_addr).split(",")[0].strip()
        email = (request.json or {}).get("email", "").lower().strip()
        now = time.time()

        # IP check
        ip_max, ip_win = RATE["ip"]
        ip_list = _allow(_rl_ip, ip, ip_win, now)
        if len(ip_list) >= ip_max:
            return jsonify({"error":"rate_limited","message":"Too many requests. Try again later."}), 429

        # Email check (only if provided)
        if email:
            em_max, em_win = RATE["email"]
            em_list = _allow(_rl_email, email, em_win, now)
            if len(em_list) >= em_max:
                return jsonify({"error":"rate_limited","message":"Too many requests for this email. Try later."}), 429

        # record
        _rl_ip.setdefault(ip, []).append(now)
        if email:
            _rl_email.setdefault(email, []).append(now)
        return fn(*args, **kwargs)
    return wrapper

PDF_CT_RE = re.compile(r"^application/(pdf|x-pdf)$", re.I)

@app.post("/s3/presign")
@ratelimit
def presign():
    data = request.get_json(force=True, silent=True) or {}
    filename = (data.get("filename") or "").strip()
    size = int(data.get("size") or 0)
    content_type = (data.get("contentType") or "").strip()
    email = (data.get("email") or "").strip()

    # Validate
    if not filename or not content_type or not size:
        return jsonify({"error":"bad_request","message":"filename, contentType, and size are required."}), 400
    if not PDF_CT_RE.match(content_type) or not filename.lower().endswith(".pdf"):
        return jsonify({"error":"unsupported_type","message":"Only PDF uploads are allowed."}), 415
    if size > 10 * 1024 * 1024:
        return jsonify({"error":"too_large","message":"Max file size is 10MB."}), 413

    key = f"uploads/{int(time.time())}_{re.sub(r'[^a-zA-Z0-9_.-]','_', filename)}"
    params = {
        "Bucket": S3_BUCKET,
        "Key": key,
        "ContentType": content_type,
        "ServerSideEncryption": "AES256",
    }
    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params=params,
        ExpiresIn=300,  # 5 min
        HttpMethod="PUT",
    )
    return jsonify({
        "url": url,
        "key": key,
        "headers": {
            "Content-Type": content_type,
            "x-amz-server-side-encryption": "AES256"
        },
        "limits": {"maxBytes": 10*1024*1024, "allowedTypes": ["application/pdf"]},
    })

# --- waitlist signup -> writes JSON record to S3: waitlist/<ts>_<uuid>.json (AES256) ---
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def _handle_waitlist():
    try:
        data = request.get_json(force=True, silent=True) or {}
        email = (data.get("email") or "").strip().lower()

        if not EMAIL_RE.match(email):
            return jsonify({"error": "invalid_email", "message": "Enter a valid email."}), 400

        entry = {
            "email": email,
            "ts": int(time.time()),
            "ua": request.headers.get("User-Agent", "")[:300],
            "ref": request.headers.get("Referer", "")[:300],
        }

        key = f"waitlist/{int(time.time())}_{uuid.uuid4().hex}.json"

        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(entry).encode("utf-8"),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )

        app.logger.info("waitlist_signup email=%s key=%s", email, key)
        return jsonify({"ok": True})

    except Exception as e:
        app.logger.error(f"[waitlist] unexpected error: {e}", exc_info=True)
        return jsonify({"error": "internal_error", "message": "Waitlist failed"}), 500

