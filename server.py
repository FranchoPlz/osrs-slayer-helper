#!/usr/bin/env python3
"""Serve the built Slayer Helper PWA (dist/). Standard library only, same pattern as osrs_flipper.

Usage: python3 server.py [--host 127.0.0.1] [--port 8766]
"""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "dist"


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json", ".js": "text/javascript", ".json": "application/json"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def send_head(self):
        path = urlsplit(self.path).path
        target = (WEB / path.lstrip("/")).resolve()
        # SPA fallback: unknown non-file routes get index.html
        if WEB not in target.parents and target != WEB or (not target.exists() and "." not in Path(path).name):
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        path = urlsplit(self.path).path
        if path in ("/", "/index.html", "/sw.js", "/registerSW.js", "/manifest.webmanifest"):
            self.send_header("Cache-Control", "no-cache")
        elif path.startswith("/assets/") or path.startswith("/workbox-"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif path.startswith("/data/"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8766)
    a = ap.parse_args()
    if not (WEB / "index.html").exists():
        raise SystemExit(f"{WEB}/index.html missing: run `npm run build` (or pull a release with dist/)")
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"Slayer Helper on http://{a.host}:{a.port}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
