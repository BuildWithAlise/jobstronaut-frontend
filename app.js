// ========== Your existing code above stays unchanged ==========


// ---------- Upload binder (safe, no-UI-change) ----------
(() => {
  const API = window.__API_BASE || 'https://jobstronaut-backend1.onrender.com';

  const btn    = document.getElementById('uploadBtn') 
              || document.querySelector('[data-action="upload"]')
              || document.querySelector('button[type="submit"]');

  const fileEl = document.getElementById('resumeInput')
              || document.querySelector('input[type="file"]');

  const emailEl = document.getElementById('emailInput')
               || document.querySelector('#email') 
               || document.querySelector('input[type="email"]');

  if (!btn || !fileEl) {
    console.warn('[UPL] Missing upload button or file input. Skipping binder.');
    return;
  }

  async function presign(file, emailOpt) {
    const contentType = file.type || 'application/pdf';
    const payload = {
      filename: file.name,
      contentType,            // camelCase required by backend
      size: file.size,
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
    } catch (err) {
      console.error('[UPL] failed:', err);
      alert('Upload failed. Check DevTools → Network for details.');
    }
  });

  console.log('[UPL] Bound to upload button + file input.');
})();


// ========== Your existing code below stays unchanged ==========
