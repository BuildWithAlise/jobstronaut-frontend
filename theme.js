(function() {
  let manualMode = null;

  function computeMode() {
    if (manualMode) return manualMode;
    const h = new Date().getHours();
    if (h >= 6 && h < 16) return 'pearl';
    if (h >= 16 && h < 20) return 'lunar';
    return 'cosmic';
  }

  function applyMode() {
    const m = computeMode();
    document.body.classList.remove('mode-pearl','mode-lunar','mode-cosmic');
    document.body.classList.add('mode-'+m);
    const icon = m === 'cosmic' ? '🌙' : '☀️';
    document.title = `Jobstronaut — ${m.charAt(0).toUpperCase()+m.slice(1)} Mode`;
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.textContent = icon;
    updateFavicon(icon);
  }

  function updateFavicon(icon) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 32, 40);
    const link = document.querySelector(\"link[rel='icon']\") || document.createElement('link');
    link.rel = 'icon';
    link.href = canvas.toDataURL();
    document.head.appendChild(link);
  }

  function toggleMode() {
    const current = computeMode();
    manualMode = current === 'pearl' ? 'lunar' : current === 'lunar' ? 'cosmic' : 'pearl';
    applyMode();
  }

  function init() {
    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.title = 'Toggle Theme (T)';
    document.body.appendChild(btn);
    btn.addEventListener('click', toggleMode);
    applyMode();
    setInterval(applyMode, 30 * 60 * 1000);
    document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 't') toggleMode(); });
  }

  window.addEventListener('DOMContentLoaded', init);
})();

