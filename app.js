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
  function pick(sel){
    const el = document.querySelector(sel);
    if (el) log("Matched", sel, "→", el);
    else log("No match for", sel);
    return el;
  }

  function findTargets(){
    // Try specific -> generic
    const input = pick('#waitlistEmail') ||
                  pick('input[name="waitlistEmail"]') ||
                  pick('input.waitlist') ||
                  pick('input[data-waitlist]');

    const button = pick('#joinWaitlistBtn') ||
                   pick('.join-waitlist-btn') ||
                   pick('button[data-action="join-waitlist"]') ||
                   pick('button.waitlist') ||
                   pick('button');

    // form is optional; used to catch Enter key
    const form = pick('#waitlistForm') ||
                 pick('form[data-role="waitlist"]') ||
                 (button && button.closest && button.closest('form'));

    return { input, button, form };
  }

  function bind(){
    const { input, button, form } = findTargets();

    if (!button) { warn("No button found. Add id='joinWaitlistBtn' OR class='join-waitlist-btn' OR data-action='join-waitlist'"); return false; }
    if (!input)  { warn("No input found. Add id='waitlistEmail' OR name='waitlistEmail' OR class='waitlist' OR data-waitlist"); return false; }

    if (button.__jobstronaut_bound) { log("Already bound, skipping."); return true; }

    const handler = async function(e){
      e && e.preventDefault && e.preventDefault();
      const email = (input && input.value || '').trim();
      log("Click handler fired. Email =", email);
      if (!email) { warn("Empty email — nothing sent."); return; }
      try {
        const out = await joinWaitlist(email);
        log("Success payload:", out);
        if (typeof window.toast === 'function') window.toast("You're on the list! 🚀", "ok");
        input && (input.value = '');
      } catch (err) {
        warn("Handler error:", err);
        if (typeof window.toast === 'function') window.toast("Waitlist failed", "err");
      }
    };

    button.addEventListener('click', handler);
    if (form) { form.addEventListener('submit', handler); log("Form submit bound to handler."); }

    button.__jobstronaut_bound = true;
    log("Bound OK to button:", button, "and input:", input);
    return true;
  }

  // Re-bind if DOM changes
  const mo = new MutationObserver(()=>bind());
  document.addEventListener('DOMContentLoaded', ()=>{
    const ok = bind();
    if (!ok) setTimeout(bind, 300);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
})();