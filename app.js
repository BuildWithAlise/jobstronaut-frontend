/* Jobstronaut frontend helpers (safe — no style/UI changes) */

/** Resolve backend base URL */
const API_BASE = (function () {
  if (window.API_BASE) return window.API_BASE;
  if (window.__API_BASE) return window.__API_BASE;
  const host = location.hostname;
  if (host === '127.0.0.1' || host === 'localhost') return 'http://127.0.0.1:5000';
  return 'https://jobstronaut-backend1.onrender.com';
})();

/* ---------------- Waitlist binder ---------------- */
(function bindWaitlist() {
  const btn = document.getElementById('waitlistBtn');
  const input = document.getElementById('waitlistEmail');
  if (!btn || !input || btn.dataset.bound) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = (input.value || '').trim();
    if (!email) return alert('Enter your email first.');
    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("🎉 You're on the list!");
      input.value = '';
    } catch (err) {
      console.error('[WL] failed:', err);
      alert('Waitlist failed. Try again.');
    }
  });
  btn.dataset.bound = '1';
  console.log('[Jobstronaut] Waitlist bound.');
})();


/* ---------------- Upload handler ---------------- */
async function uploadAndSubmit() {
  const fileInput = document.querySelector('input[type="file"]');
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a PDF before uploading.");
    return;
  }

  console.log("[UPLOAD] Starting upload for:", file.name, file.type);

  // 1. Get presigned URL from backend
  let pres;
  try {
    const resp = await fetch("https://jobstronaut-backend1.onrender.com/s3/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/pdf"
      })
    });

    console.log("[PRESIGN] Status:", resp.status);

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error("Presign failed: " + text);
    }

    pres = await resp.json();
    console.log("[PRESIGN] Response:", pres);
  } catch (err) {
    console.error("[PRESIGN ERROR]", err);
    alert("Presign failed. Check console.");
    return;
  }

  // 2. Upload file directly to S3
  try {
    const putRes = await fetch(putUrl, {
  method: "PUT",
  headers: {
    "Content-Type": file.type || "application/pdf",
    "x-amz-server-side-encryption": "AES256"   // <-- MUST match signed headers
  },
  body: file
});


    console.log("[UPLOAD] PUT status:", putResp.status);

    if (!putResp.ok) {
      const text = await putResp.text();
      throw new Error("S3 upload failed: " + text);
    }
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    alert("Upload failed. Check console.");
    return;
  }

  // 3. Notify backend waitlist (optional step)
  try {
    const wlResp = await fetch("https://jobstronaut-backend1.onrender.com/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: document.querySelector('input[type="email"]').value })
    });

    console.log("[WAITLIST] Status:", wlResp.status);

    if (!wlResp.ok) {
      const text = await wlResp.text();
      throw new Error("Waitlist failed: " + text);
    }

    alert("✅ Upload + waitlist successful!");
  } catch (err) {
    console.error("[WAITLIST ERROR]", err);
    alert("Upload ok, but waitlist failed. Check console.");
  }
}

