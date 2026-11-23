// jz_space.js —— 尾声金龙飞出天外以后的宇宙（用户 2026-11-20：龙一直往上飞到宇宙，再来宇宙穿梭、粒子）。和龙门世界共用坐标和机位（jz_town.js 的 T.cam、T.proj），Canvas 2D。
// 远的（满天星、银河带、星云）只跟着镜头转；近的（星尘、星云团）在镜头周围一个循环的盒子里，按「飞了多远」off 沿 DIR 往后流，飞得快时拉成光线（宇宙穿梭）。
// 旋涡星系放在 off 的坐标里：世界里的位置 = 定的位置 − DIR × off，越飞越近、看得出远近。
// back(ctx, c, t, P)：画在龙后面；front(ctx, c, t, P)：星尘，画在龙前面。P = { k（叠在龙门的天上时 0..1）, off（米）, v（米/秒）, gal: { c（off 坐标）, n, r } }
(() => {
const JZ = window.JZ, S = JZ.space = {}, T = JZ.town, { sm, clamp } = T, TAU = Math.PI * 2, W = 1920, H = 1080;
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const DIR = S.DIR = nrm([0, 0.75, 0.66]);   // 往上、往前飞（接龙门那一镜往上看的方向）
const md = (x, m) => ((x % m) + m) % m;
let M = null, STAR = null, MWB = null, NEB = null, PUFF = null, DUST = null, GAL = null;
const far = (c, d) => T.proj(c, c.x + d[0] * 1e5, c.y + d[1] * 1e5, c.z + d[2] * 1e5);   // 无穷远的方向（只跟着镜头转）
const onScr = (p, m) => p && p[0] > -m && p[0] < W + m && p[1] > -m && p[1] < H + m;
const NCOL = [[150, 90, 255], [60, 190, 225], [255, 80, 170], [255, 175, 90]];   // 星云：紫、青、品红、金
// 星云纹理：分形噪声 × 往外淡，一种颜色一张
const nebTex = (i) => M.cached('spneb' + i, 256, 256, (g) => { const im = g.createImageData(256, 256), d = im.data, col = NCOL[i], o = 17.3 * (i + 1);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const u = x / 128 - 1, v = y / 128 - 1, r = Math.hypot(u, v); let n = 0, amp = 0.5, fr = 2.6;
    for (let k = 0; k < 5; k++) { n += amp * M.noise(u * fr + o, v * fr - o); amp *= 0.5; fr *= 2.1; }
    const a = Math.pow(clamp((0.5 + 0.75 * n) * (1 - sm(0.3, 1, r))), 1.5), j = (y * 256 + x) * 4; d[j] = col[0]; d[j + 1] = clamp(col[1] + 70 * n, 0, 255); d[j + 2] = col[2]; d[j + 3] = 255 * a; }
  g.putImageData(im, 0, 0); });
const dotSpr = (col) => M.cached('spdot' + col, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.18, `rgba(${col},0.5)`); gr.addColorStop(0.5, `rgba(${col},0.08)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const SCOL = ['255,255,255', '200,215,255', '255,226,180', '170,190,255'];
const build = () => { const h = M.hash;
  STAR = []; for (let i = 0; i < 2200; i++) { const z = 2 * h(i, 701) - 1, a = h(i, 702) * TAU, r = Math.sqrt(1 - z * z); STAR.push({ d: [r * Math.cos(a), z, r * Math.sin(a)], m: Math.pow(h(i, 703), 3), c: Math.floor(h(i, 704) * 4), ph: h(i, 705) * TAU }); }
  // 银河带：一个大圆附近越靠中线越密，斜着横过往上看的那片天
  const N = nrm([0.9, -0.3, 0.35]), U1 = nrm(cross(N, [0, 1, 0])), U2 = cross(N, U1), band = (a, lat) => nrm([0, 1, 2].map(j => U1[j] * Math.cos(a) + U2[j] * Math.sin(a) + N[j] * lat));
  for (let i = 0; i < 2600; i++) { const lat = (h(i, 712) + h(i, 713) + h(i, 714) - 1.5) * 0.16; STAR.push({ d: band(h(i, 711) * TAU, lat), m: Math.pow(h(i, 715), 4) * 0.7, c: Math.floor(h(i, 716) * 4), ph: h(i, 717) * TAU }); }
  MWB = []; for (let i = 0; i < 90; i++) MWB.push({ d: band(h(i, 721) * TAU, (h(i, 722) - 0.5) * 0.12), r: 0.08 + 0.16 * h(i, 723), tex: Math.floor(h(i, 724) * 4), a: 0.06 + 0.08 * h(i, 725), rot: h(i, 726) * TAU });
  // 远处的大星云：在 DIR 附近（往前看就在画面里），每团 0.3–0.6 弧度
  NEB = []; for (let i = 0; i < 7; i++) NEB.push({ d: nrm([DIR[0] + (h(i, 731) - 0.5) * 1.3, DIR[1] + (h(i, 732) - 0.5) * 1.1, DIR[2] + (h(i, 733) - 0.5) * 1.3]), r: 0.3 + 0.3 * h(i, 734), tex: i % 4, a: 0.32 + 0.25 * h(i, 735), rot: h(i, 736) * TAU });
  // 近处：星云团（1600 米的盒子）、星尘（320 米的盒子）
  PUFF = []; for (let i = 0; i < 40; i++) PUFF.push({ b: [h(i, 741), h(i, 742), h(i, 743)], s: 70 + 160 * h(i, 744), tex: Math.floor(h(i, 745) * 4), a: 0.07 + 0.09 * h(i, 746), rot: h(i, 747) * TAU });
  DUST = []; for (let i = 0; i < 1100; i++) DUST.push({ b: [h(i, 751), h(i, 752), h(i, 753)], c: Math.floor(h(i, 754) * 4), w: 0.5 + h(i, 755) });
  // 旋涡星系：两条对数螺线的臂（每圈外扩，臂上偶尔一团粉色的星云）+ 核球 + 散在盘里的；局部坐标盘面 (x, z)，半径 1
  GAL = []; for (let i = 0; i < 8000; i++) { const kind = h(i, 760), u = h(i, 761), sc = (h(i, 762) + h(i, 763) - 1);
    if (kind < 0.22) { const r = 0.16 * Math.pow(u, 1.6), a = h(i, 764) * TAU; GAL.push({ r, a, y: sc * 0.05 * (1 - r * 4), c: 2, s: 1.4 }); continue; }
    const r = 0.06 + 0.94 * Math.pow(u, 0.8), arm = i % 2, a = arm * Math.PI + Math.log(r / 0.06) * 3.1 + sc * (kind < 0.8 ? 0.6 : 1.8);
    GAL.push({ r: r * (1 + 0.1 * sc), a, y: sc * 0.015, c: h(i, 765) < 0.08 && kind < 0.8 ? 4 : r < 0.3 && h(i, 767) < 0.5 ? 2 : h(i, 766) < 0.55 ? 1 : 0, s: kind < 0.8 ? 1 : 0.7 }); } };
// 一个盒子里循环的东西在世界里的位置（镜头在盒子正中）；e：离盒子边多近（0 中间，1 边上，淡掉不会一下冒出来）
const boxed = (b, BX, off, c) => { const cp = [c.x, c.y, c.z], r = [0, 1, 2].map(j => md(b[j] * BX - DIR[j] * off - cp[j], BX) - BX / 2); return [[cp[0] + r[0], cp[1] + r[1], cp[2] + r[2]], Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2])) / (BX / 2)]; };
const spr = (ctx, img, x, y, R, rot, a) => { ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(img, -R, -R, 2 * R, 2 * R); ctx.restore(); };
const toW = (p, off) => [p[0] - DIR[0] * off, p[1] - DIR[1] * off, p[2] - DIR[2] * off];

// 旋涡星系：整个盘慢慢转；臂上一层柔光、一粒粒星、偶尔一团粉色星云；核心一团暖白的光（当龙珠）
const galaxy = (ctx, c, t, G, off, k) => { const C = toW(G.c, off), q = T.toC(c, ...C); if (q[2] < 50) return; const p = T.scr(c, q), n = nrm(G.n), ex = nrm(cross(n, [0, 0, 1])), ez = cross(ex, n), R = G.r, rot = 0.025 * (t - 225) + 0.125 * (t - 231 + Math.hypot(t - 231, 2));   // 片尾转快一点：229–233 秒平滑加到每秒多转 0.25（审片：片尾 235–241 秒画面几乎不动）
  const pc = Math.min(1, 2.5 * R * p[2] / 1400); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [rr, col, a] of [[1.1, '150,140,255', 0.18], [0.45, '255,200,150', 0.32], [0.16, '255,236,205', 0.7]]) { const r = rr * R * p[2]; ctx.globalAlpha = a * k; ctx.drawImage(dotSpr(col), p[0] - r, p[1] - r, 2 * r, 2 * r); }
  const COL = [[175, 195, 255], [225, 232, 255], [255, 214, 160], [0, 0, 0], [255, 120, 180]];
  for (let i = 0; i < 420; i++) { const s = GAL[i * 19 + 7]; if (s.r < 0.12) continue; const a = s.a + rot, w = [0, 1, 2].map(j => C[j] + ex[j] * s.r * Math.cos(a) * R + ez[j] * s.r * Math.sin(a) * R), pp = T.proj(c, ...w); if (!pp) continue;
    const r = 0.11 * R * pp[2]; if (!onScr(pp, r)) continue; ctx.globalAlpha = 0.22 * k; ctx.drawImage(dotSpr(s.r > 0.5 ? '140,160,255' : '200,170,255'), pp[0] - r, pp[1] - r, 2 * r, 2 * r); }
  for (const s of GAL) { const a = s.a + rot, x = s.r * Math.cos(a) * R, z = s.r * Math.sin(a) * R, y = s.y * R, w = [C[0] + ex[0] * x + n[0] * y + ez[0] * z, C[1] + ex[1] * x + n[1] * y + ez[1] * z, C[2] + ex[2] * x + n[2] * y + ez[2] * z];
    const pp = T.proj(c, ...w); if (!pp || !onScr(pp, 4)) continue; const col = COL[s.c], sz = Math.max(1, Math.min(3.2, 0.0016 * R * pp[2] * s.s + 0.6 * pc));
    ctx.globalAlpha = k * (s.c === 4 ? 0.55 : 0.32 + 0.4 * (1 - s.r)); ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; ctx.fillRect(pp[0] - sz / 2, pp[1] - sz / 2, sz, sz); }
  ctx.restore(); };

S.back = (ctx, c, t, P, Mm) => { M = Mm; if (!STAR) build(); const k = P.k;
  ctx.save(); ctx.globalAlpha = k; const fp = far(c, DIR), g = ctx.createRadialGradient(fp ? fp[0] : W / 2, fp ? fp[1] : H / 2, 0, W / 2, H / 2, 1400); g.addColorStop(0, '#0d0a26'); g.addColorStop(0.5, '#070618'); g.addColorStop(1, '#020208'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of MWB) { const p = far(c, b.d), R = c.f * b.r; if (onScr(p, R)) spr(ctx, nebTex(b.tex), p[0], p[1], R, b.rot, b.a * k); }
  for (const b of NEB) { const p = far(c, b.d), R = c.f * b.r; if (onScr(p, R)) spr(ctx, nebTex(b.tex), p[0], p[1], R, b.rot + 0.01 * t, b.a * k); }
  for (const s of STAR) { const p = far(c, s.d); if (!onScr(p, 6)) continue; const tw = 0.75 + 0.25 * Math.sin(t * (1.5 + 2 * s.m) + s.ph), a = k * tw * (0.35 + 0.65 * s.m);
    if (s.m > 0.55) { const r = 3 + 9 * s.m; ctx.globalAlpha = a; ctx.drawImage(dotSpr(SCOL[s.c]), p[0] - r, p[1] - r, 2 * r, 2 * r); } else { const r = 0.7 + 1.6 * s.m; ctx.globalAlpha = a; ctx.fillStyle = `rgb(${SCOL[s.c]})`; ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); } }
  ctx.restore();
  if (P.gal) galaxy(ctx, c, t, P.gal, P.off, k);
  // 近处的星云团：飞得快时一团团从身边掠过
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const u of PUFF) { const [w, e] = boxed(u.b, 1600, P.off, c), q = T.toC(c, ...w); if (q[2] < 30) continue; const p = T.scr(c, q), R = u.s * p[2]; if (R > 2400 || !onScr(p, R)) continue;
    spr(ctx, nebTex(u.tex), p[0], p[1], R, u.rot, u.a * k * (1 - sm(0.7, 1, e)) * sm(30, 120, q[2])); }
  ctx.restore(); };

// 星尘：飞得快时拉成从前方迸出来的光线；慢的时候是一粒粒
S.front = (ctx, c, t, P, Mm) => { M = Mm; if (!STAR) build(); const k = P.k, L = P.v / 30; if (k <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const d of DUST) { const [w, e] = boxed(d.b, 320, P.off, c), a = T.toC(c, ...w); if (a[2] < 1.5) continue; const p1 = T.scr(c, a), b = T.toC(c, w[0] + DIR[0] * L, w[1] + DIR[1] * L, w[2] + DIR[2] * L); if (b[2] < 1.5) continue; const p0 = T.scr(c, b);
    if (!onScr(p1, 40) && !onScr(p0, 40)) continue; ctx.globalAlpha = k * (1 - sm(0.6, 1, e)) * Math.min(1, 40 / a[2]) * 0.8; ctx.strokeStyle = `rgb(${SCOL[d.c]})`; ctx.lineWidth = clamp(0.05 * p1[2] * d.w, 0.6, 3.5);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
  ctx.restore(); };
})();
