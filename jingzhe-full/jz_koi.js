// jz_koi.js —— 后半段的主角：一尾红金锦鲤（第十一次会话；用户：不用仙女，换成画得最好看的一种元素）。
// Canvas 2D 里按 3D 画：身子 = 沿脊线一圈圈椭圆截面连成的网格，剔掉背面、由远到近填；红斑、金脊、鳞片按身上的 (s, θ) 贴。
// 鳍 = 一把把鳍条，每一节顺着身子刚走过的路、按那一刻的朝向拖着（惯性由历史位置给出，不用正弦摆）。
// 锦鲤 k：{ L（全长，米）, pos(tt) → [x,y,z]（吻在 tt 时刻的位置，只由时间决定）, freq（摆尾 Hz）, amp, glow（自己发的光 0..1）, reflect（水里要不要倒影）,
//         finK（鳍长 0..1，化形时展开）, emit(s)（身上 s 处的自发光 0..1，化形时一道光从头扫到尾）, eyeLight（瞳孔里倒映的那盏灯亮了多少）,
//         up(tt, 朝向)（背朝哪边，不给就朝天；在竖着的面上游时给朝镜头，竖着游不会一下翻身） }
(() => {
const TAU = Math.PI * 2, NS = 44, NT = 32, BODY = 0.74;   // 身子占全长 74%，后面是蝶尾
const K = window.JZ.koi = {};
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / l, a[1] / l, a[2] / l]; };
const Z = () => window.JZ.town;
// 截面粗细：吻钝圆，0.27 处最粗，尾柄收细
const pf = (s) => s < 0.27 ? Math.sqrt(Math.max(0, 1 - (1 - s / 0.27) ** 2)) : 0.16 + 0.84 * Math.pow(Math.cos((s - 0.27) / 0.73 * Math.PI / 2), 1.2);
// 吻在 tt 时的速度（沿脊线排点用）
const vel = (k, tt) => { const a = k.pos(tt - 0.01), b = k.pos(tt + 0.01); return mul(sub(b, a), 50); };
// 某一刻的脊线和局部坐标：T 朝头，U 朝背，S = T × U
const spine = K.spine = (k, tt) => {
  const v = vel(k, tt), sp = Math.max(1.2, Math.hypot(v[0], v[1], v[2])), Lb = k.L * BODY, P = [k.pos(tt)];
  // 从吻往回沿来路按弧长取点（用户 2026-11-20：扎进水里时身子突然变得好长——原来按时间往回取、当速度不变，刚减速时来路是快的那段，身子被拉长几倍；同 jz_dragon.js 的 trail）
  if (!k.dir) { const dt = Math.min(0.02, Lb / sp / NS); let a = P[0], acc = 0, j = 0, i = 1;
    while (i <= NS && j < 1500) { const b = k.pos(tt - ++j * dt), l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      while (i <= NS && acc + l >= i / NS * Lb) { P.push(add(a, sub(b, a), l > 1e-9 ? (i / NS * Lb - acc) / l : 0)); i++; }
      acc += l; a = b; }
    for (; i <= NS; i++) P.push(add(P[i - 1], i > 1 ? nrm(sub(P[i - 1], P[i - 2])) : [0, 0, -1], Lb / NS)); }   // 来路不够长：顺着往后延
  // 静止时（定妆表）沿 k.dir 排
  else for (let i = 0; i <= NS; i++) P[i] = add(k.pos(tt), k.dir, -(i / NS) * Lb);
  const fr = (P) => { const Tn = [], U = [], S = []; for (let i = 0; i <= NS; i++) { const t = nrm(sub(P[Math.max(0, i - 1)], P[Math.min(NS, i + 1)])); const h = k.up ? k.up(tt, t) : [0, 1, 0]; let u = sub(h, mul(t, dot(t, h))); if (Math.hypot(...u) < 1e-3) u = [0, 0, 1]; u = nrm(u);
    if (k.roll) { const r = k.roll(tt), s0 = cross(t, u); u = nrm(add(mul(u, Math.cos(r)), s0, Math.sin(r))); } Tn.push(t); U.push(u); S.push(cross(t, u)); } return { Tn, U, S }; };
  let f = fr(P);
  const fq = k.freq ?? 1.5, A = k.amp ?? 1;
  for (let i = 0; i <= NS; i++) { const s = i / NS, off = k.L * A * (0.008 + 0.075 * s * s) * Math.sin(TAU * (s * 0.85 - fq * tt)); P[i] = add(P[i], f.S[i], off); }
  f = fr(P);
  const w = [], h = []; for (let i = 0; i <= NS; i++) { const s = i / NS; w.push(k.L * 0.092 * pf(s)); h.push(k.L * 0.112 * pf(s)); }
  return { P, ...f, w, h, wm: k.L * 0.092, hm: k.L * 0.112 };
};
const surf = (F, i, th) => add(add(F.P[i], F.S[i], F.w[i] * Math.cos(th)), F.U[i], F.h[i] * Math.sin(th));
const surfS = (F, s, th) => { const x = s * NS, i = Math.min(NS - 1, Math.floor(x)), f = x - i, a = surf(F, i, th), b = surf(F, i + 1, th); return add(a, sub(b, a), f); };
// 吻端截面缩成一点：法线按最粗处的半径算，再往前偏（不能除以 0）
const nor = (F, i, th) => { const w = Math.max(F.w[i], F.wm * 0.05), h = Math.max(F.h[i], F.hm * 0.05); return nrm(add(add(mul(F.S[i], Math.cos(th) / w), F.U[i], Math.sin(th) / h), F.Tn[i], i < 6 ? ((6 - i) / 6) ** 1.5 * 2.2 / F.wm : 0)); };
// 斑纹：几块红斑（头顶一块、背上两大块、侧面、尾柄），边缘抖一点
const BLOBS = [[0.07, 1.57, 0.085, 1.1], [0.3, 1.25, 0.14, 1.3], [0.47, 2.05, 0.1, 0.95], [0.62, 1.05, 0.1, 1.05], [0.7, 2.45, 0.07, 0.8], [0.88, 1.6, 0.075, 1.4]];
const angd = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const PEARL = [255, 247, 236], GOLDS = [255, 214, 140], RED = [255, 66, 26], RED2 = [208, 28, 18], GOLDR = [255, 196, 80];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const redF = (s, th) => { const up = Math.sin(th); let red = -1; for (const [sc, pc, rs, rp] of BLOBS) red = Math.max(red, 1 - ((s - sc) / rs) ** 2 - (angd(th, pc) / rp) ** 2);
  return red + 0.18 * Math.sin(s * 47 + th * 3.1) * Math.sin(s * 19 - th * 2) - 1.4 * Math.min(1, Math.max(0, (-up - 0.3) / 0.35)); };
const baseC = (s, th) => { const up = Math.sin(th), side = Math.abs(Math.cos(th)); let c = lerp3(PEARL, GOLDS, 0.55 * side * (up > -0.4 ? 1 : 0.3)); const g = Math.min(1, Math.max(0, (up - 0.86) / 0.1)) * (s > 0.2 && s < 0.9 ? 1 : 0); return lerp3(c, GOLDR, 0.6 * g); };
const redC = (s) => lerp3(RED, RED2, Math.min(1, s * 1.3));
// 多边形按某个场（顶点上第 k 个值）裁出 >= 0 的部分；顶点 [x, y, 明暗场, 红斑场]
const clipF = (poly, k) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[k] >= 0, ib = b[k] >= 0; if (ia) out.push(a); if (ia !== ib) { const f = a[k] / (a[k] - b[k]); out.push(a.map((v, m) => v + (b[m] - v) * f)); } } return out; };
const fillPoly = (ctx, poly, st) => { if (poly.length < 3) return; ctx.fillStyle = st; ctx.strokeStyle = st; ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); };
// 鳍：at = 挂在身上哪里 (s, θ)；rest(F, i, r) = 静止时鳍条往哪伸（局部坐标拼）；len(r) = 鳍条长（占全长）
// 尾鳍的面斜一点（往 S 偏 0.42）：侧看、俯看都有面积，不会从上面看成一条竖线
const FINS = [
  { id: 'tail', s: 1, th: null, n: 17, m: 9, curl: 0.55, len: (r) => (0.30 + 0.22 * Math.abs(r) ** 1.4) * (1 + 0.035 * Math.sin(r * 11)), rest: (F, i, r) => add(add(mul(F.Tn[i], -1), F.U[i], r * 0.8), F.S[i], 0.42 * r), base: (F, i, r) => mul(F.U[i], F.h[i] * r * 0.9), col0: [255, 72, 26, 0.97], col1: [255, 186, 120, 0.62] },
  { id: 'dorsal', s0: 0.3, s1: 0.66, th: Math.PI / 2, n: 8, m: 4, len: (r) => 0.13 - 0.06 * r, rest: (F, i) => add(F.U[i], F.Tn[i], -0.8), col0: [255, 96, 36, 0.95], col1: [255, 184, 120, 0.6] },
  { id: 'pecR', s: 0.25, th: -0.5, n: 8, m: 7, len: (r) => 0.25 + 0.05 * Math.sin(r * Math.PI), rest: (F, i, r) => add(add(mul(F.Tn[i], -0.35 - 0.75 * r), F.S[i], 0.9 - 0.6 * r), F.U[i], -0.35), col0: [255, 238, 210, 0.93], col1: [255, 160, 96, 0.62] },
  { id: 'pecL', s: 0.25, th: Math.PI + 0.5, n: 8, m: 7, len: (r) => 0.25 + 0.05 * Math.sin(r * Math.PI), rest: (F, i, r) => add(add(mul(F.Tn[i], -0.35 - 0.75 * r), F.S[i], -(0.9 - 0.6 * r)), F.U[i], -0.35), col0: [255, 238, 210, 0.93], col1: [255, 160, 96, 0.62] },
  { id: 'pelR', s: 0.5, th: -1.15, n: 5, m: 4, len: () => 0.12, rest: (F, i, r) => add(add(mul(F.Tn[i], -0.7 - 0.3 * r), F.S[i], 0.35), F.U[i], -0.6), col0: [255, 236, 206, 0.92], col1: [255, 160, 96, 0.6] },
  { id: 'pelL', s: 0.5, th: Math.PI + 1.15, n: 5, m: 4, len: () => 0.12, rest: (F, i, r) => add(add(mul(F.Tn[i], -0.7 - 0.3 * r), F.S[i], -0.35), F.U[i], -0.6), col0: [255, 236, 206, 0.92], col1: [255, 160, 96, 0.6] },
  { id: 'anal', s: 0.8, th: -Math.PI / 2, n: 5, m: 3, len: () => 0.08, rest: (F, i) => add(mul(F.Tn[i], -0.8), F.U[i], -0.6), col0: [255, 120, 60, 0.92], col1: [255, 190, 130, 0.55] },
];
const TAU_LAG = 0.05, DRAG = 0.09;
// 一片鳍所有鳍条的点（世界坐标）：第 j 节用 t - j·τ 那一刻的身子和朝向；再加上那一段的来路（往后拖）
const finRays = (k, t, fin, Fs) => {
  const rays = [];
  for (let r = 0; r < fin.n; r++) { const rr = fin.id === 'tail' ? (r / (fin.n - 1)) * 2 - 1 : r / (fin.n - 1);
    const at = (F) => { if (fin.s0 !== undefined) { const s = fin.s0 + (fin.s1 - fin.s0) * rr, i = Math.round(s * NS); return [surf(F, i, fin.th), i]; } const i = Math.round(fin.s * NS); return fin.th === null ? [add(F.P[NS], fin.base(F, NS, rr)), NS] : [surf(F, i, fin.th), i]; };
    const pts = [at(Fs[0])[0]], ln = k.L * fin.len(rr) / fin.m * (k.finK ?? 1);
    for (let j = 1; j <= fin.m; j++) { const [pa, i] = at(Fs[j]), [pb] = at(Fs[j - 1]); let d = nrm(fin.rest(Fs[j], i, rr)); if (fin.curl) d = nrm(add(d, Fs[j].U[i], fin.curl * rr * j / fin.m));
      const drag = mul(sub(pa, pb), DRAG / TAU_LAG / Math.max(0.3, k.L)); d = nrm(add(d, drag)); if (k.sag) d = nrm(add(d, [0, -k.sag * j / fin.m, 0]));
      pts.push(add(pts[j - 1], d, ln)); }
    rays.push(pts); }
  return rays;
};
const css = (c, a = 1) => `rgba(${Math.max(0, Math.min(255, c[0])) | 0},${Math.max(0, Math.min(255, c[1])) | 0},${Math.max(0, Math.min(255, c[2])) | 0},${a})`;
const drawFin = (ctx, c, fin, rays, A, wet) => {
  const Tn = Z(); const sp = rays.map(r => r.map(p => Tn.proj(c, p[0], p[1], p[2]))); if (sp.some(r => r.some(p => !p))) return;
  const [r0, g0, b0, a0] = fin.col0, [r1, g1, b1, a1] = fin.col1, base = sp[Math.floor(sp.length / 2)][0], tip = sp[Math.floor(sp.length / 2)][sp[0].length - 1];
  const gr = ctx.createLinearGradient(base[0], base[1], tip[0], tip[1]); gr.addColorStop(0, css(wet([r0, g0, b0]), a0 * A)); gr.addColorStop(0.55, css(wet([(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2]), (a0 + a1) / 2 * A)); gr.addColorStop(1, css(wet([r1, g1, b1]), a1 * A));
  ctx.fillStyle = gr;
  for (let r = 0; r < sp.length - 1; r++) { const a = sp[r], b = sp[r + 1]; ctx.beginPath(); ctx.moveTo(a[0][0], a[0][1]); for (let j = 1; j < a.length; j++) ctx.lineTo(a[j][0], a[j][1]); for (let j = b.length - 1; j >= 0; j--) ctx.lineTo(b[j][0], b[j][1]); ctx.closePath(); ctx.fill(); }
  // 鳍条：根粗梢细的亮线
  const sc = base[2] * 0.004 + 0.4; ctx.strokeStyle = css(wet([255, 222, 170]), 0.55 * A); ctx.lineCap = 'round';
  for (const r of sp) { for (let j = 1; j < r.length; j++) { ctx.lineWidth = Math.max(0.4, sc * (1.6 - j / r.length * 1.2)); ctx.beginPath(); ctx.moveTo(r[j - 1][0], r[j - 1][1]); ctx.lineTo(r[j][0], r[j][1]); ctx.stroke(); } }
  // 梢上一道亮边
  ctx.beginPath(); sp.forEach((r, i) => { const p = r[r.length - 1]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = css(wet([255, 190, 110]), 0.45 * A); ctx.lineWidth = Math.max(1, sc * 2.4); ctx.stroke(); ctx.strokeStyle = css(wet([255, 240, 210]), 0.5 * A); ctx.lineWidth = Math.max(0.5, sc * 0.9); ctx.stroke(); ctx.restore();
};
K.center = (k, t) => { const F = spine(k, t); return F.P[Math.round(NS * 0.4)]; };
// 画：mirror = 画水里的倒影那一遍（只要身子大形）
K.draw = (ctx, c, k, t, mirror) => {
  const Tn = Z(), F = spine(k, t), cp = [c.x, c.y, c.z], A = k.alpha ?? 1;
  const Fs = [F]; for (let j = 1, jm = Math.max(...FINS.map(f => f.m)); j <= jm; j++) Fs.push(spine(k, t - j * TAU_LAG));
  const KEY = nrm([0.35, 0.85, -0.4]), FILL = nrm([-0.3, -0.6, -0.5]);
  const wetK = (p) => p[1] < 0 ? Math.min(1, -p[1] * 2.5 + 0.35) * (k.under ?? 1) : 0;
  const wetOf = (w) => (col) => w > 0 ? lerp3(col, [70, 120, 150], w * 0.55) : col;
  // 鳍按深浅分前后
  const finList = FINS.map(f => { const rays = finRays(k, t, f, Fs), m = rays[Math.floor(rays.length / 2)][2]; return { f, rays, d: Tn.toC(c, m[0], m[1], m[2])[2], wet: wetK(m) }; });
  const bodyD = Tn.toC(c, ...F.P[Math.round(NS * 0.4)])[2];
  // 光晕（自己发的光）
  if (!mirror && (k.glow ?? 1) > 0) { const p = Tn.proj(c, ...F.P[Math.round(NS * 0.35)]); if (p) { const R = k.L * p[2] * 1.1; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.32 * (k.glow ?? 1) * A * Math.min(1, 600 / R); ctx.drawImage(Tn.glowSpr('koih', [255, 150, 60], 0.15), p[0] - R, p[1] - R, 2 * R, 2 * R); ctx.restore(); } }
  ctx.save(); ctx.globalAlpha = A * (mirror ? 0.85 : 1);
  if (!mirror) for (const o of finList) if (o.d > bodyD) drawFin(ctx, c, o.f, o.rays, 1, wetOf(o.wet));
  // 身子：一圈圈的四边形
  const pts = [], scr = [], nr = [], LF = [], RF = [];
  for (let i = 0; i <= NS; i++) { pts.push([]); scr.push([]); nr.push([]); LF.push([]); RF.push([]); for (let j = 0; j < NT; j++) { const th = (j / NT) * TAU, p = surf(F, i, th), n = nor(F, i, th); pts[i].push(p); scr[i].push(Tn.proj(c, p[0], p[1], p[2])); nr[i].push(n); LF[i].push(dot(n, KEY) + 0.04); RF[i].push(redF(i / NS, th)); } }
  const quads = [];
  for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) { const j2 = (j + 1) % NT, a = scr[i][j], b = scr[i + 1][j], d = scr[i + 1][j2], e = scr[i][j2]; if (!a || !b || !d || !e) continue;
    const pc = mul(add(add(pts[i][j], pts[i + 1][j2]), add(pts[i + 1][j], pts[i][j2])), 0.25), n = nrm(add(add(nr[i][j], nr[i + 1][j2]), add(nr[i + 1][j], nr[i][j2]))), v = nrm(sub(cp, pc));
    if (dot(n, v) < -0.02) continue; quads.push([Tn.toC(c, pc[0], pc[1], pc[2])[2], i, j, n, v, pc, a, b, d, e]); }
  quads.sort((x, y) => y[0] - x[0]);
  for (const [, i, j, n, v, pc, a, b, d, e] of quads) {
    const s = (i + 0.5) / NS, th = ((j + 0.5) / NT) * TAU, j2 = (j + 1) % NT;
    const wk = wetK(pc);
    const tone = (base, lit) => css(wetOf(wk)(lit ? base : [base[0] * 0.56, base[1] * 0.5, base[2] * 0.82]));
    let B = baseC(s, th), R = redC(s); const em = k.emit ? k.emit(s) : 0; if (em > 0) { B = lerp3(B, [255, 244, 214], em); R = lerp3(R, [255, 236, 200], em); }
    const poly = [[a[0], a[1], LF[i][j], RF[i][j]], [b[0], b[1], LF[i + 1][j], RF[i + 1][j]], [d[0], d[1], LF[i + 1][j2], RF[i + 1][j2]], [e[0], e[1], LF[i][j2], RF[i][j2]]];
    const lmin = Math.min(...poly.map(q => q[2])), lmax = Math.max(...poly.map(q => q[2])), rmin = Math.min(...poly.map(q => q[3])), rmax = Math.max(...poly.map(q => q[3]));
    ctx.lineWidth = 0.7;
    if (rmin < 0) { fillPoly(ctx, poly, tone(B, lmin >= 0)); if (lmin < 0 && lmax >= 0) fillPoly(ctx, clipF(poly, 2), tone(B, true)); }
    if (rmax >= 0) { const rp = rmin >= 0 ? poly : clipF(poly, 3); fillPoly(ctx, rp, tone(R, lmin >= 0)); if (lmin < 0 && lmax >= 0) fillPoly(ctx, clipF(rp, 2), tone(R, true)); }
    const col = rmax >= 0 && rmin >= 0 ? R : B, band = lmin >= 0 ? 1 : 0;
    // 鳞：隔行错半格，一道深色弧（游离缘朝尾）+ 一道亮边
    const sz = Math.hypot(b[0] - a[0], b[1] - a[1]); if (mirror || sz < 3.2 || s < 0.2 || s > 0.97) continue;
    const off = (i % 2) * 0.5, ta = ((j + off) / NT) * TAU, tb = ((j + 1 + off) / NT) * TAU, tm = (ta + tb) / 2;
    const A1 = Tn.proj(c, ...surf(F, i, ta)), B1 = Tn.proj(c, ...surf(F, i, tb)), C1 = Tn.proj(c, ...surfS(F, (i + 1.35) / NS, tm)); if (!A1 || !B1 || !C1) continue;
    ctx.beginPath(); ctx.moveTo(A1[0], A1[1]); ctx.quadraticCurveTo(C1[0], C1[1], B1[0], B1[1]); ctx.strokeStyle = css([col[0] * 0.7, col[1] * 0.62, col[2] * 0.66], 0.6); ctx.lineWidth = Math.max(0.5, sz * 0.09); ctx.stroke();
    ctx.strokeStyle = css(add(col, [40, 40, 30]), 0.4 * band); ctx.lineWidth = Math.max(0.4, sz * 0.05); ctx.beginPath(); ctx.moveTo(A1[0], A1[1]); ctx.quadraticCurveTo((A1[0] + B1[0]) / 2 * 0.35 + C1[0] * 0.65, (A1[1] + B1[1]) / 2 * 0.35 + C1[1] * 0.65, B1[0], B1[1]); ctx.stroke();
    if (k.glint && sz > 16) { const gl = k.glint(i, j); if (gl > 0.02) { const R = sz * 0.32; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gl; ctx.drawImage(Tn.glowSpr((i + j) % 3 ? 'kgl' : 'kgl2', (i + j) % 3 ? [255, 214, 150] : [210, 255, 170], 0.25), C1[0] - R, C1[1] - R, 2 * R, 2 * R); ctx.restore(); } } }   // 鳞片微距：每片鳞上一点灯光（暖的是灯，青的是萤火）
  // 外轮廓：每一圈在画面上垂直于脊线方向最靠两边的点，连成一圈
  const sil = (() => { const A = [], B = []; for (let i = 0; i <= NS; i++) { const a = Tn.proj(c, ...F.P[Math.max(0, i - 1)]), b = Tn.proj(c, ...F.P[Math.min(NS, i + 1)]); if (!a || !b) return null; const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, nx = -(a[1] - b[1]) / l, ny = (a[0] - b[0]) / l;
    let lo = 1e9, hi = -1e9, pl = null, ph = null; for (const p of scr[i]) { if (!p) return null; const d = p[0] * nx + p[1] * ny; if (d < lo) { lo = d; pl = p; } if (d > hi) { hi = d; ph = p; } } A.push(ph); B.push(pl); } return A.concat(B.reverse()); })();
  if (sil && !mirror) { const sz = Tn.proj(c, ...F.P[Math.round(NS * 0.3)]), px = sz ? sz[2] * k.L : 100, mid = Math.round(NS * 0.35), m0 = Tn.proj(c, ...add(F.P[mid], F.U[mid], -F.h[mid])), m1 = Tn.proj(c, ...add(F.P[mid], F.U[mid], F.h[mid]));
    ctx.save(); ctx.beginPath(); ctx.moveTo(sil[0][0], sil[0][1]); for (const p of sil) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip();
    if (m0 && m1) { const gb = ctx.createLinearGradient(m0[0], m0[1], m1[0], m1[1]); gb.addColorStop(0, 'rgba(255,140,60,0.32)'); gb.addColorStop(0.45, 'rgba(255,140,60,0)'); ctx.fillStyle = gb; ctx.fillRect(0, 0, 1920, 1080); }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 3; i < NS - 4; i++) { const hv = nrm(add(KEY, nrm(sub(cp, F.P[i])))), hs = dot(hv, F.S[i]), hu = dot(hv, F.U[i]), al = Math.pow(hs * hs + hu * hu, 6); if (al < 0.02) continue;
      const q = Tn.proj(c, ...surf(F, i, Math.atan2(F.h[i] * hu, F.w[i] * hs))); if (!q) continue; const R = Math.max(1.5, F.w[i] * q[2] * 0.75); ctx.globalAlpha = 0.16 * al; ctx.drawImage(Tn.glowSpr('kspec', [255, 248, 230], 0.3), q[0] - R, q[1] - R, R * 2, R * 2); }
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(sil[0][0], sil[0][1]); for (const p of sil) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.lineWidth = Math.max(1.5, px * 0.022); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore(); }
  if (!mirror) {
    // 鳃盖线、眼睛、嘴和须
    const view = (p, n) => dot(n, nrm(sub(cp, p)));
    for (const sd of [1, -1]) { ctx.beginPath(); let on = false; for (let a = -1.25; a <= 1.25; a += 0.1) { const th = sd > 0 ? a : Math.PI - a, i = Math.round(0.2 * NS), p = surf(F, i, th); if (view(p, nor(F, i, th)) < 0.05) { on = false; continue; } const q = Tn.proj(c, ...p); if (!q) continue; on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; }
      ctx.strokeStyle = 'rgba(150,40,20,0.45)'; ctx.lineWidth = Math.max(0.6, k.L * 0.006 * (Tn.proj(c, ...F.P[5]) || [0, 0, 100])[2]); ctx.stroke(); }
    for (const th of [0.42, Math.PI - 0.42]) { const i = Math.round(0.085 * NS), p = surf(F, i, th), n = nor(F, i, th), vv = view(p, n); if (vv < 0.08) continue; const q = Tn.proj(c, ...p); if (!q) continue; const R = k.L * 0.021 * q[2], sq = 0.35 + 0.65 * vv;
      ctx.save(); ctx.translate(q[0], q[1]); const ax = Tn.proj(c, ...add(p, F.Tn[i], 0.01)); if (ax) ctx.rotate(Math.atan2(ax[1] - q[1], ax[0] - q[0])); ctx.scale(sq, 1);
      ctx.fillStyle = 'rgba(120,30,20,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35, R * 1.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8b34a'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.fillStyle = '#0c0608'; ctx.beginPath(); ctx.arc(R * 0.08, 0, R * 0.72, 0, TAU); ctx.fill();
      if (R > 25) {   // 近看（鱼眼大特写）：虹膜一圈放射纹、外圈深边；瞳孔里倒映着弯的屋檐线、几点灯，eyeLight 时亮起一盏灯笼
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.arc(R * 0.08, 0, R * 0.72, 0, TAU, true); ctx.clip(); ctx.strokeStyle = 'rgba(150,80,10,0.35)'; ctx.lineWidth = Math.max(0.6, R * 0.012); ctx.beginPath();
        for (let a = 0; a < TAU; a += TAU / 72) { const r0 = R * (0.74 + 0.05 * Math.sin(a * 7)); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); } ctx.stroke();
        const ig = ctx.createRadialGradient(R * 0.08, 0, R * 0.7, 0, 0, R); ig.addColorStop(0, 'rgba(255,236,150,0.5)'); ig.addColorStop(1, 'rgba(120,50,10,0)'); ctx.fillStyle = ig; ctx.fillRect(-R, -R, 2 * R, 2 * R); ctx.restore();
        ctx.strokeStyle = 'rgba(80,30,8,0.75)'; ctx.lineWidth = R * 0.06; ctx.beginPath(); ctx.arc(0, 0, R * 0.97, 0, TAU); ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.arc(R * 0.08, 0, R * 0.72, 0, TAU); ctx.clip(); ctx.strokeStyle = 'rgba(120,140,210,0.35)'; ctx.lineWidth = R * 0.02;
        ctx.beginPath(); ctx.ellipse(R * 0.08, R * 0.95, R * 1.15, R * 0.95, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); ctx.beginPath(); ctx.ellipse(R * 0.08, R * 1.2, R * 1.3, R * 1.05, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
        ctx.fillStyle = 'rgba(200,215,255,0.5)'; for (let j = 0; j < 9; j++) { const a = Math.PI * (1.15 + 0.07 * j), rr = R * (0.55 + 0.1 * (j % 3)); ctx.fillRect(R * 0.08 + Math.cos(a) * rr, R * 0.3 + Math.sin(a) * rr * 0.8, R * 0.012, R * 0.012); }
        const eL = k.eyeLight ?? 0; if (eL > 0) { ctx.globalCompositeOperation = 'lighter'; const lx = R * 0.3, ly = -R * 0.1; ctx.globalAlpha = 0.85 * eL; ctx.drawImage(Tn.glowSpr('lan', [255, 74, 30]), lx - R * 0.5, ly - R * 0.5, R, R);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = eL; ctx.drawImage(Tn.lanSpr(1), lx - R * 0.09, ly - R * 0.09 * 82 / 60, R * 0.18, R * 0.3); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(Tn.glowSpr('lanc', [255, 241, 184]), lx - R * 0.12, ly - R * 0.12, R * 0.24, R * 0.24); }   // 瞳孔里倒映的那盏灯笼
        ctx.restore(); }
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(-R * 0.15, -R * 0.3, R * 0.24, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(R * 0.3, R * 0.25, R * 0.1, 0, TAU); ctx.fill(); ctx.restore(); }
    const m0 = add(F.P[1], F.U[1], -F.h[1] * 0.35), mq = Tn.proj(c, ...m0);
    if (mq) { ctx.fillStyle = 'rgba(90,20,20,0.6)'; ctx.beginPath(); ctx.ellipse(mq[0], mq[1], Math.max(1, k.L * 0.012 * mq[2]), Math.max(0.8, k.L * 0.008 * mq[2]), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,170,0.85)'; ctx.lineCap = 'round';
      for (const [sd, l] of [[1, 0.07], [-1, 0.07], [1, 0.04], [-1, 0.04]]) { const r0 = add(m0, F.S[1], sd * F.w[1] * 0.6), sw = Math.sin(t * 2.2 + sd), r1 = add(add(add(r0, F.Tn[0], -k.L * l * 0.4), F.S[0], sd * k.L * l * 0.5), F.U[0], -k.L * l * (0.5 + 0.2 * sw)), r2 = add(r1, F.Tn[0], -k.L * l * 0.6);
        const a = Tn.proj(c, ...r0), b = Tn.proj(c, ...r1), e = Tn.proj(c, ...r2); if (!a || !b || !e) continue; ctx.lineWidth = Math.max(0.6, k.L * 0.005 * a[2]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], e[0], e[1]); ctx.stroke(); } }
    for (const o of finList) if (o.d <= bodyD) drawFin(ctx, c, o.f, o.rays, 1, wetOf(o.wet));
  }
  ctx.restore();
};
K.tail = (k, t) => { const F = spine(k, t); return F.P[NS]; };
K.eye = (k, t, sd = 1) => { const F = spine(k, t), i = Math.round(0.085 * NS), th = sd > 0 ? 0.42 : Math.PI - 0.42; return { p: surf(F, i, th), n: nor(F, i, th) }; };   // 眼睛的位置和朝外的法线（鱼眼大特写的机位跟着它）
K.flank = (k, t, s = 0.4, th = 0) => { const F = spine(k, t), i = Math.round(s * NS); return { p: surf(F, i, th), n: nor(F, i, th) }; };   // 侧面一点和法线（鳞片微距的机位跟着它）
K.pf = pf; K.redF = redF; K.baseC = baseC; K.redC = redC;   // 化龙时龙身从锦鲤的身形、花纹渐变过去（jz_dragon.js）
K.surfS = surfS;   // 身上 (s, θ) 那一点（尾声粒子变换：光点聚成星光锦鲤）
})();
