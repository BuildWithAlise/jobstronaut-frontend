# ===============================================================
#  Jobstronaut™ Frontend Static Server (Flask)
#  Purpose: serve your built/static frontend (index.html, app.js, assets)
#  Works on Render or local dev. Supports /.well-known/security.txt
# ===============================================================

import os
from datetime import timedelta
from flask import Flask, send_from_directory, request, abort, make_response

# Directory that contains your frontend files (index.html, app.js, etc.)
# By default we serve the current working directory, but you can set STATIC_DIR.
STATIC_DIR = os.environ.get("STATIC_DIR", os.getcwd())

app = Flask(__name__, static_folder=None)

# ---------- Helpers ----------
ASSET_EXTS = (".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".map")

def _cache_headers(resp, path):
    # Long cache for hashed assets, short for html/others
    filename = os.path.basename(path)
    if any(filename.endswith(ext) for ext in ASSET_EXTS):
        # If file name looks hashed (e.g., app.3f2d1.js), cache longer
        long_cache = any("." in part and len(part) >= 6 for part in filename.split("."))
        max_age = 86400 * (30 if long_cache else 1)  # 30 days or 1 day
    else:
        max_age = 60  # 1 minute for html and misc
    resp.headers["Cache-Control"] = f"public, max-age={max_age}"
    return resp

def _serve(path, download_name=None):
    abs_path = os.path.join(STATIC_DIR, path)
    if not os.path.isfile(abs_path):
        abort(404)
    resp = make_response(send_from_directory(STATIC_DIR, path, as_attachment=False, download_name=download_name))
    return _cache_headers(resp, abs_path)

# ---------- Routes ----------

# Well-known (security.txt, etc.)
@app.route("/.well-known/<path:filename>")
def well_known(filename):
    return _serve(os.path.join(".well-known", filename))

# Robots / sitemap shortcuts
@app.route("/robots.txt")
def robots():
    return _serve("robots.txt")

@app.route("/sitemap.xml")
def sitemap():
    return _serve("sitemap.xml")

# Terms / Privacy
@app.route("/terms.html")
def terms():
    return _serve("terms.html")

@app.route("/privacy.html")
def privacy():
    return _serve("privacy.html")

# Asset catch-all (js, css, images, etc.)
@app.route("/assets/<path:filename>")
def assets(filename):
    return _serve(os.path.join("assets", filename))

# Direct file access in root (e.g., app.js, styles.css)
@app.route("/<path:filename>")
def static_files(filename):
    # Prevent path traversal
    if ".." in filename or filename.startswith("/"):
        abort(404)
    return _serve(filename)

# Index
@app.route("/")
def index():
    # Serve index.html from STATIC_DIR
    return _serve("index.html")

# Health
@app.route("/healthz")
def healthz():
    return {"ok": True}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
