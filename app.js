(() => {
  // ===== config =====
  const API_BASE = "https://jobstronaut-backend1.onrender.com"; // no trailing slash
  const api = (p) => `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;

  // loader beacon
  const APP_VER = "v3";
  console.log(`[jobstronaut] app.js ${APP_VER} loaded`);

  // ===== utils =====
  function track(e, p) { try { if (window.plausible) plausible(e, { props: p }); } catch (_) {} }
  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];

  function sniffType(file) {
    if (file && file.type) return file.type;
    const n = (file?.name || "").toLowerCase();
    if (n.endsWith(".pdf"))  return "application/pdf";
    if (n.endsWith(".doc"))  return "application/msword";
    if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (n.endsWith(".txt"))  return "text/plain";
    if (n.endsWith(".rtf"))  return "application/rtf";
    if (n.endsWith(".odt"))  return "application/vnd.oasis.opendocument.text";
    return "application/octet-stream";
  }

  // ===== resume upload =====
  async function uploadResume(file) {
    const note = document.getElementById("uploadNote");
    const contentType = sniffType(file);
    if (note) note.textContent = "Uploading…";

    try {
      // 1) presign
      const pre = await fetch(api("/s3/presign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType })
      });
      const preCT = pre.headers.get("content-type") || "";
      const preText = await pre.text();
      console.log("[presign] status:", pre.status, "| ct:", preCT);
      console.log("[presign] body:", preText.slice(0, 300));

      if (!pre.ok) { if (note) note.textContent = "❌ Presign failed — see Console."; return; }

     // ...after we fetched presign and did:
let data;
try { data = JSON.parse(preText); }
catch (e) { console.error("Presign not JSON:", e, preText); if (note) note.textContent = "❌ Presign not JSON."; return; }

// ✅ add this block exactly here:
const url       = (data && (data.url || data.uploadUrl)) || "";
const fields    = (data && data.fields) || null;
const key       = (data && (data.key || data.Key || data.objectKey)) || "";
const objectUrl = data && (data.objectUrl || data.objectURL);

if (!url) {
  console.error("Presign missing url:", data);
  if (note) note.textContent = "❌ Presign missing url.";
  return;
}
// (optional) debug
console.log("[presign] chosen url:", url);

// ...then the existing upload code runs:
// if (fields) { // presigned POST ... } else { // presigned PUT using `url` ... }

if (/your-bucket-name/i.test(url)) {
  console.error("Presign returned placeholder bucket. Fix backend S3_BUCKET.");
  if (note) note.textContent = "❌ Backend not configured (bucket placeholder).";
  return;
}
else {
        // Presigned PUT
        const tryPut = async (headers) => {
          const r = await fetch(url, { method: "PUT", headers, body: file });
          const t = await r.text();
          return { r, t };
        };
        let headers = { "Content-Type": contentType, "x-amz-server-side-encryption": "AES256" };
        ({ r: up, t: upText } = await tryPut(headers));
        if (!up.ok) {                      // retry once without AES256 if signature didn’t include it
          delete headers["x-amz-server-side-encryption"];
          ({ r: up, t: upText } = await tryPut(headers));
        }
      }

      console.log("[upload] status:", up.status, "| region:", up.headers.get("x-amz-bucket-region"));
      if (!up.ok) {
        const code = (upText.match(/<Code>([^<]+)<\/Code>/i) || [])[1] || "";
        const msg  = (upText.match(/<Message>([^<]+)<\/Message>/i) || [])[1] || "";
        console.error("[upload] failed:", code, msg, upText);
        if (note) note.textContent = `❌ Upload failed — ${code || "see Console"}${msg ? `: ${msg}` : ""}`;
        return;
      }

      // 3) optional notify
      fetch(api("/apply-complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size, contentType, key })
      }).catch(()=>{});

      if (note) note.textContent = "✅ Upload successful!";
      track("resume_upload_success", { size: file.size, type: contentType });
    } catch (err) {
      console.error("Upload crash:", err);
      if (note) note.textContent = "❌ Upload crashed — see Console.";
    }
  }
  // expose for Console/manual trigger
  window.uploadResume = uploadResume;

  // ===== waitlist join =====
  async function joinWaitlist(email) {
    const note = document.getElementById("waitlistNote");
    if (!email || !/\S+@\S+\.\S+/.test(email)) { alert("Enter a valid email."); return; }
    note && (note.textContent = "Submitting…");
    try {
      const r = await fetch(api("/waitlist/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const t = await r.text();
      if (!r.ok) { console.error("[waitlist] failed:", r.status, t); note && (note.textContent = "❌ Failed — see Console"); return; }
      note && (note.textContent = "✅ Joined! Check your email.");
      console.log("[waitlist] ok:", t.slice(0, 200));
    } catch (e) {
      console.error("[waitlist] crash:", e);
      note && (note.textContent = "❌ Failed — see Console");
    }
  }
  window.joinWaitlist = joinWaitlist;

  // ===== check status =====
  async function checkStatus() {
    const candidates = ["/status", "/system/status", "/health", "/api/health"];
    for (const path of candidates) {
      try {
        const r = await fetch(api(path));
        if (r.ok) {
          const ct = r.headers.get("content-type") || "";
          const body = await r.text();
          console.log("[status]", path, "ct:", ct, "| body:", body.slice(0, 400));
          alert(`System status ✓ (${path})`);
          return;
        }
      } catch {}
    }
    alert("Status endpoint not available yet.");
  }
  window.checkStatus = checkStatus;

  // ===== bind buttons (robust selectors) =====
  window.addEventListener("DOMContentLoaded", () => {
    // Resume upload
    const uploadBtn =
      document.getElementById("uploadButton") ||
      document.getElementById("uploadBtn") ||
      qsa("button,[role='button'],input[type='button'],input[type='submit']")
        .find(el => /upload\s*&?\s*submit/i.test(el.textContent || "") || /upload/i.test(el.value || ""));

    const fileInput =
      document.getElementById("resumeFile") ||
      document.getElementById("resumeInput") ||
      qs("input[type='file']");

    console.log("[jobstronaut] binding: uploadBtn:", uploadBtn, "fileInput:", fileInput);

    if (uploadBtn && fileInput) {
      uploadBtn.type = "button";
      uploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const f = fileInput.files && fileInput.files[0];
        if (!f) { alert("Please choose a file first."); return; }
        uploadResume(f);
      });
    }

    // Waitlist (email field + button)
    const waitlistEmail =
      document.getElementById("waitlistEmail") ||
      // fallback: the first input[type=email] inside the right card
      qs("div:has(> h3, > h2):has(> *:matches(#join\\ waitlist, .join-waitlist, .console)) input[type='email']") ||
      qs("input[type='email']");

    const waitlistBtn =
      document.getElementById("joinWaitlistBtn") ||
      qsa("button,[role='button'],input[type='button'],input[type='submit']")
        .find(el => /join\s*waitlist/i.test(el.textContent || ""));

    console.log("[jobstronaut] binding: waitlistBtn:", waitlistBtn, "email:", waitlistEmail);

    if (waitlistBtn && waitlistEmail) {
      waitlistBtn.type = "button";
      waitlistBtn.addEventListener("click", (e) => {
        e.preventDefault();
        joinWaitlist(waitlistEmail.value.trim());
      });
    }

    // Check status
    const statusBtn =
      document.getElementById("checkStatusBtn") ||
      qsa("button,[role='button'],input[type='button'],input[type='submit']")
        .find(el => /check\s*system\s*status/i.test(el.textContent || ""));

    console.log("[jobstronaut] binding: statusBtn:", statusBtn);

    if (statusBtn) {
      statusBtn.type = "button";
      statusBtn.addEventListener("click", (e) => { e.preventDefault(); checkStatus(); });
    }

    // kill stale SW caching old JS
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
    }
  });
})();

