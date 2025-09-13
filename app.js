/*!
 * Jobstronaut waitlist DEBUG add-on (v3)
 * Purpose: tell us EXACTLY why it's not binding/firing.
 * - Zero UI changes
 * - Loud console logs at every step
 */
(function(){
  const log = (...a)=>console.log("%c[Waitlist DEBUG]", "color:#7c3aed;font-weight:bold", ...a);
  const warn = (...a)=>console.warn("%c[Waitlist DEBUG]", "color:#dc2626;font-weight:bold", ...a);

  // ---------- API base ----------
  const API_BASE = (typeof window.__API_BASE === 'string' && window.__API_BASE.trim()) ? window.__API_BASE.trim() : '';
  log("API_BASE =", API_BASE || "(same-origin)");

  function api(path){ return API_BASE ? (API_BASE + path) : path; }

  // ---------- Network ----------
  async function joinWaitlist(email){
    const url = api('/waitlist');
    log("POST", url, { email });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (email||'').trim() })
      });
      const txt = await res.text();
      log("Response", res.status, txt);
      if (!res.ok) throw new Error("HTTP " + res.status);
      try { return JSON.parse(txt); } catch { return { ok: true, raw: txt }; }
    } catch (e) {
      warn("Fetch error:", e);
      throw e;
    }
  }

  // ---------- Selector detection ----------
 // ===== Robust Upload Binder (does not touch waitlist) =====
(() => {
  if (window.__boundUpload) return; window.__boundUpload = true;

  const API = window.__API_BASE || '';
  // Find elements (strict IDs first, then safe fallbacks)
  const fileInput = document.getElementById('resumeInput')
                   || document.querySelector('input[type="file"][accept*="pdf"]');
  const emailOpt  = document.getElementById('email');
  const btn       = document.getElementById('uploadBtn')
                   || document.querySelector('button[data-role="upload"]');

  if (!btn || !fileInput) {
    console.warn('[upload] Missing #uploadBtn or #resumeInput'); 
    return;
  }

  const isPDF = (f) => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const maxSz = 10 * 1024 * 1024; // 10 MB

  btn.addEventListener('click', async (e) => {
    e.preventDefault();

    const file = fileInput.files && fileInput.files[0];
    if (!file)   return alert('Choose a PDF first.');
    if (!isPDF(file)) return alert('PDF only.');
    if (file.size > maxSz) return alert('Max 10 MB.');

    try {
      // 1) presign
      const pres = await fetch(`${API}/s3/presign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          filename: file.name,
          content_type: 'application/pdf',   // be explicit
          size: file.size,
          email: (emailOpt && emailOpt.value || '').trim() || undefined
        })
      });

      if (!pres.ok) {
        const txt = await pres.text().catch(()=>'');
        throw new Error(`presign ${pres.status}: ${txt}`);
      }

      const { url, headers } = await pres.json();
      if (!url) throw new Error('no presign url');

      // 2) PUT to S3 (include both Content-Type and SSE; also include any headers backend returned)
      const put = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'x-amz-server-side-encryption': 'AES256',
          ...(headers || {})
        },
        body: file
      });

      if (!put.ok) {
        const txt = await put.text().catch(()=>'');
        throw new Error(`S3 PUT ${put.status}: ${txt}`);
      }

      alert("✅ Uploaded! We’ll email you when your resume is parsed.");
      fileInput.value = '';
      if (emailOpt) emailOpt.value = '';

    } catch (err) {
      console.error('[upload] failed:', err);
      alert('Upload failed. Check console → Network for details.');
    }
  }, { passive: false });
})();

// ===== Waitlist (bind once) =====
(function () {
  if (window.__boundWL) return; window.__boundWL = true;

  const api = window.__API_BASE || '';
  const btn = document.getElementById('waitlistBtn');
  const input = document.getElementById('waitlistEmail');

  if (!btn || !input) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = (input.value || '').trim();
    if (!email) { alert('Enter your email first.'); return; }

    try {
      const res = await fetch(`${api}/waitlist`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("🎉 You're on the list!");
      input.value = '';
    } catch (err) {
      console.error('[waitlist] error:', err);
      alert('Waitlist failed. Try again.');
    }
  }, { passive: false });
})();


  // Re-bind if DOM changes
  const mo = new MutationObserver(()=>bind());
  document.addEventListener('DOMContentLoaded', ()=>{
    const ok = bind();
    if (!ok) setTimeout(bind, 300);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
