"""导出 blender/track.json：调了 people() 的镜头（写没写 "blender" 都导：没写的只给网页预览的代理用），每隔 STEP 帧一份 scene.js 的 people() 记下的相机、人物、道具（window.__track）。
改了这些镜头的 scene.js / cues.json 就重跑，再重渲那几镜。
用法（仓库根）：.venv/bin/python -I mv-out/<项目>/blender/track.py mv-out/<项目> [镜头 id ...]"""
import json, sys
from pathlib import Path
root = Path(sys.argv[1]).resolve(); only = set(sys.argv[2:])
sys.path.insert(0, str(root.parents[1] / '.claude/skills/mv-director/scripts'))
import render, blender
from playwright.sync_api import sync_playwright

STEP = 2   # 每 2 帧（1/30 秒）一份，中间由 build.py 线性插
out = root / 'blender' / 'track.json'
track = json.loads(out.read_text(encoding='utf-8')) if out.exists() and only else {}
with sync_playwright() as p:
    b, pg, _ = render.open_page(p, root, '')
    pg.evaluate('window.TRACKING = true')   # people() 里缺 Blender 帧不报错
    info = pg.evaluate('window.MV_INFO()'); shots = info['shots']; n = round(info['dur'] * blender.FPS)
    ids = {s['id'] for s in shots}
    if only - ids: sys.exit('没有这些镜头：' + '、'.join(sorted(only - ids)))
    for k, s in enumerate(shots):
        if s['id'] not in (only or ids): continue
        f0, f1 = blender.span(shots, k, n)
        F = [pg.evaluate('(a) => { window.__track = {}; window.render(a[0] / 60); return window.__track[a[1]] || null; }', [f, s['id']]) for f in range(f0, f1 + 1, STEP)]
        ok = [i for i, x in enumerate(F) if x]
        if not ok:
            if s['blender'] or only: sys.exit(f'镜头 {s["id"]}（{s["scene"]}）没有调 people()')
            track.pop(s['id'], None); continue
        F = [x or F[min(ok, key=lambda j: abs(j - i))] for i, x in enumerate(F)]   # 镜头还没上屏的余量帧：照最近的一帧
        track[s['id']] = {'f0': f0, 'step': STEP, 'frames': F}; print(s['id'], f'{f0}–{f1} 帧，{len(F)} 份', flush=True)
    b.close()
track = {k: v for k, v in track.items() if k in ids}
out.write_text(json.dumps(track, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('写好', out)
