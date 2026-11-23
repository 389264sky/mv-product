# 抠好的照片 → 黑白线稿（XDoG 线条 + 三阶明暗），脸的结构照片定，绿底留给后面抠图
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter as G, binary_erosion
IN = Path(__file__).resolve().parents[1] / 'out/comfy/input'
TONE = {'ctalk': (1.0, 2.6, .58, 0), 'smile': (1.1, 2.8, .56, 0), 'eyes': (1.05, 2.2, .62, 0), 'hold': (.8, 2.3, .64, .66)}   # 这张照片曝光偏亮：皮肤基准压低，阴影面才有网点
for name in sys.argv[1:]:
    gamma, k, sk, floor = TONE.get(name, (.8, 2.3, .64, 0))   # floor：手贴着亮显卡，局部对比会把它压黑，给个下限
    a = np.asarray(Image.open(IN / f'ref_{name}.png').convert('RGB'), np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fg = (g - np.maximum(r, b)) < .25
    L = .30 * r + .59 * g + .11 * b
    lo, hi = np.percentile(L[fg], [3, 97]); n = np.clip((L - lo) / (hi - lo), 0, 1) ** gamma
    s = max(a.shape[:2]) / 1024 * 1.1
    d = G(n, s) - .985 * G(n, s * 1.7)
    line = d < -.008
    # 局部对比：把亮脸上的法令纹、颧骨、眼袋拉出来，不让整张脸曝成白板
    wt = G(fg.astype(np.float32), 24 * s) + 1e-3
    local = n - G(n * fg, 24 * s) / wt
    v = .5 * n + .5 * (.62 + k * local)
    v = np.where(G(n, 6 * s) < .34, n * .9, v)   # 皮衣这类大块暗部保持黑，不被局部对比提亮
    skin = G(((r - b > .07) & (r > .3) & (r >= g) & fg).astype(np.float32), 1.2 * s) > .5
    v = np.where(skin, np.maximum(sk + k * local, floor), v)         # 脸和手只按局部明暗上色，不会糊成一团黑
    base = np.select([v < .27, v < .6], [.07, .72], .97)
    out = np.where(line, .05, base)
    rgb = np.dstack([out] * 3)
    rgb[~binary_erosion(fg, iterations=1)] = (0, 1, 0)
    Image.fromarray((rgb * 255).astype(np.uint8)).save(IN / f'ink_{name}.png')
    print(name, 'ok')
