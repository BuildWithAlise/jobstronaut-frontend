# server.py
import os, uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
from botocore.client import Config

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("ALLOWED_ORIGINS", "*").split(",")}})

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET  = os.getenv("S3_BUCKET")            # e.g. jobstronaut-uploads
MAX_MB     = int(os.getenv("MAX_UPLOAD_MB", "10"))

s3 = boto3.client("s3", region_name=AWS_REGION, config=Config(signature_version="s3v4"))

@app.route("/s3/presign", methods=["POST"])
def presign():
    body = request.get_json(silent=True) or {}
    filename     = (body.get("filename") or f"file-{uuid.uuid4().hex}").replace("/", "_")
    content_type = body.get("contentType") or "application/octet-stream"
    key = f"uploads/{uuid.uuid4().hex}-{filename}"

    fields = {
        "Content-Type": content_type,
        "x-amz-server-side-encryption": "AES256",
        "acl": "private"
    }
    conditions = [
        {"acl": "private"},
        {"x-amz-server-side-encryption": "AES256"},
        ["eq", "$Content-Type", content_type],
        ["content-length-range", 1, MAX_MB * 1024 * 1024],
        ["starts-with", "$key", "uploads/"]
    ]

    presigned = s3.generate_presigned_post(
        Bucket=S3_BUCKET, Key=key, Fields=fields, Conditions=conditions, ExpiresIn=60
    )

    return jsonify({
        "url": presigned["url"],
        "fields": presigned["fields"],
        "key": key,
        "region": AWS_REGION
    })

@app.route("/apply-complete", methods=["POST"])
def apply_complete():
    # optional: receive a ping after successful upload
    payload = request.get_json(silent=True) or {}
    print("apply-complete:", payload)
    return jsonify({"ok": True})

