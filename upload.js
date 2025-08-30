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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jobstronaut Resume Upload</title>
</head>
<body>
  <h1>🚀 Jobstronaut Resume Upload</h1>
  <form id="resumeForm">
    <input type="file" id="resumeFile" accept="application/pdf" required />
    <button type="submit">Upload Resume</button>
  </form>

  <script>
    const API_BASE = "https://jobstronaut-backend.onrender.com"; // adjust if needed

    document.getElementById("resumeForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = document.getElementById("resumeFile").files[0];
      if (file) {
        await uploadResume(file);
      }
    });

    async function uploadResume(file) {
      try {
        // 1) Get presigned PUT URL
        const presignRes = await fetch(`${API_BASE}/s3/presign?filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}`, {
          method: 'POST'
        });
        const presign = await presignRes.json();
        console.log("🔐 presign payload:", presign);

        if (!presign?.url) {
          console.error("Presign response missing url:", presign);
          alert("Presign failed — check backend logs.");
          return;
        }

        // 2) PUT to S3 (no extra headers for Option A)
        const putRes = await fetch(presign.url, {
          method: 'PUT',
          body: file,
        });

        const rawText = await putRes.text();

        const hdr = {
          status: putRes.status,
          statusText: putRes.statusText,
          'x-amz-id-2': putRes.headers.get('x-amz-id-2'),
          'x-amz-request-id': putRes.headers.get('x-amz-request-id'),
          'x-amz-bucket-region': putRes.headers.get('x-amz-bucket-region'),
          'content-type': putRes.headers.get('content-type')
        };

        function parseS3XmlError(xmlStr) {
          try {
            const doc = new window.DOMParser().parseFromString(xmlStr, "application/xml");
            const get = (tag) => doc.getElementsByTagName(tag)[0]?.textContent || null;
            return {
              Code: get("Code"),
              Message: get("Message"),
              Resource: get("Resource"),
              RequestId: get("RequestId"),
              HostId: get("HostId"),
              Raw: xmlStr?.slice(0, 500)
            };
          } catch (e) {
            return { Code: null, Message: null, Raw: xmlStr?.slice(0, 500) };
          }
        }

        if (putRes.status !== 200) {
          const s3Err = parseS3XmlError(rawText);
          console.group("❌ S3 PUT failed");
          console.table(hdr);
          console.log("📄 S3 XML error:", s3Err);
          console.groupEnd();

          if (s3Err.Code === "AuthorizationHeaderMalformed") {
            console.warn("Hint: Region mismatch. Set AWS_REGION in backend to your bucket’s region shown above (x-amz-bucket-region).”);
          } else if (s3Err.Code === "SignatureDoesNotMatch") {
            console.warn("Hint: Signature mismatch. With Option A (no headers) this is usually region or clock skew.");
          } else if (s3Err.Code === "AccessDenied" || s3Err.Code === "InvalidAccessKeyId") {
            console.warn("Hint: Check IAM policy / access key and bucket permissions.");
          } else if (s3Err.Code === "NoSuchBucket") {
            console.warn("Hint: Bucket name/region typo or wrong account.");
          }

          alert(`Upload failed (${hdr.status}). See console for S3 <Code> and details.`);
          return;
        }

        console.group("✅ S3 PUT success");
        console.table(hdr);
        console.groupEnd();

        // 3) Notify backend
        const key = presign.key || presign.objectKey || null;
        const fileUrl = presign.publicUrl || presign.url?.split("?")[0] || null;

        const completePayload = {
          filename: file.name,
          size: file.size,
          type: file.type,
          key,
          url: fileUrl
        };
        console.log("📬 /apply-complete payload:", completePayload);

        const completeRes = await fetch(`${API_BASE}/apply-complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(completePayload)
        });

        if (!completeRes.ok) {
          const t = await completeRes.text();
          console.error("apply-complete failed:", completeRes.status, t);
          alert("Uploaded to S3, but saving to database failed — check backend logs.");
          return;
        }

        alert("✅ Resume uploaded!");
      } catch (err) {
        console.error("Unexpected error in uploadResume:", err);
        alert("Unexpected error — open the console for details.");
      }
    }
  </script>
</body>
</html>

