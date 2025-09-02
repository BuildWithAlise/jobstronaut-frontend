# Jobstronaut™ Frontend Static Server
# Author: Alise McNiel
# Copyright (c) 2025 Alise McNiel. All rights reserved.
# This software is part of the Jobstronaut™ project.

from flask import Flask, send_from_directory, jsonify, request
import os

# Serve files from the current working directory (repo root)
STATIC_DIR = os.environ.get("STATIC_DIR", os.getcwd())

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")

@app.get("/healthz")
def healthz():
    return jsonify(status="ok", service="jobstronaut-frontend", cwd=STATIC_DIR), 200

# Serve index.html for root and for any unknown path (SPA-friendly)
@app.get("/")
def index_root():
    return send_from_directory(STATIC_DIR, "index.html")

@app.get("/<path:path>")
def static_proxy(path):
    # If the requested path exists, serve it; else fall back to index.html
    full_path = os.path.join(STATIC_DIR, path)
    if os.path.isfile(full_path):
        return send_from_directory(STATIC_DIR, path)
    # Useful for client-side routing (keeps 200 OK so links work on refresh)
    return send_from_directory(STATIC_DIR, "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
