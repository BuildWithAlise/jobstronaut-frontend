/*!
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  JOBSTRONAUT — The universe is hiring                           │
 *  │  Frontend V2 upload + console actions                           │
 *  │  (c) 2025 Jobstronaut. AES256 S3 uploads w/ presign             │
 *  └─────────────────────────────────────────────────────────────────┘
 */
(() => {
  // ─────────────────────────────────────────────────────────────────────────────
  // Config
  // ─────────────────────────────────────────────────────────────────────────────
  const API_BASE = "https://jobstronaut-backend1.onrender.com"; // backend base
  const api = (p) => `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // Analytics (cookie-light)
  // ─────────────────────────────────────────────────────────────────────────────
  function track(ev, props) {
    try {
      if (window.plausible) plausible(ev, { props });
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  function sniffType(file) {
    if (!file?.type) return "application/octet-stream";
    const t = (file.type || "").toLowerCase();
    if (t) return t;

    // fallback by extension
    const n = (file?.name || "").toLowerCase();
    if (n.endsWith(".pdf")) return "application/pdf";
    if (n.endsWith(".doc")) return "application/msword";
    if (n.endsWith(".docx"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (n.endsWith(".rtf")) return "application/rtf";
    if (n.endsWith(".txt")) return "text/plain";
    return "application/octet-stream";
  }

  function $(id) {
    return document.getElementById(id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Upload
  // ─────────────────────────────────────────────────────────────────────────────
  async function uploadResume(file) {
    const note = $("uploadNote");
    const contentType = sniffType(file);
    if (note) note.textContent = "Uploading…";

    try {
      // 1) PRESIGN
      const pre = await fetch(api("/s3/presign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType }),
      });

      const preText = await pre.text();
      console.log(
        "[presign] status:",
        pre.status,
        "| ct:",
        pre.headers.get("content-type")
      );
      console.log("[presign] body:", preText.slice(0, 300));

      let data;
      try {
        data = JSON.parse(preText);
      } catch (e) {
        console.error("Presign not JSON:", e, preText);
        if (note) note.textContent = "❌ Presign not JSON.";
        return;
      }

      // accept either `url` or `uploadUrl` (PUT), or `url`+`fields` (POST)
      const url =
        (data && (data.url || data.uploadUrl)) ||
        ""; // presigned endpoint
      const fields = (data && data.fields) || null; // presigned POST fields
      const key =
        (data && (data.key || data.Key || data.objectKey)) || ""; // object key
      const objectUrl = data && (data.objectUrl || data.objectURL); // permanent S3 path (private by default)

      if (!url) {
        console.error("Presign missing url:", data);
        if (note) note.textContent = "❌ Presign missing url.";
        return;
      }

      console.log(
        "[presign] chosen url:",
        url,
        fields ? "(POST)" : "(PUT)"
      );

      // 2) UPLOAD
      if (fields) {
        // Presigned POST
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        fd.append("file", file);

        const up = await fetch(url, { method: "POST", body: fd });
        const body = await up.text();
        console.log(
          "[upload:POST] status:",
          up.status,
          "| region:",
          up.headers.get("x-amz-bucket-region"),
          "| body:",
          body.slice(0, 200)
        );

        if (up.ok) {
          if (note) note.textContent = "✅ Upload successful!";
          track("resume_upload_success", { size: file.size, type: contentType });
          // optional: notify backend we completed
          safeApplyComplete({ key, objectUrl, size: file.size, contentType });
        } else {
          if (note) note.textContent = "❌ Upload failed — see Console.";
        }
      } else {
        // Presigned PUT
        const up = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-amz-server-side-encryption": "AES256",
          },
          body: file,
        });
        const body = await up.text();
        console.log(
          "[upload:PUT] status:",
          up.status,
          "| region:",
          up.headers.get("x-amz-bucket-region"),
          "| body:",
          body.slice(0, 200)
        );

        if (up.ok) {
          if (note) note.textContent = "✅ Upload successful!";
          track("resume_upload_success", { size: file.size, type: contentType });
          // optional: notify backend we completed
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
        body: JSON.stringify(payload || {}),
      }).catch(() => {});
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Command Console actions
  // ─────────────────────────────────────────────────────────────────────────────
  async function joinWaitlist(email) {
    const btn = $("waitlistBtn");
    try {
      btn && (btn.disabled = true);
      const res = await fetch(api("/waitlist/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: (email || "").trim() }),
      });
      const txt = await res.text();
      console.log("[waitlist] status:", res.status, "| body:", txt.slice(0, 200));
      track("waitlist_join", { ok: res.ok });
      if (res.ok) {
        alert("Welcome aboard! You’re on the waitlist.");
      } else {
        alert("Couldn’t join waitlist right now. Try again shortly.");
      }
    } catch (e) {
      console.error("waitlist error:", e);
      alert("Network issue joining the waitlist.");
    } finally {
      btn && (btn.disabled = false);
    }
  }

  async function checkHealth() {
    const btn = $("healthBtn");
    try {
      btn && (btn.disabled = true);
      // Try /healthz first, fall back to /health
      let res = await fetch(api("/healthz")).catch(() => null);
      if (!res) res = await fetch(api("/health")).catch(() => null);
      if (!res) throw new Error("no response");
      const txt = await res.text();
      console.log("[health] status:", res.status, "| body:", txt.slice(0, 200));
      alert(res.ok ? "System is healthy ✅" : "Some systems are unhappy ⚠️");
    } catch (e) {
      console.error("health error:", e);
      alert("Couldn’t contact the status endpoint.");
    } finally {
      btn && (btn.disabled = false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bind UI
  // ─────────────────────────────────────────────────────────────────────────────
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
      healthBtn.addEventListener("click", checkHealth);
    }

    // expose for quick console testing
    window.uploadResume = uploadResume;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }
})();

