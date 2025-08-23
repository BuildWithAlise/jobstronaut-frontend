from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
import os
import time
from sqlalchemy import create_engine, text

app = Flask(__name__)
# Allow the static site (and any origin for MVP). Tighten in v2 if you want.
CORS(app, resources={r"/*": {"origins": "*"}})

# 10MB max (frontend also enforces)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# --- Environment ---
# Required on Render: DATABASE_URL, AWS_BUCKET_NAME, AWS_REGION (default us-east-1),
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SECRET_KEY
DATABASE_URL = os.environ["DATABASE_URL"]
AWS_BUCKET_NAME = os.environ["AWS_BUCKET_NAME"]
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# --- Services ---
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
s3 = boto3.client("s3", region_name=AWS_REGION)

# --- Health ---
@app.get("/healthz")
def healthz():
    return jsonify(ok=True)

# --- S3 Presign ---
@app.post("/s3/presign")
def s3_presign():
    """Generate a presigned POST so the browser can upload directly to S3.
    Expects multipart/form-data with fields: filename, content_type
    Returns JSON with: url, fields, key
    """
    filename = (request.form.get("filename") or "").strip()
    content_type = (request.form.get("content_type") or "application/octet-stream").strip()
    if not filename:
        return jsonify(error="filename required"), 400

    ts = int(time.time())
    key = f"resumes/{ts}-{filename}"

    try:
        presigned = s3.generate_presigned_post(
            Bucket=AWS_BUCKET_NAME,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, 10 * 1024 * 1024],  # 10MB
            ],
            ExpiresIn=60,  # seconds to start the upload
        )
    except Exception as e:
        return jsonify(error=str(e)), 500

    presigned["key"] = key
    return jsonify(presigned)

# --- Apply Complete ---
@app.post("/apply-complete")
def apply_complete():
    """Persist a minimal marketing record after the S3 upload succeeds.
    Expects JSON: { email, filename, content_type, size, s3_key }
    """
    data = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip()
    filename = (data.get("filename") or "").strip()
    content_type = (data.get("content_type") or "application/pdf").strip()
    size = int(data.get("size") or 0)
    s3_key = (data.get("s3_key") or "").strip()

    if not filename or not s3_key:
        return jsonify(error="filename and s3_key required"), 400

    try:
        with engine.begin() as conn:
            # Create table if it doesn't exist (safe, fast in Postgres)
            conn.execute(text(
                """
                CREATE TABLE IF NOT EXISTS applications (
                  id SERIAL PRIMARY KEY,
                  filename TEXT,
                  size INTEGER,
                  content_type TEXT,
                  email TEXT,
                  s3_key TEXT,
                  created_at TIMESTAMP DEFAULT NOW()
                )
                """
            ))
            conn.execute(text(
                """
                INSERT INTO applications (filename, size, content_type, email, s3_key)
                VALUES (:filename, :size, :ctype, :email, :s3_key)
                """
            ), {
                "filename": filename,
                "size": size,
                "ctype": content_type,
                "email": email,
                "s3_key": s3_key,
            })
    except Exception as e:
        return jsonify(ok=False, error=str(e)), 500

    return jsonify(ok=True)

# Gunicorn entrypoint is: server:app
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

