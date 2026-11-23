"""mv-director · 渲染：静帧、联系表、成片（多进程并行，60 帧，BT.709）。

在任何地方跑都行，第一个参数是项目文件夹（里面有 index.html、scene.js、song.json、cues.json、audio.wav）：
  python -I render.py <项目> stills bar9 bar13.3 line8 12.5     指定时刻的静帧 → out/stills/，再拼一张联系表
  python -I render.py <项目> shots                              每个镜头正中一张 → out/stills/每镜.jpg（每格约 1000 宽，一页 6 镜）
  python -I render.py <项目> bars                               每小节一张（刚过小节头）→ out/stills/每小节.jpg
  python -I render.py <项目> moments                            每个大时刻前后 6 帧 → out/stills/大时刻.jpg
  python -I render.py <项目> strip line8 1.5                    从第 8 句开唱起 1.5 秒，等间隔 12 帧（--n 改帧数）→ out/stills/连拍.jpg（看动作、镜头运动顺不顺）
  python -I render.py <项目> lines                              每句歌词唱到关键词那一刻一张 → out/stills/逐句.jpg（对着歌词看演没演出来）
  python -I render.py <项目> lines --blind                      同上但不画歌词、标签只写第几句 → out/stills/逐句_盲审.jpg（给没参与制作的子 agent 盲审）
  python -I render.py <项目> determinism                        同一个 t 换个顺序再画一遍，像素必须一样（不一样 = 依赖了上一帧，并行渲染的分段交界会跳）
  python -I render.py <项目> video --draft                      草稿：960×540、30 帧，几分钟出来，用来审节奏
  python -I render.py <项目> video                              成片：1920×1080、60 帧、运动模糊（每帧 4 个子帧，--subframes 1 关掉）→ out/mv.mp4
  python -I render.py <项目> video --master hevc                成片外加母版 out/mv_母版.mov（hevc：10 bit H.265，上传平台用；prores：ProRes 422 HQ，进剪辑软件用；音轨都是无损 PCM）
有 out/blender/plates.json（blender.py frames 渲过）时，Blender 镜头自动用渲好的帧当底图（M.plate）。
出图模式加 --changed：联系表只拼上次出图后变了的帧（渲染是确定性的，没改的镜头不用重看）。
原帧在 out/stills/<图名>/t_*.jpg，每次出图删掉这次没出的旧帧；联系表长边超过 2000 就分页：<图名>_p1.jpg、_p2.jpg…
可选：--debug（画面顶上印 bar / 段落 / 镜头 / 大时刻，审片用，成片别加）  --workers N（默认按 CPU 和内存定：每进程约 1 GB，留 2 GB 给系统）  --from 秒 --to 秒

需要：Python 装了 playwright（python -m playwright install chromium 一次）、Pillow；ffmpeg 在 PATH。
"""
import argparse, base64, concurrent.futures as cf, functools, http.server, json, os, re, shutil, subprocess, sys, threading, time
from pathlib import Path

FF = shutil.which('ffmpeg') or sys.exit('找不到 ffmpeg：先装 ffmpeg 并放进 PATH（见 references/安装.md）')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()


Quiet.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript',
                        '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav'}


def serve(root):
    http.server.ThreadingHTTPServer.request_queue_size = 128   # 默认只排 5 个：几个渲染进程同时开页面、一页几十个文件，会被拒（ERR_CONNECTION_RESET）
    h = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(root)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h.server_address[1]


def open_page(p, root, query):
    args = ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--js-flags=--max-old-space-size=8192']
    try:
        b = p.chromium.launch(channel='chrome', headless=True, args=args)
    except Exception:
        b = p.chromium.launch(headless=True, args=args)
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    def on_console(m):
        url = (m.location or {}).get('url', '') if isinstance(m.location, dict) else ''
        if m.type == 'error' and 'favicon' not in url: errs.append(m.text + (f'（{url}）' if url else ''))
    pg.on('console', on_console)
    port = serve(root)
    if (Path(root) / 'out' / 'blender' / 'plates.json').exists(): query += '&plates'
    pg.goto(f'http://127.0.0.1:{port}/index.html?render' + query)
    t0 = time.time()
    while True:
        st = pg.evaluate('[window.READY === true, window.MV_ERROR || null]')
        if st[1] or errs: b.close(); sys.exit('页面出错了：\n' + (st[1] or '\n'.join(errs[:6])))
        if st[0]: break
        if time.time() - t0 > 300: b.close(); sys.exit('等了 300 秒页面还没准备好（字体、图片太大？setup 卡住？）')
        time.sleep(0.15)
    return b, pg, errs


GRAB = """async ([t, q]) => { if (window.prep) await window.prep(t); const log = window.render(t); const c = document.getElementById('c');
  return [c.toDataURL('image/jpeg', q), log]; }"""


def grab(pg, t, q=0.92):
    data, log = pg.evaluate(GRAB, [t, q])
    return base64.b64decode(data.split(',', 1)[1]), log


MAXPX = 2000   # Claude 读图时长边超过 2000 px 会整张缩小：联系表按这个尺寸分页，格子才不会被缩成缩略图


def sheet(items, out, cols=5, w=None, title=''):
    from PIL import Image, ImageDraw, ImageFont
    for old in out.parent.glob(f'{out.stem}*{out.suffix}'):   # 上次的联系表（单页或分页）先删，免得看到旧图
        if re.fullmatch(re.escape(out.stem) + r'(_p\d+)?', old.stem): old.unlink()
    if not items: return []
    w = w or (MAXPX - (cols - 1) * 6) // cols
    with Image.open(items[0][0]) as im0: h = round(w * im0.height / im0.width)
    top = 40 if title else 0
    NL = chr(10)
    lh = 30 if not any(NL in lab for _, lab in items) else 52     # 标签两行时留高一点
    per = cols * max(1, (MAXPX - top) // (h + lh))
    pages = [items[i:i + per] for i in range(0, len(items), per)]
    font = None
    for fp in [r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf', '/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/Hiragino Sans GB.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
        if Path(fp).exists(): font = ImageFont.truetype(fp, 18); break
    outs = []
    for n, page in enumerate(pages, 1):
        rows = (len(page) + cols - 1) // cols
        S = Image.new('RGB', (cols * w + (cols - 1) * 6, top + rows * (h + lh)), (22, 22, 26))
        d = ImageDraw.Draw(S)
        if title: d.text((8, 8), title + (f'（第 {n}/{len(pages)} 页）' if len(pages) > 1 else ''), fill=(255, 220, 120), font=font)
        for i, (f, label) in enumerate(page):
            x, y = (i % cols) * (w + 6), top + (i // cols) * (h + lh)
            with Image.open(f) as im: S.paste(im.resize((w, h)), (x, y + lh - 2))   # 逐张开关：几百张全帧同时留在内存会 OOM
            for k, part in enumerate(label.split(NL)[:2]):
                while font and len(part) > 4 and d.textlength(part, font=font) > w - 8: part = part[:-2]
                d.text((x + 4, y + 3 + k * 23), part, fill=(240, 210, 140) if k == 0 else (190, 190, 200), font=font)
        o = out if len(pages) == 1 else out.with_name(f'{out.stem}_p{n}{out.suffix}')
        S.save(o, quality=88); outs.append(o)
        print('联系表', o)
    return outs


def changed_px(a, b):
    """两张帧有多少比例的像素明显不一样（和 determinism 同一个标准：差 24 级以上才算）。"""
    import io
    import numpy as np
    from PIL import Image
    if a == b: return 0.0
    A, B = (np.asarray(Image.open(io.BytesIO(x)).convert('RGB'), np.int16) for x in (a, b))
    return 1.0 if A.shape != B.shape else float((np.abs(A - B).max(2) > 24).mean())


def stills(root, times, labels, out_name, debug, cols=5, title='', blind=False, changed=False):
    from playwright.sync_api import sync_playwright
    od = root / 'out' / 'stills' / Path(out_name).stem; od.mkdir(parents=True, exist_ok=True)   # 每种图一个文件夹：原帧按时刻命名，混在一起会拿到别的图、旧版本的帧
    with sync_playwright() as p:
        b, pg, errs = open_page(p, root, '&nolyrics' if blind else '&debug' if debug else '')
        ts = [pg.evaluate('(r) => window.MV.M.ref(r)', x) if isinstance(x, str) else x for x in times]
        items, leaked, new = [], set(), set()
        for t, lab in zip(ts, labels):
            data, log = grab(pg, float(t))
            if blind: leaked.update(e['n'] for e in log)
            f = od / f't_{float(t):07.3f}.jpg'
            if f not in new and (not f.exists() or changed_px(f.read_bytes(), data) > 0): new.add(f); f.write_bytes(data)
            items.append((f, lab or f'{t:.2f}s'))
        b.close()
    for old in set(od.glob('t_*.jpg')) - {f for f, _ in items}: old.unlink()   # 这次没出的时刻是旧帧
    print(f'上次出图后变了 {len(new)}/{len({f for f, _ in items})} 张')
    if changed:
        items = [x for x in items if x[0] in new]
        title = (title + ' · ' if title else '') + '只拼了上次出图后变了的帧'
    if leaked:   # 自动歌词在盲审时不画，还记到歌词 = scene.js 自己画了
        sys.exit(f'✗ 盲审图里还有歌词（line{"、line".join(map(str, sorted(leaked)))}）：scene.js 自己画歌词，没看 M.noLyrics。'
                 '在画歌词（连同译文、引句）的地方加 if (M.noLyrics) return，再重出')
    sheet(items, od.parent / out_name, cols=cols, title=title)
    if errs: print('页面报错：', ' | '.join(errs[:3]))
    return items


PNG = """async (t) => { if (window.prep) await window.prep(t); window.render(t); return document.getElementById('c').toDataURL('image/png'); }"""
DRAW = """async (t) => { if (window.prep) await window.prep(t); window.render(t); }"""   # 渲过 Blender 帧以后，每画一帧都要先读进那一刻的帧


def determinism(root, song):
    """同一个 t 换个顺序再画一遍，像素要一样。不一样 = 画面偷偷依赖了上一帧，多进程渲染时分段交界会跳。"""
    import io
    import numpy as np
    from PIL import Image
    from playwright.sync_api import sync_playwright
    dur = song['dur']
    ts = [round(k * dur, 3) for k in (0.11, 0.37, 0.5, 0.73, 0.93)] + [round(dur - 1 / 60, 3)]
    def shot(pg, t):
        data = pg.evaluate(PNG, t)
        return np.asarray(Image.open(io.BytesIO(base64.b64decode(data.split(',', 1)[1]))).convert('RGB'), np.int16)
    with sync_playwright() as p:
        b, pg, errs = open_page(p, root, '')
        A = []
        for t in ts:
            for k in (3, 2, 1): pg.evaluate(DRAW, max(0, t - k / 60))   # 像成片那样一帧接一帧画到 t
            A.append(shot(pg, t))
        b.close()
        b, pg, errs2 = open_page(p, root, '')
        bad = []
        for i in reversed(range(len(ts))):                    # 新页面、倒着画，每张之前先画一个不相干的时刻
            pg.evaluate(DRAW, (ts[i] * 0.61 + 0.17 * dur) % dur)
            diff = float((np.abs(shot(pg, ts[i]) - A[i]).max(2) > 24).mean())   # 抗锯齿边缘差一两级不算
            if diff > 0.0005: bad.append(f'{ts[i]:.2f}s（{diff * 100:.2f}% 像素不一样）')
        b.close()
    if errs or errs2: sys.exit('页面报错：' + ' | '.join((errs + errs2)[:3]))
    if bad:
        sys.exit('✗ 不确定：' + '、'.join(reversed(bad)) + '\n同一个 t 画两遍不一样。查 scene.js：Math.random()、Date / performance.now()、'
                 '上一帧留下的状态（累加的变量、没清的画布）、CSS 动画、异步加载完得晚。真要用上一帧的状态就改用 M.sim。')
    print(f'✓ 确定：{len(ts)} 个时刻换个顺序重画，像素一致（{"、".join(f"{t:.2f}s" for t in ts)}）')


TAG = ',setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709'   # 只给 -color_* 参数时新版 ffmpeg 只写进 colorspace，原色和传输函数成了 unknown
COLOR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
MASTER = {'hevc': ('scale=in_range=pc:out_range=tv,format=yuv420p10le', ['-c:v', 'libx265', '-preset', 'medium', '-crf', '10', '-tag:v', 'hvc1', '-x265-params', 'log-level=error']),
          'prores': ('scale=in_range=pc:out_range=tv,format=yuv422p10le', ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0'])}


def worker(args):
    root, i0, i1, fps, query, seg, wid, crf, preset, vf, sub, master = args
    from playwright.sync_api import sync_playwright
    root = Path(root)
    mb = '' if sub == 1 else f'tmix=frames={sub},select=not(mod(n+1\\,{sub})),setpts=N/({fps}*TB),'   # 运动模糊：每帧的 sub 个子帧平均成一帧
    cmd = [FF, '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(fps * sub), '-c:v', 'mjpeg', '-i', '-',
           '-vf', mb + vf + 'scale=in_range=pc:out_range=tv,format=yuv420p' + TAG, '-r', str(fps), '-c:v', 'libx264', '-preset', preset, '-crf', str(crf),
           '-g', str(fps * 2), *COLOR, seg]
    if master:   # 同一路帧再编一份母版（ffmpeg 一个输入多个输出，只解一次）
        cmd += ['-vf', mb + vf + MASTER[master][0] + TAG, '-r', str(fps), *MASTER[master][1], *COLOR, seg.replace('.mp4', '_m.mov')]
    logs = []
    with sync_playwright() as p:
        b, pg, errs = open_page(p, root, query)
        if wid == 0:   # 一眼看出 WebGL 有没有用上显卡（SwiftShader = CPU 软件渲染，3D 会慢几十倍）
            gpu = pg.evaluate("(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return '无 WebGL2'; const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER); })()")
            print(f'WebGL：{gpu}' + ('  ⚠ 软件渲染，没用上显卡' if 'SwiftShader' in gpu else ''), flush=True)
            if vf and pg.evaluate("document.getElementById('c').width") <= 1920:   # 项目钉住的旧版 mv.js 把 scale 卡在 1
                print('⚠ 项目的 mv/mv.js 是旧版、不认 scale=2，这次没有超采样；要超采样就从 skill 的 runtime/mv.js 重拷', flush=True)
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        t0 = time.time(); last = t0
        cuts = [s['t0'] for s in pg.evaluate('window.MV_INFO().shots')] if sub > 1 else []
        for i in range(i0, i1):
            t = i / fps
            span = min([0.5 / fps] + [c - t for c in cuts if c > t + 1e-6])   # 半帧快门，不跨过切镜：硬切不会糊成半帧叠化
            for k in range(sub):
                data, log = grab(pg, t + k * span / sub, 0.93)
                ff.stdin.write(data)
                if k == 0: logs.append(log)
            if time.time() - last > 15:
                last = time.time(); print(f'  [进程{wid}] {i - i0}/{i1 - i0} 帧，{last - t0:.0f} 秒', flush=True)
            if errs: break
        ff.stdin.close(); ff.wait(); b.close()
        if errs: return wid, None, '页面报错：' + ' | '.join(errs[:3])
    return wid, logs, None


def video(root, a):
    info_dur = json.loads((root / 'song.json').read_text(encoding='utf-8'))['dur']
    fps = 30 if a.draft else a.fps
    dsf = 1 if a.draft else min(2, max(1, a.dsf))   # 运行库的 scale 最多到 2
    vf = '' if dsf == 1 else 'scale=1920:1080:flags=lanczos,'
    sub = 1 if a.draft else max(1, a.subframes)
    t_from, t_to = a.__dict__['from'] or 0.0, a.to or info_dur
    n0, n1 = int(round(t_from * fps)), int(round(t_to * fps))
    try: mem = os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') / 2 ** 30
    except (AttributeError, ValueError, OSError): mem = 64                    # Windows 没有 sysconf，不按内存限
    # 每个进程（Chrome + x264）实测：1080p 约 1.0 GB，2× 超采样约 1.2 GB；再给系统留 2 GB
    per = 1.25 if dsf > 1 else 1
    nw = max(1, min(a.workers or max(1, min(max(2, min(8, (os.cpu_count() or 4) // 3)), int((mem - 2) / per))), (n1 - n0) // 30 or 1))
    query = ('&scale=0.5' if a.draft else ('' if dsf == 1 else f'&scale={dsf:g}')) + ('&debug' if a.debug else '')
    od = root / 'out'; od.mkdir(exist_ok=True); tmp = od / '_seg'; tmp.mkdir(exist_ok=True)
    edges = [n0 + (n1 - n0) * k // nw for k in range(nw + 1)]
    jobs = [(str(root), edges[k], edges[k + 1], fps, query, str(tmp / f'seg{k:02d}.mp4'), k, 22 if a.draft else 15, 'veryfast' if a.draft else 'medium', vf, sub, None if a.draft else a.master) for k in range(nw)]
    print(f'渲染 {t_from:.2f}–{t_to:.2f} 秒，{n1 - n0} 帧 · {fps} 帧/秒 · {"草稿 960×540" if a.draft else "1920×1080" + ("（2× 超采样：3840×2160 渲、缩回 1080p）" if dsf > 1 else "")} · {nw} 个进程并行' + (f' · 运动模糊（每帧 {sub} 个子帧）' if sub > 1 else ''))
    T = time.time()
    logs = [None] * nw
    with cf.ProcessPoolExecutor(nw) as ex:
        for wid, lg, err in ex.map(worker, jobs):
            if err: sys.exit(f'进程 {wid} 失败：{err}')
            logs[wid] = lg
    print(f'画面渲完，用了 {time.time() - T:.0f} 秒')
    lst = tmp / 'list.txt'
    lst.write_text(''.join(f"file '{(tmp / f'seg{k:02d}.mp4').as_posix()}'\n" for k in range(nw)), encoding='utf-8')
    name = a.out or ('mv_草稿.mp4' if a.draft else 'mv.mp4')
    out = od / name
    cmd = [FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-ss', f'{t_from:.4f}', '-i', str(root / 'audio.wav'),
           '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', f'{(n1 - n0) / fps:.4f}', '-movflags', '+faststart', str(out)]
    subprocess.run(cmd, check=True)
    if a.master and not a.draft:
        lst.write_text(''.join(f"file '{(tmp / f'seg{k:02d}_m.mov').as_posix()}'\n" for k in range(nw)), encoding='utf-8')
        cmd[cmd.index('aac'):cmd.index('256k') + 1] = ['pcm_s24le']
        cmd[cmd.index('+faststart') + 1] = str(od / 'mv_母版.mov')
        subprocess.run(cmd, check=True)
        print(f'母版：{od / "mv_母版.mov"}')
    flat = [x for lg in logs for x in lg]
    (od / ('textlog_草稿.json' if a.draft else 'textlog.json')).write_text(json.dumps({'fps': fps, 'from': t_from, 'frames': flat}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for f in tmp.iterdir(): f.unlink()
    tmp.rmdir()
    print(f'写好了 {out}（{(n1 - n0) / fps:.2f} 秒，用时 {time.time() - T:.0f} 秒）。下一步：python -I check.py {root} {"--draft" if a.draft else ""}')


def mv_info(root):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b, pg, _ = open_page(p, root, '')
        info = pg.evaluate('window.MV_INFO()'); b.close()
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project'); ap.add_argument('mode', choices=['stills', 'strip', 'shots', 'bars', 'moments', 'lines', 'video', 'determinism'])
    ap.add_argument('times', nargs='*')
    ap.add_argument('--draft', action='store_true'); ap.add_argument('--debug', action='store_true')
    ap.add_argument('--blind', action='store_true', help='只配 lines：不画歌词，出 逐句_盲审.jpg')
    ap.add_argument('--changed', action='store_true', help='出图模式：联系表只拼上次出图后变了的帧')
    ap.add_argument('--fps', type=int, default=60); ap.add_argument('--workers', type=int)
    ap.add_argument('--dsf', type=float, default=2, help='成片超采样倍数（默认 2：3840×2160 渲染后 lanczos 降到 1080p；1 = 不超采样）。草稿不超采样')
    ap.add_argument('--subframes', type=int, default=4, help='成片每帧渲几个子时刻、平均成运动模糊（半帧快门；1 = 不做）。草稿不做')
    ap.add_argument('--master', choices=['hevc', 'prores'], help='只配成片：再出一份母版 out/mv_母版.mov（hevc：10 bit H.265；prores：ProRes 422 HQ；音轨无损）')
    ap.add_argument('--n', type=int, default=12, help='只配 strip：出几帧')
    ap.add_argument('--from', type=float); ap.add_argument('--to', type=float); ap.add_argument('--out')
    a = ap.parse_args()
    root = Path(a.project).resolve()
    for need in ['index.html', 'scene.js', 'song.json', 'cues.json']:
        if not (root / need).exists(): sys.exit(f'项目里缺 {need}：先跑 new_project.py，或检查第一个参数是不是项目文件夹')
    if a.mode == 'video' and not (root / 'audio.wav').exists():   # 本地补丁：别等所有帧渲完、合成音轨时才报缺
        sys.exit('项目里缺 audio.wav：成片要把它混进视频。它是第 0 步（new_project.py）的产出、不进 git：重跑第 0 步，或把那次的 audio.wav 拷进项目')
    if a.mode == 'video': return video(root, a)
    song = json.loads((root / 'song.json').read_text(encoding='utf-8'))
    if a.mode == 'determinism': return determinism(root, song)
    if a.mode == 'stills':
        if not a.times: sys.exit('stills 后面写时刻：bar9 bar13.3 line8 12.5')
        ts = [x if not x.replace('.', '', 1).isdigit() else float(x) for x in a.times]
        stills(root, ts, [str(x) for x in a.times], '静帧.jpg', a.debug, cols=2, changed=a.changed)
    elif a.mode == 'strip':
        if len(a.times) != 2 or a.n < 2: sys.exit('strip 后面写起点和秒数：strip line8 1.5（从第 8 句开唱起 1.5 秒，等间隔出 --n 帧）')
        step = float(a.times[1]) / (a.n - 1)
        stills(root, [f'{a.times[0]}+{k * step:.3f}s' for k in range(a.n)], [f'{a.times[0]} +{k * step:.2f}s' for k in range(a.n)], '连拍.jpg', a.debug, cols=4, changed=a.changed,
               title='连拍：同一段时间等间隔的帧。姿势过渡顺不顺、脚滑不滑、有没有跳帧、镜头起停硬不硬')
    elif a.mode == 'shots':
        shots = mv_info(root)['shots']
        ts = [min(song['dur'] - 0.01, (s['t0'] + s['t1']) / 2) for s in shots]
        labs = [f'{s["id"]} · {s["scene"]}  {s["t0"]:.2f}–{s["t1"]:.2f}s' for s in shots]
        stills(root, ts, labs, '每镜.jpg', a.debug, cols=2, changed=a.changed,
               title='每镜一张（镜头正中）：看构图、画风、人物；脸、手、材质、细线再看原帧 out/stills/每镜/t_*.jpg')
    elif a.mode == 'lines':
        cues = json.loads((root / 'cues.json').read_text(encoding='utf-8'))
        board = {int(b['line']): b for b in cues.get('board', []) if 'line' in b}
        ts, labs = [], []
        for L in song['lines']:
            if L['t0'] >= song['dur'] - 0.2: continue
            b = board.get(L['n'], {})
            keys = b.get('keys') or []
            pts = [f'line{L["n"]}@{k}' for k in keys] or [f'line{L["n"]}']
            for r_ in pts:
                ts.append(r_ + '+0.25s'); labs.append(f'line{L["n"]}「{L["text"]}」 唱到「{r_.split("@")[-1] if "@" in r_ else "开头"}」' + (chr(10) + f'要看到：{b.get("see", "")}' if b else ''))
        if a.blind:   # 不画歌词，标签只留第几句：给没看过歌词的子 agent 看
            stills(root, ts, [r_.split('@')[0].split('+')[0] for r_ in ts], '逐句_盲审.jpg', False, cols=3, changed=a.changed,
                   title='一支 MV 按时间顺序的画面，标签是第几句歌词（同一句可能有好几张）', blind=True)
        else:
            stills(root, ts, labs, '逐句.jpg', a.debug, cols=3, changed=a.changed, title='逐句：每张是唱到这个词后 0.25 秒。遮住歌词只看图，能看出歌词说的东西吗？看不出 = 没演出来')
    elif a.mode == 'bars':
        ds = [d for d in song['downbeats'] if 0 <= d < song['dur']]
        ts = [d + 0.07 for d in ds]
        labs = [f'bar{round((d - song["first_downbeat"]) / song["bar"]) + 1}  {d:.2f}s' for d in ds]
        stills(root, ts, labs, '每小节.jpg', a.debug, cols=6, changed=a.changed, title='每小节刚过小节头一帧：相邻几张长得差不多 = 这几小节画面没变化')
    else:
        ms = mv_info(root)['moments'] or []
        if not ms: sys.exit('卡点表里还没有 moments')
        offs = [-0.2, 0.0, 0.05, 0.15, 0.35, 0.7]
        ts, labs = [], []
        for m in ms:
            for o in offs:
                ts.append(max(0, min(song['dur'] - 0.01, m['t'] + o))); labs.append(f'{"★" if m["big"] else "·"}{m["name"]} {o:+.2f}s')
        stills(root, ts, labs, '大时刻.jpg', a.debug, cols=len(offs), changed=a.changed, title='每行一个大时刻：-0.2s 是之前，0 是那一拍，之后 0.05–0.7s 看它怎么炸开、怎么收')


if __name__ == '__main__':
    main()
