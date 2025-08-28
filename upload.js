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

