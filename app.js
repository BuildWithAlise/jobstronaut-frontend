/* Jobstronaut frontend helpers (safe — no style/UI changes) */

/** Resolve backend base URL */
(() => {
  const B = "https://jobstronaut-backend1.onrender.com";

  async function presign(file) {
    const ct = file.type || "application/pdf";
    const r = await fetch(`${B}/s3/presign`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ filename: `${Date.now()}_${file.name}`, contentType: ct })
    });
    if (!r.ok) throw new Error("presign " + r.status);
    return { url: (await r.json()).url, ct };
  }

  async function uploadAndSubmit(file, email) {
    const { url, ct } = await presign(file);
    const put = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": ct, "x-amz-server-side-encryption": "AES256" },
      body: file
    });
    if (!put.ok) throw new Error("S3 PUT " + put.status);

    const wl = await fetch(`${B}/waitlist`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ email })
    });
    console.log("waitlist →", wl.status, await wl.text());
    alert("✅ Upload + waitlist done");
  }

  // pick whichever selectors exist on your page
  const btn = document.querySelector("#uploadBtn") || document.querySelector("#uploadSubmit");
  const fileEl = document.querySelector("#resumeInput") || document.querySelector('input[type="file"]');
  const emailEl = document.querySelector("#emailInput") || document.querySelector('input[type="email"]');

  if (btn && fileEl) {
    btn.onclick = async () => {
      const f = fileEl.files?.[0];
      const e = (emailEl?.value || `beta+${Date.now()}@example.com`).trim();
      if (!f) return alert("Pick a PDF first!");
      try { await uploadAndSubmit(f, e); } catch (err) { console.error(err); alert(err.message); }
    };
    console.log("[temp-bind] upload click attached to", btn);
  } else {
    console.warn("[temp-bind] did not find button or file input", { btn, fileEl });
  }

  const wBtn = document.querySelector("#waitlistBtn");
  const wEmail = document.querySelector("#waitlistEmail");
  if (wBtn && wEmail) {
    wBtn.onclick = async () => {
      const e = (wEmail.value || "").trim();
      if (!e) return alert("Enter email");
      const r = await fetch(`${B}/waitlist`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email: e })
      });
      console.log("waitlist-only →", r.status, await r.text());
      alert(r.ok ? "✅ Added to waitlist" : "❌ Waitlist failed");
    };
    console.log("[temp-bind] waitlist click attached to", wBtn);
  }
})();


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

