(() => {
  const API_BASE = "https://jobstronaut-backend1.onrender.com"\; // no trailing slash
  const api = (p) => `${API_BASE}${p.startsWith("/") ? p : "/"+p}`;

  function track(e, p) { try { if (window.plausible) plausible(e, { props: p }); } catch (_) {} }

  function sniffType(file){
    if (file?.type) return file.type;
    const n = (file?.name || '').toLowerCase();
    if (n.endsWith('.pdf'))  return 'application/pdf';
    if (n.endsWith('.doc'))  return 'application/msword';
    if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (n.endsWith('.txt'))  return 'text/plain';
    if (n.endsWith('.rtf'))  return 'application/rtf';
    if (n.endsWith('.odt'))  return 'application/vnd.oasis.opendocument.text';
    return 'application/octet-stream';
  }

  async function uploadResume(file){
    const note = document.getElementById('uploadNote');
    const contentType = sniffType(file);
    if (note) note.textContent = "Uploading…";

    try {
      // 1) presign
      const pre = await fetch(api('/s3/presign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType })
      });
      const preText = await pre.text();
      if (!pre.ok) { console.error('Presign failed:', pre.status, preText); if (note) note.textContent = '❌ Presign failed — see Console.'; return; }

      let data; try { data = JSON.parse(preText); }
      catch(e){ console.error('Presign not JSON:', preText); if (note) note.textContent = '❌ Presign not JSON.'; return; }

      const { url, fields, key } = data || {};
      if (!url) { console.error('Presign missing url:', data); if (note) note.textContent = '❌ Presign missing url.'; return; }

      // 2) upload: support POST (url+fields) or PUT (single url)
      let up, upText;
      if (fields && typeof fields === 'object') {
        // Presigned POST
        const fd = new FormData();
        Object.entries(fields).forEach(([k,v]) => fd.append(k, v));
        fd.append('Content-Type', contentType);
        fd.append('x-amz-server-side-encryption', 'AES256');
        fd.append('file', file);
        up = await fetch(url, { method: 'POST', body: fd });
        upText = await up.text();
      } else {
        // Presigned PUT
        const tryPut = async (headers) => {
          const r = await fetch(url, { method: 'PUT', headers, body: file });
          const t = await r.text();
          return { r, t };
        };
        let headers = { 'Content-Type': contentType, 'x-amz-server-side-encryption': 'AES256' };
        ({ r: up, t: upText } = await tryPut(headers));
        if (!up.ok) {
          delete headers['x-amz-server-side-encryption'];
          ({ r: up, t: upText } = await tryPut(headers));
        }
      }

      console.log('[upload] status:', up.status, '| region:', up.headers.get('x-amz-bucket-region'));
      if (!up.ok) {
        const code = (upText.match(/<Code>([^<]+)<\/Code>/i) || [])[1] || '';
        const msg  = (upText.match(/<Message>([^<]+)<\/Message>/i) || [])[1] || '';
        console.error('[upload] failed:', code, msg, upText);
        if (note) note.textContent = `❌ Upload failed — ${code || 'see Console'}${msg?`: ${msg}`:''}`;
        return;
      }

      // 3) optional notify
      fetch(api('/apply-complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size, contentType, key })
      }).catch(()=>{});

      if (note) note.textContent = '✅ Upload successful!';
      track('resume_upload_success', { size: file.size, type: contentType });
    } catch (err) {
      console.error('Upload crash:', err);
      if (note) note.textContent = '❌ Upload crashed — see Console.';
    }
  }

  // expose for debugging
  window.uploadResume = uploadResume;

  // attach listeners
  window.addEventListener('DOMContentLoaded', () => {
    const btn  = document.getElementById('uploadButton') || document.getElementById('uploadBtn');
    const file = document.getElementById('resumeFile')   || document.getElementById('resumeInput');
    if (btn && file) {
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const f = file.files && file.files[0];
        if (!f) { alert('Please choose a file first.'); return; }
        uploadResume(f);
      });
    }
    // clear any stale SW that might serve old JS
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
    }
    console.log('[jobstronaut] app.js loaded; listeners attached');
  });
})();
