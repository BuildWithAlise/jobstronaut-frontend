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
          "x-amz-server-side-encryption": "AES256"   // ✅ required by presign
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
  function bindUploadButton() {
    const btn = document.querySelector("button#uploadSubmit");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const file = document.querySelector("input[type=file]").files[0];
      const email = document.querySelector("input[type=email]").value;
      if (!file) return alert("Pick a PDF first!");
      await uploadAndSubmit(file, email);
    });
  }

  document.addEventListener("DOMContentLoaded", bindUploadButton);
})();

