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
 // ===== Upload (bind once) =====
(function () {
  if (window.__boundUpload) return; window.__boundUpload = true;

  const api = window.__API_BASE || '';
  const btn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('resume');
  const emailOpt = document.getElementById('email'); // optional

  if (!btn || !fileInput) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();

    const file = fileInput.files && fileInput.files[0];
    if (!file) { alert('Choose a PDF first.'); return; }
    if (file.type !== 'application/pdf') { alert('PDF only.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB.'); return; }

    try {
      // 1) Get presigned PUT
      const pres = await fetch(`${api}/s3/presign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          size: file.size,
          email: (emailOpt && emailOpt.value || '').trim() || undefined
        })
      });
      const { url, headers } = await pres.json();
      if (!pres.ok || !url) throw new Error(`presign failed ${pres.status}`);

      // 2) Upload to S3
      const put = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          // defense-in-depth: match backend’s requirement
          'x-amz-server-side-encryption': 'AES256',
          ...(headers || {})
        },
        body: file
      });
      if (!put.ok) throw new Error(`S3 PUT failed ${put.status}`);

      alert("✅ Uploaded! We’ll email you when it’s parsed.");
      fileInput.value = '';
      if (emailOpt) emailOpt.value = '';
    } catch (err) {
      console.error('[upload] error:', err);
      alert('Upload failed. Try again.');
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
