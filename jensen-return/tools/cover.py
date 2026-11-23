# 用片子的画法出封面：scene.js 的字、网点、白边函数在 cover.html 里复用
import base64, functools, http.server, io, threading
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', headless=True); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/tools/cover.html')
    pg.wait_for_function('window.ready === true', timeout=60000)
    err = pg.evaluate('window.failed || null'); assert not err, err
    data = pg.evaluate("document.getElementById('c').toDataURL('image/png')"); b.close()
srv.shutdown()
im = Image.open(io.BytesIO(base64.b64decode(data.split(',', 1)[1]))).convert('RGB')
assert im.size == (3840, 2160)
im.resize((1920, 1080), Image.LANCZOS).save(ROOT / 'out/封面.jpg', quality=95, subsampling=0)
print('cover ok')
