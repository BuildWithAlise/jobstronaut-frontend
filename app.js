// ===============================
//  Jobstronaut Frontend Logic
// ===============================

// ===== Jobstronaut Frontend =====

console.log("[bind] script loaded");

// ------------------------------
//  Resume Upload
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

    if (!file) return alert("Please select a file first.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);

    uploadResult.textContent = "⏳ Uploading...";

    try {
      const res = await fetch("https://jobstronaut-backend1.onrender.com/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      uploadResult.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      console.error("Upload failed:", err);
      uploadResult.textContent = "❌ Upload failed: " + err;
    }
  });
}

// ------------------------------
//  Waitlist
// ------------------------------
const waitlistForm = document.getElementById("waitlistForm");
const statusResult = document.getElementById("statusResult");

if (waitlistForm) {
  console.log("[bind] waitlist button bound");
  waitlistForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("WLEmail").value;
    const name = document.getElementById("WLName").value;

    if (!email) return alert("Please enter your email.");

    statusResult.textContent = "⏳ Joining waitlist...";

    try {
      const res = await fetch("https://jobstronaut-backend1.onrender.com/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      statusResult.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      console.error("Waitlist failed:", err);
      statusResult.textContent = "❌ Waitlist failed: " + err;
    }
  });
}

// ------------------------------
//  Check system status
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
    } catch (err) {
      healthResult.textContent = "❌ Error: " + err;
    }
  });
}

// ------------------------------
//  Backend Status Indicator
// ------------------------------
const backendStatusText = document.getElementById("backendStatusText");
const backendURL = "https://jobstronaut-backend1.onrender.com/health";

async function checkBackendStatus() {
  if (!backendStatusText) return;
  try {
    const res = await fetch(backendURL);
    if (res.ok) {
      backendStatusText.textContent = "Online ✅";
      backendStatusText.style.color = "#4ade80"; // green
    } else {
      backendStatusText.textContent = "Error ❌";
      backendStatusText.style.color = "#f87171"; // red
    }
  } catch (err) {
    backendStatusText.textContent = "Offline ❌";
    backendStatusText.style.color = "#f87171";
  }
}

// Initial check + repeat every 10s
checkBackendStatus();
setInterval(checkBackendStatus, 10000);

