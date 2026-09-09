"""Local static preview with the same extensionless HTML URLs as Vercel."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        resolved = super().translate_path(path)
        if not Path(resolved).exists() and Path(resolved + ".html").is_file():
            return resolved + ".html"
        return resolved


if __name__ == "__main__":
    directory = Path(__file__).resolve().parents[1] / "public"
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4175
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(PreviewHandler, directory=str(directory)))
    print(f"Preview: http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
