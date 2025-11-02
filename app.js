// === Jobstronaut Mission Control UI Logic ===

// Reuse your existing button logic if needed
document.addEventListener("DOMContentLoaded", () => {
  const healthBtn = document.getElementById("healthBtn");
  if (healthBtn) {
    healthBtn.addEventListener("click", checkSystemStatus);
  }
});

let statusInterval;

// === Overlay Logic ===
async function checkSystemStatus() {
  const overlay = createStatusOverlay();
  const text = document.getElementById("statusText");
  overlay.style.display = "block";
  text.textContent = "Initializing Mission Telemetry...";

  await fetchAndUpdateStatus();

  // Auto-refresh every 10 seconds
  clearInterval(statusInterval);
  statusInterval = setInterval(fetchAndUpdateStatus, 10000);
}

function closeStatus() {
  document.getElementById("statusOverlay").remove();
  clearInterval(statusInterval);
}

function createStatusOverlay() {
  // If already exists, reuse it
  let overlay = document.getElementById("statusOverlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "statusOverlay";
  overlay.style.cssText = `
    display:none;
    position:fixed;
    top:0; left:0;
    width:100%; height:100%;
    background:rgba(10,0,19,0.95);
    color:#f0f0f0;
    font-family:'Orbitron', system-ui, sans-serif;
    text-align:center;
    z-index:9999;
    animation: fadeIn 0.6s ease forwards;
  `;

  overlay.innerHTML = `
    <div style="margin-top:15%;padding:20px;">
      <h1 style="color:#9

