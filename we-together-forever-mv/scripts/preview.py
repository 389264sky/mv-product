"""mv-director · 预览：在浏览器里带声音看画面，边看边提意见。

  python -I preview.py <项目> [--port 8000]

打开打印出来的网址：空格播放、←→ 跳小节、D 显示节拍信息、N 在当前时刻提意见。
意见连同时刻、小节、歌词句、镜头一起存进 <项目>/feedback.json；改完一条就把它的 done 改成 true，fix 写改了什么。
只听本机（127.0.0.1）。改了 scene.js / cues.json 刷新页面就能看到，不用重启。
别用 python -m http.server 代替：它存不了意见，也不支持 Range，拖进度条以后声音会从头放。
"""
import argparse, functools, http.server, json, os, re, sys, threading, time
from pathlib import Path

LOCK = threading.Lock()
KEYS = {'t': (int, float), 'bar': int, 'line': int, 'lyric': str, 'shot': str, 'scene': str}


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); self.send_header('Accept-Ranges', 'bytes'); super().end_headers()

    # 支持 Range：服务器不给分段，Chrome 拖进度条以后声音会从头放
    def send_head(self):
        self.left = None
        m = re.fullmatch(r'bytes=(\d+)-(\d*)', self.headers.get('Range', ''))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path): return super().send_head()
        size = os.path.getsize(path); a = int(m[1]); z = min(int(m[2] or size - 1), size - 1)
        if a > z:
            self.send_response(416); self.send_header('Content-Range', f'bytes */{size}'); self.end_headers(); return None
        f = open(path, 'rb'); f.seek(a); self.left = z - a + 1
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {a}-{z}/{size}'); self.send_header('Content-Length', str(self.left)); self.end_headers()
        return f

    def copyfile(self, src, dst):
        try:
            if self.left is None: return super().copyfile(src, dst)
            while self.left > 0 and (buf := src.read(min(65536, self.left))): dst.write(buf); self.left -= len(buf)
        except (ConnectionResetError, BrokenPipeError): pass   # 浏览器拖进度条、刷新时会掐掉没下完的请求，不算错

    def do_POST(self):
        if self.path != '/feedback': return self.send_error(404)
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if not 0 < n <= 65536: raise ValueError('意见太长或是空的')
            got = json.loads(self.rfile.read(n))
            text = got.get('text').strip() if isinstance(got, dict) and isinstance(got.get('text'), str) else ''
            if not text: raise ValueError('意见没写字')
        except (ValueError, UnicodeDecodeError) as e:
            return self.send_error(400, 'Bad feedback', str(e))   # 状态行只能是 latin-1，中文放进 explain（正文）
        item = {k: got[k] for k, ty in KEYS.items() if isinstance(got.get(k), ty) and not isinstance(got.get(k), bool)}
        item.update(text=text, done=False, at=time.strftime('%Y-%m-%d %H:%M'))
        f = Path(self.directory) / 'feedback.json'
        with LOCK:
            try: items = json.loads(f.read_text(encoding='utf-8')) if f.exists() else []
            except ValueError: return self.send_error(500, 'Broken feedback.json', 'feedback.json 坏了，先修好再提')   # 不覆盖坏文件，免得丢掉已有的意见
            item ={'id': max((x.get('id', 0) for x in items), default=0) + 1, **item}
            items.append(item)
            tmp = f.with_suffix('.json.tmp')   # 先写临时文件再换名：写到一半出错不会把已有的意见弄坏
            tmp.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
            os.replace(tmp, f)
        body = json.dumps(item, ensure_ascii=False).encode('utf-8')
        self.send_response(200); self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project'); ap.add_argument('--port', type=int, default=8000)
    a = ap.parse_args()
    root = Path(a.project).resolve()
    if not (root / 'index.html').exists(): sys.exit(f'{root} 里没有 index.html：第一个参数要是项目文件夹')
    Handler.extensions_map = {**Handler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav'}
    h = functools.partial(Handler, directory=str(root))
    try: srv = http.server.ThreadingHTTPServer(('127.0.0.1', a.port), h)
    except OSError: srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)   # 端口被占就随便挑一个空的
    print(f'预览：http://127.0.0.1:{srv.server_address[1]}/   （Ctrl+C 停）', flush=True)
    try: srv.serve_forever()
    except KeyboardInterrupt: pass


if __name__ == '__main__':
    main()
