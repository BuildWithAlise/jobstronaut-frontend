/* Jobstronaut frontend helpers (safe — no style/UI changes) */

/** Resolve backend base URL */
(async () => {
  const B = window.__API_BASE || "https://jobstronaut-backend1.onrender.com";

  async function uploadAndSubmit(file, email) {
    try {
      // Step 1: Get presign URL
      const pres = await fetch(`${B}/s3/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `${Date.now()}_${file.name}`,
          contentType: file.type || "application/pdf"
        })
      });

      if (!pres.ok) throw new Error("Failed to get presign");
      const presData = await pres.json();
      const putUrl = presData.url;

      // Step 2: Upload to S3 with required headers
      const putRes = await fetch(putUrl, {
  method: "PUT",
  headers: {
    "Content-Type": file.type || "application/pdf",
    "x-amz-server-side-encryption": "AES256"   // ✅ add this line
  },
  body: file
});


      if (!putRes.ok) {
        const text = await putRes.text();
        throw new Error(`S3 upload failed: ${putRes.status} - ${text}`);
      }
      console.log("✅ Upload successful");

      // Step 3: Call waitlist API
      const wl = await fetch(`${B}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!wl.ok) {
        const text = await wl.text();
        throw new Error(`Waitlist failed: ${wl.status} - ${text}`);
      }

      console.log("✅ Waitlist joined");
      alert("Upload + Waitlist success!");
    } catch (err) {
      console.error("[UPL] error:", err);
      alert("Upload failed. Open DevTools → Network for details.");
    }
  }

  // Bind upload button
  (function ensureBind() {
  const B = window.__API_BASE || "https://jobstronaut-backend1.onrender.com";

  async function uploadAndSubmit(file, email) {
    const ct = file.type || "application/pdf";

    // 1) presign
    const pres = await fetch(`${B}/s3/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `${Date.now()}_${file.name}`,
        contentType: ct
      })
    }).then(r => r.json());

    // 2) PUT to S3 — include SSE header or S3 will 403
    const put = await fetch(pres.url, {
      method: "PUT",
      headers: {
        "Content-Type": ct,
        "x-amz-server-side-encryption": "AES256"
      },
      body: file
    });
    if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);

    // 3) waitlist
    const wl = await fetch(`${B}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!wl.ok) throw new Error(`Waitlist failed: ${wl.status}`);

    alert("✅ Upload + Waitlist success!");
  }

  function bind() {
    const btn = document.querySelector("#uploadBtn");
    const fileEl = document.querySelector("#resumeInput");
    const emailEl = document.querySelector("#emailInput");
    if (!btn || !fileEl || !emailEl) return false;

    if (!btn.__bound) {
      btn.__bound = true;
      btn.addEventListener("click", async () => {
        const file = fileEl.files?.[0];
        const email = (emailEl.value || `beta+${Date.now()}@example.com`).trim();
        if (!file) return alert("Pick a PDF first!");
        await uploadAndSubmit(file, email);
      });
      console.log("[bind] upload button bound");
    }
    return true;
  }

  if (!bind()) {
    document.addEventListener("DOMContentLoaded", bind);
    const iv = setInterval(() => bind() && clearInterval(iv), 300);
    setTimeout(() => clearInterval(iv), 8000);
  }

  // handy manual trigger while testing
  window.__upl = () => {
    const file = document.querySelector("#resumeInput")?.files?.[0];
    const email = document.querySelector("#emailInput")?.value || `beta+${Date.now()}@example.com`;
    if (!file) return alert("Pick a PDF first!");
    return uploadAndSubmit(file, email);
  };
})();

