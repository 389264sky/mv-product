# 烘片名字形：python -I bake_title_glyphs.py → title_glyphs.js（字体换了就改 FONTS 重跑）；尾声锦鲤用尾巴写的「祥」也在这里烘
import json, math
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

FONTS, STEP = [('fonts/ZCOOLKuaiLe-Regular.ttf', 'zcoolkuaile', '惊蛰音阙诗听王梓钰/ '), ('fonts/ZhiMangXing-Regular.ttf', 'zhimangxing', '祥')], 0.0065

class Flat(BasePen):   # 曲线按约 STEP（em）一段拆成折线；y 朝下
    def __init__(self, gs, upem): super().__init__(gs); self.u, self.cs = upem, []
    def _p(self, p): self.cs[-1] += [round(p[0] / self.u, 4), round(-p[1] / self.u, 4)]
    def _moveTo(self, p): self.cs.append([]); self._p(p)
    def _lineTo(self, p): self._p(p)
    def _curve(self, pts, f):
        p0 = self._getCurrentPoint(); n = max(2, math.ceil(sum(math.dist(a, b) for a, b in zip([p0] + pts, pts)) / self.u / STEP))
        for i in range(1, n + 1): self._p(f(p0, *pts, i / n))
    def _qCurveToOne(self, a, b): self._curve([a, b], lambda p, a, b, t: [(1-t)**2*p[k] + 2*(1-t)*t*a[k] + t*t*b[k] for k in (0, 1)])
    def _curveToOne(self, a, b, c): self._curve([a, b, c], lambda p, a, b, c, t: [(1-t)**3*p[k] + 3*(1-t)**2*t*a[k] + 3*(1-t)*t*t*b[k] + t**3*c[k] for k in (0, 1)])
    def _closePath(self):
        c = self.cs[-1]
        if c[:2] == c[-2:]: del c[-2:]

out = []
for FONT, KEY, CHARS in FONTS:
    f = TTFont(FONT); upem = f['head'].unitsPerEm; gs = f.getGlyphSet(); cmap = f.getBestCmap()
    glyphs = {}
    for ch in CHARS:
        name = cmap[ord(ch)]; pen = Flat(gs, upem); gs[name].draw(pen)
        glyphs[ch] = {'a': round(gs[name].width / upem, 4), 'c': [c for c in pen.cs if len(c) >= 6]}
    data = {'family': f['name'].getDebugName(1), 'upem': upem, 'asc': f['hhea'].ascent / upem, 'desc': -f['hhea'].descent / upem, 'source': FONT.split('/')[-1], 'glyphs': glyphs}
    assert all(glyphs[ch]['c'] for ch in CHARS.replace(' ', ''))
    out.append((FONT, KEY, data)); print(KEY, {ch: (g['a'], len(g['c'])) for ch, g in glyphs.items()})
with open('title_glyphs.js', 'w') as o:
    o.write('// 片名字形和尾声的「祥」：从字体烘的轮廓（bake_title_glyphs.py）；许可见 fonts/OFL_ZCOOLKuaiLe.txt、fonts/OFL_ZhiMangXing.txt\n')
    o.write('window.SCRIPT_FONTS = window.SCRIPT_FONTS || {};\n')
    for FONT, KEY, data in out: o.write(f"window.SCRIPT_FONTS['{KEY}'] = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n")
