# Jobstronaut Frontend Deploy Bundle

**What this is:** a tiny Flask static server + Procfile so you can deploy your existing `jobstronaut-frontend` (with `index.html` at the repo root) to Render as a Python web service.

## Files included
- `frontend_server.py` — Flask app that serves everything from the repo root and exposes `/healthz`.
- `Procfile` — Gunicorn entry for Render (`web` process).
- `requirements.txt` — Python deps for Render.

---

## How to use (copy‑paste)

1) **Drop these files** into your `jobstronaut-frontend` repo root (same level as `index.html`).

2) **Commit & push:**
```bash
git add frontend_server.py Procfile requirements.txt
git commit -m "chore: add Flask static server for Render deploy"
git push origin main
```

3) **Create a Render Web Service** (not Static Site):
- **Type:** Web Service
- **Runtime:** Python 3
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn frontend_server:app --bind 0.0.0.0:$PORT`
- **Environment:** leave default (no DB needed).

4) **Health check:**
- Set **Health Check Path** → `/healthz`
- After deploy, open: `https://<your-render-service>.onrender.com/healthz`

5) **Point your domain (optional now / later):**
- Set your CNAME for `jobstronaut.dev` (or subdomain) to the Render service hostname.

---

## ENV tips

- To serve a different directory (rare), set `STATIC_DIR=/path/in/repo`. Defaults to repo root (where `index.html` lives).
- No secret env needed for this server; it’s purely static.

---

## Local test

```bash
# optional venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python frontend_server.py
# visit http://127.0.0.1:8000 and http://127.0.0.1:8000/healthz
```

---

## Checklist for today's ✅ "What's next"

- [ ] Drop in files & push
- [ ] Create Render **Web Service**
- [ ] Health check `/healthz` green
- [ ] Invite testers

> Generated: 2025-09-02T04:13:32
