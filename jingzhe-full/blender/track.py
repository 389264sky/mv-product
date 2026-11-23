"""导出前奏、A2（bar1–16）每一帧的机位和世界参数 → blender/track.json，build.py 读它。
机位只在 jz_lake.js 里写一份（CW、CL、CAM 三条路径 + 变速），预览的着色器版本和 Blender 用同一条。
在仓库根跑：.venv/bin/python -I mv-out/jingzhe-full/blender/track.py
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parents[1] / '.claude' / 'skills' / 'mv-director' / 'scripts'))
import render  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

JS = """(nf) => {
  const M = window.MV.M, L = window.JZ.lake, W = window.JZ.seg(M, 16, 4, M.ref('bar17'), M.ref('bar48')), c = L.cams();
  const P = (C) => C && { p: C.p, l: C.l, up: C.up, fov: C.fov };
  let U; const out = [];
  for (let f = 0; f < nf; f++) {
    const t = f / 60, [tw, C] = L.tc(t), a = L.pose(t, W);
    if (!U) a.sc.traverse(o => { if (!U && o.material && o.material.uniforms && o.material.uniforms.uOpen) U = o.material.uniforms; });
    const r = { f, t, tw, cam: P(C), open: U.uOpen.value, e: U.uE.value.toArray(), ei: U.uEI.value, moon: U.uMoonI.value, smoke: U.uSmoke.value, hb: U.uHB.value.toArray() };
    if (Math.abs(tw - c.BB[7]) < 0.3) { r.cw = P(c.CW(tw)); r.cl = P(c.CL(tw)); }        // bar6→7 E：两台机位都要
    if (tw > c.T[1] - 0.6) { r.cl = P(c.CL(Math.min(tw, c.T[1]))); r.cam2 = P(c.CAM(tw)); }  // bar16→17 H
    out.push(r);
  }
  return { BB: c.BB, T1: c.T[1], beat: c.beat, moon: U.uMoon.value.toArray(), frames: out };
}"""

with sync_playwright() as p:
    b, pg, _ = render.open_page(p, ROOT, '')
    nf = round(pg.evaluate("window.MV.M.ref('bar17')") * 60) + 90
    d = pg.evaluate(JS, nf)
    b.close()
(ROOT / 'blender' / 'track.json').write_text(json.dumps(d), encoding='utf-8')
print(f'track.json：{len(d["frames"])} 帧（0–{(len(d["frames"]) - 1) / 60:.2f}s）')
