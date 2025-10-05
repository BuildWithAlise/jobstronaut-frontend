/* Jobstronaut frontend helpers (safe — no style/UI changes) */

/** Resolve backend base URL */
/* Jobstronaut frontend helpers (safe — no style/UI changes) */

/** Resolve backend base URL */
/* app.js v9 – Jobstronaut Closed Beta (safe bindings + AES256 PUT) */

// at the very top of app.js
const isLocal = ["127.0.0.1", "localhost"].includes(location.hostname);
window.__API_BASE = window.__API_BASE || (isLocal
  ? "http://127.0.0.1:5000"
  : "https://jobstronaut-backend1.onrender.com");
const B = window.__API_BASE;

(() => {
  "use strict";

  const B = (window && window.__API_BASE) || "https://jobstronaut-backend1.onrender.com";

  // tiny helpers
  const q = (s) => document.querySelector(s);
  const ok = (m) => alert(`✅ ${m}`);
  const err = (m, e) => { console.error(m, e); alert(`${m}\n(Check console)`); };

  async function jfetch(url, opts) {
    const r = await fetch(url, opts);
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    return { ok: r.ok, status: r.status, json: j, text: t };
  }

  async function uploadAndWaitlist(file, email) {
    if (!file) throw new Error("No file");
    const ct = file.type || "application/pdf";

    // 1) get presigned PUT url
    const pres = await jfetch(`${B}/s3/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `${Date.now()}_${(file.name || "resume.pdf").replace(/\s+/g, "_")}`,
        contentType: ct
      })
    });
    if (!pres.ok || !pres.json || !pres.json.url) {
      throw new Error(`/s3/presign failed: ${pres.status} ${pres.text}`);
    }

    // 2) PUT with AES256
    const put = await fetch(pres.json.url, {
      method: "PUT",
      headers: {
        "Content-Type": ct,
        "x-amz-server-side-encryption": "AES256"
      },
      body: file
    });
    if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);

    // 3) waitlist
    const wl = await jfetch(`${B}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!wl.ok) throw new Error(`/waitlist failed: ${wl.status} ${wl.text}`);
  }

  async function onlyWaitlist(email) {
    const wl = await jfetch(`${B}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!wl.ok) throw new Error(`/waitlist failed: ${wl.status} ${wl.text}`);
  }

  function bindOnce() {
    const uploadBtn  = q("#uploadBtn") || q("#uploadSubmit");
    const fileInput  = q("#resumeInput") || q("input[type='file']");
    const emailInput = q("#emailInput") || q("input[type='email']");
    const waitBtn    = q("#waitlistBtn") || q(".joinWaitlist");
    const waitEmail  = q("#waitlistEmail") || q("input[name='waitlist']") || q("input[type='email']");

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return alert("Pick a file first!");
          const email = (emailInput && emailInput.value
                          ? emailInput.value
                          : `beta+${Date.now()}@example.com`).trim();
          await uploadAndWaitlist(file, email);
          ok("Upload + waitlist success!");
        } catch (e) { err("Upload failed.", e); }
      });
      console.log("[bind] upload button bound");
    } else {
      console.warn("[bind] upload elements not found");
    }

    if (waitBtn && waitEmail) {
      waitBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const email = (waitEmail.value || "").trim();
          if (!email) return alert("Enter your email.");
          await onlyWaitlist(email);
          ok("Added to waitlist");
        } catch (e) { err("Waitlist failed.", e); }
      });
      console.log("[bind] waitlist button bound");
    } else {
      console.warn("[bind] waitlist elements not found");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce, { once: true });
  } else {
    bindOnce();
  }
})();


