// ================================
// Jobstronaut V2 Frontend Logic
// ================================

// Auto-pick backend
window.__API_BASE =
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000'
    : 'https://jobstronaut-backend1.onrender.com';

// ==== Upload Binder ====
// ---------- Upload binder (safe, no-UI-change) ----------
(() => {
  // Pick up your API base if you’ve defined it already; fallback to Render.
  const API = window.__API_BASE || 'https://jobstronaut-backend1.onrender.com';

  // Try your known IDs; fall back if they aren’t present.
  const btn    = document.getElementById('uploadBtn') 
              || document.querySelector('[data-action="upload"]')
              || document.querySelector('button[type="submit"]');

  const fileEl = document.getElementById('resumeInput')
              || document.querySelector('input[type="file"]');

  // Optional email field in the left card (don’t break if it’s missing)
  const emailEl = document.getElementById('emailInput')
               || document.querySelector('#email') 
               || document.querySelector('input[type="email"]');

  if (!btn || !fileEl) {
    console.warn('[UPL] Missing upload button or file input. Skipping binder.');
    return;
  }

  async function presign(file, emailOpt) {
    const contentType = file.type || 'application/pdf'; // safe default for PDFs
    const payload = {
      filename: file.name,
      contentType,            // <-- camelCase (backend requires this)
      size: file.size,        // number
      // include email if present & non-empty; server ignores if not used
      ...(emailOpt ? { email: emailOpt } : {})
    };

    const res = await fetch(`${API}/s3/presign`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const txt = await res.text();
    if (!res.ok) {
      console.error('[UPL] presign failed', res.status, txt);
      throw new Error(`presign ${res.status}`);
    }
    try { return JSON.parse(txt); } catch {
      throw new Error('bad_presign_json');
    }
  }

  async function putToS3(url, headers, file) {
    // IMPORTANT: use exactly the signed headers returned by the server.
    const res = await fetch(url, { method: 'PUT', headers, body: file });
    if (!res.ok) throw new Error(`s3_put ${res.status}`);
    return true;
  }

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const file = (fileEl.files && fileEl.files[0]) || null;
    const emailVal = (emailEl && (emailEl.value || '').trim()) || '';

    if (!file) { alert('Choose a PDF first.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB.'); return; }

    try {
      console.log('[UPL] presign start', { name: file.name, size: file.size });
      const { url, headers, key } = await presign(file, emailVal || undefined);
      console.log('[UPL] presign ok', { url, headers, key });

      await putToS3(url, headers || {}, file);
      console.log('[UPL] s3 put ok', key || '(no key returned)');
      alert('Upload complete ✅');
      // optional: clear the file input
      // fileEl.value = '';
    } catch (err) {
      console.error('[UPL] failed:', err);
      alert('Upload failed. Check DevTools → Network for details.');
    }
  });

  console.log('[UPL] Bound to upload button + file input.');
})();


// ==== Waitlist Binder ====
// ==== Robust Upload Binder (safe, independent of waitlist) ====
(() => {
  if (window.__boundUpload) return;
  window.__boundUpload = true;

  const API = window.__API_BASE || '';
  const fileInput = document.getElementById('resumeInput');
  const emailOpt  = document.getElementById('emailInput');

  const btn       = document.getElementById('uploadBtn');

  if (!btn || !fileInput) {
    console.warn('[upload] Missing #uploadBtn or #resumeInput');
    return;
  }

  const isPDF = f => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const maxSz = 10 * 1024 * 1024; // 10 MB

  btn.addEventListener('click', async e => {
    e.preventDefault();
    const file = fileInput.files && fileInput.files[0];
    if (!file) return alert('Choose a PDF first.');
    if (!isPDF(file)) return alert('PDF only.');
    if (file.size > maxSz) return alert('Max 10 MB.');

    try {
      // 1) Request presigned URL
      const pres = await fetch(`${API}/s3/presign`, {
  method: 'POST',
  cache: 'no-store',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: file.name,
    contentType: file.type || 'application/pdf',   // <-- camelCase
    size: file.size,                                // <-- number
    email: (emailOpt && emailOpt.value || '').trim() || undefined
  })
});

      if (!pres.ok) throw new Error(`presign ${pres.status}: ${await pres.text()}`);
      const { url, headers } = await pres.json();
      if (!url) throw new Error('no presign url returned');

      // 2) Upload to S3
      const put = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'x-amz-server-side-encryption': 'AES256',
          ...(headers || {})
        },
        body: file
      });

      if (!put.ok) throw new Error(`S3 PUT ${put.status}: ${await put.text()}`);

      alert("✅ Uploaded! We’ll email you when your resume is parsed.");
      fileInput.value = '';
      if (emailOpt) emailOpt.value = '';

    } catch (err) {
      console.error('[upload] failed:', err);
      alert('Upload failed. Check DevTools → Network for details.');
    }
  }, { passive: false });
})();

