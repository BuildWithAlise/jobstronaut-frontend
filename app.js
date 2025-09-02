/*!
 * Jobstronaut Frontend Runtime
 * - Health ping, Waitlist, S3 presign → upload (PUT/POST, AES256)
 * - Minimal, style-agnostic, drop-in
 *
 * Override backend at runtime in HTML if needed:
 *   <script>window.__API_BASE="https://jobstronaut-backend.onrender.com"</script>
 *   <script src="/app.js"></script>
 */
(() => {
  "use strict";

  // ---------- Config ----------
  const API_BASE = (typeof window !== "undefined" && window.__API_BASE)
    ? window.__API_BASE
    : "https://jobstronaut-backend1.onrender.com";
  const api = (p) => `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  function track(ev, props) {
    try { if (window.plausible) window.plausible(ev, { props }); } catch (_) {}
  }

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

  async function fetchT(input, init, ms = 15000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(input, { ...(init||{}), signal: ctrl.signal });
      clearTimeout(t);
      return res;
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  }

  function inferRegionFromUrls({ objectUrl, url }) {
    try {
      const u = new URL(objectUrl || url);
      // bucket.s3.<region>.amazonaws.com or s3.<region>.amazonaws.com
      let m = u.hostname.match(/(?:^|\.)(?:s3)[.-]([a-z0-9-]+)\.amazonaws\.com$/);
      if (m) return m[1];
      // From X-Amz-Credential: AKIA.../YYYYMMDD/<region>/s3/aws4_request
      const cred = u.searchParams.get("X-Amz-Credential");
      if (cred) {
        const parts = cred.split("/");
        if (parts.length >= 3) return parts[2];
      }
    } catch (_e) {}
    return null;
  }

  // ---------- Core: Upload Resume ----------
  async function uploadResume(file) {
    const note = $("uploadNote");
    if (!file) { alert("Choose a resume file first."); return; }
    const contentType = sniffType(file);
    if (note) note.textContent = "Uploading…";

    // 1) Presign
    let pre;
    try {
      pre = await fetchT(api("/s3/presign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType })
      }, 20000);
    } catch (e) {
      console.error("Presign network error:", e);
      if (note) note.textContent = "❌ Network error during presign.";
      return;
    }

    const preText = await pre.text();
    console.log("[presign] status:", pre.status, "| ct:", pre.headers.get("content-type"));
    console.log("[presign] body:", preText.slice(0, 400));
    if (!pre.ok) {
      if (note) note.textContent = "❌ Presign failed — see Console.";
      return;
    }

    let data;
    try { data = JSON.parse(preText); }
    catch (e) {
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

    // 2) Upload
    try {
      if (fields) {
        const fd = new FormData();
        Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
        fd.append("file", file);

        const up = await fetchT(url, { method: "POST", body: fd }, 60000);
        const body = await up.text();
        const region = up.headers.get("x-amz-bucket-region") || inferRegionFromUrls({ objectUrl, url });
        console.log("[upload:POST] status:", up.status, "| region:", region, "| body:", body.slice(0, 200));
        if (!up.ok) throw new Error("Upload (POST) failed");

        // Success popup (POST)
        if (note) note.textContent = "✅ Upload successful!";
        alert("✅ Upload received! We’ll process it and email you.");
        track("resume_upload_success", { size: file.size, type: contentType });
        safeApplyComplete({ key, objectUrl, size: file.size, contentType });

      } else {
        const up = await fetchT(url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType,
            "x-amz-server-side-encryption": "AES256"
          },
          body: file
        }, 60000);
        const body = await up.text();
        const region = up.headers.get("x-amz-bucket-region") || inferRegionFromUrls({ objectUrl, url });
        console.log("[upload:PUT] status:", up.status, "| region:", region, "| body:", body.slice(0, 200));
        if (!up.ok) throw new Error("Upload (PUT) failed");

        // Success popup (PUT)
        if (note) note.textContent = "✅ Upload successful!";
        alert("✅ Upload received! We’ll process it and email you.");
        track("resume_upload_success", { size: file.size, type: contentType });
        safeApplyComplete({ key, objectUrl, size: file.size, contentType });
      }
    } catch (e) {
      console.error("Upload error:", e);
      if (note) note.textContent = "❌ Upload failed — see Console.";
      track("resume_upload_failed", { size: file.size, type: contentType });
      return;
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

  // ---------- Waitlist ----------
  async function joinWaitlist(email) {
    const btn = $("waitlistBtn");
    try {
      if (!email || !/.+@.+\..+/.test(email)) {
        alert("Enter a valid email"); return;
      }
      btn && (btn.disabled = true);
      const res = await fetchT(api("/waitlist/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: (email || "").trim() })
      }, 15000);
      const txt = await res.text();
      console.log("[waitlist] status:", res.status, "| body:", txt.slice(0, 200));
      if (res.ok) alert("You're on the list! 🚀");
      else alert("Couldn’t join waitlist right now. Try again shortly.");
      track("waitlist_join", { ok: res.ok });
    } catch (e) {
      console.error("waitlist error:", e);
      alert("Network issue joining the waitlist.");
      track("waitlist_join", { ok: false });
    } finally {
      btn && (btn.disabled = false);
    }
  }

  // ---------- Quick status ping ----------
  async function quickPing() {
    try {
      const h = await fetchT(api("/healthz"), {}, 8000);
      const ht = await h.text();
      console.log("[ping] /healthz", h.status, ht.slice(0, 200));

      const p = await fetchT(api("/s3/presign"), {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ filename: "ping.txt", contentType: "text/plain" })
      }, 10000);
      const pt = await p.text();
      console.log("[ping] /s3/presign", p.status, pt.slice(0, 300));

      const note = $("uploadNote");
      if (note) note.textContent = (h.ok && p.ok) ? "✅ Backend OK" : "⚠️ Some systems unhappy";
    } catch (e) {
      console.error("[ping] error:", e);
      const note = $("uploadNote");
      if (note) note.textContent = "⚠️ Ping error (see Console)";
    }
  }

  // ---------- Bind UI ----------
  function bindUI() {
    console.log("%c[jobstronaut] app.js loaded", "color:#6cf;font-weight:600;");
    console.log("[API_BASE]", API_BASE);

    const uploadBtn = $("uploadBtn");
    const fileInput = $("resumeInput");
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", async () => {
        const f = fileInput.files?.[0];
        if (!f) return alert("Choose a PDF resume first.");
        await uploadResume(f);
      });
      console.log("[bind] uploadBtn + fileInput OK");
    }

    const waitlistBtn = $("waitlistBtn");
    const waitEmail  = $("waitlistEmail");
    if (waitlistBtn && waitEmail) {
      waitlistBtn.addEventListener("click", () => joinWaitlist(waitEmail.value.trim()));
      console.log("[bind] waitlistBtn + waitlistEmail OK");
    }

    const healthBtn = $("healthBtn");
    if (healthBtn) {
      healthBtn.addEventListener("click", quickPing);
      console.log("[bind] healthBtn OK");
    }

    // Expose for console
    window.uploadResume = uploadResume;
    window.quickPing = quickPing;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }
})();
