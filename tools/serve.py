"""Tiny local web server for the course, with caching turned off so edits always show up.
    python3 tools/serve.py            # then open http://127.0.0.1:8000/
    python3 tools/serve.py 9000       # use another port
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
root = Path(__file__).resolve().parent.parent
handler = partial(NoCache, directory=str(root))
print(f"Serving {root} at http://127.0.0.1:{port}/  (Ctrl+C to stop)")
ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
