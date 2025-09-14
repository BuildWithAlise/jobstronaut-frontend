/* Jobstronaut frontend helpers (safe — no style/UI changes) */

/** Resolve backend base URL */
const API_BASE = (function () {
  if (window.API_BASE) return window.API_BASE;
  if (window.__API_BASE) return window.__API_BASE;
  const host = location.hostname;
  if (host === '127.0.0.1' || host === 'localhost') return 'http://127.0.0.1:5000';
  return 'https://jobstronaut-backend1.onrender.com';
})();

/* ---------------- Waitlist binder ---------------- */
(function bindWaitlist() {
  const btn = document.getElementById('waitlistBtn');
  const input = document.getElementById('waitlistEmail');
  if (!btn || !input || btn.dataset.bound) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = (input.value || '').trim();
    if (!email) return alert('Enter your email first.');
    try {
      const res = await fetch(`${API_BASE}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("🎉 You're on the list!");
      input.value = '';
    } catch (err) {
      console.error('[WL] failed:', err);
      alert('Waitlist failed. Try again.');
    }
  });
  btn.dataset.bound = '1';
  console.log('[Jobstronaut] Waitlist bound.');
})();


/* ---------------- Upload handler ---------------- */
async function uploadAndSubmit() {
  const fileInput  = document.getElementById('resumeFile')
                    || document.getElementById('resumeInput')
                    || document.querySelector('input[type="file"]');
  const emailInput = document.getElementById('emailInput')
                    || document.getElementById('email')
                    || document.querySelector('input[type="email"]');

  const file  = fileInput?.files?.[0];
  const email = (emailInput?.value || '').trim();

  if (!file) {
    alert('Please choose a PDF first!');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('Max 10 MB.');
    return;
  }

  try {
    const presignRes = await fetch(`${API_BASE}/s3/presign`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/pdf',
        size: file.size,
        ...(email ? { email } : {})
      })
    });
    const presignText = await presignRes.text();
    if (!presignRes.ok) {
      console.error('[UPL] presign failed', presignRes.status, presignText);
      throw new Error(`Presign failed: ${presignRes.status}`);
    }
    let presigned;
    try { presigned = JSON.parse(presignText); } catch {
      throw new Error('Bad presign JSON');
    }
    const { url, headers: signedHeaders, key } = presigned;
    if (!url) throw new Error('No presigned URL returned');

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: signedHeaders || {},
      body: file
    });
    if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);

    alert('🚀 Upload successful!');
    console.log('[UPL] stored at:', key || '(no key returned)');
  } catch (err) {
    console.error('[UPL] error:', err);
    alert('Upload failed. Open DevTools → Network for details.');
  }
}

/* ---------------- Bind Upload button ---------------- */
(function bindUploadButton() {
  function doBind() {
    const btn = document.getElementById('uploadBtn')
             || document.querySelector('[data-action="upload"]')
             || document.querySelector('button[type="submit"]');
    if (!btn) {
      console.warn('[Jobstronaut] #uploadBtn not found.');
      return;
    }
    if (btn.dataset.bound) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      uploadAndSubmit();
    });
    btn.dataset.bound = '1';
    console.log('[Jobstronaut] Upload button bound.');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doBind);
  } else {
    doBind();
  }
})();
