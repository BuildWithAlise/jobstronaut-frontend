/*!
 * Jobstronaut waitlist addon (v2)
 * - No UI mutations (does not change button text/state)
 * - Robust binding with MutationObserver + delegation
 * - Uses window.__API_BASE if set; else same-origin in prod
 */
(function(){
  function ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }
  function $(sel){ return document.querySelector(sel); }

  // --- API base detection ---
  var API_BASE = (typeof window.__API_BASE === 'string' && window.__API_BASE.trim()) ? window.__API_BASE.trim() : '';

  function api(path){ return API_BASE ? (API_BASE + path) : path; }

  async function joinWaitlist(email){
    const res = await fetch(api('/waitlist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: (email||'').trim() })
    });
    if (!res.ok){
      let msg = 'Could not join waitlist.';
      try { const j = await res.json(); msg = j.message || msg; } catch(_){}
      throw new Error(msg);
    }
    return res.json().catch(()=>({ok:true}));
  }

  function getInputs(){
    const input = $('#waitlistEmail') || $('input[name="waitlistEmail"]') || $('input[type="email"].waitlist') || $('input[data-waitlist]');
    const button = $('#joinWaitlistBtn') || $('.join-waitlist-btn') || $('button[data-action="join-waitlist"]') || $('button.waitlist');
    const form = $('#waitlistForm') || $('form[data-role="waitlist"]') || (button && button.closest('form'));
    return {input, button, form};
  }

  function bindOnce(){
    const {input, button, form} = getInputs();
    if (!button){ return false; }
    if (button.__jobstronaut_bound) return true;
    const handler = async function(e){
      e && e.preventDefault && e.preventDefault();
      const email = (input && input.value || '').trim();
      if (!email) return;
      try{
        await joinWaitlist(email);
        try { if (typeof window.toast === 'function') window.toast("You're on the list! 🚀", 'ok'); } catch(_){}
        input && (input.value='');
        try { window.plausible && window.plausible('waitlist_join'); } catch(_){}
      } catch(err){
        console.warn('[Jobstronaut] Waitlist error:', err);
        try { if (typeof window.toast === 'function') window.toast("Waitlist failed", 'err'); } catch(_){}
      }
    };
    button.addEventListener('click', handler);
    if (form) form.addEventListener('submit', handler);
    button.__jobstronaut_bound = true;
    console.log('[Jobstronaut] Waitlist addon v2 bound.');
    return true;
  }

  function installObserver(){
    const obs = new MutationObserver(function(){
      bindOnce();
    });
    obs.observe(document.documentElement, {subtree: true, childList: true});
  }

  ready(function(){
    bindOnce() || setTimeout(bindOnce, 200);
    installObserver();
  });
})();