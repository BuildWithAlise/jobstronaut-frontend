// ===============================================================
// Jobstronaut™ Frontend Upload Logic (Closed Beta)
// Author: Alise McNiel
// ===============================================================

(function() {
  const fileInput = document.querySelector('#resume');
  const emailInput = document.querySelector('#email');
  const uploadBtn = document.querySelector('#uploadBtn');

  // Feedback link analytics
  const feedbackLink = document.querySelector('#feedbackLink');
  if (feedbackLink) {
    feedbackLink.addEventListener('click', () => {
      window.plausible && window.plausible('feedback_open');
    });
  }

  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); el.remove(); }, 3500);
  }

  function fmtBytes(n) {
    const units = ['B','KB','MB','GB'];
    let i = 0;
    while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
    return n.toFixed(1) + ' ' + units[i];
  }

  async function presignUpload(file, email) {
    const res = await fetch('/s3/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        contentType: file.type || 'application/pdf',
        email: (email || '').trim()
      })
    });
    if (!res.ok) {
      let msg = 'Could not start upload.';
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      if (res.status === 413) msg = 'File too large. Max 10MB.';
      if (res.status === 415) msg = 'Only PDF files are allowed.';
      if (res.status === 429) msg = 'Too many requests. Try later.';
      window.plausible && window.plausible('upload_error', {props:{code: res.status}});
      throw new Error(msg);
    }
    return res.json();
  }

  async function putToS3(url, headers, file) {
    const put = await fetch(url, { method: 'PUT', headers, body: file });
    if (!put.ok) throw new Error('Upload failed (S3 PUT).');
  }

  async function handleUpload() {
    const file = fileInput && fileInput.files && fileInput.files[0];
    const email = emailInput ? emailInput.value : '';

    if (!file) return toast('Choose a PDF first.', 'err');
    if (!/\.pdf$/i.test(file.name)) return toast('Only PDF allowed.', 'err');
    if (file.size > 10 * 1024 * 1024) return toast('Max 10MB.', 'err');

    uploadBtn && (uploadBtn.disabled = true);
    uploadBtn && (uploadBtn.textContent = 'Uploading…');

    try {
      const { url, headers } = await presignUpload(file, email);
      await putToS3(url, headers, file);
      toast('Thanks! We’ll email you when your resume is parsed.', 'ok');
      window.plausible && window.plausible('upload_success', {props:{size: fmtBytes(file.size)}});
      // Optional: clear input
      if (fileInput) fileInput.value = '';
    } catch (e) {
      toast(e.message || 'Upload failed.', 'err');
    } finally {
      uploadBtn && (uploadBtn.disabled = false);
      uploadBtn && (uploadBtn.textContent = 'Upload Resume');
    }
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleUpload();
    });
  }

  // Minimal toast styles (inject if not present)
  const style = document.createElement('style');
  style.textContent = `
  .toast {
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(20px);
    padding: 10px 14px; border-radius: 10px; opacity: 0; transition: all .25s ease;
    background: #111; color: #fff; font-weight: 600; z-index: 9999;
  }
  .toast.ok { background: #0e7c3a; }
  .toast.err { background: #b71c1c; }
  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(style);
})();
