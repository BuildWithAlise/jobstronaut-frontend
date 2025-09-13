// ================================
// Jobstronaut V2 Frontend Logic
// ================================

// Auto-pick backend
window.__API_BASE =
  (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000'
    : 'https://jobstronaut-backend1.onrender.com';

// ==== Upload Binder ====
(() => {
  if (window.__boundUpload) return;
  window.__boundUpload = true;

  const API = window.__API_BASE;
  const fileInput = document.getElementById('resumeInput');

  const emailOpt = document.getElementById('email');
  const btn = document.getElementById('uploadBtn');

  if (!btn || !fileInput) return;

  const isPDF = f =>
    f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  const maxSz = 10 * 1024 * 1024; // 10 MB

  btn.addEventListener(
    'click',
    async e => {
      e.preventDefault();
      const file = fileInput.files && fileInput.files[0];
      if (!file) return alert('Choose a PDF first.');
      if (!isPDF(file)) return alert('PDF only.');
      if (file.size > maxSz) return alert('Max 10 MB.');

      try {
        // 1) Get presign
        const pres = await fetch(`${API}/s3/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            content_type: 'application/pdf',
            size: file.size,
            email: (emailOpt && emailOpt.value || '').trim() || undefined
          })
        });

        if (!pres.ok) throw new Error(`presign ${pres.status}`);
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

        if (!put.ok) throw new Error(`S3 PUT ${put.status}`);

        alert("✅ Uploaded! We’ll email you when your resume is parsed.");
        fileInput.value = '';
        if (emailOpt) emailOpt.value = '';
      } catch (err) {
        console.error('[upload] failed:', err);
        alert('Upload failed. Check DevTools → Network for details.');
      }
    },
    { passive: false }
  );
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: 'application/pdf',
          size: file.size,
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

