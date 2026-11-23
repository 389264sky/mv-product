// jz_dragon.js —— 尾声「鲤跃龙门化龙」的金龙（第十二次会话：用户要后半段更震撼，这是全片最大的一下）。
// 画法照 jz_koi.js：身子 = 沿脊线一圈圈截面连成的网格，剔背面；明暗、高光、腹甲、锦鲤的红斑都按顶点上的场用等值线切开（边是平滑曲线），鳞片隔行错半格画弧。
// 脊线按弧长从吻往回沿来路取点：身子顺着走过的路排，拐弯、盘起来都不拉长。角、须、鬃、背鳍、尾鬃、四爪是挂在脊线局部坐标上的条带，和身子的面一起按深度排（盘起来能互相挡）。
// 龙 d：{ L（化成龙的全长，米）, Lk（化龙前锦鲤的全长）, g（化龙进度 0..1：0 = 锦鲤的身形和花纹，1 = 金龙）, pos(tt) → 吻在 tt 的位置（只由时间决定）,
//         freq, amp（身子的波）, glow, up（头顶朝哪边的提示，默认 +y）, key（主光方向）, fog（0..1 混进远处的雾色）, alpha }
(() => {
const TAU = Math.PI * 2, NS = 150, NT = 20;
const Dr = window.JZ.dragon = {};
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, k) => a + (b - a) * k, clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x, sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const css = (c, a = 1) => `rgba(${clamp(c[0], 0, 255) | 0},${clamp(c[1], 0, 255) | 0},${clamp(c[2], 0, 255) | 0},${a})`;
const Z = () => window.JZ.town, KO = () => window.JZ.koi;
// 圈：头上密（吻、眉眼要细），往尾巴疏
const SS = []; for (let i = 0; i <= NS; i++) SS.push((i / NS) ** 1.35);
const idxOf = (s) => NS * Math.pow(clamp(s), 1 / 1.35);
// 龙的截面（单位 R0 = 0.034 × 全长）：[s, 半宽, 半高, 截面中心往背上偏]。吻扁、鼻头鼓、眉骨隆起、腮最宽，颈细一点，身子 0.3 最粗，尾巴收尖
const DPROF = [[0, 0, 0, -0.12], [0.003, 0.4, 0.3, -0.1], [0.008, 0.56, 0.44, -0.04], [0.016, 0.46, 0.36, -0.12], [0.03, 0.66, 0.66, 0.04], [0.044, 0.86, 0.8, 0.04], [0.056, 0.8, 0.74, 0], [0.075, 0.62, 0.64, 0],
  [0.12, 0.74, 0.76, 0], [0.3, 1, 1, 0], [0.55, 0.9, 0.9, 0], [0.8, 0.55, 0.55, 0], [0.93, 0.26, 0.26, 0], [1, 0.04, 0.04, 0]];
const DW = [], DH = [], DC = [];
{ const at = (s, k) => { let j = 0; while (j < DPROF.length - 2 && DPROF[j + 1][0] < s) j++; const a = DPROF[j], b = DPROF[j + 1]; return lerp(a[k], b[k], clamp((s - a[0]) / (b[0] - a[0]))); };
  for (let i = 0; i <= NS; i++) { DW.push(at(SS[i], 1)); DH.push(at(SS[i], 2)); DC.push(at(SS[i], 3)); }
  for (const A of [DW, DH, DC]) for (let n = 0; n < 3; n++) { const B = A.slice(); for (let i = 1; i < NS; i++) A[i] = (B[i - 1] + 2 * B[i] + B[i + 1]) / 4; } }
// 从吻往回沿来路按弧长取点（第 i 圈在 SS[i] × 身长处）
const trail = (d, tt, Lb) => { const P = [d.pos(tt)], dt = 0.006; let a = P[0], acc = 0, k = 0, i = 1;
  while (i <= NS && k < 6000) { const b = d.pos(tt - ++k * dt), l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    while (i <= NS && acc + l >= SS[i] * Lb) { P.push(add(a, sub(b, a), l > 1e-9 ? (SS[i] * Lb - acc) / l : 0)); i++; }
    acc += l; a = b; }
  for (; i <= NS; i++) P.push(add(P[i - 1], i > 1 ? nrm(sub(P[i - 1], P[i - 2])) : [0, -1, 0], (SS[i] - SS[i - 1]) * Lb));   // 来路不够长：顺着往后延
  return P; };
// 局部坐标：T 朝头，U 朝背，S = T × U；U 从头上按提示定，再顺着身子平行移下去（竖着飞、盘起来都不翻）
const frames = (P, up) => { const Tn = [], U = [], S = [];
  for (let i = 0; i <= NS; i++) Tn.push(nrm(sub(P[Math.max(0, i - 1)], P[Math.min(NS, i + 1)])));
  let u = sub(up, mul(Tn[0], dot(up, Tn[0]))); if (Math.hypot(u[0], u[1], u[2]) < 1e-3) { const z = [0, 0, -1]; u = sub(z, mul(Tn[0], dot(z, Tn[0]))); }
  for (let i = 0; i <= NS; i++) { u = nrm(sub(u, mul(Tn[i], dot(u, Tn[i])))); U.push(u); S.push(cross(Tn[i], u)); }
  return { Tn, U, S }; };
const spine = Dr.spine = (d, tt) => {
  const g = d.g ?? 1, e = sm(0, 1, g), Lk = d.Lk ?? d.L * 0.12, Lb = lerp(Lk * 0.74, d.L, e), R0 = lerp(Lk * 0.1, 0.034 * d.L, e), up = d.up ?? [0, 1, 0];
  const P = trail(d, tt, Lb); let f = frames(P, up);
  const fq = d.freq ?? 0.6, A = (d.amp ?? 1) * R0;
  for (let i = 0; i <= NS; i++) { const s = SS[i], k = sm(0.04, 0.3, s); P[i] = add(add(P[i], f.S[i], A * k * 0.55 * Math.sin(TAU * (s * 2.2 - fq * tt))), f.U[i], A * k * 0.35 * Math.sin(TAU * (s * 1.6 - fq * 0.8 * tt) + 1)); }
  f = frames(P, up);
  const pf = KO().pf, w = [], h = [], co = [];
  for (let i = 0; i <= NS; i++) { const s = SS[i]; w.push(lerp(Lk * 0.092 * pf(s), 0.034 * d.L * DW[i], e)); h.push(lerp(Lk * 0.112 * pf(s), 0.034 * d.L * DH[i], e)); co.push(0.034 * d.L * DC[i] * e); }
  return { P, ...f, w, h, co, R0, Lb, g, e };
};
const Gs = (x, sg) => Math.exp(-(x * x) / (2 * sg * sg)), adf = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
// 头的起伏（截面半径按 s、θ 加减）：眉骨、额头、鼻头两个鼓包、鼻梁凹、颧骨、上唇一道起伏的唇边
const headMod = (s, th) => s > 0.075 ? 0 : 0.2 * Gs(s - 0.031, 0.005) * (Gs(adf(th, Math.PI / 2 - 0.78), 0.22) + Gs(adf(th, Math.PI / 2 + 0.78), 0.22))
  + 0.12 * Gs(s - 0.047, 0.008) * Gs(adf(th, Math.PI / 2), 0.45) + 0.14 * Gs(s - 0.008, 0.004) * (Gs(adf(th, Math.PI / 2 - 0.55), 0.3) + Gs(adf(th, Math.PI / 2 + 0.55), 0.3))
  - 0.07 * Gs(s - 0.02, 0.006) * Gs(adf(th, Math.PI / 2), 0.25) + 0.13 * Gs(s - 0.05, 0.007) * (Gs(adf(th, 0.05), 0.3) + Gs(adf(th, Math.PI - 0.05), 0.3))
  + 0.05 * Gs(s - 0.024, 0.012) * (Gs(adf(th, -0.62), 0.18) + Gs(adf(th, Math.PI + 0.62), 0.18)) * (1 + 0.6 * Math.sin(s * 900));
const surf = (F, i, th) => { const k = 1 + F.e * headMod(SS[i], th); return add(add(F.P[i], F.S[i], F.w[i] * Math.cos(th) * k), F.U[i], F.h[i] * Math.sin(th) * k + F.co[i]); };
const nor = (F, i, th) => { const w = Math.max(F.w[i], F.R0 * 0.05), h = Math.max(F.h[i], F.R0 * 0.05); return nrm(add(add(mul(F.S[i], Math.cos(th) / w), F.U[i], Math.sin(th) / h), F.Tn[i], i < 4 ? (4 - i) / 4 * 1.6 / F.R0 : 0)); };
// 任意 s 处的圈（两圈之间插值）；s > 1 时顺着尾巴往后延（尾鬃）
const at = (F, s) => { if (s > 1) { const r = at(F, 1); return { ...r, P: add(r.P, r.T, -(s - 1) * F.Lb) }; }
  const x = idxOf(s), i = Math.min(NS - 1, Math.floor(x)), f = x - i, L = (A) => A[i] + (A[i + 1] - A[i]) * f, V = (A) => add(A[i], sub(A[i + 1], A[i]), f);
  return { P: V(F.P), T: nrm(V(F.Tn)), U: nrm(V(F.U)), S: nrm(V(F.S)), w: L(F.w), h: L(F.h), co: L(F.co), s, e: F.e }; };
const surfA = (r, th, out = 0) => { const k = 1 + (r.e ?? 0) * headMod(r.s ?? 1, th); return add(add(r.P, r.S, (r.w * k + out) * Math.cos(th)), r.U, (r.h * k + out) * Math.sin(th) + r.co); };
// 多边形按某个场（顶点上第 k 个值）裁出 >= 0 的部分
const clipF = (poly, k) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[k] >= 0, ib = b[k] >= 0; if (ia) out.push(a); if (ia !== ib) { const f = a[k] / (a[k] - b[k]); out.push(a.map((v, m) => v + (b[m] - v) * f)); } } return out; };
const fillPoly = (ctx, poly, st) => { if (poly.length < 3) return; ctx.fillStyle = st; ctx.strokeStyle = st; ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); };
// 色板：金身（亮、背光、高光）、腹甲、红鬃（根、中、梢）、角、爪
const GOLD = [244, 168, 58], GOLD_HI = [255, 242, 188], BELLY = [255, 228, 166], PEARLK = [255, 228, 196];
const FLAME = [[178, 16, 38], [255, 92, 36], [255, 206, 112]], WHISK = [[255, 230, 170], [255, 206, 110], [255, 250, 228]], HORN = [[150, 86, 38], [232, 190, 120], [255, 246, 220]], CLAW = [[214, 150, 62], [255, 222, 150], [255, 250, 232]];

Dr.center = (d, t) => at(spine(d, t), 0.3).P;
Dr.at = at; Dr.surfA = surfA;   // 任意 s 处的圈、圈上 θ 那一点（尾声粒子变换：龙散成光点、再聚回来）
Dr.head = (d, t) => d.pos(t);
Dr.draw = (ctx, c, d, t) => {
  const Tn = Z(), F = spine(d, t), cp = [c.x, c.y, c.z], A = d.alpha ?? 1, g = F.g, R0 = F.R0, grow = sm(0.25, 0.95, g);
  const KEY = nrm(d.key ?? [0.35, 0.85, -0.4]), fk = d.fog ?? 0, FG = (col) => fk > 0 ? mix(col, [38, 40, 95], fk) : col;
  const dep = (p) => Tn.toC(c, p[0], p[1], p[2])[2], prims = [];
  const um = (s) => clamp(g * 1.5 - s * 0.5), front = (s) => g > 0 && g < 1 ? clamp(1 - Math.abs(um(s) - 0.42) / 0.16) : 0;
  ctx.save(); ctx.globalAlpha = A;
  // 光晕：沿身子一串暖光；化龙时一道金光从头扫到尾
  if ((d.glow ?? 1) > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 3; i < NS; i += 6) { const p = Tn.proj(c, ...F.P[i]); if (!p) continue; const R = Math.min(600, Math.max(F.w[i], F.h[i]) * p[2] * 3.2), fr = front(SS[i]);
      ctx.globalAlpha = (0.07 * (d.glow ?? 1) + 0.22 * fr) * A; ctx.drawImage(Tn.glowSpr(fr > 0.3 ? 'dragf' : 'dragh', fr > 0.3 ? [255, 236, 170] : [255, 168, 70], 0.15), p[0] - R, p[1] - R, 2 * R, 2 * R); }
    ctx.restore(); }
  // ---- 身子：一圈圈的四边形 ----
  const scr = [], LF = [], HF = [], BF = [], RF = [], MF = [], nr = [], pts = [];
  for (let i = 0; i <= NS; i++) { scr.push([]); LF.push([]); HF.push([]); MF.push([]); BF.push([]); RF.push([]); nr.push([]); pts.push([]);
    for (let j = 0; j < NT; j++) { const th = (j / NT) * TAU, p = surf(F, i, th); pts[i].push(p); scr[i].push(Tn.proj(c, p[0], p[1], p[2])); } }
  // 头上几圈有起伏：法线用相邻顶点算（沿身子 × 绕一圈），起伏的明暗才出得来；其余用椭圆截面的公式
  for (let i = 0; i <= NS; i++) for (let j = 0; j < NT; j++) { const th = (j / NT) * TAU;
    const n = i > 0 && i < NS && SS[i] < 0.08 ? nrm(cross(sub(pts[i - 1][j], pts[i + 1][j]), sub(pts[i][(j + 1) % NT], pts[i][(j + NT - 1) % NT]))) : nor(F, i, th), l = dot(n, KEY); nr[i].push(n);
    LF[i].push(l + 0.04); HF[i].push(l - 0.74); MF[i].push(l - 0.32); BF[i].push(-Math.sin(th) - 0.6); RF[i].push(KO().redF(SS[i], th)); }
  const surfI = (x, th) => { const i = Math.min(NS - 1, Math.floor(x)), f = x - i, a = surf(F, i, th), b = surf(F, i + 1, th); return add(a, sub(b, a), f); };
  for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) { const j2 = (j + 1) % NT, a = scr[i][j], b = scr[i + 1][j], dd = scr[i + 1][j2], ee = scr[i][j2]; if (!a || !b || !dd || !ee) continue;
    const pc = mul(add(add(pts[i][j], pts[i + 1][j2]), add(pts[i + 1][j], pts[i][j2])), 0.25), n = nrm(add(add(nr[i][j], nr[i + 1][j2]), add(nr[i + 1][j], nr[i][j2]))); if (dot(n, nrm(sub(cp, pc))) < -0.02) continue;
    prims.push([dep(pc), () => {
      const s = (SS[i] + SS[i + 1]) / 2, th = (j + 0.5) / NT * TAU, m = sm(0.15, 0.6, um(s)), fr = front(s), dr = m >= 0.5, fld = dr ? BF : RF;
      const V = (ii, jj) => [scr[ii][jj][0], scr[ii][jj][1], LF[ii][jj], fld[ii][jj], HF[ii][jj], MF[ii][jj]], poly = [V(i, j), V(i + 1, j), V(i + 1, j2), V(i, j2)];
      let cA = dr ? mix(PEARLK, GOLD, m) : mix(KO().baseC(s, th), GOLD, m), cB = dr ? mix(PEARLK, BELLY, m) : mix(KO().redC(s), GOLD, m);
      if (fr > 0) { cA = mix(cA, [255, 248, 214], 0.6 * fr); cB = mix(cB, [255, 248, 214], 0.6 * fr); }
      // 头上：越往轮廓转过去越暗（脸才有体积，起伏看得出）
      if (s < 0.08) { const ao = 1 - 0.3 * Gs(s - 0.05, 0.01) * (Gs(adf(th, -0.35), 0.25) + Gs(adf(th, Math.PI + 0.35), 0.25)) - 0.22 * Gs(s - 0.02, 0.008) * Gs(adf(th, Math.PI / 2), 0.25); cA = mul(cA, ao); cB = mul(cB, ao); }
      if (s < 0.08) { const fk = 0.6 + 0.4 * clamp(dot(nrm(add(add(nr[i][j], nr[i + 1][j2]), add(nr[i + 1][j], nr[i][j2]))), nrm(sub(cp, pts[i][j])))); cA = mul(cA, fk); cB = mul(cB, fk); }
      const tone = (col, lit) => css(FG(lit ? mix(col, [col[0] * 0.95, col[1] * 0.8, col[2] * 0.6], m) : [col[0] * lerp(0.56, 0.72, m), col[1] * lerp(0.5, 0.42, m), col[2] * lerp(0.82, 0.36, m)]));
      const mn = (k) => Math.min(...poly.map(q => q[k])), mxx = (k) => Math.max(...poly.map(q => q[k])), lmin = mn(2), lmax = mxx(2), rmin = mn(3), rmax = mxx(3);
      ctx.lineWidth = 0.7;
      if (rmin < 0) { fillPoly(ctx, poly, tone(cA, lmin >= 0)); if (lmin < 0 && lmax >= 0) fillPoly(ctx, clipF(poly, 2), tone(cA, true)); }
      if (rmax >= 0) { const rp = rmin >= 0 ? poly : clipF(poly, 3); fillPoly(ctx, rp, tone(cB, lmin >= 0)); if (lmin < 0 && lmax >= 0) fillPoly(ctx, clipF(rp, 2), tone(cB, true)); }
      if (m > 0.3 && mxx(5) >= 0) fillPoly(ctx, clipF(clipF(poly, 2), 5), css(FG(mix(cA, [255, 214, 104], m))));   // 受光面再亮一阶
      if (m > 0.3 && mxx(4) >= 0) fillPoly(ctx, clipF(poly, 4), css(FG(mix(cA, GOLD_HI, 0.8 * m))));
      // 鳞：隔行错半格一道深色弧（游离缘朝尾）+ 一道亮边；腹甲是一道道横纹
      const sz = Math.hypot(b[0] - a[0], b[1] - a[1]); if (sz < 3 || s > 0.97) return;
      if (s < 0.06) { if (sz > 4 && i % 2 === 0 && Math.sin(th) > -0.3) { ctx.strokeStyle = css(FG([cA[0] * 0.6, cA[1] * 0.42, cA[2] * 0.3]), 0.3); ctx.lineWidth = Math.max(0.5, sz * 0.05); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + ee[0]) / 2 + (b[0] - a[0]) * 0.25, (a[1] + ee[1]) / 2 + (b[1] - a[1]) * 0.25, ee[0], ee[1]); ctx.stroke(); } return; }
      const belly = dr && (BF[i][j] + BF[i][j2]) > 0, col = rmax >= 0 && rmin >= 0 ? cB : cA, band = lmin >= 0 ? 1 : 0;
      if (belly) { if (i % 2) return; ctx.strokeStyle = css(FG([col[0] * 0.62, col[1] * 0.5, col[2] * 0.4]), 0.55); ctx.lineWidth = Math.max(0.6, sz * 0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(ee[0], ee[1]); ctx.stroke(); return; }
      const off = (i % 2) * 0.5, ta = ((j + off) / NT) * TAU, tb = ((j + 1 + off) / NT) * TAU, tm = (ta + tb) / 2;
      const A1 = Tn.proj(c, ...surf(F, i, ta)), B1 = Tn.proj(c, ...surf(F, i, tb)), C1 = Tn.proj(c, ...surfI(i + 1.35, tm)); if (!A1 || !B1 || !C1) return;
      ctx.beginPath(); ctx.moveTo(A1[0], A1[1]); ctx.quadraticCurveTo(C1[0], C1[1], B1[0], B1[1]); ctx.strokeStyle = css(FG([col[0] * 0.66, col[1] * 0.5, col[2] * 0.4]), 0.65); ctx.lineWidth = Math.max(0.5, sz * 0.1); ctx.stroke();
      ctx.strokeStyle = css(FG(mix(col, [255, 255, 235], 0.5)), 0.45 * band); ctx.lineWidth = Math.max(0.4, sz * 0.05); ctx.beginPath(); ctx.moveTo(A1[0], A1[1]); ctx.quadraticCurveTo((A1[0] + B1[0]) / 2 * 0.35 + C1[0] * 0.65, (A1[1] + B1[1]) / 2 * 0.35 + C1[1] * 0.65, B1[0], B1[1]); ctx.stroke(); }]); }
  // 轮廓光：每一圈在画面上垂直于脊线最靠两边的点，相邻两圈连一小段，按那一圈的深度排
  const sil = []; for (let i = 0; i <= NS; i++) { const a = Tn.proj(c, ...F.P[Math.max(0, i - 1)]), b = Tn.proj(c, ...F.P[Math.min(NS, i + 1)]); if (!a || !b || scr[i].some(p => !p)) { sil.push(null); continue; }
    const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, nx = -(a[1] - b[1]) / l, ny = (a[0] - b[0]) / l; let lo = 1e9, hi = -1e9, pl = null, ph = null; for (let k = 0; k < 48; k++) { const p = Tn.proj(c, ...surf(F, i, k / 48 * TAU)); if (!p) continue; const v = p[0] * nx + p[1] * ny; if (v < lo) { lo = v; pl = p; } if (v > hi) { hi = v; ph = p; } } sil.push([ph, pl, a[2]]); }
  for (let i = 0; i < NS; i++) { const S0 = sil[i], S1 = sil[i + 1]; if (!S0 || !S1) continue; const m = sm(0.15, 0.6, um(SS[i]));
    prims.push([dep(F.P[i]) - Math.max(F.w[i], F.h[i]) * 0.95, () => { ctx.beginPath(); for (const k of [0, 1]) { ctx.moveTo(S0[k][0], S0[k][1]); ctx.lineTo(S1[k][0], S1[k][1]); } ctx.lineCap = 'round';
      ctx.strokeStyle = css(FG(mix([255, 214, 150], [255, 236, 170], m)), 0.55); ctx.lineWidth = Math.max(1.2, R0 * S0[2] * 0.045); ctx.stroke(); }]); }
  // ---- 条带：鬃、须、角、爪（3D 折线 + 每点半宽，在画面上往两边撑开）----
  const ribbon = (pts, hw) => { const q = pts.map(p => Tn.proj(c, p[0], p[1], p[2])); if (q.some(p => !p)) return null; const L = [], R = [];
    for (let j = 0; j < q.length; j++) { const a = q[Math.max(0, j - 1)], b = q[Math.min(q.length - 1, j + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, r = Math.max(0.4, hw[j] * q[j][2]); L.push([q[j][0] - dy / l * r, q[j][1] + dx / l * r]); R.push([q[j][0] + dy / l * r, q[j][1] - dx / l * r]); }
    return { q, poly: L.concat(R.reverse()) }; };
  const addStrip = (pts, hw, cols, o = {}) => { const rb = ribbon(pts, hw); if (!rb) return; const q = rb.q;
    prims.push([dep(pts[pts.length >> 1]) - (o.bias ?? 0), () => { const gr = ctx.createLinearGradient(q[0][0], q[0][1], q[q.length - 1][0], q[q.length - 1][1]); gr.addColorStop(0, css(FG(cols[0]))); gr.addColorStop(0.5, css(FG(cols[1]))); gr.addColorStop(1, css(FG(cols[2]), 0.92));
      ctx.fillStyle = gr; const Pq = rb.poly; ctx.beginPath(); ctx.moveTo((Pq[0][0] + Pq[1][0]) / 2, (Pq[0][1] + Pq[1][1]) / 2); for (let k = 1; k <= Pq.length; k++) { const a = Pq[k % Pq.length], b = Pq[(k + 1) % Pq.length]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } ctx.closePath(); ctx.fill();
      if (o.line) { ctx.strokeStyle = o.line; ctx.lineWidth = Math.max(0.6, R0 * q[0][2] * 0.02); ctx.lineJoin = 'round'; ctx.stroke(); }
      if (o.rings) { const n = q.length; ctx.strokeStyle = 'rgba(90,50,20,0.45)'; ctx.lineWidth = Math.max(0.6, R0 * q[0][2] * 0.015); ctx.beginPath(); for (let j = 1; j < n - 1; j++) { const a = rb.poly[j], b = rb.poly[2 * n - 1 - j]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke(); }
      if (o.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = css(cols[2], o.glow); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.6, hw[0] * q[0][2] * 0.5); ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (const p of q) ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.restore(); } }]); };
  // 一缕（鬃、须、眉、胡子、尾鬃）：根在身上 (s0, th)，往后顺着身子的来路拖，一节比一节离身子远，带一道往后传的波
  const strand = (s0, th, n, ds, rise, hw0, cols, ph, wv, o) => { const pts = [], hw = [];
    for (let j = 0; j <= n; j++) { const f = j / n, r = at(F, s0 + ds * f), out = R0 * rise * f, wob = R0 * wv * f * Math.sin(TAU * (f * 1.3 - 0.9 * t) + ph);
      pts.push(add(add(surfA(r, th, out), r.U, wob * Math.cos(th)), r.S, -wob * Math.sin(th))); hw.push(R0 * (hw0 * Math.pow(1 - f, 0.8) + 0.008)); }
    addStrip(pts, hw, cols, o); };
  const qb = (a, b, e, u) => add(add(mul(a, (1 - u) * (1 - u)), b, 2 * u * (1 - u)), e, u * u);
  // 一根管子（腿、趾）：中心线 C、每点半径；截面 NQ 份，按主光分四阶（高光、亮、中、暗），外侧（up 那一边）一排鳞，内侧隔一圈一道横纹
  const tube = (C, rad, up, o = {}) => { const m = C.length - 1, Tt = [], Uu = [], Sv = [], NQ = o.n ?? 8;
    for (let k = 0; k <= m; k++) Tt.push(nrm(sub(C[Math.min(m, k + 1)], C[Math.max(0, k - 1)])));
    let u = sub(up, mul(Tt[0], dot(up, Tt[0]))); if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = cross(Tt[0], [1, 0, 0]); u = nrm(u);
    for (let k = 0; k <= m; k++) { u = nrm(sub(u, mul(Tt[k], dot(u, Tt[k])))); Uu.push(u); Sv.push(cross(Tt[k], u)); }
    const Vv = [], Nn = []; for (let k = 0; k <= m; k++) { Vv.push([]); Nn.push([]); for (let j = 0; j < NQ; j++) { const a = (j + 0.5) / NQ * TAU, dv = add(mul(Sv[k], Math.cos(a)), Uu[k], Math.sin(a)); Vv[k].push(add(C[k], dv, rad[k])); Nn[k].push(dv); } }
    for (let k = 0; k < m; k++) for (let j = 0; j < NQ; j++) { const j2 = (j + 1) % NQ, P4 = [Vv[k][j], Vv[k + 1][j], Vv[k + 1][j2], Vv[k][j2]], pc = mul(add(add(P4[0], P4[1]), add(P4[2], P4[3])), 0.25), n = nrm(add(add(Nn[k][j], Nn[k + 1][j]), add(Nn[k + 1][j2], Nn[k][j2])));
      if (dot(n, nrm(sub(cp, pc))) < -0.05) continue; const q = P4.map(x => Tn.proj(c, ...x)); if (q.some(x => !x)) continue; const l = dot(n, KEY), outer = Math.sin((j + 1) / NQ * TAU) > 0.2;
      const col = l > 0.7 ? mix(GOLD, GOLD_HI, 0.75) : l > 0.3 ? [255, 210, 100] : l > -0.08 ? [GOLD[0] * 0.95, GOLD[1] * 0.78, GOLD[2] * 0.58] : [GOLD[0] * 0.7, GOLD[1] * 0.42, GOLD[2] * 0.34];
      prims.push([dep(pc) - (o.bias ?? 0), () => { ctx.lineWidth = 0.7; fillPoly(ctx, q, css(FG(outer || !o.scales ? col : mix(col, BELLY, 0.45))));
        const sz = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]); if (sz < 4 || !o.scales) return; ctx.strokeStyle = css(FG([150, 72, 20]), 0.5); ctx.lineWidth = Math.max(0.5, sz * 0.08); ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
        if (outer) ctx.quadraticCurveTo((q[1][0] + q[2][0]) * 0.3 + (q[0][0] + q[3][0]) * 0.2, (q[1][1] + q[2][1]) * 0.3 + (q[0][1] + q[3][1]) * 0.2, q[3][0], q[3][1]); else if (k % 2 === 0) ctx.lineTo(q[3][0], q[3][1]); ctx.stroke(); }]); } };
  if (grow > 0.02) {
    // 背鳍：一路火焰形的鳍刺，肩上最大，往尾巴变小
    for (let s = 0.085; s < 0.93; s += 0.012) { const r0 = at(F, s), r1 = at(F, s + 0.0095), rm = at(F, s + 0.005), cpS = sm(0.07, 0.15, s) * (1 - 0.55 * sm(0.45, 0.95, s)), hg = R0 * 0.62 * cpS * (0.85 + 0.15 * Math.sin(s * 91)) * grow; if (hg < R0 * 0.03) continue;
      const b0 = surfA(r0, Math.PI / 2, -R0 * 0.04), b1 = surfA(r1, Math.PI / 2, -R0 * 0.04), sw = 0.12 * Math.sin(TAU * (s * 3 - 0.8 * t)), tip = add(add(add(surfA(rm, Math.PI / 2), rm.U, hg), rm.T, -hg * 0.8), rm.S, hg * sw);
      const c0 = add(mul(add(b0, tip), 0.5), rm.T, hg * 0.22), c1 = add(mul(add(b1, tip), 0.5), rm.U, -hg * 0.1), P = [b0, c0, tip, c1, b1].map(p => Tn.proj(c, ...p)); if (P.some(p => !p)) continue;
      prims.push([dep(tip), () => { const gr = ctx.createLinearGradient((P[0][0] + P[4][0]) / 2, (P[0][1] + P[4][1]) / 2, P[2][0], P[2][1]); gr.addColorStop(0, css(FG(FLAME[0]))); gr.addColorStop(0.55, css(FG(FLAME[1]))); gr.addColorStop(1, css(FG(FLAME[2]), 0.95));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.quadraticCurveTo(P[1][0], P[1][1], P[2][0], P[2][1]); ctx.quadraticCurveTo(P[3][0], P[3][1], P[4][0], P[4][1]); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,200,120,0.35)'; ctx.lineWidth = Math.max(0.6, R0 * P[2][2] * 0.03); ctx.stroke(); ctx.restore(); }]); }
    // 鬃：颈后一大把往后飘；眉上两缕；下巴一撮胡子
    for (let k = 0; k < 24; k++) { const side = k % 2 ? 1 : -1, sp = 0.15 + 1.75 * ((k * 0.37) % 1); strand(0.046 + 0.09 * k / 23, Math.PI / 2 + side * sp, 12, (0.07 + 0.03 * (k % 3)) * grow, (1.1 + 0.4 * (k % 3)) * grow, 0.24, FLAME, k * 1.7, 0.5, { glow: 0.25 }); }
    for (const sd of [1, -1]) for (let k = 0; k < 3; k++) strand(0.05 + 0.006 * k, (sd > 0 ? 0 : Math.PI) + sd * (0.1 - 0.35 * k), 8, 0.035 * grow, 1.3 * grow, 0.2, [[255, 170, 70], [255, 112, 40], [255, 214, 130]], k + sd, 0.25, { glow: 0.3 });   // 腮鬃
    for (const sd of [1, -1]) strand(0.03, Math.PI / 2 - sd * 0.62, 6, 0.05 * grow, 0.9 * grow, 0.16, FLAME, sd, 0.3, { glow: 0.3 });
    for (let k = 0; k < 6; k++) strand(0.012 + 0.006 * k, -Math.PI / 2 + (k - 2.5) * 0.2, 6, 0.03 * grow, 0.95 * grow, 0.12, FLAME, k * 2.1, 0.4, { glow: 0.2 });
    // 龙须：吻两边两根长须，顺着脖子往后飘
    for (const sd of [1, -1]) strand(0.007, sd > 0 ? 0.05 : Math.PI - 0.05, 22, 0.24 * grow, 1.9 * grow, 0.13, WHISK, sd * 1.3, 1.3, { glow: 0.55 });
    // 尾鬃：尾巴梢一大蓬火焰
    for (let k = 0; k < 9; k++) strand(0.93 + 0.006 * k, Math.PI / 2 + (k - 4) * 0.42, 8, 0.1 * grow, 2.4 * grow, 0.38, FLAME, k * 0.9, 0.6, { glow: 0.25 });
    // 角：两支鹿角，主干往后上翘，分两个叉
    for (const sd of [1, -1]) { const r = at(F, 0.048), root = surfA(r, Math.PI / 2 - sd * 0.42, -R0 * 0.05), d1 = nrm(add(add(mul(r.T, -0.95), r.U, 0.8), r.S, sd * 0.38)), len = R0 * 2.2 * grow, beam = [];
      for (let k = 0; k <= 12; k++) { const f = k / 12; beam.push(add(add(add(root, d1, len * f), r.U, len * 0.18 * Math.sin(Math.PI * f)), r.T, -len * 0.2 * f * f)); }
      addStrip(beam, beam.map((_, k) => R0 * (0.17 - 0.145 * Math.pow(k / 12, 1.3))), HORN, { line: 'rgba(70,30,10,0.55)', rings: true });
      for (const [k, dv, lf] of [[4, add(add(r.U, r.T, 0.4), r.S, sd * 0.2), 0.38], [8, add(add(mul(r.U, 0.85), r.T, -0.45), r.S, sd * 0.35), 0.3]]) { const dd = nrm(dv), tine = []; for (let j = 0; j <= 3; j++) tine.push(add(add(beam[k], dd, len * lf * j / 3), r.T, -len * 0.05 * j * j / 9));
        addStrip(tine, [0.1, 0.07, 0.045, 0.018].map(x => x * R0), HORN, { line: 'rgba(70,30,10,0.55)', bias: 0.01 }); } }
    // 四爪：前一对、后一对。腿是一根弯的管子（上臂鼓、肘细、前臂再鼓一点、腕最细），外侧一排鳞、内侧几道横纹；肘后一根骨刺、一撮火焰毛
    // 掌上四根趾，每根两节往下勾，趾尖是象牙白、尖上发黑的钩爪
    for (const [sL, fr] of [[0.17, 0], [0.52, 1]]) for (const sd of [1, -1]) { const r = at(F, sL), sh = add(add(r.P, r.S, sd * r.w * 0.72), r.U, -r.h * 0.45 + r.co), ph = TAU * 0.45 * t + fr * Math.PI + (sd > 0 ? 0 : Math.PI / 2), out = mul(r.S, sd), gs = 0.4 + 0.6 * grow;
      const ua = nrm(add(add(mul(r.T, -(0.55 + 0.35 * Math.sin(ph))), r.S, sd * 0.8), r.U, -0.5)), el = add(sh, ua, R0 * 1.9 * grow);
      const fa = nrm(add(add(mul(r.T, 0.65 + 0.35 * Math.cos(ph)), r.S, sd * 0.3), r.U, -0.85)), wr = add(el, fa, R0 * 1.6 * grow);
      const C = []; for (let k = 0; k <= 12; k++) { const u = k / 12; C.push(u <= 0.5 ? qb(sh, add(mix(sh, el, 0.5), out, R0 * 0.22 * grow), el, u * 2) : qb(el, add(mix(el, wr, 0.5), r.T, R0 * 0.18 * grow), wr, (u - 0.5) * 2)); }
      const prof = (u) => R0 * gs * (u <= 0.5 ? 0.44 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 2.4)) - 0.16 * u : 0.3 + 0.07 * Math.sin(Math.PI * (u - 0.5) * 2) - 0.1 * (u - 0.5));
      tube(C, C.map((_, k) => prof(k / 12)), out, { scales: true });
      addStrip([el, add(add(el, r.T, -R0 * 0.35 * grow), out, R0 * 0.1 * grow), add(add(add(el, r.T, -R0 * 0.75 * grow), out, R0 * 0.15 * grow), r.U, R0 * 0.1 * grow)], [0.1, 0.06, 0.01].map(x => x * R0 * gs), CLAW, { line: 'rgba(90,40,12,0.5)', bias: 0.02 });
      const hd = nrm(add(add(mul(r.T, 0.5), r.S, sd * 0.45), r.U, -0.55)), dn = mul(r.U, -1);
      for (let k = 0; k < 4; k++) { const dk = nrm(add(add(hd, r.S, sd * (k - 1.5) * 0.45), r.T, (1.5 - Math.abs(k - 1.5)) * 0.15)), p1 = add(wr, dk, R0 * 0.36 * grow), p2 = add(add(p1, dk, R0 * 0.2 * grow), dn, R0 * 0.12 * grow);
        tube([wr, mix(wr, p1, 0.5), p1, mix(p1, p2, 0.5), p2], [0.13, 0.12, 0.11, 0.09, 0.08].map(x => x * R0 * gs), out, { n: 6, bias: 0.01 });
        const c1 = add(add(p2, dk, R0 * 0.12 * grow), dn, R0 * 0.04 * grow), c2 = add(add(c1, dk, R0 * 0.06 * grow), dn, R0 * 0.14 * grow), c3 = add(add(c2, dk, -R0 * 0.02 * grow), dn, R0 * 0.12 * grow);
        addStrip([p2, c1, c2, c3], [0.075, 0.06, 0.035, 0.006].map(x => x * R0 * gs), [[255, 246, 222], [236, 220, 186], [70, 44, 30]], { line: 'rgba(70,40,20,0.55)', bias: 0.015 }); }
      for (let k = 0; k < 3; k++) { const pts = [], hw = []; for (let j = 0; j <= 5; j++) { const f = j / 5, wv = R0 * 0.25 * f * Math.sin(TAU * (f - 0.9 * t) + k + sd); pts.push(add(add(add(el, r.T, -R0 * (0.5 + 0.2 * k) * f * grow), r.U, R0 * (0.15 + 0.2 * k) * f * grow + wv), r.S, sd * R0 * 0.35 * f * grow)); hw.push(R0 * (0.12 * (1 - f) + 0.01)); }
        addStrip(pts, hw, FLAME, { glow: 0.25, bias: 0.02 }); } }
  }
  // ---- 头：眼、眉骨、鼻孔、嘴线、獠牙 ----
  const view = (p, n) => dot(n, nrm(sub(cp, p))), nAt = (r, th) => nrm(add(mul(r.S, Math.cos(th) / Math.max(r.w, 1e-4)), r.U, Math.sin(th) / Math.max(r.h, 1e-4)));
  if (g > 0.15) { const ga = sm(0.15, 0.5, g);
    for (const sd of [1, -1]) { const r = at(F, 0.032), th = sd > 0 ? 0.48 : Math.PI - 0.48, p = surfA(r, th), vv = view(p, nAt(r, th)); if (vv < 0.06) continue; const q = Tn.proj(c, ...p); if (!q) continue;
      const ax = Tn.proj(c, ...add(p, r.T, R0 * 0.1)), uq = Tn.proj(c, ...add(p, r.U, R0 * 0.1)); if (!ax || !uq) continue; const ang = Math.atan2(ax[1] - q[1], ax[0] - q[0]), ux = uq[0] - q[0], uy = uq[1] - q[1], ys = (-Math.sin(ang) * ux + Math.cos(ang) * uy) > 0 ? -1 : 1, Rr = R0 * 0.22 * q[2], sq = 0.3 + 0.7 * vv;
      prims.push([dep(p) - R0 * 0.3, () => { ctx.save(); ctx.globalAlpha = A * ga; ctx.translate(q[0], q[1]); ctx.rotate(ang); ctx.scale(sq, ys);
        const almond = (a, b) => { ctx.beginPath(); ctx.moveTo(-a, b * 0.15); ctx.quadraticCurveTo(-a * 0.1, -b * 1.5, a, -b * 0.25); ctx.quadraticCurveTo(a * 0.1, b * 1.3, -a, b * 0.15); ctx.closePath(); };
        // 眼眶：外面一道金边、里面一圈深色；眼白偏暖，内眼角一点红
        almond(Rr * 1.62, Rr * 1.04); ctx.fillStyle = css(FG([176, 96, 30])); ctx.fill();
        almond(Rr * 1.46, Rr * 0.93); ctx.fillStyle = 'rgba(58,14,8,0.94)'; ctx.fill();
        almond(Rr * 1.25, Rr * 0.72); ctx.fillStyle = css(FG([255, 236, 196])); ctx.fill(); ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(214,58,46,0.75)'; ctx.beginPath(); ctx.ellipse(Rr * 1.08, -Rr * 0.12, Rr * 0.24, Rr * 0.17, 0, 0, TAU); ctx.fill();
        // 虹膜：金到橙红的渐变、一圈放射纹、外圈深边；竖瞳，瞳孔外一圈亮
        const ig = ctx.createRadialGradient(-Rr * 0.1, -Rr * 0.15, Rr * 0.05, 0, 0, Rr * 0.72); ig.addColorStop(0, '#fff6b0'); ig.addColorStop(0.45, '#ffbe30'); ig.addColorStop(0.8, '#e0700e'); ig.addColorStop(1, '#8a3008'); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(0, 0, Rr * 0.72, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(140,56,8,0.45)'; ctx.lineWidth = Math.max(0.5, Rr * 0.025); ctx.beginPath(); for (let k = 0; k < 30; k++) { const an = k / 30 * TAU, r0 = Rr * (0.24 + 0.04 * Math.sin(k * 3.7)); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * Rr * 0.68, Math.sin(an) * Rr * 0.68); } ctx.stroke();
        ctx.strokeStyle = 'rgba(70,20,4,0.8)'; ctx.lineWidth = Rr * 0.06; ctx.beginPath(); ctx.arc(0, 0, Rr * 0.7, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,150,0.55)'; ctx.lineWidth = Rr * 0.06; ctx.beginPath(); ctx.ellipse(0, 0, Rr * 0.17, Rr * 0.6, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#100303'; ctx.beginPath(); ctx.ellipse(0, 0, Rr * 0.11, Rr * 0.57, 0, 0, TAU); ctx.fill();
        // 上眼睑投下来的影子
        const shd = ctx.createLinearGradient(0, -Rr * 0.9, 0, -Rr * 0.05); shd.addColorStop(0, 'rgba(60,18,6,0.6)'); shd.addColorStop(1, 'rgba(60,18,6,0)'); ctx.fillStyle = shd; ctx.fillRect(-Rr * 1.3, -Rr, Rr * 2.6, Rr); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(-Rr * 0.3, -Rr * 0.26, Rr * 0.15, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(Rr * 0.28, Rr * 0.3, Rr * 0.07, 0, TAU); ctx.fill();
        // 上眼睑：一道粗的深色线，压一道金边；下眼睑一道细线
        ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-Rr * 1.3, Rr * 0.14); ctx.quadraticCurveTo(-Rr * 0.1, -Rr * 1.12, Rr * 1.3, -Rr * 0.24); ctx.strokeStyle = 'rgba(48,12,6,0.96)'; ctx.lineWidth = Rr * 0.2; ctx.stroke(); ctx.strokeStyle = css(FG([255, 204, 104])); ctx.lineWidth = Rr * 0.06; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-Rr * 1.2, Rr * 0.2); ctx.quadraticCurveTo(Rr * 0.05, Rr * 1.0, Rr * 1.25, -Rr * 0.2); ctx.strokeStyle = 'rgba(70,20,8,0.7)'; ctx.lineWidth = Rr * 0.07; ctx.stroke();
        // 眉骨：三段鼓起的金鳞，像一丛粗眉，压在眼上
        for (let k = 0; k < 3; k++) { const x0 = -Rr * 2.0 + k * Rr * 1.15, y0 = -Rr * (0.62 + 0.14 * k), x1 = x0 + Rr * 1.45, y1 = -Rr * (0.74 + 0.14 * k); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - Rr * (1.0 - 0.15 * k), x1, y1); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - Rr * 0.25, x0, y0); ctx.closePath();
          ctx.fillStyle = css(FG(k === 1 ? [255, 214, 120] : [244, 186, 82])); ctx.fill(); ctx.strokeStyle = 'rgba(90,40,12,0.75)'; ctx.lineWidth = Rr * 0.07; ctx.stroke(); }
        ctx.restore(); }]);
      // 鼻孔
      const rn = at(F, 0.005), thn = Math.PI / 2 - sd * 0.75, pn = surfA(rn, thn), qn = Tn.proj(c, ...pn); if (qn && view(pn, nAt(rn, thn)) > 0.05) prims.push([dep(pn) - R0 * 0.3, () => { ctx.save(); ctx.globalAlpha = A * ga; ctx.fillStyle = 'rgba(80,24,10,0.85)'; ctx.beginPath(); ctx.ellipse(qn[0], qn[1], R0 * 0.07 * qn[2], R0 * 0.045 * qn[2], 0, 0, TAU); ctx.fill(); ctx.strokeStyle = css(FG([255, 206, 110])); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.7, R0 * 0.035 * qn[2]); ctx.beginPath(); ctx.arc(qn[0], qn[1], R0 * 0.12 * qn[2], sd > 0 ? -0.6 : Math.PI - 3.2, sd > 0 ? 3.2 : Math.PI + 0.6); ctx.stroke(); ctx.restore(); }]);
      // 嘴线：从吻尖沿下颌往后，到腮上卷一个小圈；前面两颗獠牙
      const ml = []; for (let s = 0.002; s <= 0.047; s += 0.003) { const r2 = at(F, s), th2 = sd > 0 ? -0.62 : Math.PI + 0.62, p2 = surfA(r2, th2); ml.push([p2, view(p2, nAt(r2, th2)), r2]); }
      if (ml.filter(x => x[1] > 0.05).length > 4) prims.push([dep(ml[8][0]) - R0 * 0.3, () => { ctx.save(); ctx.globalAlpha = A * ga; ctx.beginPath(); let on = false; for (const [p2, v2] of ml) { const q2 = Tn.proj(c, ...p2); if (!q2 || v2 < 0.05) { on = false; continue; } on ? ctx.lineTo(q2[0], q2[1]) : ctx.moveTo(q2[0], q2[1]); on = true; }
        const pxm = (Tn.proj(c, ...ml[8][0]) || [0, 0, 50])[2]; ctx.strokeStyle = 'rgba(90,10,18,0.9)'; ctx.lineWidth = Math.max(0.8, R0 * 0.06 * pxm); ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); on = false; for (const [p2, v2, r2] of ml) { const q2 = Tn.proj(c, ...add(p2, r2.U, R0 * 0.05)); if (!q2 || v2 < 0.05) { on = false; continue; } on ? ctx.lineTo(q2[0], q2[1]) : ctx.moveTo(q2[0], q2[1]); on = true; } ctx.strokeStyle = css(FG([255, 200, 100]), 0.85); ctx.lineWidth = Math.max(0.6, R0 * 0.03 * pxm); ctx.stroke();
        ctx.fillStyle = 'rgba(255,246,226,0.95)'; for (let k = 1; k < ml.length - 1; k++) { if (k === 3 || k === 7) continue; const [p2, v2, r2] = ml[k]; if (v2 < 0.1) continue; const a = Tn.proj(c, ...add(p2, r2.T, R0 * 0.022)), b = Tn.proj(c, ...add(p2, r2.T, -R0 * 0.022)), tp = Tn.proj(c, ...add(p2, r2.U, -R0 * 0.09)); if (!a || !b || !tp) continue; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(tp[0], tp[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); }
        for (const k of [3, 7]) { const [p2, v2, r2] = ml[k]; if (v2 < 0.1) continue; const a = Tn.proj(c, ...add(p2, r2.T, R0 * 0.05)), b = Tn.proj(c, ...add(p2, r2.T, -R0 * 0.05)), tp = Tn.proj(c, ...add(add(p2, r2.U, -R0 * 0.24), r2.T, R0 * 0.03)); if (!a || !b || !tp) continue;
          ctx.fillStyle = 'rgba(255,248,230,0.95)'; ctx.strokeStyle = 'rgba(90,40,12,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + tp[0]) / 2, (a[1] + tp[1]) / 2 + 1, tp[0], tp[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.restore(); }]); } }
  // ---- 下颌：张着；嘴里深红、一条舌头，下獠牙朝上（上獠牙在上面的嘴线那里）----
  if (g > 0.15) { const ga = sm(0.15, 0.5, g), JN = 12, NJ = 12, op = R0 * 0.55 * ga, jaw = [];
    for (let k = 0; k <= JN; k++) { const s = 0.004 + 0.046 * k / JN, r = at(F, s), cen = add(r.P, r.U, r.co - r.h * 0.55 - op * (1 - k / JN)); jaw.push({ r, cen, jw: r.w * 0.8 * (k ? 1 : 0.4), jh: R0 * (k ? 0.17 : 0.08) }); }
    const js = (k, th) => add(add(jaw[k].cen, jaw[k].r.S, jaw[k].jw * Math.cos(th)), jaw[k].r.U, jaw[k].jh * Math.sin(th));
    const lip = (k, sd) => surfA(jaw[k].r, sd > 0 ? -0.62 : Math.PI + 0.62), mid = jaw[JN >> 1].cen;
    // 嘴里：每一节上唇到下颌上沿围一圈，填深红
    const inner = []; for (let k = 0; k <= JN; k++) inner.push([lip(k, 1), lip(k, -1), js(k, Math.PI * 0.75), js(k, Math.PI * 0.25)].map(q => Tn.proj(c, ...q)));
    if (!inner.some(r => r.some(q => !q))) prims.push([dep(mid) + R0 * 0.2, () => { ctx.save(); ctx.globalAlpha = A * ga; ctx.fillStyle = css(FG([92, 12, 24])); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
      for (let k = 0; k < JN; k++) for (const [a, b] of [[0, 3], [1, 2], [0, 1], [3, 2]]) { const q = [inner[k][a], inner[k + 1][a], inner[k + 1][b], inner[k][b]]; ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore(); }]);
    // 舌头：从喉咙往前，梢上往上卷
    const tg = []; for (let k = JN - 1; k >= 1; k--) tg.push(add(jaw[k].cen, jaw[k].r.U, jaw[k].jh * 0.9 + (k < 3 ? R0 * 0.18 * (3 - k) / 2 : 0)));
    addStrip(tg, tg.map((_, k) => R0 * (0.12 - 0.06 * k / tg.length)), [[150, 20, 40], [214, 48, 70], [255, 120, 130]], { bias: -R0 * 0.1 });
    // 下颌的面：一节节椭圆截面，金色、下面是腹甲色，按主光分三阶
    for (let k = 0; k < JN; k++) for (let j = 0; j < NJ; j++) { const t0 = j / NJ * TAU, t1 = (j + 1) / NJ * TAU, tm = (t0 + t1) / 2, P4 = [js(k, t0), js(k + 1, t0), js(k + 1, t1), js(k, t1)], q = P4.map(p => Tn.proj(c, ...p)); if (q.some(x => !x)) continue;
      const r = jaw[k].r, n = nrm(add(mul(r.S, Math.cos(tm) / jaw[k].jw), r.U, Math.sin(tm) / jaw[k].jh)), pc = mul(add(add(P4[0], P4[1]), add(P4[2], P4[3])), 0.25); if (dot(n, nrm(sub(cp, pc))) < -0.02) continue;
      const l = dot(n, KEY), base = Math.sin(tm) < -0.3 ? BELLY : GOLD, col = l > 0.32 ? [255, 214, 104] : l > -0.04 ? [base[0] * 0.95, base[1] * 0.8, base[2] * 0.6] : [base[0] * 0.72, base[1] * 0.42, base[2] * 0.36];
      prims.push([dep(pc), () => { ctx.save(); ctx.globalAlpha = A * ga; fillPoly(ctx, q, css(FG(col))); ctx.restore(); }]); }
    for (const sd of [1, -1]) for (let k = 1; k <= 9; k++) { const big = k === 2 || k === 5, hw = R0 * (big ? 0.045 : 0.022), b0 = add(js(k, sd > 0 ? 0.5 : Math.PI - 0.5), jaw[k].r.T, hw), b1 = add(js(k, sd > 0 ? 0.5 : Math.PI - 0.5), jaw[k].r.T, -hw), tp = add(add(js(k, sd > 0 ? 0.5 : Math.PI - 0.5), jaw[k].r.U, R0 * (big ? 0.22 : 0.09)), jaw[k].r.T, R0 * 0.02), q = [b0, tp, b1].map(x => Tn.proj(c, ...x)); if (q.some(x => !x)) continue;
      prims.push([dep(tp) - R0 * 0.05, () => { ctx.save(); ctx.globalAlpha = A * ga; ctx.fillStyle = 'rgba(255,248,230,0.95)'; ctx.strokeStyle = 'rgba(90,40,12,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }]); } }
  if (d.extra) for (const e of d.extra(c)) prims.push(e);   // 和身子一起排深度的东西（绕月时的月亮：龙从它后面绕过去）
  prims.sort((x, y) => y[0] - x[0]);
  for (const [, fn] of prims) fn();
  ctx.restore();
};
})();
