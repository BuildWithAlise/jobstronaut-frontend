// ===============================================================
// Jobstronaut™ Frontend Upload Logic (Resilient v2)
// - waits for DOMContentLoaded
// - works whether script is in <head> (defer) or end of <body>
// - safely binds even if elements appear later
// - prevents form submit reloads
// ===============================================================

(function () {
  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }

  function toast(msg, type = 'ok') {
    let el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); el.remove(); }, 3500);
  }

  function bind() {
    const fileInput = document.querySelector('#resume, input[type="file"][name="resume"]');
    const emailInput = document.querySelector('#email, input[type="email"][name="email"]');
    const uploadBtn  = document.querySelector('#uploadBtn, button[data-action="upload"], .upload-btn');
    const form       = document.querySelector('form#uploadForm, form[data-role="upload"]') || uploadBtn?.closest('form');

    // If nothing to bind, try again shortly (in case of late-rendered DOM)
    if (!uploadBtn) {
      setTimeout(bind, 200);
      return;
    }

    // Ensure button doesn't trigger full-page form submit
    if (uploadBtn.tagName === 'BUTTON' && uploadBtn.getAttribute('type') !== 'button') {
      uploadBtn.setAttribute('type', 'button');
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

    function fmtBytes(n) {
      const u=['B','KB','MB','GB']; let i=0; while(n>=1024 && i<u.length-1){ n/=1024; i++; } return n.toFixed(1)+' '+u[i];
    }

    async function handleUpload(e) {
      e && e.preventDefault && e.preventDefault();

      const file = fileInput && fileInput.files && fileInput.files[0];
      const email = emailInput ? emailInput.value : '';

      if (!file) return toast('Choose a PDF first.', 'err');
      if (!/\.pdf$/i.test(file.name)) return toast('Only PDF allowed.', 'err');
      if (file.size > 10 * 1024 * 1024) return toast('Max 10MB.', 'err');

      if (uploadBtn){ uploadBtn.disabled = true; uploadBtn.textContent = 'Uploading…'; }

      try {
        const { url, headers } = await presignUpload(file, email);
        await putToS3(url, headers, file);
        toast('Thanks! We’ll email you when your resume is parsed.', 'ok');
        window.plausible && window.plausible('upload_success', {props:{size: fmtBytes(file.size)}});
        if (fileInput) fileInput.value = '';
      } catch (err) {
        toast(err.message || 'Upload failed.', 'err');
        console.error('[Jobstronaut] Upload error:', err);
      } finally {
        if (uploadBtn){ uploadBtn.disabled = false; uploadBtn.textContent = 'Upload Resume'; }
      }
    }

    // Bind once
    uploadBtn.removeEventListener('click', handleUpload);
    uploadBtn.addEventListener('click', handleUpload);

    // Also intercept form submit if user presses Enter
    if (form) {
      form.addEventListener('submit', handleUpload);
    }

    console.log('[Jobstronaut] Upload button bound.');
  }

  // Inject minimal toast CSS if missing
  ready(function(){
    if (!document.querySelector('style[data-jobstronaut-toast]')) {
      const style = document.createElement('style');
      style.setAttribute('data-jobstronaut-toast','');
      style.textContent = `
      .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(20px);
        padding: 10px 14px; border-radius: 10px; opacity: 0; transition: all .25s ease;
        background: #111; color: #fff; font-weight: 600; z-index: 9999; }
      .toast.ok { background: #0e7c3a; }
      .toast.err { background: #b71c1c; }
      .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }`;
      document.head.appendChild(style);
    }
    bind();
  });
})();