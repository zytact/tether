#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import time


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/tether.rpm":
            super().do_GET()
            return
        payload = b"x" * (2 * 1024 * 1024)
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        for offset in range(0, len(payload), 65536):
            self.wfile.write(payload[offset:offset + 65536])
            self.wfile.flush()
            time.sleep(0.5)


directory = Path(sys.argv[1]).resolve()
directory.mkdir(parents=True, exist_ok=True)
with ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(directory))) as server:
    url = f"http://127.0.0.1:{server.server_port}"
    (directory / "server.url").write_text(url + "\n")
    print(url, flush=True)
    server.serve_forever()
