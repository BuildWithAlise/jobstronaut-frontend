<<<<<<< HEAD
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
import boto3, os, datetime, botocore, uuid
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

# --- Presign route with SSE enforced ---
@app.post("/s3/presign")
def s3_presign():
    filename = request.args.get("filename") or request.json.get("filename")
    content_type = request.args.get("type") or request.json.get("type") or "application/pdf"

    key = f"uploads/{uuid.uuid4()}_{filename}"

    params = {
        "Bucket": AWS_BUCKET_NAME,
        "Key": key,
        "ContentType": content_type,
        "ServerSideEncryption": "AES256"
    }

    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params=params,
        ExpiresIn=300,
        HttpMethod="PUT"
    )

    return jsonify({
        "url": url,
        "key": key,
        "bucket": AWS_BUCKET_NAME,
        "region": AWS_REGION
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

"""
Frontend snippet for PUT (upload.js)
====================================
const putRes = await fetch(presign.url, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type || 'application/pdf',
    'x-amz-server-side-encryption': 'AES256'
  }
});

if (!putRes.ok) {
  console.error("Upload failed", putRes.status, await putRes.text());
} else {
  console.log("✅ Upload success");
}
"""


---

BACKEND: `/s3/presign` with Server-Side Encryption (AES256)
==========================================================
```python
# Add to server.py
import uuid

@app.post("/s3/presign")
def s3_presign():
    data = {}
    try:
        if request.is_json:
            data = request.get_json() or {}
    except Exception:
        data = {}

    filename = request.args.get("filename") or data.get("filename") or "resume.pdf"
    content_type = request.args.get("type") or data.get("type") or "application/pdf"

    # Object key under uploads/
    key = f"uploads/{uuid.uuid4()}_{filename}"

    params = {
        "Bucket": AWS_BUCKET_NAME,
        "Key": key,
        "ContentType": content_type,
        # REQUIRED: include SSE in signature
        "ServerSideEncryption": "AES256",
    }

    url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params=params,
        ExpiresIn=300,
        HttpMethod="PUT",
    )

    return jsonify({
        "url": url,
        "key": key,
        "bucket": AWS_BUCKET_NAME,
        "region": AWS_REGION,
    })
```

FRONTEND: `uploadResume` with matching SSE + Content-Type headers
=================================================================
```html
<script>
async function uploadResume(file) {
  try {
    // 1) Get presigned URL (relative path hits your backend)
    const presignRes = await fetch(`/s3/presign?filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type || 'application/pdf')}`, { method: 'POST' });
    const presign = await presignRes.json();
    console.log("🔐 presign payload:", presign);
    if (!presign?.url) { alert('Presign failed'); return; }

    // 2) PUT to S3 with headers that MATCH the signature
    const putRes = await fetch(presign.url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/pdf',
        'x-amz-server-side-encryption': 'AES256'
      }
    });

    const bodyText = await putRes.text();
    console.log('PUT status:', putRes.status, putRes.statusText);
    console.table({
      status: putRes.status,
      'x-amz-bucket-region': putRes.headers.get('x-amz-bucket-region'),
      'x-amz-id-2': putRes.headers.get('x-amz-id-2'),
      'x-amz-request-id': putRes.headers.get('x-amz-request-id'),
      'content-type': putRes.headers.get('content-type')
    });

    if (putRes.status !== 200) {
      try {
        const doc = new DOMParser().parseFromString(bodyText, 'application/xml');
        const Code = doc.getElementsByTagName('Code')[0]?.textContent;
        const Message = doc.getElementsByTagName('Message')[0]?.textContent;
        console.warn('S3 error:', { Code, Message });
      } catch {}
      alert(`Upload failed (${putRes.status}). See console.`);
      return;
    }

    // 3) Notify backend of completion (optional)
    const completePayload = {
      filename: file.name,
      size: file.size,
      type: file.type,
      key: presign.key,
      url: presign.url.split('?')[0]
    };
    await fetch('/apply-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completePayload)
    });

    alert('✅ Resume uploaded!');
  } catch (e) {
    console.error(e);
    alert('Unexpected error — check console.');
  }
}
</script>
```
=======
// ===============================
// Jobstronaut - Resume Upload JS
// ===============================

// ---- CONFIG ----
// upload.js (top of file)
const API_BASE = "https://jobstronaut-backend1.onrender.com"; // ← set this
const PRESIGN_ENDPOINT = "/s3/presign";
const COMPLETE_ENDPOINT = "/apply-complete";
const LOCKED_CONTENT_TYPE = "application/pdf";

// ---- HELPERS ----
function $(sel) {
  const el = document.querySelector(sel);
  if (!el) console.warn(`Missing element for selector: ${sel}`);
  return el;
}
function setStatus(msg) { const s = $("#status"); if (s) s.textContent = msg; }
function setBanner(type, msg) {
  const b = $("#banner");
  if (!b) return;
  b.textContent = msg;
  b.className = ""; // reset
  b.classList.add("banner", type); // e.g. 'success' | 'error' | 'info'
}
async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}

// ---- CORE FLOW ----
async function uploadResume(file, userEmail) {
  if (!file) throw new Error("No file provided");
  if (file.type !== LOCKED_CONTENT_TYPE) {
    // Some browsers set octet-stream; we still enforce PDF to keep it simple
    console.warn("File type was:", file.type, "forcing to application/pdf");
  }

  // 1) Presign from backend (Flask)
  const presignBody = {
    filename: file.name,
    contentType: LOCKED_CONTENT_TYPE,
    email: userEmail || null,
  };

  const { url, key, contentType } = await jsonFetch(API_BASE + PRESIGN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(presignBody),
  });

  // 2) PUT the file directly to S3
  const putRes = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType || LOCKED_CONTENT_TYPE },
  });

  if (!putRes.ok) {
    const errXml = await putRes.text(); // S3 returns XML with <Code>
    console.error("S3 PUT failed:", putRes.status, errXml);
    throw new Error("s3_upload_failed");
  }

  // 3) Notify backend that upload finished (save DB row)
  await jsonFetch(API_BASE + COMPLETE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userEmail || null,
      filename: file.name,
      s3_key: key,
      content_type: contentType || LOCKED_CONTENT_TYPE,
    }),
  });

  return { key };
}

// ---- WIRING ----
function wireUploadForm() {
  const form = $("#resume-form");
  const fileInput = $("#resume");
  const emailInput = $("#email");

  if (!form || !fileInput) {
    console.warn("Missing #resume-form or #resume");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];
    const email = emailInput?.value?.trim() || null;

    try {
      setBanner("info", "Uploading…");
      setStatus("Uploading…");

      const { key } = await uploadResume(file, email);

      setBanner("success", "✅ Resume uploaded! We’ll be in touch soon.");
      setStatus(`Done. S3 key: ${key}`);

      // OPTIONAL: clear input
      // fileInput.value = "";
    } catch (err) {
      console.error(err);
      setBanner("error", "⚠️ Upload failed, please retry.");
      setStatus(err.message || "Upload failed");
    }
  });
}

// ---- INIT ----
document.addEventListener("DOMContentLoaded", wireUploadForm);
>>>>>>> origin/feature/privacy-footer

