"""লোকালে frontend চালানোর ছোট সার্ভার।

frontend-এর ফাইলগুলো দেখায়, আর /api/* অনুরোধ লোকাল backend-এ পাঠায়,
ঠিক Netlify যেমন Render-এ পাঠায়। তাই backend-এ CORS লাগে না।

    python dev_server.py                 # backend: http://localhost:8002
    python dev_server.py --api https://somiti-kisti-agent.onrender.com
"""
import argparse
import http.server
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent


def make_handler(api: str):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def _proxy(self):
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else None
            headers = {
                k: v for k, v in self.headers.items()
                if k.lower() in ("authorization", "content-type", "accept")
            }
            req = urllib.request.Request(
                api + self.path, data=body, headers=headers, method=self.command
            )
            try:
                with urllib.request.urlopen(req, timeout=120) as res:
                    status, data, ctype = res.status, res.read(), res.headers.get("Content-Type")
            except urllib.error.HTTPError as err:
                status, data, ctype = err.code, err.read(), err.headers.get("Content-Type")
            except urllib.error.URLError:
                status, ctype = 502, "application/json"
                data = b'{"error":"backend_down","message":"backend \\u099a\\u09b2\\u099b\\u09c7 \\u09a8\\u09be"}'
            self.send_response(status)
            if ctype:
                self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _route(self):
            if self.path.startswith("/api/"):
                self._proxy()
            elif self.command == "GET":
                super().do_GET()
            else:
                self.send_error(405)

        do_GET = do_POST = do_PATCH = do_PUT = do_DELETE = _route

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--api", default="http://localhost:8002")
    args = parser.parse_args()
    print(f"frontend: http://localhost:{args.port}  ->  api: {args.api}")
    http.server.ThreadingHTTPServer(
        ("127.0.0.1", args.port), make_handler(args.api.rstrip("/"))
    ).serve_forever()
