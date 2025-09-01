<!-- ===============================================================
     Jobstronaut™ Frontend
     Author: Alise McNiel
     Copyright (c) 2025 Alise McNiel. All rights reserved.
     This software is part of the Jobstronaut™ project.
     Unauthorized copying, modification, or distribution is prohibited.
     =============================================================== -->

/*!
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  JOBSTRONAUT — The universe is hiring                           │
 *  │  Frontend V2 actions: Resume upload, Waitlist, Health checks    │
 *  │  S3 presigned PUT/POST (AES256), Plausible hooks                │
 *  └─────────────────────────────────────────────────────────────────┘
 */
(() => {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────────
  // Backend base URL
  // Set window.__API_BASE in index.html to override at runtime if needed:
  //   <script>window.__API_BASE="https://jobstronaut-backend.onrender.com"</script>
  const API_BASE = (typeof window !== "undefined" && window.__API_BASE) 
    ? window.__API_BASE 
    : "https://jobstronaut-backend1.onrender.com";

  const api = (p) => `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // Analytics (Plausible optional)
  function track(ev, props) {
    try { if (window.plausible) window.plausible(ev, { props }); } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  function $(id) { return document.getElementById(id); }

  function sniffType(file) {
    if (!file) return "application/octet-stream";
    const t = (file.type || "").toLowerCase();
    if (t) return t;
    const n = (file.name || "").toLowerCase();
    if (n.endsWith(".pdf"))  return "application/pdf";
    if (n.endsWith(".doc"))  return "application/msword";
    if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (n.endsWith(".rtf"))  return "application/rtf";
    if (n.endsWith(".txt"))  return "text/plain";
    return "application/octet-stream";
  }

  // Small fetch with timeout
  async function fetchT(input, init, ms = 15000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(input, { ...(init||{}), signal: ctrl.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Resume Upload (supports presigned POST and PUT). AES256 enforced.
  async function uploadResume(file) {
    const note = $("uploadNote");
    const contentType = sniffType(file);
    if (!file) { alert("Choose a resume file first."); return; }
    if (note) note.textContent = "Uploading…";

    try {
      // 1) PRESIGN
      const pre = await fetchT(api("/s3/presign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType })
      }, 20000);

      const preText = await pre.text();
      console.log("[presign] status:", pre.status, "| ct:", pre.headers.get("content-type"));
      console.log("[presign] body:", preText.slice(0, 300));

      let data;
      try {
        data = JSON.parse(preText);
      } catch (e) {
        console.error("Presign not JSON:", e, preText);
        if (note) note.textContent = "❌ Presign not JSON.";
        return;
      }

      const url       = (data && (data.url || data.uploadUrl)) || "";
      const fields    = (data && data.fields) || null;
      const key       = (data && (data.key || data.Key || data.objectKey)) || "";
      const objectUrl = data && (data.objectUrl || data.objectURL);

      if (!url) {
        console.error("Presign missing url:", data);
        if (note) note.textContent = "❌ Presign missing url.";
        return;
      }

      console.log("[presign] chosen url:", url, fields ? "(POST)" : "(PUT)");

      // 2) UPLOAD
      if (fields) {
        // Presigned POST
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        fd.append("file", file);

        const up = await fetchT(url, { method: "POST", body: fd }, 60000);
        const body = await up.text();
        console.log("[upload:POST] status:", up.status, "| region:", up.headers.get("x-amz-bucket-region"), "| body:", body.slice(0, 200));

        if (up.ok) {
          if (note) note.textContent = "✅ Upload successful!";
          track("resume_upload_success", { size: file.size, type: contentType });
          safeApplyComplete({ key, objectUrl, size: file.size, contentType });
        } else {
          if (note) note.textContent = "❌ Upload failed — see Console.";
        }
      } else {
        // Presigned PUT
        const up = await fetchT(url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-amz-server-side-encryption": "AES256"
          },
          body: file
        }, 60000);
        const body = await up.text();
        console.log("[upload:PUT] status:", up.status, "| region:", up.headers.get("x-amz-bucket-region"), "| body:", body.slice(0, 200));

        if (up.ok) {
          if (note) note.textContent = "✅ Upload successful!";
          track("resume_upload_success", { size: file.size, type: contentType });
          safeApplyComplete({ key, objectUrl, size: file.size, contentType });
        } else {
          if (note) note.textContent = "❌ Upload failed — see Console.";
        }
      }
    } catch (err) {
      console.error("Upload exception:", err);
      if (note) note.textContent = "❌ Upload error — see Console.";
    }
  }

  async function safeApplyComplete(payload) {
    try {
      await fetch(api("/apply-complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      }).catch(() => {});
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Waitlist
  async function joinWaitlist(email) {
    const btn = $("waitlistBtn");
    try {
      if (btn) btn.disabled = true;
      const res = await fetchT(api("/waitlist/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: (email || "").trim() })
      }, 15000);
      const txt = await res.text();
      console.log("[waitlist] status:", res.status, "| body:", txt.slice(0, 200));
      track("waitlist_join", { ok: res.ok });
      if (res.ok) alert("Welcome aboard! You’re on the waitlist.");
      else alert("Couldn’t join waitlist right now. Try again shortly.");
    } catch (e) {
      console.error("waitlist error:", e);
      alert("Network issue joining the waitlist.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Quick Ping (used by “Check system status” button)
  async function quickPing() {
    try {
      const h = await fetchT(api("/healthz"), {}, 8000);
      const hText = await h.text();
      console.log("[ping] /healthz", h.status, hText.slice(0, 200));

      const p = await fetchT(api("/s3/presign"), {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ filename: "ping.txt", contentType: "text/plain" })
      }, 10000);
      const pText = await p.text();
      console.log("[ping] /s3/presign", p.status, pText.slice(0, 300));

      const note = $("uploadNote");
      if (note) note.textContent = (h.ok && p.ok) ? "✅ Backend OK" : "⚠️ Some systems unhappy";
    } catch (e) {
      console.error("[ping] error:", e);
      const note = $("uploadNote");
      if (note) note.textContent = "⚠️ Ping error (see Console)";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bind UI
  function bindUI() {
    console.log("[jobstronaut] app.js v3 loaded");

    const uploadBtn = $("uploadBtn");
    const fileInput = $("resumeInput");
    console.log("[jobstronaut] binding: uploadBtn:\n", uploadBtn, "\n fileInput:\n", fileInput);
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", async () => {
        const f = fileInput.files?.[0];
        if (!f) return alert("Choose a PDF resume first.");
        await uploadResume(f);
      });
    }

    const waitlistBtn = $("waitlistBtn");
    const emailInput = $("waitlistEmail");
    console.log("[jobstronaut] binding: waitlistBtn:\n", waitlistBtn, "\n email:\n", emailInput);
    if (waitlistBtn && emailInput) {
      waitlistBtn.addEventListener("click", async () => {
        const email = (emailInput.value || "").trim();
        if (!email) return alert("Enter your email to join the waitlist.");
        await joinWaitlist(email);
      });
    }

    const healthBtn = $("healthBtn");
    console.log("[jobstronaut] binding: statusBtn:\n", healthBtn);
    if (healthBtn) {
      healthBtn.addEventListener("click", quickPing);
    }

    // expose handy functions for console testing
    window.uploadResume = uploadResume;
    window.quickPing = quickPing;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }
})();
