// 🪐 Jobstronaut Frontend Logic (Stable v10)

document.addEventListener("DOMContentLoaded", () => {
  console.log("[🛰️] Jobstronaut script loaded");

  const uploadForm = document.getElementById("uploadForm");
  const waitlistForm = document.getElementById("waitlistForm");
  const backendStatusText = document.getElementById("backendStatusText");
  const backendStatusFooter = document.getElementById("backendStatusFooter");
  const healthResult = document.getElementById("healthResult");
  const uploadResult = document.getElementById("uploadResult");
  const waitlistResult = document.getElementById("waitlistResult");
  const btnHealth = document.getElementById("btnHealth");

  const BACKEND_URL = "https://jobstronaut-backend1.onrender.com";

  // -------------------------------
  // 🧠 Health Check
  // -------------------------------
  if (btnHealth) {
    btnHealth.addEventListener("click", async () => {
      healthResult.textContent = "Checking...";
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        if (res.ok) {
          healthResult.textContent = "✅ Backend Online";
          healthResult.style.color = "#4ade80";
        } else {
          healthResult.textContent = "⚠️ Backend Error";
          healthResult.style.color = "#f87171";
        }
      } catch (err) {
        healthResult.textContent = "❌ Offline";
        healthResult.style.color = "#f87171";
      }
    });
  }

  // -------------------------------
  // 🚀 Upload Resume
  // -------------------------------
  if (uploadForm) {
    console.log("[bind] upload button bound");

    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById("resumeFile");
      const emailInput = document.getElementById("emailField");
      const file = fileInput?.files[0];
      const email = emailInput?.value || "anonymous";

      if (!file) {
        alert("Please select a file first!");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", email);

      uploadResult.textContent = "🚀 Uploading...";

      try {
        const res = await fetch(`${BACKEND_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);

        const data = await res.json();
        uploadResult.textContent = JSON.stringify(data, null, 2);
        uploadResult.style.color = "#4ade80";
        console.log("✅ Upload success:", data);
      } catch (err) {
        console.error("Upload failed:", err);
        uploadResult.textContent = "❌ Upload failed. Check console for details.";
        uploadResult.style.color = "#f87171";
      }
    });
  }

  // -------------------------------
  // ✉️ Waitlist Form
  // -------------------------------
  if (waitlistForm) {
    console.log("[bind] waitlist button bound");

    waitlistForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("wlEmail")?.value;
      const name = document.getElementById("wlName")?.value || "Anonymous";

      if (!email) {
        alert("Please enter a valid email!");
        return;
      }

      waitlistResult.textContent = "🛰️ Sending...";

      try {
        const res = await fetch(`${BACKEND_URL}/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name }),
        });

        if (!res.ok) throw new Error(`Waitlist failed with status ${res.status}`);

        const data = await res.json();
        waitlistResult.textContent = `✅ ${data.message || "Joined successfully!"}`;
        waitlistResult.style.color = "#4ade80";
        console.log("✅ Waitlist success:", data);
      } catch (err) {
        console.error("Waitlist failed:", err);
        waitlistResult.textContent = "❌ Failed to join waitlist.";
        waitlistResult.style.color = "#f87171";
      }
    });
  }

  // -------------------------------
  // 🩺 Live Backend Status Checker
  // -------------------------------
  async function checkBackendStatus() {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        backendStatusText.textContent = "Online ✅";
        backendStatusText.style.color = "#4ade80";
        backendStatusFooter.textContent = "Online ✅";
        backendStatusFooter.className = "online";
      } else {
        backendStatusText.textContent = "Error ❌";
        backendStatusText.style.color = "#f87171";
        backendStatusFooter.textContent = "Offline ❌";
        backendStatusFooter.className = "offline";
      }
    } catch {
      backendStatusText.textContent = "Offline ❌";
      backendStatusText.style.color = "#f87171";
      backendStatusFooter.textContent = "Offline ❌";
      backendStatusFooter.className = "offline";
    }
  }

  // Run initially + every 10 seconds
  checkBackendStatus();
  setInterval(checkBackendStatus, 10000);
});

