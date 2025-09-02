# Jobstronaut – Waitlist Add-on (Keep your old app.js)

This package lets you keep your **existing working `app.js`** for uploads and adds the **waitlist** behavior separately, without changing your button text, classes, or disabled states.

## Files
- `app.addon.waitlist.v2.js` – robust waitlist binder
- `README.md` – these instructions

## How to use
1) Put **both files** in your frontend project root (same folder as `index.html`).
2) In your HTML, load **your original app.js** first, then the add-on:

```html
<!-- Optional: set this only if testing from file:// or localhost and need to hit Render -->
<!-- <script>window.__API_BASE='https://YOUR-BACKEND.onrender.com'</script> -->

<script src="app.js?v=YOUR_EXISTING_VERSION" defer></script>
<script src="app.addon.waitlist.v2.js?v=1" defer></script>
```

3) Make sure your waitlist markup has one of these selectors:
- Button: `#joinWaitlistBtn` **or** `.join-waitlist-btn` **or** `button[data-action="join-waitlist"]` **or** `button.waitlist`
- Input: `#waitlistEmail` **or** `[name="waitlistEmail"]` **or** `input.waitlist` **or** `input[data-waitlist]`
- (Optional) Form: `#waitlistForm` **or** `form[data-role="waitlist"]`

> The add-on finds the first matching elements and binds once. It also re-binds if your DOM is replaced (MutationObserver).

## Backend routes expected
- `POST /waitlist` (preferred) — **or**
- `POST /waitlist/join` — supported by the alias we added in your backend

## Troubleshooting
- **Nothing happens on click** → bump the cache (`?v=1 -> ?v=2`) and hard-refresh (Cmd+Shift+R).
- **404** on `/waitlist` → confirm the backend has the route (we shipped both `/waitlist` and `/waitlist/join`).
- **CORS error from file://** → set `window.__API_BASE` to your Render backend URL before the scripts.
- **Multiple toasts** → ensure the button is only present once or that you aren’t loading the add-on twice.
