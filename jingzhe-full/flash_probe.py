"""查闪（不渲视频）：在给定时刻前后密集出帧，按 check.py 的 flashes() 同一条判据算「闪一下」。

用法（仓库根）：.venv/bin/python -I mv-out/jingzhe-full/flash_probe.py bar17 bar19 line6@火 [--pre 0.5 --dur 1.4 --fps 30] [--curve]
每个时刻：从「时刻 - pre」起出 dur 秒、每秒 fps 帧的连拍（render.py strip），每帧缩到 160×90 取平均亮度（0–255），
0.1 秒内比前 0.2 秒的中位数高 8 以上、0.33–0.53 秒后又落回涨幅一半以上 = ✗ 闪。静帧没有运动模糊，出草稿后以 check.py 为准。
"""
import argparse, glob, re, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]; PROJ = Path(__file__).resolve().parent
ap = argparse.ArgumentParser(); ap.add_argument('at', nargs='+'); ap.add_argument('--pre', type=float, default=0.5)
ap.add_argument('--dur', type=float, default=1.4); ap.add_argument('--fps', type=int, default=30); ap.add_argument('--curve', action='store_true')
a = ap.parse_args()
for at in a.at:
    r = subprocess.run([sys.executable, '-I', str(ROOT / '.claude/skills/mv-director/scripts/render.py'), str(PROJ), 'strip', f'{at}-{a.pre}s', str(a.dur), '--n', str(round(a.dur * a.fps))], capture_output=True, text=True)
    if r.returncode: print(f'{at:>14}  渲染失败：{r.stderr.strip().splitlines()[-1:]}'); continue
    fs = sorted(glob.glob(str(PROJ / 'out/stills/连拍/t_*.jpg')))
    t = [float(re.search(r't_([\d.]+)\.jpg', f).group(1)) for f in fs]
    Y = np.array([np.asarray(Image.open(f).convert('L').resize((160, 90), Image.BOX), np.float32).mean() for f in fs])
    w = lambda s: max(1, int(round(s * a.fps))); out = []; i = w(0.2); best = (0.0, 0.0)
    while i < len(Y) - w(0.53):
        b0 = float(np.median(Y[i - w(0.2):i])); top = float(Y[i:i + w(0.1)].max()); aft = float(np.median(Y[i + w(0.33):i + w(0.53)]))
        if top - b0 > best[0]: best = (top - b0, top - aft)
        if top - b0 >= 8 and top - aft >= (top - b0) * 0.5: out.append((t[i], top - b0)); i += w(0.5)
        else: i += 1
    print(f'{at:>14}  亮度 {Y.min():5.1f}–{Y.max():5.1f}  0.1 秒最大上跳 +{best[0]:4.1f}（之后落回 {best[1]:5.1f}）  ' + ('✗ 闪 ' + '，'.join(f'{x:.2f}s +{y:.0f}' for x, y in out) if out else '✓'))
    if a.curve: print('   ', ' '.join(f'{v:.0f}' for v in Y))
