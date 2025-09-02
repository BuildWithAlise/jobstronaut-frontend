/*!
 * Jobstronaut addon (waitlist-only, no UI changes) v1
 * - Safe to include AFTER your existing app.js
 * - Does NOT change button text, styling, or disable states
 * - Uses window.__API_BASE if set; otherwise auto-picks for file://
 */

(function(){
  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }
  function $(id){ return document.getElementById(id); }
  function toast(msg){ 
    try {
      // Use existing toast() if your app.js defines it
      if (typeof window.toast === 'function') return window.toast(msg, 'ok');
    } catch(_) {}
    // Fallback (no styling changes)
    console.log('[Jobstronaut] ' + msg);
  }

  var DEFAULT_RENDER_API = 'https://jobstronaut-backend1.onrender.com'; // change if your Render URL differs
  var API_BASE = '';
  if (typeof window.__API_BASE === 'string' && window.__API_BASE.trim()) {
    API_BASE = window.__API_BASE.trim();
  } else if (location.protocol === 'file:' || location.hostname === '' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    API_BASE = DEFAULT_RENDER_API;
  } else {
    API_BASE = ''; // same-origin in prod
  }
  function api(path){ return API_BASE ? (API_BASE + path) : path; }

  async function joinWaitlist(email){
    const res = await fetch(api('/waitlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: (email||'').trim() })
    });
    if (!res.ok){
      let msg='Could not join waitlist.';
      try { const j=await res.json(); msg=j.message||msg; } catch(_){}
      throw new Error(msg);
    }
    return res.json().catch(()=>({ok:true}));
  }

  function bindWaitlist(){
    const wlInput = $('waitlistEmail') || document.querySelector('input[name="waitlistEmail"]');
    const wlBtn   = $('joinWaitlistBtn') || document.querySelector('.join-waitlist-btn, button[data-action="join-waitlist"]');
    const wlForm  = document.querySelector('form#waitlistForm, form[data-role="waitlist"]') || (wlBtn && wlBtn.closest('form'));
    if (!wlBtn){ setTimeout(bindWaitlist, 200); return; }

    async function handleJoin(e){
      e && e.preventDefault && e.preventDefault();
      const email = (wlInput && wlInput.value || '').trim();
      if (!email) return; // keep UX minimal; no alerts
      try{
        await joinWaitlist(email);
        toast("You're on the list! 🚀");
        wlInput && (wlInput.value='');
        try { window.plausible && window.plausible('waitlist_join'); } catch(_){}
      }catch(err){
        console.warn('[Jobstronaut] Waitlist error:', err);
      }
    }

    wlBtn.addEventListener('click', handleJoin);
    wlForm && wlForm.addEventListener('submit', handleJoin);
    console.log('[Jobstronaut] Waitlist addon bound.');
  }

  ready(bindWaitlist);
})();