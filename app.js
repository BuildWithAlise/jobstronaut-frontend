// ===============================
//  Jobstronaut Frontend Logic
// ===============================

// ===== Jobstronaut Frontend =====

console.log("[bind] Jobstronaut frontend loaded");

// ------------------------------
// 🔔 Toast Notification Helper
// ------------------------------
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="margin-right:6px;">${type === "success" ? "🚀" : "⚠️"}</span>
    ${message}
    <span style="font-size:11px;opacity:0.7;margin-left:8px;">
      ${new Date().toLocaleTimeString()}
    </span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ------------------------------
// 🧾 Resume Upload
// ------------------------------
const uploadForm = document.getElementById("uploadForm");
const uploadResult = document.getElementById("uploadResult");

if (uploadForm) {
  console.log("[bind] upload button bound");
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById("resumeFile");
    const emailInput = document.getElementById("emailField");
    const file = fileInput.files[0];
    const email = emailInput.value || "";

    if (!file) {
      showToast("Please select a file before uploading!", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);

    uploadResult.textContent = "⏳ Uploading...";

    try {
      const res = await fetch("https://jobstronaut-backend1.onrender.com/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed with status " + res.status);

      const data = await res.json();
      showToast("✅ Resume uploaded successfully!", "success");
      uploadResult.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      console.error("Upload failed:", err);
      showToast("❌ Upload failed. Check console for details.", "error");
      uploadResult.textContent = "❌ Upload failed: " + err;
    }
  });
}

// ------------------------------
// 🪐 Waitlist
// ------------------------------
const waitlistForm = document.getElementById("waitlistForm");
const statusResult = document.getElementById("statusResult");

if (waitlistForm) {
  console.log("[bind] waitlist button bound");
  waitlistForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("WLEmail").value;
    const name = document.getElementById("WLName").value;

    if (!email) {
      showToast("Please enter your email first!", "error");
      return;
    }

    statusResult.textContent = "⏳ Joining waitlist...";

    try {
      const res = await fetch("https://jobstronaut-backend1.onrender.com/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      if (!res.ok) throw new Error("Waitlist failed with status " + res.status);

      const data = await res.json();
      showToast("🚀 Added to waitlist successfully!", "success");
      statusResult.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      console.error("Waitlist failed:", err);
      showToast("❌ Waitlist submission failed.", "error");
      statusResult.textContent = "❌ Waitlist failed: " + err;
    }
  });
}

// ------------------------------
// 🩺 Health Check
// ------------------------------
const btnHealth = document.getElementById("btnHealth");
if (btnHealth) {
  btnHealth.addEventListener("click", async () => {
    const healthResult = document.getElementById("healthResult");
    healthResult.textContent = "⏳ Checking backend...";
    try {
      const res = await fetch("https://jobstronaut-backend1.onrender.com/health");
      const data = await res.json();
      healthResult.textContent = JSON.stringify(data, null, 2);
      showToast("🛰️ Backend responded OK", "success");
    } catch (err) {
      healthResult.textContent = "❌ Error: " + err;
      showToast("⚠️ Backend check failed", "error");
    }
  });
}

// ------------------------------
// 🌌 Backend Live Status
// ------------------------------
const backendStatusText = document.getElementById("backendStatusText");
const backendURL = "https://jobstronaut-backend1.onrender.com/health";

async function checkBackendStatus() {
  if (!backendStatusText) return;
  try {
    const res = await fetch(backendURL);
    if (res.ok) {
      backendStatusText.textContent = "Online ✅";
      backendStatusText.style.color = "#4ade80";
    } else {
      backendStatusText.textContent = "Error ❌";
      backendStatusText.style.color = "#f87171";
    }
  } catch {
    backendStatusText.textContent = "Offline ❌";
    backendStatusText.style.color = "#f87171";
  }
}

checkBackendStatus();
setInterval(checkBackendStatus, 10000);

