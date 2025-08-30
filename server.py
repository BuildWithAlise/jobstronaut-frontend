"""
Jobstronaut Backend – Diagnostic & Upload Service
-------------------------------------------------
Project: Jobstronaut (Neptune Inc.)
Owner: Commander thuggathegreatest (Alise McNiel)
File: server.py
Date: 2025-08-30
Copyright © 2025 Neptune Inc. All Rights Reserved.

This software and associated documentation files (the "Software") are the
confidential and proprietary information of Neptune Inc. Unauthorized copying,
modification, distribution, or disclosure is prohibited.

Trademark Notice: Jobstronaut™ is a trademark of Neptune Inc.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3, os, datetime, botocore
from sqlalchemy import create_engine, text

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# 10MB max upload
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# --- Environment vars ---
DATABASE_URL = os.environ["DATABASE_URL"]
AWS_BUCKET_NAME = os.environ["AWS_BUCKET_NAME"]
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# --- Services ---
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
s3 = boto3.client("s3", region_name=AWS_REGION)

# --- Health check ---
@app.get("/healthz")
def healthz():
    return jsonify(ok=True)

# --- One-time diagnostic route ---
@app.get("/diag/s3")
def diag_s3():
    bucket = AWS_BUCKET_NAME
    region_env = AWS_REGION
    access = os.getenv("AWS_ACCESS_KEY_ID")
    secret_set = bool(os.getenv("AWS_SECRET_ACCESS_KEY"))
    
    try:
        loc = s3.get_bucket_location(Bucket=bucket).get("LocationConstraint")
        bucket_region = loc or "us-east-1"
        s3.head_bucket(Bucket=bucket)

        return jsonify({
            "ok": True,
            "time_utc": datetime.datetime.utcnow().isoformat() + "Z",
            "bucket": bucket,
            "AWS_REGION_env": region_env,
            "bucket_region_actual": bucket_region,
            "has_access_key": bool(access),
            "has_secret_key": secret_set
        })
    except botocore.exceptions.ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        msg = e.response.get("Error", {}).get("Message")
        headers = e.response.get("ResponseMetadata", {}).get("HTTPHeaders", {}) or {}
        return jsonify({
            "ok": False,
            "bucket": bucket,
            "AWS_REGION_env": region_env,
            "error_code": code,
            "error_message": msg,
            "aws_headers": {
                "x-amz-bucket-region": headers.get("x-amz-bucket-region"),
                "x-amz-id-2": headers.get("x-amz-id-2"),
                "x-amz-request-id": headers.get("x-amz-request-id")
            }
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False,
            "bucket": bucket,
            "AWS_REGION_env": region_env,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

