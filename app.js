// ===========================================================
// Jobstronaut™ Frontend — Stable Upload + Waitlist v1
// ===========================================================

console.log("[Jobstronaut] frontend initializing…");

// Use the verified backend endpoint
const BACKEND = "https://jobstronaut-backend1.onrender.com";

// Utility: error handler
function err(e) {
  console.error("Upload/Waitlist error:", e);
  alert("Something went wrong — please retry or check connection.");
}

// Bind once to upload button
function bindOnce() {
  const uploadBtn = document.querySelector("#uploadBtn");
  const resumeInput = document.querySelector("#resumeInput");
  const waitlistBtn = document.querySelector("#waitlistBtn");
  const emailInput = document.querySelector("#emailInput");

  if (uploadBtn && resumeInput) {
    uploadBtn.addEventListener("click", async () => {
      const file = resumeInput.files[0];
      if (!file) return alert("Please choose a file first.");

      try {
        const res = await fetch(`${BACKEND}/s3/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type || "application/pdf",
          }),
        });

        const data = await res.json();
        if (!data.ok) throw new Error("Presign failed");

        const formData = new FormData();
        for (const [k, v] of Object.entries(data.presigned.fields)) {
          formData.append(k, v);
        }
        formData.append("file", file);

        const upload = await fetch(data.presigned.url, {
          method: "POST",
          body: formData,
        });

        if (upload.ok) {
          alert("✅ Resume uploaded successfully!");
        } else {
          throw new Error("Upload error: " + upload.status);
        }
      } catch (e) {
        err(e);
      }
    });
    console.log("[bind] upload button bound");
  }

  if (waitlistBtn && emailInput) {
    waitlistBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email) return alert("Enter an email first.");
      try {
        const res = await fetch(`${BACKEND}/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.ok) alert("✅ Added to waitlist!");
        else throw new Error(data.error || "Waitlist failed");
      } catch (e) {
        err(e);
      }
    });
    console.log("[bind] waitlist button bound");
  }
}

document.addEventListener("DOMContentLoaded", bindOnce);

