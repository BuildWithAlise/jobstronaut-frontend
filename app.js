
(() => {
  const API_BASE = (window.__API_BASE || "https://jobstronaut-backend1.onrender.com").replace(/\/+$/,"");

  // Element helpers
  const $ = (sel) => document.querySelector(sel);
  const log = (...a) => { try { console.log(...a); } catch (_) {} };

  // Inputs & buttons (existence-checked so this is drop-in safe)
  const fileInput        = $("#resumeFile");
  const emailInput       = $("#emailInput");
  const uploadBtn        = $("#uploadBtn");
  const waitlistEmail    = $("#waitlistEmail");
  const joinWaitlistBtn  = $("#joinWaitlistBtn");
  const healthBtn        = $("#healthBtn");
  const openApplyBtn     = $("#openApplyBtn");

  // UI feedback helpers
  const toast = (msg) => { try { alert(msg); } catch(_) {} };
  const setBusy = (el, busy, labelBusy, labelIdle) => {
    if (!el) return;
    el.disabled = !!busy;
    if (labelBusy && labelIdle) el.textContent = busy ? labelBusy : labelIdle;
  };

  // --- API helpers -----------------------------------------------------------
  async function apiJSON(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, body };
  }

  // --- HEALTH CHECK ----------------------------------------------------------
  async function handleHealth() {
    setBusy(healthBtn, true, "Checking...", "Check system status");
    try {
      const { ok, status, body } = await apiJSON("/healthz");
      log("[healthz]", status, body);
      toast(ok ? "System OK ✅" : `Health check failed (${status})`);
    } catch (err) {
      console.error(err);
      toast("Health check error");
    } finally {
      setBusy(healthBtn, false, "Checking...", "Check system status");
    }
  }

  // --- WAITLIST --------------------------------------------------------------
  async function handleJoinWaitlist() {
    if (!waitlistEmail) return;
    const email = (waitlistEmail.value || "").trim();
    if (!email) return toast("Enter your email to join the waitlist.");
    setBusy(joinWaitlistBtn, true, "Joining...", "Join waitlist");
    try {
      // 🔁 NEW: correct endpoint
      const { ok, status, body } = await apiJSON("/waitlist", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      log("[waitlist]", status, body);
      if (ok) {
        toast("You're on the waitlist! 🚀");
        try { waitlistEmail.value = ""; } catch(_){}
      } else {
        const msg = (body && body.message) ? body.message : `Join failed (${status})`;
        toast(msg);
      }
    } catch (err) {
      console.error(err);
      toast("Network error joining waitlist.");
    } finally {
      setBusy(joinWaitlistBtn, false, "Joining...", "Join waitlist");
    }
  }

  // --- UPLOAD (PDF → S3 via presign) ----------------------------------------
  async function handleUpload() {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      return toast("Choose a PDF first.");
    }
    const file = fileInput.files[0];
    const email = (emailInput && emailInput.value || "").trim();
    const ct = file.type || "application/pdf";

    if (!/application\/(pdf|x-pdf)/i.test(ct) || !/\.pdf$/i.test(file.name)) {
      return toast("Only PDF files are allowed.");
    }
    if (file.size > 10 * 1024 * 1024) {
      return toast("Max file size is 10MB.");
    }

    setBusy(uploadBtn, true, "Uploading...", "Upload & Submit");

    try {
      // 1) Ask backend for presigned URL
      const presignRes = await apiJSON("/s3/presign", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          contentType: ct,
          email: email || undefined,
        }),
      });
      if (!presignRes.ok) {
        const msg = (presignRes.body && presignRes.body.message) ? presignRes.body.message : "Could not get upload URL.";
        toast(msg);
        return;
      }
      const { url, headers } = presignRes.body || {};
      if (!url) return toast("Upload URL not returned from server.");

      log("[presign] got", url);

      // 2) Upload file directly to S3
      const putRes = await fetch(url, {
        method: "PUT",
        headers: {
          ...(headers || {}),
          "Content-Type": ct,
        },
        body: file,
      });

      log("[upload:PUT] status:", putRes.status);
      if (!putRes.ok) {
        return toast(`Upload failed (${putRes.status}).`);
      }

      toast("Resume uploaded ✅");
      try { fileInput.value = ""; } catch(_){}
      try { if (emailInput) emailInput.value = ""; } catch(_){}

    } catch (err) {
      console.error(err);
      toast("Network error during upload.");
    } finally {
      setBusy(uploadBtn, false, "Uploading...", "Upload & Submit");
    }
  }

  // --- OPTIONAL: Open Apply (placeholder hook) -------------------------------
  function handleOpenApply() {
    // Keep the button alive without breaking layout; implement later.
    toast("Apply flow coming soon ✨");
  }

  // --- BINDINGS --------------------------------------------------------------
  try {
    if (joinWaitlistBtn && waitlistEmail) {
      joinWaitlistBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleJoinWaitlist();
      });
      log("[bind] waitlistBtn + waitlistEmail OK");
    }
    if (healthBtn) {
      healthBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleHealth();
      });
      log("[bind] healthBtn OK");
    }
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleUpload();
      });
      log("[bind] uploadBtn + fileInput OK");
    }
    if (openApplyBtn) {
      openApplyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleOpenApply();
      });
    }
  } catch (err) {
    console.error("binding error", err);
  }
})();
