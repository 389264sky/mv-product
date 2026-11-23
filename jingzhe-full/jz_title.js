// 片头、片尾的歌名和歌手（plan 6.4）：照 mv-line-art STYLE §6.1 的署名（描字、灌金、走光那几段从它的 scene.js 搬来，不要信封、玫瑰）
// 一支带笔尖光的笔描歌名轮廓 → 从下往上灌金 → 一道柔光从左扫到右 → 署名线从右往左 → 描歌手、灌金。字形是 title_glyphs.js（ZCOOLKuaiLe 烘的，bake_title_glyphs.py）
(() => {
const F = window.SCRIPT_FONTS.zcoolkuaile;
const cl = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const eo = (k) => { k = cl(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const GOLD = '#e9d7a5', GAP = 18;

const compose = (str, size, x0, base) => {   // 每个字一组轮廓，按书写顺序
  const raw = [], groups = []; let x = x0;
  for (const ch of str) {
    const g = F.glyphs[ch]; if (!g) { x += size * 0.26; continue; }
    const gs = g.c.map(c => { const p = []; for (let i = 0; i < c.length; i += 2) p.push([x + c[i] * size, base + c[i + 1] * size]); return p; });
    raw.push(...gs); groups.push(gs); x += g.a * size;
  }
  return { raw, groups };
};
const ink = (raw) => { const b = [1e9, 1e9, -1e9, -1e9]; for (const s of raw) for (const q of s) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); } return b; };
const stroke = (pts) => { const cum = [0]; let L = 0; for (let i = 1; i < pts.length; i++) cum.push(L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, L }; };
const chain = (groups, pen) => {   // 每段轮廓按「离上一笔收笔最近」排先后，方向取先往右的一侧；一个字描完才进下一个字
  const out = [];
  for (const raw of groups) {
    const rest = raw.slice();
    while (rest.length) {
      let bi = 0, bp = 0, bd = 1e9;
      rest.forEach((s, i) => s.forEach((q, k) => { const d = (q[0] - pen[0]) ** 2 + (q[1] - pen[1]) ** 2; if (d < bd) { bd = d; bi = i; bp = k; } }));
      const s = rest.splice(bi, 1)[0], fwd = s.slice(bp).concat(s.slice(0, bp + 1)), rev = fwd.slice().reverse();
      let df = 0, dr = 0; for (let i = 1; i < Math.min(fwd.length, 9); i++) { df += fwd[i][0] - fwd[i - 1][0]; dr += rev[i][0] - rev[i - 1][0]; }
      const pick = df >= dr ? fwd : rev; out.push(stroke(pick)); pen = pick[pick.length - 1];
    }
  }
  return out;
};
const path = (raw) => { const p = new Path2D(); for (const s of raw) { s.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); } return p; };
const total = (ss, gap) => ss.reduce((T, s) => T + s.L + gap, 0);
const penAt = (ss, upto, gap) => {
  for (const s of ss) {
    if (upto <= s.L) { let i = 0; while (i < s.cum.length - 1 && s.cum[i + 1] <= upto) i++; const u = cl((upto - s.cum[i]) / ((s.cum[i + 1] - s.cum[i]) || 1)), b = s.pts[Math.min(i + 1, s.pts.length - 1)]; return [s.pts[i][0] + (b[0] - s.pts[i][0]) * u, s.pts[i][1] + (b[1] - s.pts[i][1]) * u]; }
    upto -= s.L + gap;
  }
  const l = ss[ss.length - 1]; return l.pts[l.pts.length - 1];
};
const drawTo = (o, ss, upto, gap) => {   // 画到第 upto 像素，提笔处断开
  for (const s of ss) {
    if (upto <= 0) break;
    const take = Math.min(upto, s.L);
    if (take > 0.4) {
      o.beginPath(); o.moveTo(s.pts[0][0], s.pts[0][1]); let i = 1;
      for (; i < s.pts.length && s.cum[i] <= take; i++) o.lineTo(s.pts[i][0], s.pts[i][1]);
      if (i < s.pts.length) { const u = (take - s.cum[i - 1]) / ((s.cum[i] - s.cum[i - 1]) || 1); o.lineTo(s.pts[i - 1][0] + (s.pts[i][0] - s.pts[i - 1][0]) * u, s.pts[i - 1][1] + (s.pts[i][1] - s.pts[i - 1][1]) * u); }
      o.stroke();
    }
    upto -= s.L + gap;
  }
};
const drawPen = (o, p, a) => {   // 笔尖光（不跟拍闪：全片不闪）
  if (a <= 0.01) return;
  const g = o.createRadialGradient(p[0], p[1], 0, p[0], p[1], 30);
  g.addColorStop(0, `rgba(255,244,218,${0.85 * a})`); g.addColorStop(0.35, `rgba(233,215,165,${0.26 * a})`); g.addColorStop(1, 'rgba(233,215,165,0)');
  o.save(); o.globalCompositeOperation = 'lighter'; o.fillStyle = g; o.beginPath(); o.arc(p[0], p[1], 30, 0, 6.283); o.fill();
  o.fillStyle = `rgba(255,248,230,${0.95 * a})`; o.beginPath(); o.arc(p[0], p[1], 2.4, 0, 6.283); o.fill(); o.restore();
};

// 版面：画面正中偏上；歌名 200 px，歌手 46 px 居中在下面
const TITLE = '惊蛰', ARTIST = '音阙诗听 / 王梓钰', TB = 340, AB = 470, TS = 200, AS = 46;
let I = null;
const build = () => {
  let c = compose(TITLE, TS, 0, 0); const ti = ink(c.raw), tx = 960 - (ti[0] + ti[2]) / 2; c = compose(TITLE, TS, tx, TB);
  let ac = compose(ARTIST, AS, 0, 0); const ai = ink(ac.raw), ax = 960 - (ai[0] + ai[2]) / 2; ac = compose(ARTIST, AS, ax, AB);
  const tS = chain(c.groups, [ti[0] + tx - 20, TB - TS]), aS = chain(ac.groups, [ai[0] + ax - 20, AB - 46]);
  const ruleY = AB - 50, rule = [ai[0] + ax - 46, ai[2] + ax];   // 署名线比歌手往左多出 46 px，收笔停在歌手左边
  I = { tS, tT: total(tS, GAP), tP: path(c.raw), tx0: ti[0] + tx, tW: ti[2] - ti[0], tTop: ti[1] + TB, tBot: ti[3] + TB, aS, aT: total(aS, 9), aP: path(ac.raw), ruleY, rule };
};

// 时序（秒，从起笔算）：描歌名 → 灌金 → 走光 → 署名线 → 描歌手 → 歌手灌金，约 6.6 秒写完
const K = { title0: 0, title1: 3.0, fill: 3.05, sheen: 4.0, rule: 4.9, art0: 5.35, art1: 6.15 };
const draw = (o, lt, a) => {
  if (!I) build();
  const e = (t0, d) => eo((lt - t0) / d);
  const tp = e(K.title0, K.title1 - K.title0), fp = e(K.fill, 1.1);
  o.save(); o.lineCap = 'round'; o.lineJoin = 'round';
  if (tp > 0) {   // 歌名：先描线
    o.save(); o.strokeStyle = GOLD; o.lineWidth = 2.1; o.shadowColor = GOLD; o.shadowBlur = 4; o.globalAlpha = (0.92 - 0.45 * fp) * a; drawTo(o, I.tS, tp * I.tT, GAP); o.restore();
  }
  if (fp > 0) {   // 金从字底往上灌：渐变钉在画布上，只抬液面
    const top = I.tTop - 10, bot = I.tBot + 10, fy = bot - (bot - top) * fp;
    o.save(); o.clip(I.tP, 'nonzero');
    const g = o.createLinearGradient(0, top, 0, bot); g.addColorStop(0, '#fbeecb'); g.addColorStop(0.38, '#ecd39a'); g.addColorStop(0.72, '#d6b06e'); g.addColorStop(1, '#bf9350');
    o.globalAlpha = a * 0.97; o.fillStyle = g; o.fillRect(I.tx0 - 60, fy, I.tW + 120, bot - fy + 30);
    const gg = o.createLinearGradient(0, fy - 30, 0, fy + 4); gg.addColorStop(0, 'rgba(247,227,180,0)'); gg.addColorStop(1, 'rgba(247,227,180,0.96)');
    o.globalAlpha = a * (1 - cl((fp - 0.92) / 0.08)); o.fillStyle = gg; o.fillRect(I.tx0 - 60, fy - 30, I.tW + 120, 34);   // 液面一线亮边
    o.restore();
    const rv = cl((fp - 0.86) / 0.14);
    if (rv > 0) { o.save(); o.globalAlpha = 0.5 * rv * a; o.strokeStyle = '#fff3d2'; o.lineWidth = 1.1; o.stroke(I.tP); o.restore(); }   // 灌满再压一道细亮边
  }
  const sp = e(K.sheen, 1.1);
  if (sp > 0 && sp < 1) {   // 走光
    const bx = I.tx0 - 260 + (I.tW + 560) * sp, g2 = o.createLinearGradient(bx - 170, 0, bx + 170, 0);
    g2.addColorStop(0, 'rgba(255,252,240,0)'); g2.addColorStop(0.5, 'rgba(255,252,240,.46)'); g2.addColorStop(1, 'rgba(255,252,240,0)');
    o.save(); o.clip(I.tP, 'nonzero'); o.globalCompositeOperation = 'lighter'; o.globalAlpha = a * 0.9; o.fillStyle = g2; o.fillRect(I.tx0 - 200, I.tTop - 40, I.tW + 400, I.tBot - I.tTop + 80); o.restore();
  }
  const rp = e(K.rule, 0.45), [x0, x1] = I.rule;
  if (rp > 0) { o.save(); o.strokeStyle = GOLD; o.lineWidth = 1.5; o.globalAlpha = 0.62 * rp * a; o.beginPath(); o.moveTo(x1, I.ruleY); o.lineTo(x1 - (x1 - x0) * rp, I.ruleY); o.stroke(); o.restore(); }   // 署名线从右往左
  const ap = e(K.art0, K.art1 - K.art0), af = cl((lt - K.art1) / 0.45);
  if (ap > 0) { o.save(); o.strokeStyle = GOLD; o.lineWidth = 1.45; o.shadowColor = GOLD; o.shadowBlur = 3; o.globalAlpha = 0.82 * a; drawTo(o, I.aS, ap * I.aT, 9); o.restore(); }
  if (af > 0) {   // 小字描完也灌金，只留轮廓会发虚
    const ag = o.createLinearGradient(0, AB - 40, 0, AB + 10); ag.addColorStop(0, '#f5e5bb'); ag.addColorStop(0.55, '#e0c189'); ag.addColorStop(1, '#c9a463');
    o.save(); o.globalAlpha = 0.94 * af * a; o.fillStyle = ag; o.fill(I.aP, 'nonzero'); o.globalAlpha = 0.5 * af * a; o.strokeStyle = '#fff3d2'; o.lineWidth = 0.9; o.stroke(I.aP); o.restore();
  }
  // 笔尖光：描的时候跟着笔，阶段之间停在收笔处，写完慢慢收
  let pen = null, pa = 0.7;
  if (tp < 1) { pen = penAt(I.tS, tp * I.tT, GAP); pa = 1; }
  else if (lt < K.rule) pen = penAt(I.tS, I.tT, GAP);
  else if (lt < K.art0) { pen = [x1 - (x1 - x0) * rp, I.ruleY]; pa = 1; }
  else if (ap < 1) { pen = penAt(I.aS, ap * I.aT, 9); pa = 1; }
  else { pen = penAt(I.aS, I.aT, 9); pa = 0.7 * (1 - cl((lt - K.art1) / 0.8)); }
  if (lt > -0.12) drawPen(o, pen, a * pa * cl((lt + 0.12) / 0.12));
  o.restore();
};

// 片头：0.3 秒起笔，bar5 推进冰里（8.84 秒）前淡完；片尾：bar119 起再写一遍，最后一小节淡掉，最后一帧没有字（接第一帧）
JZ.title = (o, M) => {
  const t = M.t, F = M.full || M, b5 = F.ref('bar5'), b119 = F.ref('bar119'), b123 = F.ref('bar123');
  if (t < b5) draw(o, t - 0.3, 1 - M.smooth(b5 - 1.45, b5 - 0.45, t));
  else if (t > b119 - 0.2) draw(o, t - b119, 1 - M.smooth(b123, F.dur - 0.05, t));
};
})();
