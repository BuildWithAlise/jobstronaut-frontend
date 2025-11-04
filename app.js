// ===============================
//  Jobstronaut Frontend Logic
// ===============================

// ===== Jobstronaut Frontend =====

// Point to your Render backend. Keep exactly this for your prod domain:
const BACKEND_BASE = "https://jobstronaut-backend.onrender.com";

// Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.headers.get("content-type")?.includes("application/json")
    ? res.json()
    : res.text();
}

function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// Health Button
$("#btnHealth").addEventListener("click", async () => {
  try {
    const text = await fetch(`${BACKEND_BASE}/health`).then(r => r.text());
    $("#healthResult").textContent = text.trim();
    toast("Backend healthy");
  } catch (e) {
    $("#healthResult").textContent = "ERROR";
    toast("Health check failed", "err");
  }
});

// Status Button
$("#btnStatus").addEventListener("click", async () => {
  try {
    const data = await jsonFetch(`${BACKEND_BASE}/status`);
    $("#statusResult").textContent = JSON.stringify(data, null, 2);
    toast("Status loaded");
  } catch (e) {
    $("#statusResult").textContent = e.message || "ERROR";
    toast("Status failed", "err");
  }
});

// Waitlist Form
$("#waitlistForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("#wlEmail").value.trim();
  const name = $("#wlName").value.trim();
  if (!email) {
    toast("Email is required", "err");
    return;
  }
  try {
    const res = await jsonFetch(`${BACKEND_BASE}/waitlist`, {
      method: "POST",
      body: JSON.stringify({ email, name })
    });
    toast(res.message || "Added to waitlist ✅");
    $("#wlEmail").value = "";
    $("#wlName").value = "";
  } catch (e) {
    toast(e.message || "Failed to join", "err");
  }
});

// Resume Upload
$("#resumeInput").addEventListener("change", () => {
  const f = $("#resumeInput").files?.[0];
  $("#resumeName").textContent = f ? f.name : "No file chosen";
});

$("#btnUpload").addEventListener("click", async () => {
  const f = $("#resumeInput").files?.[0];
  if (!f) {
    toast("Pick a file first", "err");
    return;
  }
  const fd = new FormData();
  fd.append("file", f);
  try {
    const res = await fetch(`${BACKEND_BASE}/upload`, {
      method: "POST",
      body: fd,
      credentials: "include"
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    toast("Resume uploaded 🚀");
    $("#uploadResult").textContent = JSON.stringify(data.file, null, 2);
  } catch (e) {
    toast("Upload failed", "err");
    $("#uploadResult").textContent = e.message || "ERROR";
  }
});

// Mission Control quick link
$("#btnAdmin").addEventListener("click", () => {
  const url = `${BACKEND_BASE}/admin?secret=cosmic_access_999`;
  window.open(url, "_blank", "noopener,noreferrer");
});

