// jz_town.js —— 后半段（bar57–123，第十一次会话起）：夜里的江南水乡古镇「灯火长街」，主角是一尾红金锦鲤（jz_koi.js）。
// 画法照 we-together-forever-v2：Canvas 2D + 透视相机（不用 three.js）；画面只由时间算出，不记上一帧。
// 世界（米）：x 向右，y 向上，z 顺着河往前。河宽 8 米（|x| < 4），水面 y = 0；两岸石驳岸顶 y = 1.2，石板街到 |x| = 6.5，临河的房子从那里往外。
(() => {
const TAU = Math.PI * 2, W = 1920, H = 1080;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x, lerp = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mx = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const css = (c, a = 1) => `rgba(${clamp(c[0], 0, 255) | 0},${clamp(c[1], 0, 255) | 0},${clamp(c[2], 0, 255) | 0},${a})`;
let M, SC, hash, FOG = 0, HZ = null;
const T = window.JZ.town = { hx, mx, css, sm, clamp, lerp };

// ---------------- 色板（画风卡第 5 节）----------------
const P = T.P = {
  skyTop: hx('#050922'), skyMid: hx('#121a52'), skyLow: hx('#35296a'), skyGlow: hx('#a4506e'), haze: hx('#26285f'),
  moon: hx('#fff4dc'), star: hx('#dfe6ff'),
  wall: hx('#6b76a6'), wallLow: hx('#3a4170'), wallEnd: hx('#8791c0'), stain: hx('#2c3157'),
  tile: hx('#15182c'), tileHi: hx('#56639a'), soffit: hx('#24161c'), rafter: hx('#4a2a26'),
  wood: hx('#2b1719'), woodHi: hx('#5e3226'), paper: hx('#ffcf86'), paperHot: hx('#fff0c4'), paperDim: hx('#2e2a44'),
  stone: hx('#3e4469'), stoneHi: hx('#69709c'), stoneJ: hx('#1d2140'), moss: hx('#1f3a3e'),
  water: hx('#060a26'), waterFar: hx('#2a2a62'),
  lanHot: hx('#fff1b8'), lan: hx('#ff4a1e'), lanEdge: hx('#b3121a'), lanOff: hx('#4a1820'), gold: hx('#e9b24c'), cap: hx('#2a1210'),
  silk: hx('#d61f3a'), silkHi: hx('#ff8c86'), silkDk: hx('#6e0a22'),
  warm: hx('#ff9d4a'),
};
const F = (c, a = 1) => css(FOG > 0 ? mx(c, HZ || P.haze, FOG) : c, a);

// ---------------- 相机 ----------------
// {x, y, z, yaw（0 = 朝 +z，正 = 往右转）, pitch（正 = 抬头）, f（焦距，像素）, ox, oy（画面中心，定妆表分格用）}
const cam = T.cam = (o) => { const c = { f: 1250, yaw: 0, pitch: 0, ox: W / 2, oy: H / 2, ...o }; c.cy = Math.cos(c.yaw); c.sy = Math.sin(c.yaw); c.cp = Math.cos(c.pitch); c.sp = Math.sin(c.pitch); return c; };
const toC = T.toC = (c, x, y, z) => { const dx = x - c.x, dy = y - c.y, dz = z - c.z, x1 = dx * c.cy - dz * c.sy, z1 = dx * c.sy + dz * c.cy; return [x1, dy * c.cp - z1 * c.sp, dy * c.sp + z1 * c.cp]; };
const NEAR = T.NEAR = 0.1;
const scr = T.scr = (c, q) => { const s = c.f / q[2]; return [c.ox + q[0] * s, c.oy - q[1] * s, s]; };
const pr = T.proj = (c, x, y, z) => { const q = toC(c, x, y, z); return q[2] < NEAR ? null : scr(c, q); };
const cut = (a, b) => { const k = (NEAR - a[2]) / (b[2] - a[2]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR]; };
// 多边形先在相机空间按近平面裁，再投影
const clipP = T.clipP = (c, pts) => { const q = pts.map(p => toC(c, p[0], p[1], p[2])), out = [];
  for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR; if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)); }
  return out.length < 3 ? null : out.map(p => scr(c, p)); };
const sub = (ctx, sp) => { ctx.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]); ctx.closePath(); };
const fillP = T.fillP = (ctx, c, pts, style) => { const sp = clipP(c, pts); if (!sp) return null; ctx.beginPath(); sub(ctx, sp); ctx.fillStyle = style; ctx.fill(); return sp; };
const seg = T.seg = (ctx, c, a, b) => { let p = toC(c, a[0], a[1], a[2]), q = toC(c, b[0], b[1], b[2]); if (p[2] < NEAR && q[2] < NEAR) return; if (p[2] < NEAR) p = cut(p, q); else if (q[2] < NEAR) q = cut(p, q); const A = scr(c, p), B = scr(c, q); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); };
// 竖直方向的渐变（墙、门板）：投影同一根竖线的上下两端
const vg = (ctx, c, x, z, y0, y1, stops) => { const a = pr(c, x, y0, z), b = pr(c, x, y1, z); if (!a || !b || Math.abs(b[1] - a[1]) < 0.01) return F(stops[0][1]); const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); for (const [k, col, al] of stops) g.addColorStop(k, F(col, al ?? 1)); return g; };
const depth = (c, x, y, z) => toC(c, x, y, z)[2];

// ---------------- 精灵（画一次缓存）----------------
// 缓存名带上颜色和参数：同一个名字配不同颜色时，不能谁先画就缓存成谁（会让画面取决于渲染顺序）
const glowSpr = (key, col, k1 = 0.25) => M.cached('tg_' + key + col.join(',') + '_' + k1, 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, css(col, 1)); gr.addColorStop(k1, css(col, 0.45)); gr.addColorStop(0.6, css(col, 0.1)); gr.addColorStop(1, css(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, true);
// 灯笼：椭圆的红纸面、竹骨、上下黑底金边的盖、金穗子；on = 点亮的版本（中心发白、往外红、边上深红）
const lanSpr = (on) => M.cached('tlan' + on, 120, 200, (g) => {
  const cx = 60, cy = 82, rx = 44, ry = 52;
  g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.clip();
  const gr = g.createRadialGradient(cx - 6, cy - 4, 2, cx, cy, rx * 1.15);
  if (on) { gr.addColorStop(0, css(P.lanHot)); gr.addColorStop(0.35, css(hx('#ffb347'))); gr.addColorStop(0.7, css(P.lan)); gr.addColorStop(1, css(P.lanEdge)); }
  else { gr.addColorStop(0, css(hx('#7a2a2c'))); gr.addColorStop(0.7, css(P.lanOff)); gr.addColorStop(1, css(hx('#22090f'))); }
  g.fillStyle = gr; g.fillRect(0, 0, 120, 200);
  for (let k = -4; k <= 4; k++) { const ex = rx * Math.sin(k / 4.6 * Math.PI / 2); g.beginPath(); g.ellipse(cx, cy, Math.abs(ex) + 0.5, ry, 0, 0, TAU); g.strokeStyle = on ? 'rgba(160,30,10,0.45)' : 'rgba(10,0,4,0.5)'; g.lineWidth = 1.6; g.stroke(); }
  if (!on) { const sh = g.createLinearGradient(cx - rx, 0, cx + rx, 0); sh.addColorStop(0, 'rgba(150,170,255,0.18)'); sh.addColorStop(0.3, 'rgba(150,170,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, 120, 200); }
  g.restore();
  const capH = 9; for (const [y0, w] of [[cy - ry - capH + 4, 50], [cy + ry - 4, 50]]) { g.fillStyle = css(P.cap); g.beginPath(); g.roundRect(cx - w / 2, y0, w, capH, 3); g.fill(); g.fillStyle = css(P.gold); g.fillRect(cx - w / 2, y0 + (y0 < cy ? capH - 2.5 : 0), w, 2.5); }
  g.strokeStyle = css(P.gold); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, cy - ry - capH + 4); g.stroke();
  for (let k = 0; k < 9; k++) { const x = cx - 8 + k * 2; g.strokeStyle = css(mx(P.gold, hx('#ff7a2a'), k % 3 / 3)); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, cy + ry + 5); g.quadraticCurveTo(x + (k - 4) * 0.6, cy + ry + 30, x + (k - 4) * 1.1, cy + ry + 52); g.stroke(); }
  g.fillStyle = css(P.gold); g.beginPath(); g.ellipse(cx, cy + ry + 8, 5, 4, 0, 0, TAU); g.fill();
}, true);
// 一盏灯笼：p = 挂点下面灯笼中心的世界坐标，k = 亮了多少；返回屏幕位置（给光晕、倒影用）
const lantern = (ctx, c, x, y, z, k, sway = 0, size = 0.46) => {
  const p = pr(c, x, y, z); if (!p) return null; const w = size * p[2], h = w * 200 / 120; if (w < 0.6) return p;
  ctx.save(); ctx.translate(p[0], p[1] - w * 0.68 * 82 / 60 * 0 ); ctx.rotate(sway); const ox = -w / 2, oy = -h * 82 / 200;
  ctx.globalAlpha = FOG > 0 ? 1 - FOG * 0.6 : 1;
  if (k < 1) ctx.drawImage(lanSpr(0), ox, oy, w, h);
  if (k > 0) { ctx.globalAlpha *= k; ctx.drawImage(lanSpr(1), ox, oy, w, h); }
  ctx.restore(); return p;
};
const GLOWS = [];   // 这一帧要加的光晕：[x, y, 半径, 精灵, 透明度]，最后统一用 lighter 叠
const GK = 0.55, GR = 260;   // 光晕总强度、最大半径（像素）：整条街的灯都亮时不叠成白带
let GA = 1;   // 这一帧光晕的总强度（st.glowK；高处看整条街时调低，不叠成两条白线）
const glow = (x, y, r, spr, a) => { if (a > 0.004 && r > 0.5) GLOWS.push([x, y, Math.min(r, GR), spr, a * GK * GA * (1 - FOG * 0.65)]); };   // 远处的光晕按雾暗下去（不在消失点叠成亮核）

// ---------------- 镇子的布局（按 hash 定，不随时间变）----------------
const HS = T.houses = [], BR = T.bridges = [], STR = T.strings = [], RIB = T.ribbons = [];
const build = () => {
  for (const z of [48, 200, 352, 520, 700, 880, 1080]) BR.push({ z });
  for (const side of [-1, 1]) {
    let z = -70, i = 0;
    while (z < 1500) { const r = (k) => hash(i * 13 + k, side > 0 ? 101 : 211);
      const w = r(1) < 0.12 ? 8.5 + 2 * r(9) : 4.2 + 3.4 * r(1), h1 = 2.9 + 0.5 * r(2), tall = r(4) > 0.86 ? 2.7 : 0, h2 = h1 + 2.8 + 1.0 * r(3) + tall;
      const n = Math.max(1, Math.round(w / 2.6)), lans = [];
      for (let k = 0; k < n; k++) lans.push({ z: z + w * (k + 0.5) / n, up: 1, ph: r(20 + k) * TAU });
      if (r(7) < 0.7) for (let k = 0; k < Math.max(1, n - 1); k++) lans.push({ z: z + w * (k + 1) / n, up: 0, ph: r(30 + k) * TAU });
      HS.push({ side, i, z0: z, z1: z + w, h1, h2, deep: 7 + 3 * r(5), gable: r(6) < 0.62, shop: r(7) < 0.7, tone: 0.9 + 0.16 * r(8), win: Math.max(1, Math.round(w / 2.4)), lans, r });
      z += w + (r(10) < 0.1 ? 1.4 + r(11) : 0); i++; }
  }
  for (let z = 30; z < 1500; z += 17 + 9 * hash(z | 0, 5)) STR.push({ z, n: 7, sag: 0.8 + 0.5 * hash(z | 0, 6), y: 6.0 + 0.8 * hash(z | 0, 7) });
  for (let z = 22, n = 0; z < 1500; z += 13 + 7 * hash(z | 0, 8), n++) RIB.push({ z, y: 7.3 + 0.6 * hash(z | 0, 9), sag: 1.4 + 0.6 * hash(z | 0, 10), ph: hash(z | 0, 11) * TAU, dz: (n % 2 ? 1 : -1) * (2 + 3 * hash(z | 0, 12)) });
  buildMore();
};

// ---------------- 天 ----------------
let STARS = null;
const sky = (ctx, c, t, st) => {
  const hy = c.oy + c.f * Math.tan(c.pitch), g = ctx.createLinearGradient(0, hy - c.f * 1.1, 0, hy + 4);
  g.addColorStop(0, css(P.skyTop)); g.addColorStop(0.5, css(P.skyMid)); g.addColorStop(0.84, css(P.skyLow)); g.addColorStop(1, css(mx(P.skyLow, P.skyGlow, 0.55 + 0.45 * (st.townGlow ?? 1))));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 银河：一条斜着的淡带，叠几层软光点
  if (!STARS) { STARS = []; const rnd = M.rng(31); for (let i = 0; i < 900; i++) { const u = (rnd() - 0.5) * 3.6, e = Math.asin(0.05 + 0.95 * Math.pow(rnd(), 1.4)); STARS.push([u, e, rnd(), rnd() * TAU, rnd()]); }
    STARS.mw = []; for (let i = 0; i < 260; i++) { const a = rnd(), u = -1.4 + 2.8 * a, e = 0.25 + 0.9 * a + (rnd() - 0.5) * 0.22; STARS.mw.push([u, e, 0.06 + 0.1 * rnd(), rnd()]); } }
  const dir = (u, e) => { const ce = Math.cos(e); return pr(c, c.x + Math.sin(u) * ce * 1e5, c.y + Math.sin(e) * 1e5, c.z + Math.cos(u) * ce * 1e5); };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [u, e, r, a] of STARS.mw) { const p = dir(u, e); if (!p) continue; const R = r * c.f * 0.6; ctx.globalAlpha = 0.05 + 0.05 * a; ctx.drawImage(glowSpr('mw', hx('#8a8fd8')), p[0] - R, p[1] - R, 2 * R, 2 * R); }
  for (const [u, e, b, ph, sz] of STARS) { const p = dir(u, e); if (!p || p[1] > hy - 2) continue; const tw = 0.55 + 0.45 * Math.sin(t * (1.3 + 2 * b) + ph), a = (0.25 + 0.75 * b * b) * tw * sm(0, 0.12, e);
    const s = 0.8 + 1.8 * sz * sz; ctx.globalAlpha = a; ctx.fillStyle = css(P.star); ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s); if (b > 0.93) { ctx.globalAlpha = a * 0.5; ctx.drawImage(glowSpr('st', P.star, 0.1), p[0] - 9, p[1] - 9, 18, 18); } }
  ctx.restore();
  // 月亮：右前方高处
  const mp = dir(st.moonU ?? 0.42, st.moonE ?? 0.5); if (mp) { const R = c.f * 0.022 * (st.moonR ?? 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(glowSpr('moonh', hx('#9aa6ff'), 0.08), mp[0] - R * 9, mp[1] - R * 9, R * 18, R * 18); ctx.globalAlpha = 0.5; ctx.drawImage(glowSpr('moonh2', P.moon, 0.2), mp[0] - R * 2.6, mp[1] - R * 2.6, R * 5.2, R * 5.2); ctx.restore();
    const mg = ctx.createRadialGradient(mp[0] - R * 0.3, mp[1] - R * 0.3, R * 0.1, mp[0], mp[1], R); mg.addColorStop(0, css(hx('#fffaf0'))); mg.addColorStop(1, css(hx('#f2dfb8'))); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mp[0], mp[1], R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(190,170,140,0.28)'; for (const [a, b, r] of [[-0.3, -0.2, 0.28], [0.25, 0.1, 0.22], [-0.05, 0.35, 0.18], [0.35, -0.35, 0.12]]) { ctx.beginPath(); ctx.arc(mp[0] + a * R, mp[1] + b * R, r * R, 0, TAU); ctx.fill(); } }
  // 远处：两层山影 + 一座塔（白塔在左前方 600 米外，塔檐挂灯）
  for (const [d, col, amp, ph] of [[1, mx(P.skyLow, P.haze, 0.3), 0.035, 1.3], [0, mx(P.haze, hx('#141638'), 0.5), 0.022, 4.1]]) {
    ctx.beginPath(); let first = true;
    for (let u = -1.9; u <= 1.9; u += 0.02) { const e = amp * (0.55 + 0.45 * Math.sin(u * 3.1 + ph) * Math.sin(u * 7.3 + ph * 2) + 0.25 * Math.sin(u * 17 + ph)) + 0.004; const p = dir(c.yaw + u, e); if (!p) continue; if (first) { ctx.moveTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]); }
    if (!first) { ctx.lineTo(W + 50, hy + 40); ctx.lineTo(-50, hy + 40); ctx.closePath(); ctx.fillStyle = css(col); ctx.fill(); } }
  if (!st.world) pagoda(ctx, c, -55, 640, st);   // 塔在镇子的世界里，龙门那边不画
};
const pagoda = (ctx, c, x, z, st) => {
  FOG = 0.55; const lv = 7; let y = 0;
  for (let k = 0; k < lv; k++) { const r = 5.2 - k * 0.5, hh = 4.2 - k * 0.25;
    fillP(ctx, c, [[x - r * 0.8, y, z], [x - r * 0.8, y + hh, z], [x + r * 0.8, y + hh, z], [x + r * 0.8, y, z]], F(hx('#1c1f45')));
    fillP(ctx, c, [[x - r * 1.35, y + hh - 0.2, z], [x - r * 0.9, y + hh + 0.7, z], [x + r * 0.9, y + hh + 0.7, z], [x + r * 1.35, y + hh - 0.2, z]], F(hx('#0e1030')));
    const lk = st.lit(x, y, z) * 0.9; if (lk > 0) for (const sx of [-1, 1]) { const p = pr(c, x + sx * r * 1.3, y + hh - 0.6, z); if (p) glow(p[0], p[1], p[2] * 2.2, glowSpr('lan', P.lan), 0.5 * lk); }
    const wp = pr(c, x, y + hh * 0.45, z); if (wp && lk > 0) { ctx.fillStyle = F(P.paper, lk); const s = wp[2]; ctx.fillRect(wp[0] - s * 0.5, wp[1] - s * 0.9, s, s * 1.6); }
    y += hh + 0.7; }
  const p = pr(c, x, y + 3, z); if (p) { ctx.strokeStyle = F(hx('#0e1030')); ctx.lineWidth = Math.max(1, p[2] * 0.4); ctx.beginPath(); seg(ctx, c, [x, y, z], [x, y + 4, z]); ctx.stroke(); }
  FOG = 0;
};

// ---------------- 房子 ----------------
const house = (ctx, c, h, st, t) => {
  const s = h.side, X = s * 6.5, z0 = h.z0, z1 = h.z1, Y0 = 1.2, h1 = h.h1, h2 = h.h2, zm = (z0 + z1) / 2, E = s * 5.35, ridge = s * (6.5 + h.deep * 0.5), RY = h2 + 2.3;
  const L = st.lit(X, h2, zm), Lw = sm(0.25, 1, L);
  const wallC = mx(P.wall, hx('#c8cfe8'), (h.tone - 0.9) * 2), lowC = P.wallLow;
  // 端墙（z0 那一面；马头墙台阶或者普通的山墙）先画，房子正面盖在它前面那条缝上
  const ex = s * (6.5 + h.deep);
  if (c.z < z0) { if (h.gable) { const a1 = s * (6.4 + h.deep * 0.3), a2 = s * (6.4 + h.deep * 0.62), y1 = h2 + 0.75, y2 = h2 + 1.6, y3 = RY + 0.55;
      fillP(ctx, c, [[X - s * 0.15, Y0, z0], [X - s * 0.15, y1, z0], [a1, y1, z0], [a1, y2, z0], [a2, y2, z0], [a2, y3, z0], [ex, y3, z0], [ex, Y0, z0]], vg(ctx, c, X, z0, y3, Y0, [[0, P.wallEnd], [0.7, mx(P.wallEnd, lowC, 0.5)], [1, lowC]]));
      // 每级台阶的瓦顶 + 翘起来的「马头」
      for (const [xa, xb, y] of [[X - s * 0.15, a1, y1], [a1, a2, y2], [a2, ex, y3]]) {
        fillP(ctx, c, [[xa - s * 0.25, y - 0.05, z0 - 0.18], [xa - s * 0.25, y + 0.28, z0 - 0.18], [xb, y + 0.28, z0 - 0.18], [xb, y - 0.05, z0 - 0.18]], F(P.tile));
        fillP(ctx, c, [[xa - s * 0.25, y + 0.28, z0 - 0.18], [xa - s * 0.42, y + 0.62, z0 - 0.18], [xa + s * 0.25, y + 0.28, z0 - 0.18]], F(P.tile));
        ctx.beginPath(); seg(ctx, c, [xa - s * 0.25, y + 0.28, z0 - 0.19], [xb, y + 0.28, z0 - 0.19]); ctx.strokeStyle = F(P.tileHi, 0.8); const q = pr(c, xa, y, z0); ctx.lineWidth = q ? Math.max(0.6, q[2] * 0.04) : 1; ctx.stroke(); }
    } else { fillP(ctx, c, [[X, Y0, z0], [X, h2, z0], [E, h2, z0], [ridge, RY, z0], [ex, h2 - 0.5, z0], [ex, Y0, z0]], vg(ctx, c, X, z0, RY, Y0, [[0, P.wallEnd], [1, lowC]])); } }
  // 一楼：木门板；开着的铺子门板是透光的纸格子
  const gf = fillP(ctx, c, [[X, Y0, z0], [X, h1, z0], [X, h1, z1], [X, Y0, z1]], vg(ctx, c, X, zm, h1, Y0, [[0, P.woodHi], [1, P.wood]]));
  const pz = pr(c, X, h1, zm), big = pz ? pz[2] : 0;
  if (gf && big > 1.2) {
    const pw = 0.62, n = Math.floor((z1 - z0 - 0.3) / (pw + 0.08)), zA = zm - n * (pw + 0.08) / 2;
    for (let k = 0; k < n; k++) { const za = zA + k * (pw + 0.08) + 0.04, zb = za + pw, ya = Y0 + 0.12, yb = h1 - 0.22, open = h.shop && hash(h.i * 7 + k, 3 + s) < 0.75;
      const ko = open ? Lw * (0.6 + 0.4 * hash(h.i + k, 9)) : 0;
      fillP(ctx, c, [[X, ya, za], [X, yb, za], [X, yb, zb], [X, ya, zb]], ko > 0 ? vg(ctx, c, X, za, yb, ya, [[0, mx(P.paperDim, P.paperHot, ko)], [0.6, mx(P.paperDim, P.paper, ko)], [1, mx(P.paperDim, P.warm, ko)]]) : F(mx(P.wood, P.paperDim, 0.35)));
      if (big > 3) { ctx.beginPath(); for (let m = 1; m < 4; m++) seg(ctx, c, [X, ya, za + pw * m / 4], [X, yb, za + pw * m / 4]); for (let m = 1; m < 7; m++) { const y = ya + (yb - ya) * m / 7; seg(ctx, c, [X, y, za], [X, y, zb]); }
        ctx.strokeStyle = F(P.wood, 0.9); ctx.lineWidth = Math.max(0.6, big * 0.022); ctx.stroke(); }
      if (ko > 0) { const p = pr(c, X - s * 0.6, (ya + yb) / 2, (za + zb) / 2); if (p) glow(p[0], p[1], p[2] * 1.6, glowSpr('pap', P.warm), 0.22 * ko); } } }
  // 二楼粉墙 + 窗
  const up = fillP(ctx, c, [[X, h1 + 0.5, z0], [X, h2, z0], [X, h2, z1], [X, h1 + 0.5, z1]], vg(ctx, c, X, zm, h2, h1 + 0.5, [[0, mx(wallC, lowC, 0.25)], [0.15, wallC], [1, lowC]]));
  if (up && big > 0.8) {
    // 雨水的旧痕：从檐下往下的几道深色
    for (let k = 0; k < 4; k++) { const zz = z0 + (z1 - z0) * hash(h.i * 5 + k, 41 + s), ww = 0.2 + 0.6 * hash(h.i + k, 43), yb = h2 - (0.8 + 1.8 * hash(h.i + k, 45));
      fillP(ctx, c, [[X, yb, zz], [X, h2, zz], [X, h2, zz + ww], [X, yb + 0.3, zz + ww]], vg(ctx, c, X, zz, h2, yb, [[0, P.stain, 0.28], [1, P.stain, 0]])); }
    const nw = h.win, wy0 = h1 + 0.5 + (h2 - h1 - 0.5) * 0.28, wy1 = wy0 + Math.min(1.35, (h2 - h1) * 0.42);
    for (let k = 0; k < nw; k++) { const zc = z0 + (z1 - z0) * (k + 0.5) / nw, hw = Math.min(0.62, (z1 - z0) / nw * 0.32), kw = Lw * (hash(h.i * 3 + k, 61 + s) < 0.7 ? 1 : 0.25);
      fillP(ctx, c, [[X, wy0 - 0.12, zc - hw - 0.12], [X, wy1 + 0.12, zc - hw - 0.12], [X, wy1 + 0.12, zc + hw + 0.12], [X, wy0 - 0.12, zc + hw + 0.12]], F(P.wood));
      fillP(ctx, c, [[X, wy0, zc - hw], [X, wy1, zc - hw], [X, wy1, zc + hw], [X, wy0, zc + hw]], kw > 0 ? vg(ctx, c, X, zc, wy1, wy0, [[0, mx(P.paperDim, P.paperHot, kw)], [1, mx(P.paperDim, P.paper, kw)]]) : F(P.paperDim));
      if (big > 2.5) { ctx.beginPath(); for (let m = 1; m < 5; m++) seg(ctx, c, [X, wy0, zc - hw + 2 * hw * m / 5], [X, wy1, zc - hw + 2 * hw * m / 5]); for (let m = 1; m < 5; m++) { const y = wy0 + (wy1 - wy0) * m / 5; seg(ctx, c, [X, y, zc - hw], [X, y, zc + hw]); }
        ctx.strokeStyle = F(P.wood, 0.85); ctx.lineWidth = Math.max(0.5, big * 0.02); ctx.stroke(); }
      if (kw > 0) { const p = pr(c, X - s * 0.5, (wy0 + wy1) / 2, zc); if (p) glow(p[0], p[1], p[2] * 1.4, glowSpr('pap', P.warm), 0.2 * kw); } }
    // 灯笼照在墙上的暖光
    if (L > 0) { ctx.save(); ctx.beginPath(); sub(ctx, up); if (gf) sub(ctx, gf); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      for (const ln of h.lans) { const y = ln.up ? h2 - 0.75 : h1 - 0.4, a = pr(c, X, y, ln.z - 1.7), b = pr(c, X, y, ln.z + 1.7), p = pr(c, X, y, ln.z); if (!a || !b || !p) continue;
        const rw = Math.abs(b[0] - a[0]) / 2 + 2, rh = p[2] * 1.9; ctx.globalAlpha = 0.32 * L * (1 - FOG); ctx.drawImage(glowSpr('wallw', hx('#ff8a3a'), 0.15), p[0] - rw, p[1] - rh, rw * 2, rh * 2); }
      ctx.restore(); }
  }
  // 腰檐（一楼顶上的小披檐）：从河上看是底面 + 檐口
  const midE = s * 5.75;
  eave(ctx, c, X, midE, h1 + 0.5, h1 + 0.08, z0 - 0.1, z1 + 0.1, big);
  // 大屋顶
  eave(ctx, c, X, E, h2 + 0.05, h2 - 0.02, z0 - 0.2, z1 + 0.2, big, ridge, RY, st.glint ? st.glint(X, zm) : 0, s * (6.5 + h.deep + 0.9));
  // 灯笼
  for (const ln of h.lans) { const x = ln.up ? s * 5.62 : s * 5.95, y = ln.up ? h2 - 0.78 : h1 - 0.42, kl = st.lit(x, y, ln.z), k = ln.up ? kl : sm(0.1, 0.6, kl);   // 每盏按自己的位置亮
    const sw = 0.06 * Math.sin(t * 1.3 + ln.ph) * (st.wind ?? 1);
    ctx.beginPath(); seg(ctx, c, [x, ln.up ? h2 - 0.02 : h1 + 0.1, ln.z], [x, y + 0.3, ln.z]); ctx.strokeStyle = F(P.cap, 0.8); ctx.lineWidth = 1; ctx.stroke();
    const p = lantern(ctx, c, x, y, ln.z, k, sw, ln.up ? 0.5 : 0.4);
    if (p && k > 0) { glow(p[0], p[1], p[2] * 1.0, glowSpr('lanc', P.lanHot), 0.6 * k); glow(p[0], p[1], p[2] * 3.2, glowSpr('lan', hx('#ff5a22')), 0.42 * k); } }
};
// 檐：贴墙那条边 (X, yw) 到檐口 (E, ye)；镜头在檐下看底面（椽子一根根），在檐上看瓦面（瓦垄）；ridge 给了就是大屋顶（瓦面一直铺到屋脊）
const eave = (ctx, c, X, E, yw, ye, z0, z1, big, ridge, RY, gl = 0, back) => {
  const s = Math.sign(X), below = c.y < ye + (yw - ye) * 0.5;
  if (below) {
    const sp = fillP(ctx, c, [[X, yw - 0.18, z0], [E, ye - 0.12, z0], [E, ye - 0.12, z1], [X, yw - 0.18, z1]], F(P.soffit));
    if (sp && big > 1.5) { ctx.beginPath(); for (let z = z0 + 0.1; z < z1; z += 0.28) seg(ctx, c, [X, yw - 0.18, z], [E, ye - 0.12, z]); ctx.strokeStyle = F(P.rafter, 0.9); ctx.lineWidth = Math.max(0.6, big * 0.05); ctx.stroke(); }
  }
  if (!below || ridge !== undefined) { const top = ridge !== undefined ? [ridge, RY] : [X, yw];
    const rp = fillP(ctx, c, [[E, ye, z0], [top[0], top[1], z0], [top[0], top[1], z1], [E, ye, z1]], F(P.tile));
    if (rp && !below && big > 0.6) { ctx.beginPath(); for (let z = z0 + 0.11; z < z1; z += 0.23) seg(ctx, c, [E, ye + 0.03, z], [top[0], top[1], z]); ctx.strokeStyle = F(gl > 0 ? mx(P.tileHi, hx('#ffd27a'), gl) : P.tileHi, 0.55 + 0.4 * gl); ctx.lineWidth = Math.max(0.5, big * 0.035); ctx.stroke(); }
    if (back !== undefined && c.y > RY) { const bp = fillP(ctx, c, [[ridge, RY, z0], [back, ye, z0], [back, ye, z1], [ridge, RY, z1]], F(mx(P.tile, P.tileHi, 0.12)));
      if (bp && big > 0.6) { ctx.beginPath(); for (let z = z0 + 0.11; z < z1; z += 0.23) seg(ctx, c, [back, ye + 0.03, z], [ridge, RY, z]); ctx.strokeStyle = F(gl > 0 ? mx(P.tileHi, hx('#ffd27a'), gl) : P.tileHi, 0.4 + 0.4 * gl); ctx.lineWidth = Math.max(0.5, big * 0.035); ctx.stroke(); } }
    if (ridge !== undefined) { ctx.beginPath(); seg(ctx, c, [ridge, RY, z0 - 0.3], [ridge, RY, z1 + 0.3]); ctx.strokeStyle = F(P.tile); ctx.lineWidth = Math.max(1, big * 0.3); ctx.stroke(); } }
  // 檐口：一条厚边 + 一排瓦当，两头往上翘
  const fr = fillP(ctx, c, [[E, ye - 0.14, z0], [E, ye + 0.1, z0], [E, ye + 0.1, z1], [E, ye - 0.14, z1]], F(mx(P.tile, P.tileHi, 0.15)));
  for (const [zz, d] of [[z0, -1], [z1, 1]]) fillP(ctx, c, [[E, ye - 0.14, zz], [E, ye + 0.1, zz], [E - s * 0.15, ye + 0.42, zz + d * 0.35], [E, ye + 0.02, zz + d * 0.1]], F(P.tile));
  if (fr && big > 4) { ctx.fillStyle = F(P.tileHi, 0.2); for (let z = z0 + 0.12; z < z1; z += 0.23) { const p = pr(c, E - s * 0.02, ye - 0.06, z); if (p) { ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.5, p[2] * 0.03), 0, TAU); ctx.fill(); } } }
};

// ---------------- 驳岸、石板街 ----------------
const bank = (ctx, c, side, za, zb, big, st) => {
  const X = side * 4;
  const wf = fillP(ctx, c, [[X, -0.3, za], [X, 1.08, za], [X, 1.08, zb], [X, -0.3, zb]], vg(ctx, c, X, (za + zb) / 2, 1.08, -0.3, [[0, P.stoneHi], [0.55, P.stone], [0.85, P.moss], [1, hx('#0b1426')]]));
  if (wf && big > 6) for (let r = 0; r < 3; r++) { const y0 = [-0.3, 0.32, 0.7][r], y1 = [0.32, 0.7, 1.08][r]; for (let z = Math.floor(za / 0.9) * 0.9 + (r % 2) * 0.45 - 0.9; z < zb; z += 0.9) { const a = Math.max(za, z), b = Math.min(zb, z + 0.9); if (b <= a) continue; const hh = hash(Math.round(z / 0.45), r * 7 + (side > 0 ? 3 : 5));
      fillP(ctx, c, [[X, y0, a], [X, y1, a], [X, y1, b], [X, y0, b]], vg(ctx, c, X, (a + b) / 2, y1, y0, [[0, mx(P.stoneHi, P.stone, 0.2 + 0.5 * hh)], [1, mx(P.stone, r ? P.stoneJ : P.moss, 0.25 + 0.4 * hh)]])); } }
  if (wf && big > 0.9) { ctx.beginPath(); for (const y of [0.32, 0.7]) seg(ctx, c, [X, y, za], [X, y, zb]);
    for (let r = 0; r < 3; r++) { const y0 = [-0.3, 0.32, 0.7][r], y1 = [0.32, 0.7, 1.08][r]; for (let z = Math.ceil(za / 0.9) * 0.9 + (r % 2) * 0.45; z < zb; z += 0.9) seg(ctx, c, [X, y0, z], [X, y1, z]); }
    ctx.strokeStyle = F(P.stoneJ, 0.85); ctx.lineWidth = Math.max(0.6, big * 0.03); ctx.stroke(); }
  // 压顶条石：稍微探出来一点，顶边受月光
  fillP(ctx, c, [[X - side * 0.08, 1.04, za], [X - side * 0.08, 1.24, za], [X - side * 0.08, 1.24, zb], [X - side * 0.08, 1.04, zb]], F(mx(P.stone, P.stoneHi, 0.5)));
  if (c.y > 1.25) { const top = fillP(ctx, c, [[X - side * 0.08, 1.24, za], [side * 6.5, 1.24, za], [side * 6.5, 1.24, zb], [X - side * 0.08, 1.24, zb]], F(mx(P.stone, P.stoneHi, 0.25)));
    if (top && big > 6) for (let z = Math.floor(za / 1.1) * 1.1; z < zb; z += 1.1) for (const [xa, xb, q] of [[X - side * 0.08, side * 5.2, 1], [side * 5.2, side * 6.5, 2]]) { const a = Math.max(za, z), b = Math.min(zb, z + 1.1); if (b <= a) continue; const hh = hash(Math.round(z / 1.1), q * 13 + side);
      fillP(ctx, c, [[xa, 1.245, a], [xb, 1.245, a], [xb, 1.245, b], [xa, 1.245, b]], F(mx(mx(P.stone, P.stoneHi, 0.15 + 0.35 * hh), P.warm, 0.06 * st.lit(xa, 1.2, a)))); }
    if (top && big > 0.9) { ctx.beginPath(); for (let z = Math.ceil(za / 1.1) * 1.1; z < zb; z += 1.1) seg(ctx, c, [X, 1.25, z], [side * 6.5, 1.25, z]); seg(ctx, c, [side * 5.2, 1.25, za], [side * 5.2, 1.25, zb]); ctx.strokeStyle = F(P.stoneJ, 0.6); ctx.lineWidth = 1; ctx.stroke(); } }
};

// ---------------- 石拱桥 ----------------
const BRT = (x) => 1.2 + 4.0 * Math.pow(Math.max(0, 1 - (x / 7.4) ** 2), 0.8);
const bridge = (ctx, c, b, st, t) => {
  const zf = b.z - 1.7, zk = b.z + 1.7, R = 3.6, Yc = 0.15, big = (pr(c, 0, 3, zf) || [0, 0, 0])[2];
  if (c.z < zf) {
    // 拱底：看穿桥洞时看得到的那段弧面
    for (let k = 0; k < 18; k++) { const a = Math.PI * k / 18, a2 = Math.PI * (k + 1) / 18, m = Math.sin((a + a2) / 2);
      fillP(ctx, c, [[Math.cos(a) * R, Yc + Math.sin(a) * R, zf], [Math.cos(a2) * R, Yc + Math.sin(a2) * R, zf], [Math.cos(a2) * R, Yc + Math.sin(a2) * R, zk], [Math.cos(a) * R, Yc + Math.sin(a) * R, zk]], F(mx(hx('#2a2f52'), hx('#141632'), m))); }
    const outer = []; for (let x = -7.4; x <= 7.41; x += 0.37) outer.push([x, BRT(x), zf]); outer.push([7.4, -0.5, zf], [-7.4, -0.5, zf]);
    const hole = [[R, -0.5, zf]]; for (let k = 0; k <= 30; k++) { const a = Math.PI * k / 30; hole.push([Math.cos(a) * R, Yc + Math.sin(a) * R, zf]); } hole.push([-R, -0.5, zf]);
    const o = clipP(c, outer), hp = clipP(c, hole); if (!o) return;
    ctx.save(); ctx.beginPath(); sub(ctx, o); if (hp) sub(ctx, hp); ctx.fillStyle = vg(ctx, c, 0, zf, 5.2, -0.4, [[0, mx(P.stoneHi, hx('#9aa2c8'), 0.3)], [0.5, P.stone], [0.85, P.moss], [1, hx('#0b1426')]]); ctx.fill('evenodd'); ctx.clip('evenodd');
    if (big > 0.8) { ctx.beginPath();
      for (let y = 0.45; y < 5.4; y += 0.45) seg(ctx, c, [-7.4, y, zf], [7.4, y, zf]);
      for (let r = 0; r < 12; r++) { const y0 = r * 0.45, off = (r % 2) * 0.55; for (let x = -7.4 + off; x < 7.4; x += 1.1) seg(ctx, c, [x, y0, zf], [x, y0 + 0.45, zf]); }
      ctx.strokeStyle = F(P.stoneJ, 0.7); ctx.lineWidth = Math.max(0.6, big * 0.025); ctx.stroke();
      // 拱券石：一圈放射的缝，外沿一道亮边
      ctx.beginPath(); for (let k = 0; k <= 26; k++) { const a = Math.PI * k / 26; seg(ctx, c, [Math.cos(a) * R, Yc + Math.sin(a) * R, zf], [Math.cos(a) * (R + 0.7), Yc + Math.sin(a) * (R + 0.7), zf]); }
      ctx.strokeStyle = F(P.stoneJ, 0.95); ctx.lineWidth = Math.max(0.8, big * 0.035); ctx.stroke();
      ctx.beginPath(); for (let k = 0; k <= 40; k++) { const a = Math.PI * k / 40, p = pr(c, Math.cos(a) * (R + 0.72), Yc + Math.sin(a) * (R + 0.72), zf); if (p) k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.strokeStyle = F(P.stoneHi, 0.75); ctx.lineWidth = Math.max(0.8, big * 0.05); ctx.stroke(); }
    ctx.restore();
    // 栏板 + 望柱
    const rail = []; for (let x = -7.0; x <= 7.01; x += 0.35) rail.push([x, BRT(x) + 0.78, zf]); for (let x = 7.0; x >= -7.01; x -= 0.35) rail.push([x, BRT(x) - 0.02, zf]);
    fillP(ctx, c, rail, F(mx(P.stone, P.stoneHi, 0.55)));
    if (big > 1) { ctx.beginPath(); for (let x = -6.7; x < 6.8; x += 1.25) { const y = BRT(x); seg(ctx, c, [x, y + 0.08, zf - 0.01], [x, y + 0.7, zf - 0.01]); } ctx.strokeStyle = F(P.stoneJ, 0.6); ctx.lineWidth = Math.max(0.8, big * 0.06); ctx.stroke(); }
    for (let x = -6.875; x < 7; x += 1.25) { const y = BRT(x); fillP(ctx, c, [[x - 0.11, y, zf - 0.04], [x - 0.11, y + 1.05, zf - 0.04], [x + 0.11, y + 1.05, zf - 0.04], [x + 0.11, y, zf - 0.04]], F(mx(P.stone, P.stoneHi, 0.75)));
      const k = st.lit(x, y, b.z), k2 = Math.round((x + 6.875) / 1.25) % 2 === 0;
      if (k2) { const p = lantern(ctx, c, x, y + 1.42, zf - 0.08, k, 0.05 * Math.sin(t * 1.1 + x), 0.42); if (p && k > 0) { glow(p[0], p[1], p[2] * 1.0, glowSpr('lanc', P.lanHot), 0.6 * k); glow(p[0], p[1], p[2] * 3.4, glowSpr('lan', hx('#ff5a22')), 0.45 * k); } } }
  }
};

// ---------------- 横过河的灯笼串、红绸 ----------------
const lanString = (ctx, c, S, st, t) => {
  const y = (x) => S.y - S.sag * (1 - (x / 6.4) ** 2), k = st.lit(0, S.y, S.z);
  ctx.beginPath(); let first = true; for (let x = -6.4; x <= 6.41; x += 0.4) { const p = pr(c, x, y(x), S.z); if (!p) continue; first ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); first = false; }
  ctx.strokeStyle = F(P.cap, 0.9); ctx.lineWidth = 1.2; ctx.stroke();
  for (let i = 0; i < S.n; i++) { const x = -5.4 + 10.8 * i / (S.n - 1), sw = 0.08 * Math.sin(t * 1.6 + i + S.z) * (st.wind ?? 1); const p = lantern(ctx, c, x, y(x) - 0.55, S.z, k, sw, 0.44);
    if (p && k > 0) { glow(p[0], p[1], p[2] * 1.0, glowSpr('lanc', P.lanHot), 0.6 * k); glow(p[0], p[1], p[2] * 3.2, glowSpr('lan', hx('#ff5a22')), 0.42 * k); } }
};
// 红绸：一幅宽 0.55 米的绸子兜过河，风让它沿长度起伏、翻面（翻到背面颜色深）
// shortcut: 绸子按风场解析地摆，没用 M.sim 算惯性；要和锦鲤、人碰撞时改成 verlet
const ribbon = (ctx, c, Rb, st, t) => {
  const wv = st.wind ?? 1, k = st.lit(0, Rb.y, Rb.z), pts = [], U = st.unfurl ? st.unfurl(Rb) : 1, gust = Math.max(0, wv - 1.2);
  if (U <= 0.01) return;
  for (let i = 0; i <= 40; i++) { const u = i / 40 * U, x = -6.4 + 12.8 * u, sag = Rb.sag * (1 - 0.55 * Math.min(1, gust)), yy = Rb.y - sag * (1 - (2 * u - 1) ** 2) + gust * 0.5 * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(t * 3.1 + u * 6)), dz = Rb.dz * u + 0.35 * wv * Math.sin(t * (1.7 + gust) + u * 7 + Rb.ph) * Math.sin(Math.PI * u) - gust * 1.2 * Math.sin(Math.PI * u), tw = 1.4 * Math.sin(t * 1.2 + u * 9 + Rb.ph * 2) + 0.5 * Math.sin(u * 23 + Rb.ph);
    pts.push([x, yy + 0.05 * Math.sin(t * 2.3 + u * 9), Rb.z + dz, tw]); }
  for (let i = 0; i < 40; i++) { const a = pts[i], b = pts[i + 1], wa = 0.19, ta = a[3], tb = b[3];
    const q = [[a[0], a[1] + wa * Math.cos(ta), a[2] + wa * Math.sin(ta)], [b[0], b[1] + wa * Math.cos(tb), b[2] + wa * Math.sin(tb)], [b[0], b[1] - wa * Math.cos(tb), b[2] - wa * Math.sin(tb)], [a[0], a[1] - wa * Math.cos(ta), a[2] - wa * Math.sin(ta)]];
    const face = Math.cos(ta), sheen = Math.pow(Math.max(0, Math.cos(ta * 1.7 - 0.6)), 8);
    let col = mx(P.silkDk, P.silk, 0.35 + 0.65 * Math.abs(face)); col = mx(col, P.silkHi, sheen * 0.75); col = mx(col, mx(col, hx('#ffb070'), 0.6), k * 0.35);
    fillP(ctx, c, q, F(col, clamp((depth(c, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2) - 0.6) / 3))); }   // 贴着镜头的那几段淡掉（审片：157.6 秒俯冲时擦过一幅红绸、一个绣球，算闪）
  const m = pts[20], p = U > 0.98 ? pr(c, m[0], m[1] - 0.35, m[2]) : null, kb = st.ball ? st.ball(Rb) : 0, nb = p ? clamp((depth(c, m[0], m[1] - 0.35, m[2]) - 1) / 5) : 0; if (p && nb > 0) { if (kb > 0) glow(p[0], p[1], 0.48 * p[2] * 4, glowSpr('ball', hx('#ffb040'), 0.2), 0.7 * kb * nb); const R = 0.48 * p[2]; ctx.save(); ctx.globalAlpha = (1 - FOG * 0.5) * nb; ctx.drawImage(ballSpr(), p[0] - R, p[1] - R * 0.9, R * 2, R * 3.2); ctx.restore(); if (k > 0) glow(p[0], p[1], R * 2.5, glowSpr('lan', hx('#ff5a22')), 0.18 * k * nb); }
};
// 绣球：一团红绸扎的花球，上下两道金箍，底下垂两条绸尾
const ballSpr = () => M.cached('tball', 128, 205, (g) => { const cx = 64, cy = 64, R = 58;
  for (const [a, b] of [[0.5, 1.05], [-0.5, 1.05]]) { g.fillStyle = css(P.silk); g.beginPath(); g.moveTo(cx + a * 20, cy + 40); g.quadraticCurveTo(cx + a * 70, cy + 100, cx + a * 30, cy + 140 * b); g.lineTo(cx + a * 46, cy + 138 * b); g.quadraticCurveTo(cx + a * 80, cy + 90, cx + a * 34, cy + 36); g.fill(); }
  const gr = g.createRadialGradient(cx - 18, cy - 20, 6, cx, cy, R); gr.addColorStop(0, css(P.silkHi)); gr.addColorStop(0.45, css(P.silk)); gr.addColorStop(1, css(P.silkDk)); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; g.strokeStyle = 'rgba(90,0,20,0.45)'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45, R * 0.42, a + 2.2, a + 4.2); g.stroke(); g.strokeStyle = 'rgba(255,170,160,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45, R * 0.36, a + 2.4, a + 3.8); g.stroke(); }
  g.fillStyle = css(P.gold); g.fillRect(cx - 9, 0, 18, 9); g.beginPath(); g.ellipse(cx, cy + R - 2, 10, 6, 0, 0, TAU); g.fill(); }, true);

// ---------------- 水面 ----------------
const waterPoly = (c, zFar = 1600) => [[-4, 0, c.z - 300], [-4, 0, zFar], [4, 0, zFar], [4, 0, c.z - 300]];
// 倒影：同一个世界用镜像机位（水面下）画一遍，再上下翻过来贴进水里，按水波错开一条条
const reflect = (ctx, c, st, t) => {
  const Rl = M.layer('town_refl'), r = Rl.getContext('2d'), Fl = M.layer('town_refl2'), f = Fl.getContext('2d');
  r.setTransform(1, 0, 0, 1, 0, 0); r.clearRect(0, 0, Rl.width, Rl.height); r.setTransform(SC, 0, 0, SC, 0, 0);
  const cm = cam({ ...c, y: -c.y, pitch: -c.pitch });
  drawWorld(r, cm, true, null, st, t);
  f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, Fl.width, Fl.height); f.setTransform(1, 0, 0, -1, 0, Fl.height); f.drawImage(Rl, 0, 0); f.setTransform(1, 0, 0, 1, 0, 0);
  const wp = clipP(c, waterPoly(c)); if (!wp) return null;
  ctx.save(); ctx.beginPath(); sub(ctx, wp); ctx.clip();
  const hy = c.oy + c.f * Math.tan(c.pitch), st2 = 3;
  for (let y = Math.max(0, Math.floor(hy) - 2); y < H; y += st2) { const d = Math.max(1, y - hy), amp = Math.min(14, 0.012 * d * (1 + 0.6 * Math.sin(y * 0.031 + t * 0.7)) * (st.waves ?? 1)), dx = amp * Math.sin(y * 0.19 + t * 2.1) + amp * 0.5 * Math.sin(y * 0.071 - t * 1.3);
    ctx.drawImage(Fl, 0, y * SC, Fl.width, st2 * SC, dx, y, W, st2); }
  // 水本身的颜色：近处深、远处多反天光
  const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, css(P.waterFar, 0.25)); g.addColorStop(0.25, css(P.water, 0.45)); g.addColorStop(1, css(P.water, 0.68));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore(); return wp;
};

// ---------------- 后期：泛光、暗角、颗粒、调色 ----------------
let BL = null;
const post = (ctx, st) => {
  if (!BL) { BL = document.createElement('canvas'); BL.width = Math.ceil(W * SC / 4); BL.height = Math.ceil(H * SC / 4); }
  const b = BL.getContext('2d'); b.globalCompositeOperation = 'copy'; b.filter = 'none'; b.drawImage(ctx.canvas, 0, 0, BL.width, BL.height); b.globalCompositeOperation = 'multiply'; b.drawImage(BL, 0, 0); b.drawImage(BL, 0, 0);
  ctx.save(); M.resetTransform(ctx); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = st.bloom ?? 0.5; ctx.filter = 'blur(8px)'; ctx.drawImage(BL, 0, 0, W, H); ctx.globalAlpha = (st.bloom ?? 0.5) * 0.8; ctx.filter = 'blur(30px)'; ctx.drawImage(BL, 0, 0, W, H); ctx.filter = 'none';
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.3; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3b46a8'); g.addColorStop(0.6, '#7a5aa0'); g.addColorStop(1, '#ff9a5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(M.cached('tvig', W, H, (v) => { const gr = v.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05); gr.addColorStop(0, 'rgba(4,4,20,0)'); gr.addColorStop(1, 'rgba(4,4,20,0.42)'); v.fillStyle = gr; v.fillRect(0, 0, W, H); }, true), 0, 0, W, H);
  const gt = M.cached('tgrain', 256, 256, (v) => { const d = v.createImageData(256, 256), r = M.rng(77); for (let i = 0; i < d.data.length; i += 4) { const n = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = n; d.data[i + 3] = 255; } v.putImageData(d, 0, 0); });
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.045; ctx.fillStyle = ctx.createPattern(gt, 'repeat'); ctx.translate((M.t * 997 % 256) | 0, (M.t * 613 % 256) | 0); ctx.fillRect(-256, -256, W + 512, H + 512);
  ctx.restore();
};

// ---------------- 河灯、孔明灯、垂柳、后排的房子、高处的地面和灯网（第十一次铺开时加）----------------
const LOT = T.lot = [], SKY = T.sky = [], WIL = T.wil = [], HB = T.hb = [], NET = T.net = [];
const buildMore = () => {
  const r = M.rng(4242);
  for (let i = 0; i < 900; i++) LOT.push({ i, x: (r() - 0.5) * 6.6, z: 40 + r() * 700, ph: r() * TAU, s: 0.85 + 0.3 * r(), v: 0.25 + 0.2 * r(), u: r() });
  for (let i = 0; i < 2600; i++) { const near = r() < 0.6; SKY.push({ i, x: (r() - 0.5) * (near ? 50 : 320), z: near ? 300 + r() * 700 : 200 + r() * 900, u: r(), v: 2.2 + 2.0 * r(), ph: r() * TAU, s: 1.3 + 0.6 * r() }); }
  for (const [z, sd] of [[17, -1], [31, 1], [77, 1], [104, -1], [131, -1], [236, 1], [251, -1], [292, 1], [333, -1], [410, 1], [455, -1]]) WIL.push({ z, x: sd * 5.25, sd, ph: hash(z, 3) * TAU });
  for (const side of [-1, 1]) for (const X0 of [14.5, 24.5, 34.5]) { let z = -60, i = 0; while (z < 1500) { const q = (k) => hash(i * 17 + k + X0 * 3, side > 0 ? 7 : 9), w = 5 + 4 * q(1);
      HB.push({ side, X0, z0: z, z1: z + w, h2: 4.5 + 3.5 * q(2), deep: 6 + 3 * q(3), lan: q(4) < 0.8, i }); z += w + (q(5) < 0.25 ? 3 : 0.3); i++; } }
  for (const L of [10.5, 20, 30, 42, 55, 70, 88, 110, 135, 165, 200, 240]) for (const sd of [-1, 1]) for (let z = -60; z < 1500; z += 5 + 3 * hash(z | 0, L | 0)) NET.push([sd * (L + (hash(z | 0, 77) - 0.5) * 2), z]);
  for (let z = 0; z < 1500; z += 38) for (let x = 10; x < 240; x += 4.5) for (const sd of [-1, 1]) NET.push([sd * x, z + (hash(x | 0, z | 0) - 0.5) * 3]);
};
// 河灯：莲花瓣一层层（尖白根粉），底下一圈绿叶托，花心一点烛火
const lotusSpr = (on) => M.cached('tlotus' + on, 160, 120, (g) => {
  const cx = 80, cy = 82, base = on ? '#ff6f9a' : '#6a2a48', tip = on ? '#fff4f7' : '#b48aa2';
  const petal = (a, len, wd) => { g.save(); g.translate(cx, cy); g.rotate(a); const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, base); gr.addColorStop(1, tip); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(wd, -len * 0.35, wd * 0.7, -len * 0.8, 0, -len); g.bezierCurveTo(-wd * 0.7, -len * 0.8, -wd, -len * 0.35, 0, 0); g.fill(); g.strokeStyle = 'rgba(140,30,70,0.35)'; g.lineWidth = 1.2; g.stroke(); g.restore(); };
  g.fillStyle = on ? '#2f7a4a' : '#173a2c'; g.beginPath(); g.ellipse(cx, cy + 4, 66, 15, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(10,40,20,0.5)'; g.lineWidth = 1.5; for (let k = 0; k < 10; k++) { g.beginPath(); g.moveTo(cx, cy + 4); g.lineTo(cx + Math.cos(k / 10 * TAU) * 64, cy + 4 + Math.sin(k / 10 * TAU) * 14); g.stroke(); }
  for (const a of [-1.3, 1.3, -0.9, 0.9]) petal(a, 50, 19);
  for (const a of [-0.48, 0.48, 0]) petal(a, 58, 21);
  if (on) { const gr = g.createRadialGradient(cx, cy - 24, 1, cx, cy - 24, 28); gr.addColorStop(0, 'rgba(255,252,225,1)'); gr.addColorStop(0.3, 'rgba(255,205,95,0.85)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(cx - 32, cy - 54, 64, 64); }
  for (const a of [-0.55, 0.62]) petal(a, 40, 19);
}, true);
// 河灯 L 在 t 的位置：顺水往 −z 漂、轻轻晃；st.lotus.lift(L, t) 给离水升空的高度
const lotPos = T.lotPos = (L, t, st) => { const lf = st.lotus.lift ? st.lotus.lift(L, t) : 0, p = [L.x + 0.15 * Math.sin(t * 0.4 + L.ph) + lf * 0.08 * Math.sin(t * 0.7 + L.ph), 0.03 + 0.02 * Math.sin(t * 1.3 + L.ph) + lf, L.z - L.v * (t - 130) - (st.lotus.drift ? st.lotus.drift(L, t) : 0)]; return st.lotus.pos ? st.lotus.pos(L, t, p) : p; };   // pos：镜头可以改写（水龙卷把河灯卷上去）
const lotus = (ctx, c, L, st, t, p3) => {
  const p = pr(c, ...p3); if (!p) return; const k = st.lotus.lit(L, t), w = 0.6 * L.s * p[2], a = st.lotus.a(L, t) * clamp((1200 - w) / 600); if (a <= 0) return;  // 离镜头太近就淡掉，不铺满画面
  if (w > 1.5) { const dy = c.y - p3[1], dh = Math.hypot(c.x - p3[0], c.z - p3[2]) + 0.01, sq = 0.5 + 0.5 * Math.min(1, Math.abs(dy) / dh * 1.4), h = w * 0.75 * (0.7 + 0.3 * sq);
    ctx.save(); ctx.globalAlpha = a * (1 - FOG * 0.6); if (k < 1) ctx.drawImage(lotusSpr(0), p[0] - w / 2, p[1] - h * 0.68, w, h); if (k > 0) { ctx.globalAlpha *= k; ctx.drawImage(lotusSpr(1), p[0] - w / 2, p[1] - h * 0.68, w, h); } ctx.restore(); }
  if (k > 0) { glow(p[0], p[1] - w * 0.2, Math.max(2, p[2] * 0.5), glowSpr('lanc', P.lanHot), 0.55 * k * a); glow(p[0], p[1] - w * 0.15, Math.max(3, p[2] * 1.6), glowSpr('lot', hx('#ff7a8a')), 0.35 * k * a); }
};
// 孔明灯：上宽下窄的纸罩，底口一团火
const skySpr = () => M.cached('tskyl', 80, 120, (g) => {
  g.beginPath(); g.moveTo(14, 14); g.quadraticCurveTo(40, 2, 66, 14); g.lineTo(60, 100); g.quadraticCurveTo(40, 106, 20, 100); g.closePath();
  const gr = g.createLinearGradient(0, 4, 0, 104); gr.addColorStop(0, '#b8342a'); gr.addColorStop(0.45, '#ff7a32'); gr.addColorStop(0.85, '#ffd27a'); gr.addColorStop(1, '#fff2c0'); g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(120,30,10,0.35)'; g.lineWidth = 1.3; for (const x of [27, 40, 53]) { g.beginPath(); g.moveTo(x + (x - 40) * 0.25, 8); g.lineTo(x - (x - 40) * 0.1, 102); g.stroke(); }
  g.fillStyle = 'rgba(60,20,10,0.8)'; g.fillRect(20, 99, 40, 3);
  const f = g.createRadialGradient(40, 96, 1, 40, 96, 16); f.addColorStop(0, 'rgba(255,255,230,1)'); f.addColorStop(0.4, 'rgba(255,200,80,0.8)'); f.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = f; g.fillRect(20, 78, 40, 36);
}, true);
// st.sky = { at(Lk) → 放飞时刻, a(Lk, t) → 透明度 }；还没放返回 null
const skyPos = T.skyPos = (Lk, t, st) => { const t0 = st.sky.at(Lk); if (t < t0) return null; const age = t - t0; return [Lk.x + 0.35 * age + 0.4 * Math.sin(age * 0.5 + Lk.ph), 7 + Lk.v * age + 0.3 * Math.sin(age * 0.9 + Lk.ph), Lk.z + 0.12 * age]; };
const skyLan = (ctx, c, Lk, p3, t, a) => { const p = pr(c, ...p3); if (!p) return; const w = 0.9 * Lk.s * p[2], fl = 0.85 + 0.15 * Math.sin(t * 9 + Lk.ph * 5);
  if (w > 1.6) { ctx.save(); ctx.globalAlpha = a * (1 - FOG * 0.5); ctx.translate(p[0], p[1]); ctx.rotate(0.06 * Math.sin(t * 0.8 + Lk.ph)); ctx.drawImage(skySpr(), -w / 2, -w * 0.75, w, w * 1.5); ctx.restore(); }
  glow(p[0], p[1] + w * 0.5, Math.max(1.5, w * 1.6), glowSpr('skyg', hx('#ff9a40'), 0.2), 0.5 * a * fl); if (w <= 1.6) glow(p[0], p[1], Math.max(1.2, w * 0.7), glowSpr('lanc', P.lanHot), 0.8 * a * fl); };
// 垂柳：歪向河的干，一丝丝垂下来的柳条，叶子是一串短撇
// shortcut: 柳条按风解析地摆，没用 M.sim；要和锦鲤碰着时改 verlet
const willow = (ctx, c, w, st, t) => {
  const p0 = pr(c, w.x, 3, w.z); if (!p0) return; const big = p0[2], top = [w.x - w.sd * 0.9, 5.6, w.z], wind = st.wind ?? 1, k = st.lit(w.x, 4, w.z);
  fillP(ctx, c, [[w.x - 0.24, 1.2, w.z], [top[0] - 0.12, top[1], w.z], [top[0] + 0.12, top[1], w.z], [w.x + 0.24, 1.2, w.z]], F(mx(hx('#1b1214'), hx('#4a2a22'), 0.3 + 0.4 * k)));
  const n = big > 40 ? 70 : big > 8 ? 46 : 20, leaf = mx(hx('#1e4634'), hx('#9cc36a'), 0.25 + 0.55 * k);
  for (let i = 0; i < n; i++) { const h1 = hash(i, w.z * 3 | 0), h2 = hash(i, w.z * 5 | 0), a = h1 * TAU, r = 2.8 * Math.sqrt(h2), an = [top[0] + Math.cos(a) * r, top[1] + 0.5 - 0.12 * r * r, w.z + Math.sin(a) * r], len = 2.6 + 1.6 * hash(i, 9), pts = [];
    for (let j = 0; j <= 6; j++) { const f = j / 6, sw = wind * 0.35 * f ** 1.5 * Math.sin(t * 1.3 + w.ph + i * 0.7 - j * 0.4); pts.push(pr(c, an[0] + w.sd * 0.15 * f + sw * 0.4, an[1] - len * f, an[2] + sw - wind * 0.2 * f * f)); }
    if (pts.some(q => !q)) continue;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); ctx.strokeStyle = F(mx(leaf, hx('#0e2418'), 0.45)); ctx.lineWidth = Math.max(0.5, pts[3][2] * 0.02); ctx.stroke();
    if (big > 2.5) { ctx.fillStyle = F(mx(leaf, hx('#e8f0a0'), 0.25 * hash(i, 4)), 0.9); for (let j = 1; j < 6; j++) { const q = pts[j], q2 = pts[j + 1], L = Math.max(1, q[2] * 0.09);
      for (const sd of [-1, 1]) { ctx.save(); ctx.translate((q[0] + q2[0]) / 2 + sd * L * 0.4, (q[1] + q2[1]) / 2); ctx.rotate(sd * 0.6 + Math.atan2(q2[1] - q[1], q2[0] - q[0]) - Math.PI / 2); ctx.beginPath(); ctx.ellipse(0, 0, L * 0.22, L * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore(); } } } }
};
// 后排的房子（高处才看得到）：一面墙、两面坡、一盏灯
const houseLite = (ctx, c, h, st) => { const s = h.side, X = s * h.X0, z0 = h.z0, z1 = h.z1, zm = (z0 + z1) / 2, RX = s * (h.X0 + h.deep / 2), RY = h.h2 + 2, BX = s * (h.X0 + h.deep + 0.7), E = s * (h.X0 - 0.7), L = st.lit(X, h.h2, zm);
  fillP(ctx, c, [[X, 1.2, z0], [X, h.h2, z0], [X, h.h2, z1], [X, 1.2, z1]], F(mx(P.wallLow, P.wall, 0.2)));
  if (c.z < z0) fillP(ctx, c, [[X, 1.2, z0], [X, h.h2, z0], [RX, RY, z0], [BX, h.h2, z0], [BX, 1.2, z0]], F(mx(P.wallLow, P.wallEnd, 0.35)));
  const gl = st.glint ? st.glint(X, zm) : 0, tc = (k) => F(gl > 0 ? mx(mx(P.tile, P.tileHi, k), hx('#c8903a'), gl * 0.6) : mx(P.tile, P.tileHi, k));
  fillP(ctx, c, [[E, h.h2, z0], [RX, RY, z0], [RX, RY, z1], [E, h.h2, z1]], tc(0.18)); if (c.y > RY) fillP(ctx, c, [[RX, RY, z0], [BX, h.h2, z0], [BX, h.h2, z1], [RX, RY, z1]], tc(0.05));
  if (h.lan && L > 0) { const p = pr(c, E, h.h2 - 0.8, zm); if (p) { glow(p[0], p[1], Math.max(1.5, p[2] * 0.5), glowSpr('lanc', P.lanHot), 0.6 * L); glow(p[0], p[1], Math.max(2.5, p[2] * 2.5), glowSpr('lan', hx('#ff5a22')), 0.4 * L); } } };
// 高处：底下一整片地，远处巷子里的灯连成网
const ground = (ctx, c, st) => { FOG = 0; for (const sd of [-1, 1]) fillP(ctx, c, [[sd * 6.5, 1.15, c.z - 200], [sd * 400, 1.15, c.z - 200], [sd * 400, 1.15, c.z + 1500], [sd * 6.5, 1.15, c.z + 1500]], css(hx('#15183a')));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, z] of NET) { const k = st.lit(x, 1.5, z); if (k <= 0) continue; const q = toC(c, x, 1.6, z); if (q[2] < 2 || q[2] > 1300) continue; const p = scr(c, q); if (p[0] < -20 || p[0] > W + 20 || p[1] < -20 || p[1] > H + 20) continue;
    const R = Math.max(1.2, p[2] * 0.9), fo = 1 - Math.min(0.75, q[2] / 1600); ctx.globalAlpha = 0.55 * k * fo; ctx.drawImage(glowSpr('net', hx('#ffb050'), 0.18), p[0] - R * 2, p[1] - R * 2, R * 4, R * 4); }
  ctx.restore(); };

// ---------------- 一个世界（正画、水里的镜像、水下看上去共用）----------------
const drawWorld = (g, cc, mirror, afterSky, st, t) => {
  const S = mirror && st.litM ? { ...st, lit: st.litM } : st, high = cc.y > 6;
  sky(g, cc, t, S); if (afterSky) afterSky();
  if (!mirror && high) ground(g, cc, S);
  const items = [], far = high ? 700 : 420, near = cc.z - (high ? 200 : 30);
  if (st.sky && !mirror) { for (const Lk of SKY) { const p3 = skyPos(Lk, t, st); if (!p3) continue; const d = depth(cc, ...p3); if (d < NEAR) continue; const a = st.sky.a ? st.sky.a(Lk, t) : 1; if (a <= 0) continue;
      if (d > 90) { FOG = clamp((d - 60) / 900, 0, 0.7); skyLan(g, cc, Lk, p3, t, a); } else items.push([d, () => skyLan(g, cc, Lk, p3, t, a)]); } FOG = 0; }
  for (const h of HS) { if (h.z1 < near || h.z0 > cc.z + far) continue; items.push([depth(cc, h.side * 9, 4, (h.z0 + h.z1) / 2) + 1.0, () => house(g, cc, h, S, t)]); }
  if (high && !mirror) for (const h of HB) { if (h.z1 < near || h.z0 > cc.z + far) continue; items.push([depth(cc, h.side * (h.X0 + 4), 4, (h.z0 + h.z1) / 2) + 1.0, () => houseLite(g, cc, h, S)]); }
  for (const b of BR) { if (b.z < near || b.z > cc.z + far) continue; items.push([depth(cc, 0, 3, b.z - 1.7), () => bridge(g, cc, b, S, t)]); }
  for (const Sx of STR) { if (Sx.z < near || Sx.z > cc.z + 160) continue; items.push([depth(cc, 0, Sx.y, Sx.z), () => lanString(g, cc, Sx, S, t)]); }
  for (const Rb of RIB) { if (Rb.z < near || Rb.z > cc.z + 160) continue; items.push([depth(cc, 0, Rb.y, Rb.z) - 0.05, () => ribbon(g, cc, Rb, S, t)]); }
  for (const w of WIL) { if (w.z < near || w.z > cc.z + 200) continue; items.push([depth(cc, w.x, 3, w.z) - 0.3, () => willow(g, cc, w, S, t)]); }
  if (st.lotus) for (const L of LOT) { const p3 = lotPos(L, t, st); if (p3[2] < cc.z - 5 || p3[2] > cc.z + 220) continue; const d = depth(cc, ...p3); if (d < NEAR) continue; items.push([d, () => lotus(g, cc, L, S, t, p3)]); }
  if (!mirror) for (const side of [-1, 1]) for (let z = Math.floor(Math.max(near, cc.z - 40) / 4) * 4; z < cc.z + Math.min(far, 320); z += 4) { if (z + 4 < cc.z - 2 && !high) continue; const bg = (pr(cc, side * 4, 1, z + 2) || [0, 0, 0])[2]; items.push([depth(cc, side * 4, 0.5, z + 2), () => bank(g, cc, side, z, z + 4, bg, S)]); }
  for (const k of st.koi || []) { if (mirror && !k.reflect) continue; items.push([depth(cc, ...window.JZ.koi.center(k, t)), () => window.JZ.koi.draw(g, cc, k, t, mirror)]); }
  if (st.items) st.items(items, g, cc, mirror);
  items.sort((a, b) => b[0] - a[0]);
  for (const [d, fn] of items) { FOG = clamp((d - 25) / (high ? 900 : 420), 0, 0.8) * (st.fog ?? 1); fn(); }
  FOG = 0;
};

// ---------------- 水下（C13）：抬头看水面，上面的灯透下来 ----------------
const frameUnder = (ctx, s, st) => {
  const HWu = st.hw ?? 4, t = s.t, c = st.cam, hy = c.oy + c.f * Math.tan(c.pitch);
  const g = ctx.createLinearGradient(0, hy - c.f * 0.9, 0, hy + c.f * 0.6); g.addColorStop(0, st.deep ? '#14424e' : '#1f6a7a'); g.addColorStop(0.45, st.deep ? '#082430' : '#0c3247'); g.addColorStop(1, st.deep ? '#01070e' : '#020b16'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 水面（从下面看）：上面的世界画进一张图，裁进水面、按水波错开、染青；离远了是全反射，暗下去
  const sp = clipP(c, [[-HWu, 0, c.z - 80], [-HWu, 0, c.z + 400], [HWu, 0, c.z + 400], [HWu, 0, c.z - 80]]);
  if (sp && !st.split) { const U = M.layer('town_under'), u = U.getContext('2d'); u.setTransform(1, 0, 0, 1, 0, 0); u.clearRect(0, 0, U.width, U.height); u.setTransform(SC, 0, 0, SC, 0, 0);
    const n0 = GLOWS.length; drawWorld(u, cam({ ...c, y: 0.05 }), false, null, { ...st, koi: [], lotus: null }, t); const ups = GLOWS.splice(n0);
    const U2 = M.layer('town_under2'), u2 = U2.getContext('2d'); u2.setTransform(1, 0, 0, 1, 0, 0); u2.clearRect(0, 0, U2.width, U2.height); u2.filter = `blur(${7 * SC}px)`; u2.drawImage(U, 0, 0); u2.filter = 'none';
    ctx.save(); ctx.beginPath(); sub(ctx, sp); ctx.clip(); ctx.globalAlpha = 0.6;
    for (let y = 0; y < H; y += 3) { const dx = 16 * Math.sin(y * 0.035 + t * 2.1) + 7 * Math.sin(y * 0.11 - t * 1.6); ctx.drawImage(U2, 0, y * SC, U2.width, 3 * SC, dx, y, W, 3); } ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#6cc0cc'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    const nz = pr(c, c.x, 0, c.z + Math.abs(c.y) * 1.13 + 6), gy = ctx.createLinearGradient(0, nz ? nz[1] : H, 0, hy); gy.addColorStop(0, 'rgba(12,50,66,0)'); gy.addColorStop(1, 'rgba(12,50,66,0.95)'); ctx.fillStyle = gy; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of ups) { const dx = 7 * Math.sin(y * 0.045 + t * 2.3); ctx.globalAlpha = Math.min(1, a) * 0.7; ctx.drawImage(spr, x + dx - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6); }
    ctx.restore(); }
  HZ = hx('#0b2c3c');
  // 河床（深 3 米）和两岸石墙的水下部分
  FOG = 0; fillP(ctx, c, [[-HWu, -3, c.z - 10], [-HWu, -3, c.z + 260], [HWu, -3, c.z + 260], [HWu, -3, c.z - 10]], vg(ctx, c, 0, c.z + 4, -3, -3.001, [[0, hx('#2e4c4a')], [1, hx('#2e4c4a')]]));
  for (const sd of [-1, 1]) for (let z = Math.floor((c.z - 8) / 3) * 3; z < c.z + 120; z += 3) { const d = depth(c, sd * HWu, -1.5, z + 1.5); FOG = clamp(d / 45, 0, 0.92); fillP(ctx, c, [[sd * HWu, -3, z], [sd * HWu, 0, z], [sd * HWu, 0, z + 3], [sd * HWu, -3, z + 3]], vg(ctx, c, sd * HWu, z + 1.5, 0, -3, [[0, hx('#2c5a5c')], [1, hx('#10282c')]]));
    if (d < 25) { ctx.beginPath(); for (const y of [-0.8, -1.6, -2.4]) seg(ctx, c, [sd * HWu, y, z], [sd * HWu, y, z + 3]); seg(ctx, c, [sd * HWu, -3, z + (sd > 0 ? 1 : 2)], [sd * HWu, 0, z + (sd > 0 ? 1 : 2)]); ctx.strokeStyle = F(hx('#0c1e22'), 0.6); ctx.lineWidth = 1; ctx.stroke(); } }
  const items = [];
  // 卵石、水草
  for (let gz = Math.floor(c.z); gz < c.z + 30; gz += 0.7) for (let gx = -HWu + 0.2; gx < HWu - 0.2; gx += 0.7) { const h1 = hash(gx * 10 | 0, gz * 10 | 0); if (h1 > 0.35) continue; const x = gx + 0.6 * hash(gz * 7 | 0, gx * 3 | 0), z = gz + 0.6 * h1;
    items.push([depth(c, x, -3, z), () => { const p = pr(c, x, -2.98, z); if (!p) return; FOG = clamp(depth(c, x, -3, z) / 40, 0, 0.9); ctx.fillStyle = F(mx(hx('#4a6a64'), hx('#8aa49a'), h1 * 2)); ctx.beginPath(); ctx.ellipse(p[0], p[1], p[2] * (0.08 + 0.12 * h1), p[2] * (0.03 + 0.05 * h1), 0, 0, TAU); ctx.fill(); }]); }
  for (let i = 0; i < 160; i++) { const x = (hash(i, 31) < 0.7 ? Math.sign(hash(i, 32) - 0.5) * (HWu * 0.65 + HWu * 0.32 * hash(i, 33)) : (hash(i, 34) - 0.5) * HWu * 1.25), z = Math.floor(c.z / 60) * 60 + hash(i, 35) * 120; if (z < c.z - 2) continue; const len = 0.8 + 1.6 * hash(i, 36);
    items.push([depth(c, x, -2.2, z), () => { const pts = []; for (let j = 0; j <= 6; j++) { const f = j / 6, sw = 0.35 * f * f * Math.sin(t * 1.1 + i + j * 0.5) + (st.current ?? 0) * f * f * 0.6; const p = pr(c, x + sw, -3 + len * f, z + sw * 0.5); if (!p) return; pts.push(p); }
      FOG = clamp(depth(c, x, -2, z) / 40, 0, 0.9); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.strokeStyle = F(mx(hx('#1f5a3a'), hx('#7ab46a'), hash(i, 37) * 0.6)); ctx.lineWidth = Math.max(1, pts[2][2] * 0.05); ctx.lineCap = 'round'; ctx.stroke(); }]); }
  // 水面上的河灯从下面看：一圈暗影、中间透光，往下拖一道光柱
  if (st.lotus) for (const L of LOT) { const p3 = lotPos(L, t, st); if (p3[1] > 0.3 || p3[2] < c.z - 3 || p3[2] > c.z + 90) continue; const a = st.lotus.a(L, t), k = st.lotus.lit(L, t); if (a <= 0) continue;
    items.push([depth(c, p3[0], 0, p3[2]), () => { const q = []; for (let j = 0; j < 16; j++) { const an = j / 16 * TAU; q.push([p3[0] + Math.cos(an) * 0.33 * L.s, 0, p3[2] + Math.sin(an) * 0.33 * L.s]); } FOG = clamp(depth(c, ...p3) / 60, 0, 0.85);
      fillP(ctx, c, q, F(hx('#3a2038'), 0.3 * a)); const p = pr(c, p3[0], 0, p3[2]); if (!p || k <= 0) return; glow(p[0], p[1], p[2] * 0.5, glowSpr('lot', hx('#ff8aa0')), 0.9 * k * a); glow(p[0], p[1], p[2] * 0.18, glowSpr('lanc', P.lanHot), 0.9 * k * a);
      const b0 = pr(c, p3[0] - 0.15, 0, p3[2]), b1 = pr(c, p3[0] + 0.15, 0, p3[2]), b2 = pr(c, p3[0] + 0.5, -3, p3[2] + 0.4), b3 = pr(c, p3[0] - 0.5, -3, p3[2] + 0.4); if (!b0 || !b1 || !b2 || !b3) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createLinearGradient(p[0], p[1], (b2[0] + b3[0]) / 2, (b2[1] + b3[1]) / 2); gr.addColorStop(0, `rgba(255,190,140,${0.07 * k * a})`); gr.addColorStop(1, 'rgba(255,190,140,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b3[0], b3[1]); ctx.closePath(); ctx.fill(); ctx.restore(); }]); }
  for (const k of st.koi || []) items.push([depth(c, ...window.JZ.koi.center(k, t)), () => window.JZ.koi.draw(ctx, c, k, t, false)]);
  if (st.items) st.items(items, ctx, c, false);
  items.sort((a, b) => b[0] - a[0]); for (const [, fn] of items) fn();
  FOG = 0; HZ = null;
  if (st.fx) st.fx(ctx, c, null);
  // 水里的悬浮颗粒
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 220; i++) { const x = (hash(i, 51) - 0.5) * 2 * HWu, y = -3 * hash(i, 52) + 0.1 * Math.sin(t * 0.5 + i), z = c.z + 1 + hash(i, 53) * 25 + 0.2 * Math.sin(t * 0.3 + i); const p = pr(c, x, y, z); if (!p) continue; ctx.globalAlpha = 0.25 * (1 - clamp(p[3] ?? 0)); ctx.fillStyle = '#bfe8e0'; const r = Math.max(0.6, p[2] * 0.012); ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); } ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
  if (!st.noPost) post(ctx, { ...st, bloom: st.bloom ?? 0.7 });
};

// ---------------- 龙门（尾声「鲤跃龙门化龙」，第十二次）：镇子尽头的大瀑布，水口后面一座三间四柱的石牌坊；底下一潭水，两边崖壁围成半圈，满天孔明灯 ----------------
// 自己一套坐标（米）：潭面 y = 0；瀑布面 z = 26，宽 14 米（|x| < 7），水口 y = 20；崖壁一列列往外越高、越靠后；牌坊立在水口后面 z = 28
const GT = T.GT = { lip: 20, zf: 26, hw: 7, zg: 28 };
let GCL = null, GSKY = null, GLOT = null;
const GST = { lotus: { lit: () => 1, a: () => 1 } };
const buildGate = () => {
  GCL = []; for (const sd of [-1, 1]) { let x = GT.hw + 0.2, zp = GT.zf + 0.3; for (let k = 0; x < 95; k++) { const h = (n) => hash(k * 7 + n, sd > 0 ? 401 : 402), w = 2.6 + 3.8 * h(1), dx = x - GT.hw, z = GT.zf + 0.6 + 0.42 * dx + 1.5 * h(3);
      GCL.push({ sd, x0: x, x1: x + w, top: GT.lip + 1.8 + 0.34 * dx + 4 * h(2), z, zp, h: h(4), pine: h(5) < 0.55, lan: k % 3 === 1, fall: k === 1 }); x += w; zp = z; } }
  GSKY = []; for (let i = 0; i < 2500; i++) { const near = i >= 1600 && i < 2100, moon = i >= 2100; GSKY.push({ x: (hash(i, 411) - 0.5) * (near ? 80 : moon ? 130 : 300), z: near ? -5 + 60 * hash(i, 412) : moon ? 30 + 140 * hash(i, 412) : -15 + 320 * Math.pow(hash(i, 412), 0.85), y0: near ? 8 + 80 * hash(i, 413) : moon ? 40 + 80 * hash(i, 413) : -30 + 190 * hash(i, 413), v: 1.6 + 1.8 * hash(i, 414), s: 0.8 + 0.7 * hash(i, 415), ph: hash(i, 416) * TAU }); }   // 后 500 盏在牌坊附近，天上有前后层次
  GLOT = []; for (let i = 0; i < 80; i++) GLOT.push({ x: (hash(i, 421) - 0.5) * 36, z: hash(i, 422), s: 0.8 + 0.5 * hash(i, 423), ph: hash(i, 424) * TAU });
};
// 一道瀑布：竖着的渐变水帘（水口白亮、中间透出青、底下白沫），几道暗一点的水筋，上千道往下冲的白线（按颜色分三批画），水口一道亮边
const falls = (ctx, c, t, x0, x1, ytop, z, n, seed) => {
  fillP(ctx, c, [[x0, ytop, z], [x1, ytop, z], [x1, 0, z], [x0, 0, z]], vg(ctx, c, (x0 + x1) / 2, z, ytop, 0, [[0, hx('#d8f0ff'), 0.96], [0.08, hx('#8fc4dc'), 0.93], [0.45, hx('#4a7fa4'), 0.88], [0.86, hx('#7aaccc'), 0.92], [1, hx('#e6f6ff'), 0.97]]));
  for (let k = 0; k < 10; k++) { const xa = lerp(x0, x1, hash(k, seed)), w = (0.25 + 0.5 * hash(k, seed + 1)) * Math.sign(x1 - x0); fillP(ctx, c, [[xa, ytop, z - 0.02], [xa + w, ytop, z - 0.02], [xa + w * 1.3, 0, z - 0.02], [xa + w * 0.3, 0, z - 0.02]], F(hx('#1a3a62'), 0.2)); }
  const pm = pr(c, (x0 + x1) / 2, ytop / 2, z); if (!pm) return; const B = [[], [], []];
  for (let i = 0; i < n; i++) { const h = (k) => hash(i, seed + 3 + k), v = 8 + 6 * h(1), len = 1.2 + 3.5 * h(2), span = ytop + len, yH = ytop - ((t * v + h(3) * span) % span), ya = Math.min(ytop, yH + len), yb = Math.max(0, yH); if (ya <= yb) continue; B[h(4) < 0.18 ? 2 : h(4) < 0.6 ? 1 : 0].push([lerp(x0, x1, h(0)), ya, yb]); }
  const lw = Math.max(0.8, pm[2] * 0.035);
  for (const [k, col, a] of [[0, '#e8f6ff', 0.22], [1, '#ffffff', 0.45], [2, '#ffd296', 0.4]]) { ctx.beginPath(); for (const [x, ya, yb] of B[k]) seg(ctx, c, [x, ya, z - 0.05], [x, yb, z - 0.05]); ctx.strokeStyle = F(hx(col), a); ctx.lineWidth = lw * (k ? 1 : 1.6); ctx.stroke(); }
  ctx.beginPath(); for (let k = 0; k <= 24; k++) { const x = lerp(x0, x1, k / 24), p = pr(c, x, ytop + 0.12 + 0.06 * Math.sin(k * 1.7 + t * 3), z - 0.35); if (!p) continue; k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  ctx.strokeStyle = F(hx('#ffffff'), 0.75); ctx.lineWidth = Math.max(1, pm[2] * 0.14); ctx.stroke();
  const pt = pr(c, (x0 + x1) / 2, ytop - 2, z - 0.2); if (pt) glow(pt[0], pt[1], pt[2] * Math.abs(x1 - x0) * 0.6, glowSpr('fallw', hx('#ffb070')), 0.5);
};
// 崖底的水雾和溅起的水珠
const mist = (ctx, c, t) => { ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) { const h1 = hash(i, 431), h2 = hash(i, 432), age = (t * 0.18 + hash(i, 433)) % 1, p = pr(c, (h1 - 0.5) * 2 * (GT.hw + 1.5), 0.5 + 6 * age + 1.5 * h2, GT.zf - 1 - 3 * h2 - 2 * age); if (!p) continue;
    const R = Math.min(500, (2.5 + 3 * h2) * p[2]); ctx.globalAlpha = 0.11 * Math.sin(Math.PI * age); ctx.drawImage(glowSpr('mist', hx('#cfe4ff'), 0.3), p[0] - R, p[1] - R, 2 * R, 2 * R); }
  ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(235,248,255,0.55)';
  for (let i = 0; i < 300; i++) { const h = (k) => hash(i, 441 + k), age = ((t * 0.8 + h(0)) % 1) * 1.4, y = 0.3 + (3 + 5 * h(4)) * age - 4.9 * age * age; if (y < 0) continue;
    const p = pr(c, (h(1) - 0.5) * 2 * GT.hw + (h(2) - 0.5) * 3 * age, y, GT.zf - 0.5 - (2 + 4 * h(3)) * age); if (!p) continue; const r = Math.max(0.8, 0.05 * p[2]) * (1 - age / 1.6); ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); }
  ctx.restore(); };
// 潭：近黑远亮（瀑布底下泛白），瀑布的倒影一片竖着晃的白，一圈圈往外的水纹
const pool = (ctx, c, t) => { const n = pr(c, 0, 0, Math.max(c.z + 3, -60)), f = pr(c, 0, 0, GT.zf); let st = F(P.water);
  if (n && f) { const g = ctx.createLinearGradient(0, n[1], 0, f[1]); g.addColorStop(0, css(hx('#040620'))); g.addColorStop(0.75, css(hx('#0c1440'))); g.addColorStop(1, css(hx('#22365e'))); st = g; }
  fillP(ctx, c, [[-120, 0, c.z - 5], [-120, 0, GT.zf], [120, 0, GT.zf], [120, 0, c.z - 5]], st);
  const a = pr(c, 0, 0, GT.zf), b = pr(c, 0, 0, GT.zf - 12); if (a && b) { const g = ctx.createLinearGradient(0, a[1], 0, b[1]); g.addColorStop(0, 'rgba(220,240,255,0.3)'); g.addColorStop(1, 'rgba(220,240,255,0)'); fillP(ctx, c, [[-GT.hw, 0, GT.zf], [GT.hw, 0, GT.zf], [GT.hw * 1.3, 0, GT.zf - 12], [-GT.hw * 1.3, 0, GT.zf - 12]], g); }
  ctx.save(); ctx.lineWidth = 1.2; for (let k = 0; k < 6; k++) { const fr = (t * 0.22 + k / 6) % 1, r = 3 + 24 * fr; ctx.beginPath(); let on = false; for (let i = 0; i <= 40; i++) { const an = Math.PI + Math.PI * i / 40, p = pr(c, r * 1.3 * Math.cos(an), 0.01, GT.zf - 0.5 + r * Math.sin(an)); if (!p) { on = false; continue; } on ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); on = true; }
    ctx.strokeStyle = `rgba(200,230,255,${0.16 * (1 - fr)})`; ctx.stroke(); } ctx.restore(); };
// 黄山松：崖顶一棵，几层平展的枝叶（剪影），上沿一道月光
const pine = (ctx, c, x, y, z, h, r) => { const b = pr(c, x, y, z), tp = pr(c, x + 0.6 * (r - 0.5) * h, y + h, z); if (!b || !tp) return; const s = b[2];
  ctx.strokeStyle = F(hx('#0b1230')); ctx.lineWidth = Math.max(1, s * 0.22); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(b[0] + s * h * 0.25 * (r - 0.5), (b[1] + tp[1]) / 2, tp[0], tp[1]); ctx.stroke();
  for (let k = 0; k < 5; k++) { const f = 0.3 + 0.7 * k / 4, cx = lerp(b[0], tp[0], f) + (hash(k, r * 100 | 0) - 0.5) * s * h * 0.25, cy = lerp(b[1], tp[1], f), w = s * h * (0.42 - 0.26 * k / 4) * (0.8 + 0.4 * hash(k + 9, r * 100 | 0));
    ctx.fillStyle = F(hx('#0b1230')); ctx.beginPath(); ctx.ellipse(cx, cy, w, w * 0.2, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = F(hx('#4a5a98'), 0.5); ctx.lineWidth = Math.max(0.6, s * 0.05); ctx.beginPath(); ctx.ellipse(cx, cy, w, w * 0.2, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } };
// 一列崖壁：正面（底下被潭里的灯映暖、上沿月光冷）、朝中间的侧面、几道岩层、崖顶的松、挂着的灯、第二列挂一道细瀑布
const cliff = (ctx, c, cl, t, LREF) => { const sd = cl.sd, xa = sd * cl.x0, xb = sd * cl.x1, z = cl.z, tp = cl.top, j1 = tp + 1.2 * (cl.h - 0.5), j2 = tp - 0.8 * cl.h;
  const top = [[xa, tp, z], [lerp(xa, xb, 0.35), j1, z], [lerp(xa, xb, 0.7), j2, z], [xb, tp + 0.6 * (cl.h - 0.3), z]];
  if (cl.zp < z) fillP(ctx, c, [[xa, 0, cl.zp], [xa, tp, cl.zp], [xa, tp, z], [xa, 0, z]], F(hx('#1e2146')));
  fillP(ctx, c, [[xa, 0, z], ...top, [xb, 0, z]], vg(ctx, c, (xa + xb) / 2, z, 0, tp, [[0, hx('#33284c')], [0.3, hx('#2a2d5e')], [0.85, hx('#3a4580')], [1, hx('#5f6fae')]]));
  const pm = pr(c, (xa + xb) / 2, tp / 2, z), s = pm ? pm[2] : 10, xm = lerp(xa, xb, 0.35 + 0.3 * cl.h);
  fillP(ctx, c, [[xm, 0, z - 0.01], [top[1][0], top[1][1], z - 0.01], ...top.slice(2), [xb, 0, z - 0.01]], F(hx('#10143a'), 0.28));
  ctx.beginPath(); for (let k = 0; k < 3; k++) { const x = lerp(xa, xb, 0.2 + 0.3 * k + 0.1 * hash(k, cl.x0 * 7 | 0)); let y = tp - 0.5, xx = x; for (let n = 0; n < 6; n++) { const y2 = y - tp * (0.08 + 0.1 * hash(n, k + (cl.x0 * 3 | 0))), x2 = xx + 0.5 * (hash(n + 5, k + (cl.x0 * 5 | 0)) - 0.5); seg(ctx, c, [xx, y, z - 0.02], [x2, y2, z - 0.02]); xx = x2; y = y2; if (y < 1) break; } }
  ctx.strokeStyle = F(hx('#12142e'), 0.75); ctx.lineWidth = Math.max(0.7, s * 0.06); ctx.stroke();
  for (let k = 0; k < 3; k++) { const y = tp * (0.25 + 0.22 * k + 0.08 * hash(k, cl.x0 * 11 | 0)), xa2 = lerp(xa, xb, 0.1 * hash(k + 3, cl.x0 | 0)), xb2 = lerp(xa, xb, 0.55 + 0.45 * hash(k + 4, cl.x0 | 0));
    fillP(ctx, c, [[xa2, y, z - 0.03], [xb2, y, z - 0.03], [xb2, y - 0.35, z - 0.03], [xa2, y - 0.35, z - 0.03]], F(hx('#1a1c44')));
    ctx.beginPath(); seg(ctx, c, [xa2, y, z - 0.04], [xb2, y, z - 0.04]); ctx.strokeStyle = F(hx('#7a8ac4'), 0.55); ctx.lineWidth = Math.max(0.7, s * 0.07); ctx.stroke();
    for (let n = 0; n < 4; n++) { const q = pr(c, lerp(xa2, xb2, (n + 0.5) / 4 + 0.1 * (hash(n, k) - 0.5)), y + 0.15, z - 0.05); if (!q) continue; const r = q[2] * (0.35 + 0.3 * hash(n, k + 7)); ctx.fillStyle = F(hx('#14283a')); ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * 0.45, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = F(hx('#4e7a7a'), 0.5); ctx.lineWidth = Math.max(0.5, s * 0.04); ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * 0.45, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); } }
  ctx.beginPath(); for (let k = 1; k <= 4; k++) { const y = tp * (0.18 + 0.19 * k) + 1.2 * (hash(k, cl.x0 * 10 | 0) - 0.5); seg(ctx, c, [xa, y + 0.6 * (cl.h - 0.5), z - 0.02], [xb, y - 0.5 * (cl.h - 0.5), z - 0.02]); } ctx.strokeStyle = F(hx('#181a3a'), 0.7); ctx.lineWidth = Math.max(0.8, s * 0.08); ctx.stroke();
  ctx.beginPath(); for (let k = 0; k < 3; k++) seg(ctx, c, top[k], top[k + 1]); ctx.strokeStyle = F(hx('#8a9ad0'), 0.6); ctx.lineWidth = Math.max(1, s * 0.12); ctx.stroke();
  if (cl.fall) falls(ctx, c, t, lerp(xa, xb, 0.3), lerp(xa, xb, 0.62), tp - 0.3, z - 0.15, 160, 450 + (sd > 0 ? 7 : 0));
  if (cl.pine) pine(ctx, c, lerp(xa, xb, 0.5), (j1 + j2) / 2 - 0.2, z + 1, 4 + 3 * cl.h, cl.h);
  if (cl.lan) { const x = lerp(xa, xb, 0.5), y = tp - 2.2, p = lantern(ctx, c, x, y, z - 0.5, 1, 0.05 * Math.sin(t * 1.3 + x), 0.8); if (p) { glow(p[0], p[1], p[2] * 1.0, glowSpr('lanc', P.lanHot), 0.6); glow(p[0], p[1], p[2] * 3.6, glowSpr('lan', hx('#ff5a22')), 0.45); LREF.push([x, y, z - 0.5]); } } };
// 牌坊：四根石柱（中间两根高），上下两道彩绘额枋，中间「龙门」匾；三片飞檐顶（从下面看是椽子、斗拱），屋脊两头鸱吻；额枋下挂灯笼
const paifang = (ctx, c, t, LREF) => { const y0 = GT.lip + 0.2, z0 = GT.zg, zf = z0 - 0.42;
  const box = (xa, xb, ya, yb, za, zb, front, side, bot) => { if (c.x < xa) fillP(ctx, c, [[xa, ya, za], [xa, yb, za], [xa, yb, zb], [xa, ya, zb]], side); else if (c.x > xb) fillP(ctx, c, [[xb, ya, za], [xb, yb, za], [xb, yb, zb], [xb, ya, zb]], side);
    if (c.y < ya) fillP(ctx, c, [[xa, ya, za], [xb, ya, za], [xb, ya, zb], [xa, ya, zb]], bot); fillP(ctx, c, [[xa, ya, za], [xb, ya, za], [xb, yb, za], [xa, yb, za]], front); };
  // 飞檐顶：eave 前沿（两头起翘）、瓦面到屋脊、从下面看得到的椽子底、斗拱一排、封檐板金边；鸱吻在屋脊两头（或只在外头）
  const roof = (xc, hw, ye, yr, upL, upR, kiss) => { const N = 18, up = (x) => { const u = (x - xc) / hw; return 0.85 * Math.pow(sm(0.7, 1, u < 0 ? -u * upL : u * upR), 1.4); }, ridge = hw - 0.6, E = [];
    for (let i = 0; i <= N; i++) { const x = xc - hw + 2 * hw * i / N; E.push([x, ye + up(x), z0 - 1.5]); }
    fillP(ctx, c, [...E, [xc + ridge, yr, z0], [xc - ridge, yr, z0]], F(hx('#1a1e3a')));
    box(xc - ridge, xc + ridge, yr, yr + 0.35, z0 - 0.15, z0 + 0.15, F(hx('#2a2f5c')), F(hx('#1a1e3a')), F(hx('#15182c')));
    for (const [sd, on] of [[-1, kiss !== 1], [1, kiss !== -1]]) { if (!on) continue; const X = xc + sd * ridge, sh = [[0, 0], [0.15, 0.5], [0.05, 0.95], [-0.25, 1.15], [-0.45, 1.0], [-0.3, 0.85], [-0.12, 0.88], [-0.08, 0.55], [-0.35, 0.3], [-0.4, 0]];
      const sp = fillP(ctx, c, sh.map(([u, v]) => [X + sd * u * 1.1, yr + 0.35 + v * 1.1, z0 - 0.16]), F(hx('#1c2048'))); if (sp) { ctx.strokeStyle = F(P.gold, 0.7); ctx.lineWidth = 1.2; ctx.stroke(); } }
    const inner = [[xc + ridge, ye - 0.05, z0 - 0.4], [xc - ridge, ye - 0.05, z0 - 0.4]], sof = E.map(([x, y, z]) => [x, y - 0.12, z]);
    fillP(ctx, c, [...sof, ...inner], F(hx('#2a1820')));
    ctx.beginPath(); for (let x = xc - hw + 0.2; x < xc + hw; x += 0.32) seg(ctx, c, [x, ye + up(x) - 0.14, z0 - 1.48], [lerp(xc, x, ridge / hw), ye - 0.06, z0 - 0.42]); ctx.strokeStyle = F(hx('#6a3a32'), 0.8); const pp = pr(c, xc, ye, z0 - 1); ctx.lineWidth = Math.max(0.6, (pp ? pp[2] : 10) * 0.05); ctx.stroke();
    fillP(ctx, c, [[xc - ridge, ye - 0.6, z0 - 0.43], [xc + ridge, ye - 0.6, z0 - 0.43], [xc + ridge, ye - 0.05, z0 - 0.43], [xc - ridge, ye - 0.05, z0 - 0.43]], F(hx('#6a1622')));
    for (let x = xc - ridge + 0.25, k = 0; x < xc + ridge - 0.1; x += 0.45, k++) fillP(ctx, c, [[x - 0.12, ye - 0.5, z0 - 0.44], [x + 0.12, ye - 0.5, z0 - 0.44], [x + 0.12, ye - 0.15, z0 - 0.44], [x - 0.12, ye - 0.15, z0 - 0.44]], F(k % 2 ? hx('#2a7480') : P.gold));
    const fa = [...E.map(([x, y, z]) => [x, y - 0.14, z - 0.01]), ...E.slice().reverse().map(([x, y, z]) => [x, y + 0.06, z - 0.01])], sp = fillP(ctx, c, fa, F(hx('#3a1a1c')));
    ctx.beginPath(); for (let i = 0; i < N; i++) seg(ctx, c, [E[i][0], E[i][1] - 0.14, E[i][2] - 0.02], [E[i + 1][0], E[i + 1][1] - 0.14, E[i + 1][2] - 0.02]); ctx.strokeStyle = F(P.gold, 0.85); ctx.lineWidth = Math.max(0.8, (pp ? pp[2] : 10) * 0.04); ctx.stroke(); };
  // 额枋：红漆，中间一道青绿彩画，上下金边，几朵金色旋子
  const beam = (xa, xb, ya, yb) => { box(xa, xb, ya, yb, zf + 0.1, z0 + 0.3, F(hx('#7c1822')), F(hx('#4a0e16')), F(hx('#3c0a12')));
    const h = yb - ya; fillP(ctx, c, [[xa, ya + h * 0.3, zf + 0.09], [xb, ya + h * 0.3, zf + 0.09], [xb, ya + h * 0.7, zf + 0.09], [xa, ya + h * 0.7, zf + 0.09]], F(hx('#1f6670')));
    ctx.beginPath(); for (const y of [ya + h * 0.08, yb - h * 0.08]) seg(ctx, c, [xa, y, zf + 0.08], [xb, y, zf + 0.08]); ctx.strokeStyle = F(P.gold, 0.9); const pp = pr(c, (xa + xb) / 2, ya, zf); ctx.lineWidth = Math.max(0.8, (pp ? pp[2] : 10) * h * 0.08); ctx.stroke();
    for (let k = 1, n = Math.max(2, Math.round((xb - xa) / 1.4)); k < n; k++) { const p = pr(c, lerp(xa, xb, k / n), (ya + yb) / 2, zf + 0.07); if (!p) continue; const r = p[2] * h * 0.26; ctx.fillStyle = F(P.gold); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); ctx.fillStyle = F(hx('#1f6670')); ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.55, 0, TAU); ctx.fill(); } };
  roof(0, 4.6, y0 + 9.75, y0 + 11.2, 1, 1, 0);
  for (const sd of [-1, 1]) roof(sd * 5.5, 2.9, y0 + 7.35, y0 + 8.3, sd < 0 ? 1 : 0, sd > 0 ? 1 : 0, sd);
  for (const X of [-7.4, -3, 3, 7.4]) { const Hh = Math.abs(X) < 5 ? 9.5 : 7.1; box(X - 0.38, X + 0.38, y0, y0 + Hh, zf, z0 + 0.38, vg(ctx, c, X, zf, y0, y0 + Hh, [[0, hx('#343a64')], [0.7, hx('#5c6496')], [1, hx('#7a82b4')]]), F(hx('#262a54')), F(hx('#1d2140')));
    box(X - 0.62, X + 0.62, y0, y0 + 1.3, zf - 0.24, z0 + 0.62, F(hx('#4a5184')), F(hx('#2a2e58')), F(hx('#1d2140'))); }
  beam(-3, 3, y0 + 6.9, y0 + 7.5); beam(-3, 3, y0 + 8.85, y0 + 9.6);
  for (const sd of [-1, 1]) { beam(Math.min(sd * 3, sd * 7.4), Math.max(sd * 3, sd * 7.4), y0 + 5.15, y0 + 5.7); beam(Math.min(sd * 3, sd * 7.4), Math.max(sd * 3, sd * 7.4), y0 + 6.45, y0 + 7.05);
    fillP(ctx, c, [[sd * 3.4, y0 + 5.7, zf + 0.15], [sd * 7, y0 + 5.7, zf + 0.15], [sd * 7, y0 + 6.45, zf + 0.15], [sd * 3.4, y0 + 6.45, zf + 0.15]], F(hx('#2e3466'))); }
  // 匾：深蓝底金框，「龙门」两个金字（字体照歌词，导演守则 14）；按投影的三个角把字贴到匾面上
  const zp = zf - 0.05, tl = pr(c, -1.35, y0 + 8.8, zp), tr = pr(c, 1.35, y0 + 8.8, zp), bl = pr(c, -1.35, y0 + 7.55, zp);
  if (tl && tr && bl) { ctx.save(); ctx.transform((tr[0] - tl[0]) / 270, (tr[1] - tl[1]) / 270, (bl[0] - tl[0]) / 125, (bl[1] - tl[1]) / 125, tl[0], tl[1]);
    ctx.fillStyle = F(hx('#16205a')); ctx.fillRect(0, 0, 270, 125); ctx.strokeStyle = F(P.gold); ctx.lineWidth = 9; ctx.strokeRect(4.5, 4.5, 261, 116); ctx.lineWidth = 2; ctx.strokeRect(14, 14, 242, 97);
    ctx.font = '84px MaShanZheng'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const gg = ctx.createLinearGradient(0, 20, 0, 105); gg.addColorStop(0, '#fff2c0'); gg.addColorStop(0.5, '#ffc24a'); gg.addColorStop(1, '#d88a20'); ctx.fillStyle = gg; ctx.fillText('龙 门', 135, 66); ctx.restore(); }
  for (const [x, y, sz] of [[-1.75, y0 + 6.0, 0.95], [1.75, y0 + 6.0, 0.95], [-5.2, y0 + 4.4, 0.75], [5.2, y0 + 4.4, 0.75]]) { const p = lantern(ctx, c, x, y, zf - 0.1, 1, 0.04 * Math.sin(t * 1.2 + x), sz); if (!p) continue;
    glow(p[0], p[1], p[2] * 1.1, glowSpr('lanc', P.lanHot), 0.6); glow(p[0], p[1], p[2] * 4, glowSpr('lan', hx('#ff5a22')), 0.5); LREF.push([x, y, zf - 0.1]); } };
// 潭里灯的倒影：竖着拖长的光带和碎光（裁进潭面）
const gateRef = (ctx, c, t, LREF) => { const sp = clipP(c, [[-120, 0, c.z - 5], [-120, 0, GT.zf], [120, 0, GT.zf], [120, 0, c.z - 5]]); if (!sp) return; ctx.save(); ctx.beginPath(); sub(ctx, sp); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, z] of LREF) { const p = pr(c, x, -y, z), q = pr(c, x, 0, z); if (!p || !q) continue; const r = Math.max(2, 0.9 * p[2]), L = Math.min(300, Math.abs(p[1] - q[1]) * 1.6 + r);
    ctx.globalAlpha = 0.35; ctx.drawImage(glowSpr('lan', P.lan), p[0] - r * 0.5, p[1] - L * 0.5, r, L);
    for (let k = 0; k < 5; k++) { const yy = p[1] - L * 0.4 + L * 0.8 * hash(k, (x * 10 | 0) + 7), w2 = r * (0.4 + 0.8 * hash(k, (y * 10 | 0) + 3)), dx = Math.sin(t * 2.6 + k * 1.7 + x) * r * 0.25; ctx.globalAlpha = 0.45 * (0.5 + 0.5 * Math.sin(t * 3.1 + k * 2.3 + x)); ctx.fillStyle = css(hx('#ffc070')); ctx.fillRect(p[0] - w2 / 2 + dx, yy, w2, Math.max(1, r * 0.06)); } }
  ctx.restore(); };
// 峡口后面上游的远山（用户 2026-11-19：山和远处的背景太简单）：一层山脊 = 起伏上叠几座尖峰（峰林），山体上亮下暗、往山脚化进雾里，山脊一道月光、往下几道沟壑；近的两层山脊上一排松，山腰村子的灯；山脚一条雾带
const ridgeY = (x, y0, amp, seed) => { const n = Math.sin(x * 0.021 + seed) * 0.5 + Math.sin(x * 0.053 + seed * 2.3) * 0.3 + Math.sin(x * 0.11 + seed * 4.1) * 0.2 + 0.08 * Math.sin(x * 0.37 + seed); let pk = 0;
  for (let k = 0; k < 9; k++) { const xk = -240 + 60 * k + 25 * Math.sin(seed * 3 + k * 1.7), wk = 20 + 14 * (0.5 + 0.5 * Math.sin(seed + k * 2.9)), hk = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(seed * 1.3 + k * 4.1))) * amp * 0.55, dd = Math.abs(x - xk) / wk; if (dd < 1) pk = Math.max(pk, hk * (0.5 + 0.5 * Math.cos(Math.PI * dd)) * (1 + 0.04 * Math.sin(x * 1.3 + k))); }
  return y0 + amp * (0.55 + 0.45 * n) * 0.8 + pk + 0.0012 * x * x; };
const ridges = (ctx, c, t, z, y0, amp, col, seed, lights, pines) => { const pts = []; for (let x = -260; x <= 260; x += 3) pts.push([x, ridgeY(x, y0, amp, seed), z + 0.15 * Math.abs(x)]);
  const top = pr(c, 0, y0 + amp * 1.2, z), bot = pr(c, 0, y0 - 10, z); let fs = F(col); if (top && bot && Math.abs(bot[1] - top[1]) > 1) { const g = ctx.createLinearGradient(0, top[1], 0, bot[1]); g.addColorStop(0, css(mx(col, hx('#8a96d0'), 0.15))); g.addColorStop(0.45, css(col)); g.addColorStop(1, css(mx(col, P.haze, 0.35))); fs = g; }
  fillP(ctx, c, [...pts, [260, -10, z + 39], [-260, -10, z + 39]], fs);
  ctx.beginPath(); for (let i = 2; i < pts.length - 2; i += 3) { const [x, y, zz] = pts[i], h = hash(i, seed * 10 | 0); if (h < 0.35) continue; const len = Math.max(2, (y - y0) * (0.25 + 0.55 * h)); seg(ctx, c, [x, y - 0.6, zz], [x + (h - 0.5) * 7, y - len, zz]); } ctx.strokeStyle = css(mx(col, hx('#080a22'), 0.55), 0.5); ctx.lineWidth = 1.3; ctx.stroke();
  ctx.beginPath(); for (let k = 0; k < pts.length - 1; k++) seg(ctx, c, pts[k], pts[k + 1]); ctx.strokeStyle = css(mx(col, hx('#dce4ff'), 0.6), 0.85); ctx.lineWidth = 1.6; ctx.stroke();
  if (pines) for (let i = 1; i < pts.length - 1; i++) { if (hash(i, seed * 7 | 0) < 0.55) continue; const [x, y, zz] = pts[i], b = pr(c, x, y - 0.3, zz); if (!b) continue; const hh = (1.6 + 2.2 * hash(i, 3)) * b[2], w = hh * 0.36; if (hh < 2.5) continue;
    ctx.fillStyle = css(mx(col, hx('#05071a'), 0.4)); ctx.beginPath(); for (let k = 0; k < 3; k++) { const yb = b[1] - hh * (0.25 * k), ww = w * (1 - 0.28 * k); ctx.moveTo(b[0] - ww, yb); ctx.lineTo(b[0], yb - hh * 0.5); ctx.lineTo(b[0] + ww, yb); } ctx.fill(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 14; k++) { const x = -240 + 37 * k + 10 * Math.sin(seed + k), q = pr(c, x, y0 + 4, z + 0.15 * Math.abs(x)); if (!q) continue; const R = Math.min(600, 40 * q[2]); ctx.globalAlpha = 0.035; ctx.drawImage(glowSpr('mist', hx('#b8c4f0'), 0.3), q[0] - R, q[1] - R * 0.25, 2 * R, R * 0.5); } ctx.restore();
  if (lights) for (let i = 0; i < lights; i++) { const k = Math.floor(hash(i, seed * 10 | 0) * (pts.length - 1)), [x, y, zz] = pts[k], yy = y0 + (y - y0) * (0.25 + 0.45 * hash(i, 3 + seed * 10 | 0)), p = pr(c, x, yy, zz); if (!p) continue; const r = Math.max(0.8, p[2] * 0.5);
    ctx.fillStyle = css(hx('#ffc070'), 0.8); ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); glow(p[0], p[1], Math.max(2, p[2] * 4), glowSpr('lan', P.lan), 0.25); } };
// 云海：两层山之间铺开的一片月光照亮的云
const cloudSea = (ctx, c, z, y, seed) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 34; k++) { const x = -280 + 17 * k + 12 * Math.sin(seed + k * 1.9), yy = y + 4 * Math.sin(seed * 2 + k * 2.7), q = pr(c, x, yy, z + 0.12 * Math.abs(x)); if (!q) continue; const R = Math.min(600, (22 + 10 * Math.sin(k * 3.1 + seed)) * q[2]); ctx.globalAlpha = 0.06; ctx.drawImage(glowSpr('cloud', hx('#c4cdf4'), 0.35), q[0] - R, q[1] - R * 0.3, 2 * R, R * 0.6); } ctx.restore(); };
// 最高峰上一座小庙：一间屋、翘檐、一盏灯
const temple = (ctx, c, z, seed) => { let x = 0, y = -1e9; for (let xx = -110; xx <= 110; xx++) { const yy = ridgeY(xx, 22, 70, seed); if (yy > y) { y = yy; x = xx; } } const b = pr(c, x, y, z + 0.15 * Math.abs(x)); if (!b || b[2] < 0.3) return; const s = b[2]; ctx.fillStyle = css(hx('#141838'));
  ctx.fillRect(b[0] - 3 * s, b[1] - 3 * s, 6 * s, 3 * s); ctx.beginPath(); ctx.moveTo(b[0] - 4.6 * s, b[1] - 2.6 * s); ctx.quadraticCurveTo(b[0] - 3 * s, b[1] - 3.2 * s, b[0], b[1] - 5 * s); ctx.quadraticCurveTo(b[0] + 3 * s, b[1] - 3.2 * s, b[0] + 4.6 * s, b[1] - 2.6 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = css(P.paper, 0.9); ctx.fillRect(b[0] - 0.6 * s, b[1] - 2.4 * s, 1.2 * s, 1.5 * s); glow(b[0], b[1] - 1.6 * s, Math.max(3, 5 * s), glowSpr('lan', P.lan), 0.35); };
// 有远近的月亮（尾声金龙绕月，月亮当龙珠）：一个对着镜头的圆盘，外面两层光晕，几块淡的环形山
const moonObj = T.moonObj = (ctx, c, Mo, Rm, k = 1) => { const p = pr(c, ...Mo); if (!p || k <= 0) return; const R = Rm * p[2];   // k：整体淡掉（尾声飞出天外前，镜头贴着月亮过去，光晕会盖住半个画面）
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * k; ctx.drawImage(glowSpr('moonh', hx('#9aa6ff'), 0.08), p[0] - R * 5, p[1] - R * 5, R * 10, R * 10); ctx.globalAlpha = 0.3 * k; ctx.drawImage(glowSpr('moonh2', P.moon, 0.2), p[0] - R * 2, p[1] - R * 2, R * 4, R * 4); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = k;
  const mg = ctx.createRadialGradient(p[0] - R * 0.3, p[1] - R * 0.3, R * 0.1, p[0], p[1], R); mg.addColorStop(0, css(hx('#f4ecd8'))); mg.addColorStop(1, css(hx('#d8c49c'))); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,170,140,0.28)'; for (const [a, b, r] of [[-0.3, -0.2, 0.28], [0.25, 0.1, 0.22], [-0.05, 0.35, 0.18], [0.35, -0.35, 0.12], [0.1, -0.5, 0.09], [-0.5, 0.25, 0.1]]) { ctx.beginPath(); ctx.arc(p[0] + a * R, p[1] + b * R, r * R, 0, TAU); ctx.fill(); } ctx.restore(); };
const frameGate = (ctx, s, st) => { const t = s.t, c = st.cam; if (!GCL) buildGate();
  sky(ctx, c, t, st); if (st.space) st.space(ctx, c);   // 尾声金龙往上飞出天外：星空一点点盖住夜空（jz_space.js）
  // 远处的地面（高处往远看时，远山外面不能露出天底的粉色）
  { const n = pr(c, c.x, -0.5, c.z + 40), g = n ? ctx.createLinearGradient(0, c.oy + c.f * Math.tan(c.pitch), 0, n[1]) : null; if (g) { g.addColorStop(0, css(mx(P.haze, P.skyLow, 0.4))); g.addColorStop(1, css(hx('#0c0f2c'))); } fillP(ctx, c, [[-6000, -0.5, -6000], [-6000, -0.5, 6000], [6000, -0.5, 6000], [6000, -0.5, -6000]], g || css(hx('#0c0f2c'))); }
  pool(ctx, c, t);
  const items = [], LREF = [];
  for (const Lk of GSKY) { const y = Lk.y0 + Lk.v * (t - 200); if (y < 1) continue; const p3 = [Lk.x + 0.4 * Math.sin(t * 0.37 + Lk.ph), y, Lk.z + 0.1 * (t - 200)]; if (p3[2] < GT.zf && y < 3) continue; const d = depth(c, ...p3); if (d < 6) continue; const a = sm(1, 5, y) * sm(6, 16, d);   // 离镜头近的淡掉：一盏灯不在画面上一下变大变亮
    items.push([d, () => { if (d > 120) FOG = clamp((d - 60) / 900, 0, 0.7); skyLan(ctx, c, Lk, p3, t, a * (st.lanA ?? 1)); }]); }
  for (const [z, y0, amp, col, seed, n, pn] of [[440, 60, 130, '#3e4686', 0.7, 0, false], [300, 40, 110, '#2e3472', 1.3, 0, false], [190, 22, 70, '#20255a', 2.7, 40, true], [110, 10, 34, '#141840', 4.2, 30, true]]) items.push([depth(c, 0, y0, z), () => { FOG = 0; ridges(ctx, c, t, z, y0, amp, hx(col), seed, n, pn); if (z === 190) temple(ctx, c, z, 2.7); }]);
  for (const [z, y, seed] of [[360, 70, 1.1], [240, 48, 2.3], [150, 30, 3.7]]) items.push([depth(c, 0, y, z) - 1, () => { FOG = 0; cloudSea(ctx, c, z, y, seed); }]);
  for (const cl of GCL) items.push([depth(c, cl.sd * (cl.x0 + cl.x1) / 2, cl.top * 0.5, cl.z) + 2, () => cliff(ctx, c, cl, t, LREF)]);
  items.push([depth(c, 0, GT.lip + 6, GT.zg), () => paifang(ctx, c, t, LREF)]);
  items.push([depth(c, 0, GT.lip * 0.5, GT.zf), () => falls(ctx, c, t, -GT.hw, GT.hw, GT.lip, GT.zf, 900, 440)]);
  items.push([depth(c, 0, 3, GT.zf - 2.5), () => mist(ctx, c, t)]);
  for (const L of GLOT) { const p3 = [L.x + 0.2 * Math.sin(t * 0.4 + L.ph), 0.03, -30 + ((L.z * 52 - 0.5 * (t - 200)) % 52 + 52) % 52]; const d = depth(c, ...p3); if (d < 1.5) continue; items.push([d, () => lotus(ctx, c, L, GST, t, p3)]); }
  for (const k of st.koi || []) items.push([depth(c, ...window.JZ.koi.center(k, t)), () => window.JZ.koi.draw(ctx, c, k, t, false)]);
  if (st.items) st.items(items, ctx, c, false);
  items.sort((a, b) => b[0] - a[0]);
  for (const [d, fn] of items) { FOG = clamp((d - 25) / 260, 0, 0.6); fn(); }
  FOG = 0; gateRef(ctx, c, t, LREF);
  if (st.fx) st.fx(ctx, c, null);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
  post(ctx, st);
};

// ---------------- 红伞巷（A10，第十二次重排）：一条 4.4 米宽的水巷，两边两层的白墙黑瓦，左边一条廊（柱、美人靠、廊下灯笼），头顶挂满撑开的红油纸伞；巷口一道石水门，门下一盏大灯笼 ----------------
// 自己一套坐标（米）：水面 y 0，水巷 |x| < 2.2，两岸石板 y 0.8、到 |x| 3.2 是墙；巷子顺 +z，z −20 到水门 64；门外是大河
const LN = T.LN = { hw: 2.2, wx: 3.2, by: 0.8, zg: 64 };
let LUM = null, LWS = null;
const buildLane = () => {
  LUM = []; let i = 0;
  LUM.push({ x: 0, y: 4.97, z: 6, r: 1.0, ax: [0, 1, 0], ph: 0.3, col: hx('#d61f3a'), pat: true, lamp: false, key: true });   // E：接月亮的那一把（正上方、伞底朝下）
  for (const cx of [-1.55, 0, 1.55]) for (let z = -18 + 0.6 * (cx + 1.55); z < 61; z += 1.5 + 0.45 * hash(i, 501), i++) { if (Math.hypot(cx, z - 6) < 1.9) continue;
    const h = (k) => hash(i, 501 + k), tx = 0.3 * (h(4) - 0.5), tz = 0.3 * (h(5) - 0.5), cl = h(7);
    LUM.push({ x: cx + 0.35 * (h(1) - 0.5), y: 4.6 + 1.5 * h(2), z, r: 0.76 + 0.24 * h(3), ax: [Math.sin(tx), Math.cos(tx) * Math.cos(tz), Math.sin(tz)], ph: h(6) * TAU, col: hx(cl < 0.55 ? '#d61f3a' : cl < 0.75 ? '#e8452a' : cl < 0.9 ? '#a8142c' : '#e0a030'), pat: h(8) < 0.35, lamp: h(9) < 0.2 }); }
  for (let k = 0; k < 90; k++) { const h = (n) => hash(k, 521 + n), tx = 0.4 * (h(4) - 0.5), tz = 0.4 * (h(5) - 0.5), cl = h(7);
    LUM.push({ x: (h(0) - 0.5) * 5.4, y: 6.6 + 1.6 * h(1), z: -18 + 80 * h(2), r: 0.8 + 0.25 * h(3), ax: [Math.sin(tx), Math.cos(tx) * Math.cos(tz), Math.sin(tz)], ph: h(6) * TAU, col: hx(cl < 0.6 ? '#d61f3a' : cl < 0.85 ? '#e8452a' : '#c0182c'), pat: h(8) < 0.3, lamp: false }); }
  // 低挂的一排（2.7–3.3 米，伞下多挂小灯）：廊下侧面横移时画面上半是它们；避开 E 那把伞的正下方（z 2–10）和水门前（z 46 以后，不挡大灯笼）
  for (let z = -10, k = 0; z < 46; z += 2.0 + 0.6 * hash(k, 581), k++) { if (z > 1.5 && z < 10.5) continue; const h = (n) => hash(k, 582 + n), tx = 0.35 * (h(3) - 0.5), tz = 0.35 * (h(4) - 0.5), cl = h(5);
    LUM.push({ x: -1.2 + 2.1 * h(0), y: 2.75 + 0.55 * h(1), z, r: 0.62 + 0.16 * h(2), ax: [Math.sin(tx), Math.cos(tx) * Math.cos(tz), Math.sin(tz)], ph: h(6) * TAU, col: hx(cl < 0.5 ? '#d61f3a' : cl < 0.8 ? '#e8452a' : '#a8142c'), pat: h(7) < 0.5, lamp: h(8) < 0.4 }); }
  LWS = []; for (const sd of [-1, 1]) { let z = -22, k = 0; while (z < LN.zg) { const w = 3.6 + 1.8 * hash(k, sd > 0 ? 531 : 532); LWS.push({ sd, z0: z, z1: Math.min(LN.zg, z + w), h: 6.1 + 0.7 * hash(k, 533 + sd), r: (n) => hash(k * 11 + n, sd > 0 ? 541 : 542) }); z += w; k++; } }
};
// 一把油纸伞：伞面是一圈 12 片的浅锥（伞骨在两片之间），伞柄往下；从下面看是透光的伞底（伞骨、撑子、伞柄），从上面看是红伞面；rot = 绕自己的轴转了多少，gk = 伞底透出的光
const umbrella = (ctx, c, U, rot, gk) => {
  const A = U.ax, e1 = nrmT(Math.abs(A[1]) < 0.9 ? crossT(A, [0, 1, 0]) : crossT(A, [1, 0, 0])), e2 = crossT(A, e1), C = [U.x, U.y, U.z], r = U.r, ap = addT(C, A, r * 0.3), n = 12;
  const pc = pr(c, ...C); if (!pc) return; const sz = r * pc[2], below = (c.x - C[0]) * A[0] + (c.y - C[1]) * A[1] + (c.z - C[2]) * A[2] < 0;
  const rim = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; rim.push(addT(addT(C, e1, r * Math.cos(a)), e2, r * Math.sin(a))); }
  const col = U.col, und = mx(col, hx('#ffc890'), 0.3 + 0.25 * gk), dk = (k) => [col[0] * k, col[1] * k, col[2] * k];
  if (sz < 10) { const sp = clipP(c, rim); if (sp) { ctx.beginPath(); sub(ctx, sp); ctx.fillStyle = F(below ? mx(dk(0.8), und, gk) : dk(0.75)); ctx.fill(); } return; }
  const fan = (k0, k1, i, cl) => fillP(ctx, c, [mixT(ap, rim[i], k0), mixT(ap, rim[(i + 1) % n], k0), mixT(ap, rim[(i + 1) % n], k1), mixT(ap, rim[i], k1)], F(cl));
  for (let i = 0; i < n; i++) { const f = i % 2 ? 0.92 : 1.06;
    if (below) { fan(0, 0.5, i, mx(und, [255, 220, 170], 0.25 * gk).map(v => v * f)); fan(0.5, 1, i, mx(dk(0.85), und, 0.55 * gk).map(v => v * f)); }
    else { fan(0, 1, i, dk(0.62 * f + 0.1 * Math.max(0, A[1]))); } }
  if (U.pat) { ctx.beginPath(); for (let i = 0; i < n; i++) { const a = rim[i], b = rim[(i + 1) % n]; seg(ctx, c, mixT(ap, a, 0.72), mixT(ap, b, 0.72)); } ctx.strokeStyle = F(below ? hx('#7a1018') : P.gold, 0.8); ctx.lineWidth = Math.max(1, sz * 0.05); ctx.stroke();
    ctx.fillStyle = F(hx('#fff4e8'), below ? 0.5 : 0.85); for (let i = 0; i < n; i += 2) { const q = pr(c, ...mixT(ap, mixT(rim[i], rim[(i + 1) % n], 0.5), 0.84)); if (q) { const rr = Math.max(1, sz * 0.045); ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, TAU); ctx.fill(); } } }   // 一圈金边、白梅点（转起来看得出）
  ctx.beginPath(); for (let i = 0; i < n; i++) seg(ctx, c, rim[i], rim[(i + 1) % n]); ctx.strokeStyle = F(dk(0.45), 0.9); ctx.lineWidth = Math.max(0.8, sz * 0.02); ctx.stroke();
  if (below) { const st0 = addT(ap, A, -r * 0.42); ctx.beginPath(); for (let i = 0; i < n; i++) { seg(ctx, c, ap, rim[i]); seg(ctx, c, st0, mixT(ap, rim[i], 0.55)); } seg(ctx, c, ap, addT(ap, A, -r * 1.05));
    ctx.strokeStyle = F(hx('#3a140e'), 0.85); ctx.lineWidth = Math.max(0.7, sz * 0.018); ctx.stroke();
    if (U.lamp && gk > 0) { const q = pr(c, ...addT(ap, A, -r * 1.1)); if (q) { glow(q[0], q[1], q[2] * 0.25, glowSpr('lanc', P.lanHot), 0.7 * gk); glow(q[0], q[1], q[2] * 1.4, glowSpr('lan', hx('#ff5a22')), 0.5 * gk); } } }
  else { const q = pr(c, ...addT(ap, A, r * 0.05)); if (q) { ctx.fillStyle = F(hx('#2a1210')); ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(1, sz * 0.05), 0, TAU); ctx.fill(); } }
};
const addT = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], mixT = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)], crossT = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrmT = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// 一段墙（一户人家的门面）：一楼（右边门板、透光的窗；左边在廊下），腰檐，二楼粉墙、木格窗，墙头一道瓦檐；右边檐下挂灯笼
const laneWall = (ctx, c, Wd, t, lk) => { const sd = Wd.sd, X = sd * LN.wx, z0 = Wd.z0, z1 = Wd.z1, H = Wd.h, r = Wd.r, zm = (z0 + z1) / 2, w = z1 - z0;
  fillP(ctx, c, [[X, LN.by, z0], [X, H, z0], [X, H, z1], [X, LN.by, z1]], vg(ctx, c, X, zm, LN.by, H, [[0, mx(P.wallLow, P.stain, 0.5)], [0.42, P.wallLow], [0.55, P.wall], [1, mx(P.wall, P.wallEnd, 0.4)]]));
  ctx.beginPath(); seg(ctx, c, [X, LN.by, z0], [X, H, z0]); ctx.strokeStyle = F(P.stain, 0.6); const pm = pr(c, X, 3, zm), s = pm ? pm[2] : 10; ctx.lineWidth = Math.max(0.6, s * 0.05); ctx.stroke();
  const win = (y0, y1, za, zb, k) => { fillP(ctx, c, [[X - sd * 0.02, y0, za], [X - sd * 0.02, y1, za], [X - sd * 0.02, y1, zb], [X - sd * 0.02, y0, zb]], F(mx(P.paperDim, P.paper, k)));
    ctx.beginPath(); for (let q = 1; q < 4; q++) { const zz = lerp(za, zb, q / 4); seg(ctx, c, [X - sd * 0.03, y0, zz], [X - sd * 0.03, y1, zz]); } for (let q = 1; q < 3; q++) { const yy = lerp(y0, y1, q / 3); seg(ctx, c, [X - sd * 0.03, yy, za], [X - sd * 0.03, yy, zb]); }
    ctx.strokeStyle = F(P.wood, 0.9); ctx.lineWidth = Math.max(0.6, s * 0.035); ctx.stroke(); if (k > 0) { const q = pr(c, X - sd * 0.05, (y0 + y1) / 2, (za + zb) / 2); if (q) glow(q[0], q[1], q[2] * 1.2, glowSpr('win', P.paper), 0.25 * k); } };
  const nW = Math.max(1, Math.round(w / 1.8)); for (let q = 0; q < nW; q++) { const za = z0 + w * (q + 0.22) / nW, zb = z0 + w * (q + 0.78) / nW; win(3.95, 5.35, za, zb, lk * (r(q) < 0.75 ? 1 : 0.2)); if (sd > 0) win(1.35, 2.75, za, zb, lk * (r(q + 5) < 0.6 ? 0.9 : 0)); }
  // 腰檐、墙头檐：一条瓦（瓦面深、檐口一道亮边），往巷子里挑出去
  for (const [ye, out, th] of [[3.45, 0.55, 0.32], [H, 0.75, 0.42]]) { const xo = X - sd * out; fillP(ctx, c, [[X, ye + th, z0], [X, ye + th, z1], [xo, ye, z1], [xo, ye, z0]], F(P.tile)); fillP(ctx, c, [[X, ye - 0.05, z0], [X, ye - 0.05, z1], [xo, ye - 0.02, z1], [xo, ye - 0.02, z0]], F(P.soffit));
    ctx.beginPath(); seg(ctx, c, [xo, ye, z0], [xo, ye, z1]); ctx.strokeStyle = F(P.tileHi, 0.8); ctx.lineWidth = Math.max(0.8, s * 0.05); ctx.stroke(); }
  if (sd > 0) for (let q = 0; q < nW; q++) { const z = z0 + w * (q + 0.5) / nW, p = lantern(ctx, c, X - 0.45, 2.75, z, lk, 0.04 * Math.sin(t * 1.3 + z), 0.42); if (p && lk > 0) { glow(p[0], p[1], p[2] * 1.0, glowSpr('lanc', P.lanHot), 0.6 * lk); glow(p[0], p[1], p[2] * 3.4, glowSpr('lan', hx('#ff5a22')), 0.45 * lk); } }
};
// 左边的廊：柱（3 米一根）、美人靠、廊顶（从下面看是椽子）、柱间挂灯笼
const gallery = (ctx, c, t, zA, zB, lit) => { const xp = -2.45;
  fillP(ctx, c, [[-LN.wx, 3.55, zA], [-LN.wx, 3.55, zB], [-2.1, 3.1, zB], [-2.1, 3.1, zA]], F(c.y < 3.1 ? hx('#2a1820') : P.tile));
  ctx.beginPath(); for (let z = Math.ceil(zA / 0.5) * 0.5; z < zB; z += 0.5) seg(ctx, c, [-LN.wx, 3.53, z], [-2.12, 3.08, z]); ctx.strokeStyle = F(hx('#5a3228'), 0.7); ctx.lineWidth = 1; ctx.stroke();
  for (let z = Math.ceil((zA - 1.5) / 3) * 3 + 1.5; z < zB; z += 3) { fillP(ctx, c, [[xp + 0.09, LN.by, z - 0.09], [xp + 0.09, 3.1, z - 0.09], [xp + 0.09, 3.1, z + 0.09], [xp + 0.09, LN.by, z + 0.09]], F(hx('#3a1a16')));
    if (c.z < z) fillP(ctx, c, [[xp - 0.09, LN.by, z - 0.09], [xp - 0.09, 3.1, z - 0.09], [xp + 0.09, 3.1, z - 0.09], [xp + 0.09, LN.by, z - 0.09]], F(hx('#2a1210')));
    const lk = lit(z + 1.5), p = lantern(ctx, c, xp, 2.55, z + 1.5, lk, 0.04 * Math.sin(t * 1.2 + z), 0.4); if (p && lk > 0) { glow(p[0], p[1], p[2] * 1.0, glowSpr('lanc', P.lanHot), 0.6 * lk); glow(p[0], p[1], p[2] * 3.2, glowSpr('lan', hx('#ff5a22')), 0.45 * lk); } } };
// 水门：一道石墙横过巷口，中间一个半圆拱，拱下挂一盏大灯笼（st.big：亮度、透明度、里面锦鲤的影子由镜头给）
const water_gate = (ctx, c, t) => { const z = LN.zg, ar = 2.0, ay = 2.2, pts = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; pts.push(pr(c, ar * Math.cos(a), ay + ar * Math.sin(a), z)); } pts.push(pr(c, -ar, 0, z), pr(c, ar, 0, z));
  const o = [[-LN.wx - 0.4, 0, z], [-LN.wx - 0.4, 7.2, z], [LN.wx + 0.4, 7.2, z], [LN.wx + 0.4, 0, z]].map(p => pr(c, ...p)); if (o.some(p => !p) || pts.some(p => !p)) return;
  ctx.beginPath(); o.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.moveTo(pts[17][0], pts[17][1]); ctx.lineTo(pts[18][0], pts[18][1]); for (let i = 0; i <= 16; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
  ctx.fillStyle = vg(ctx, c, 0, z, 0, 7.2, [[0, P.stone], [0.7, P.stoneHi], [1, mx(P.stoneHi, P.wallEnd, 0.4)]]); ctx.fill('evenodd');
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = Math.PI * i / 16, b = Math.PI * (i + 1) / 16; seg(ctx, c, [ar * Math.cos(a), ay + ar * Math.sin(a), z - 0.02], [(ar + 0.6) * Math.cos(a), ay + (ar + 0.6) * Math.sin(a), z - 0.02]); } for (let y = 1.2; y < 7; y += 0.6) { seg(ctx, c, [-LN.wx - 0.4, y, z - 0.02], [-ar - 0.1, y, z - 0.02]); seg(ctx, c, [ar + 0.1, y, z - 0.02], [LN.wx + 0.4, y, z - 0.02]); }
  ctx.strokeStyle = F(P.stoneJ, 0.7); ctx.lineWidth = 1; ctx.stroke();
  fillP(ctx, c, [[-LN.wx - 0.9, 7.2, z - 0.8], [LN.wx + 0.9, 7.2, z - 0.8], [LN.wx + 0.5, 7.9, z], [-LN.wx - 0.5, 7.9, z]], F(P.tile)); };
const frameLaneAbove = (ctx, c, t, st) => { if (!LUM) buildLane();
  sky(ctx, c, t, st);
  const lit = (z) => st.laneLit ? st.laneLit(z) : 1, far = LN.zg + 4;
  // 门外的大河：水和远处的灯
  fillP(ctx, c, [[-6, 0, LN.zg], [6, 0, LN.zg], [9, 0, LN.zg + 200], [-9, 0, LN.zg + 200]], F(hx('#0a1236')));
  for (let k = 0; k < 24; k++) { const p = pr(c, (hash(k, 551) - 0.5) * 30, 1 + 6 * hash(k, 552), LN.zg + 30 + 150 * hash(k, 553)); if (p) glow(p[0], p[1], Math.max(2, p[2] * 1.2), glowSpr('lan', P.lan), 0.35); }
  const walls = LWS.filter(Wd => Wd.z1 > c.z - 6).sort((a, b) => b.z0 - a.z0); for (const Wd of walls) laneWall(ctx, c, Wd, t, lit((Wd.z0 + Wd.z1) / 2));
  // 水面：深靛蓝，伞和灯笼的倒影是一团团红光，横的细波纹
  const wp = clipP(c, [[-LN.hw, 0, c.z - 3], [-LN.hw, 0, far], [LN.hw, 0, far], [LN.hw, 0, c.z - 3]]);
  if (wp) { ctx.save(); ctx.beginPath(); sub(ctx, wp); ctx.fillStyle = F(P.water); ctx.fill(); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    for (const U of LUM) { if (U.z < c.z - 2) continue; const p = pr(c, U.x, -U.y, U.z), q = pr(c, U.x, 0, U.z); if (!p || !q) continue; const gk = 0.35 + 0.65 * lit(U.z), rr = Math.max(2, U.r * p[2]); ctx.globalAlpha = 0.3 * gk; ctx.drawImage(glowSpr('umr', U.col, 0.4), p[0] - rr * 1.2, p[1] - rr * 0.6, rr * 2.4, rr * 1.2); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(160,170,220,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 40; k++) { const z = c.z + 1 + 50 * Math.pow(hash(k, 561), 1.6), x = (hash(k, 562) - 0.5) * 4, w = 0.3 + 0.6 * hash(k, 563); seg(ctx, c, [x - w + 0.2 * Math.sin(t + k), 0, z], [x + w + 0.2 * Math.sin(t + k), 0, z]); } ctx.stroke(); ctx.restore(); }
  // 两岸石驳岸（水到石板）
  for (const sd of [-1, 1]) { fillP(ctx, c, [[sd * LN.hw, 0, c.z - 3], [sd * LN.hw, LN.by, c.z - 3], [sd * LN.hw, LN.by, far], [sd * LN.hw, 0, far]], vg(ctx, c, sd * LN.hw, c.z + 8, 0, LN.by, [[0, P.moss], [1, P.stoneHi]]));
    fillP(ctx, c, [[sd * LN.hw, LN.by, c.z - 3], [sd * LN.wx, LN.by, c.z - 3], [sd * LN.wx, LN.by, far], [sd * LN.hw, LN.by, far]], F(mx(P.stone, P.stoneHi, 0.35)));   // 石板路面
    ctx.beginPath(); for (let z = Math.ceil((c.z - 3) / 0.9) * 0.9; z < far; z += 0.9) seg(ctx, c, [sd * LN.hw, LN.by + 0.005, z], [sd * LN.wx, LN.by + 0.005, z]); seg(ctx, c, [sd * (LN.hw + 0.5), LN.by + 0.005, c.z - 3], [sd * (LN.hw + 0.5), LN.by + 0.005, far]); ctx.strokeStyle = F(P.stoneJ, 0.6); ctx.lineWidth = 1; ctx.stroke(); }
  const items = [];
  items.push([depth(c, 0, 3.5, LN.zg), () => { water_gate(ctx, c, t); if (st.big) st.big(ctx, c); }]);
  for (let z0 = Math.floor((c.z - 3) / 6) * 6; z0 < LN.zg; z0 += 6) items.push([depth(c, -2.6, 2.2, z0 + 3) + 0.5, () => gallery(ctx, c, t, Math.max(z0, -22), Math.min(z0 + 6, LN.zg), lit)]);
  for (const U of LUM) { if (U.z < c.z - 3) continue; const d = depth(c, U.x, U.y, U.z); if (d < 0.3) continue; items.push([d, () => umbrella(ctx, c, U, U.ph + 0.12 * t + (st.spin ? st.spin(U.z) : 0), 0.35 + 0.65 * lit(U.z))]); }
  for (const k of st.koi || []) items.push([depth(c, ...window.JZ.koi.center(k, t)), () => window.JZ.koi.draw(ctx, c, k, t, false)]);
  if (st.items) st.items(items, ctx, c, false);
  items.sort((a, b) => b[0] - a[0]); for (const [d, fn] of items) { FOG = clamp((d - 20) / 140, 0, 0.5); fn(); } FOG = 0;
  if (st.fx) st.fx(ctx, c, wp);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); GLOWS.length = 0;
};
// 红伞巷一帧；st.split 时镜头卡在水线上：上半是巷子，下半是水下（frameUnder 用窄水道），中间一条晃的水线、镜头上挂几颗水珠
const frameLane = (ctx, s, st) => { const t = s.t, c = st.cam;
  if (!st.split) { frameLaneAbove(ctx, c, t, st); post(ctx, st); return; }
  frameLaneAbove(ctx, cam({ ...c, y: Math.max(c.y, 0.015) }), t, st);
  const hy = lerp(H + 40, c.oy + c.f * Math.tan(c.pitch), st.splitK ?? 1), wv = (x) => hy + 7 * Math.sin(x / 190 + t * 2.6) + 3 * Math.sin(x / 61 - t * 4.3);
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, wv(0)); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, wv(x)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
  frameUnder(ctx, s, { ...st, cam: cam({ ...c, y: -0.015 }), hw: LN.hw, split: true, noPost: true, deep: true, fx: st.fxUnder }); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0, wv(0)); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wv(x)); ctx.strokeStyle = 'rgba(230,245,255,0.8)'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(20,40,60,0.5)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, wv(0) + 5); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wv(x) + 5); ctx.stroke();
  for (let k = 0; k < 7; k++) { const x = W * hash(k, 571), y = wv(x) - 30 - 120 * hash(k, 572), r = 8 + 22 * hash(k, 573); ctx.strokeStyle = 'rgba(230,245,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, TAU); ctx.fill(); }
  post(ctx, st); };

// 一片荷叶：近乎圆，朝叶柄有一道缺口，叶面微微兜起；正面深绿（月光下偏青）、叶脉放射，背面银白带粉；C 叶心，N 叶面朝向，r 半径，rot 缺口朝哪，cup 兜起多少
// sil：水下看，逆光的剪影、边透亮
const leaf = T.leaf = (ctx, c, C, N, r, rot, cup = 0.08, sil = false) => { const pc = pr(c, ...C); if (!pc || r * pc[2] < 0.8) return; const e1 = nrmT(Math.abs(N[1]) < 0.9 ? crossT(N, [0, 1, 0]) : crossT(N, [1, 0, 0])), e2 = crossT(N, e1), n = 22, rim = [];
  for (let i = 0; i <= n; i++) { const a = rot + 0.22 + (TAU - 0.44) * i / n, rr = r * (1 + 0.04 * Math.sin(i * 2.7)); rim.push(addT(addT(addT(C, e1, rr * Math.cos(a)), e2, rr * Math.sin(a)), N, cup * r)); }
  const top = (c.x - C[0]) * N[0] + (c.y - C[1]) * N[1] + (c.z - C[2]) * N[2] > 0, sp = clipP(c, [C, ...rim]); if (!sp) return;
  const vn = top ? N[1] : -N[1], lk = clamp(0.25 + 0.75 * vn);   // 看到的那一面朝上才被月光照亮：背面只有翻过来朝上时才是银白，从下面看是暗的
  if (sil) { const rp = rim.map(q => pr(c, ...q)); if (rp.some(q => !q)) return; const sz = r * pc[2];
    ctx.beginPath(); ctx.moveTo(pc[0], pc[1]); ctx.lineTo(rp[0][0], rp[0][1]); for (let i = 1; i < rp.length - 1; i++) ctx.quadraticCurveTo(rp[i][0], rp[i][1], (rp[i][0] + rp[i + 1][0]) / 2, (rp[i][1] + rp[i + 1][1]) / 2); ctx.lineTo(rp[rp.length - 1][0], rp[rp.length - 1][1]); ctx.closePath();
    const gr = ctx.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], Math.max(1, sz * 1.1)); gr.addColorStop(0, F(hx('#06160e'), 0.95)); gr.addColorStop(0.7, F(hx('#0e2a1c'), 0.9)); gr.addColorStop(1, F(hx('#2a5a40'), 0.85)); ctx.fillStyle = gr; ctx.fill();
    if (sz > 4) { ctx.strokeStyle = F(hx('#8ad0a8'), 0.5); ctx.lineWidth = Math.max(0.8, sz * 0.025); ctx.stroke(); ctx.beginPath(); for (let i = 0; i <= n; i += 2) { const m = rp[i]; ctx.moveTo(pc[0], pc[1]); ctx.quadraticCurveTo((pc[0] + m[0]) / 2 + (m[1] - pc[1]) * 0.06, (pc[1] + m[1]) / 2 - (m[0] - pc[0]) * 0.06, m[0], m[1]); } ctx.strokeStyle = F(hx('#3a7a5a'), 0.4); ctx.lineWidth = Math.max(0.5, sz * 0.012); ctx.stroke();
      ctx.fillStyle = F(hx('#4a8a68'), 0.6); ctx.beginPath(); ctx.arc(pc[0], pc[1], Math.max(1, sz * 0.1), 0, TAU); ctx.fill(); } return; }
  ctx.beginPath(); sub(ctx, sp); ctx.fillStyle = F(mx(hx('#0e1c18'), top ? hx('#25503a') : hx('#9cb89c'), lk)); ctx.fill();
  if (sil) { if (r * pc[2] > 4) { ctx.beginPath(); for (let i = 0; i < n; i++) seg(ctx, c, rim[i], rim[i + 1]); ctx.strokeStyle = F(hx('#8ad0a8'), 0.55); ctx.lineWidth = Math.max(0.8, r * pc[2] * 0.03); ctx.stroke(); ctx.beginPath(); for (let i = 0; i <= n; i += 2) seg(ctx, c, C, rim[i]); ctx.strokeStyle = F(hx('#3a7a5a'), 0.35); ctx.lineWidth = Math.max(0.5, r * pc[2] * 0.012); ctx.stroke(); ctx.fillStyle = F(hx('#4a8a68'), 0.6); ctx.beginPath(); ctx.arc(pc[0], pc[1], Math.max(1, r * pc[2] * 0.1), 0, TAU); ctx.fill(); } return; }
  if (r * pc[2] > 6) { ctx.beginPath(); for (let i = 0; i <= n; i += 2) seg(ctx, c, C, rim[i]); ctx.strokeStyle = F(top ? hx('#3d7452') : hx('#c8dcc0'), 0.7); ctx.lineWidth = Math.max(0.5, r * pc[2] * 0.012); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < n; i++) seg(ctx, c, rim[i], rim[i + 1]); ctx.strokeStyle = F(top ? hx('#5a9a70') : hx('#e6f0dc'), 0.55); ctx.lineWidth = Math.max(0.6, r * pc[2] * 0.02); ctx.stroke(); } };
// ---------------- 荷塘（C13，第十二次重排）：镇外一大片荷塘，满塘荷叶、荷花、萤火，远处一排镇子的屋顶和灯；水下看荷叶是逆光的剪影、荷梗一根根伸到底 ----------------
// 自己一套坐标（米）：水面 y 0，池底 y −2.5；荷叶集中在 x ±40、z −10..120；远处镇子在 z 260
let PLV = null, PFL = null, PFF = null, PTN = null;
const buildPond = () => {
  PLV = []; for (let i = 0; i < 760; i++) { const h = (k) => hash(i, 701 + k), raised = h(3) < 0.33; PLV.push({ x: (h(0) - 0.5) * (i < 260 ? 12 : 80), z: -10 + (i < 260 ? 50 : 130) * h(1), r: 0.32 + 0.55 * h(2), y: raised ? 0.25 + 0.75 * h(4) : 0.02, raised, tx: (h(5) - 0.5) * (raised ? 0.5 : 0.08), tz: (h(6) - 0.5) * (raised ? 0.5 : 0.08), rot: h(7) * TAU, i }); }
  PFL = []; for (let i = 0; i < 70; i++) { const h = (k) => hash(i, 721 + k); PFL.push({ x: (h(0) - 0.5) * (i < 30 ? 12 : 70), z: -6 + (i < 30 ? 46 : 120) * h(1), y: 0.35 + 0.7 * h(2), s: 0.28 + 0.16 * h(3), red: i === 7, bud: h(4) < 0.25, ph: h(5) * TAU }); }
  PFL[7].x = 0.6; PFL[7].z = 18; PFL[7].y = 0.55; PFL[7].s = 0.42; PFL[7].bud = false;   // 「红」那一朵
  PFF = []; for (let i = 0; i < 260; i++) { const h = (k) => hash(i, 741 + k); PFF.push({ x: (h(0) - 0.5) * 40, z: -6 + 70 * h(1), y: 0.3 + 2.6 * h(2), ph: h(3) * TAU, v: 0.3 + 0.5 * h(4) }); }
  PTN = []; let x = -170; for (let k = 0; x < 170; k++) { const w = 5 + 7 * hash(k, 761), h = 6 + 5 * hash(k, 762) + (hash(k, 763) < 0.08 ? 9 : 0); PTN.push({ x0: x, x1: x + w, h, gable: hash(k, 764) < 0.6, k }); x += w + 0.5 * hash(k, 765); } };
// 荷花：粉白的花瓣一层层（尖白根粉），中间黄的莲蓬；red 是「红」那一朵；bud 是花苞
const flowerSpr = (red, bud) => M.cached('tflower' + red + bud, 120, 110, (g) => { const cx = 60, cy = 86, base = red ? '#c0102e' : '#e8608e', tip = red ? '#ff9a9a' : '#fff2f6';
  const petal = (a, len, wd) => { g.save(); g.translate(cx, cy); g.rotate(a); const gr = g.createLinearGradient(0, 0, 0, -len); gr.addColorStop(0, base); gr.addColorStop(1, tip); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(wd, -len * 0.35, wd * 0.7, -len * 0.82, 0, -len); g.bezierCurveTo(-wd * 0.7, -len * 0.82, -wd, -len * 0.35, 0, 0); g.fill(); g.strokeStyle = red ? 'rgba(90,0,20,0.35)' : 'rgba(150,40,80,0.3)'; g.lineWidth = 1; g.stroke(); g.restore(); };
  if (bud) { petal(-0.18, 52, 16); petal(0.18, 52, 16); petal(0, 58, 18); return; }
  for (const a of [-1.35, 1.35, -0.95, 0.95]) petal(a, 46, 18); for (const a of [-0.5, 0.5, 0]) petal(a, 56, 20);
  g.fillStyle = '#e8c850'; g.beginPath(); g.ellipse(cx, cy - 20, 13, 6, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,100,20,0.6)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx - 8 + k * 3.2, cy - 21 + (k % 2), 1.2, 0, TAU); g.fill(); }
  for (const a of [-0.62, 0.62]) petal(a, 38, 17); }, true);
// 远处的镇子：一排屋顶剪影（马头墙）、窗和灯笼的光点，在水里拖成竖的倒影
const pondTown = (ctx, c, t) => { const z = 260; FOG = 0.45;
  for (const Hs of PTN) { const pts = [[Hs.x0, -1, z], [Hs.x0, Hs.h, z]]; if (Hs.gable) pts.push([Hs.x0 + 0.5, Hs.h + 1.4, z], [Hs.x1 - 0.5, Hs.h + 1.4, z]); else pts.push([(Hs.x0 + Hs.x1) / 2, Hs.h + 2.4, z]); pts.push([Hs.x1, Hs.h, z], [Hs.x1, -1, z]); fillP(ctx, c, pts, F(hx('#121636')));
    for (let q = 0; q < 3; q++) { if (hash(Hs.k, 770 + q) < 0.45) continue; const p = pr(c, lerp(Hs.x0, Hs.x1, 0.2 + 0.3 * q), Hs.h * (0.3 + 0.3 * hash(Hs.k, 780 + q)), z); if (!p) continue; const s = Math.max(1, p[2] * 0.9); ctx.fillStyle = F(P.paper, 0.85); ctx.fillRect(p[0] - s / 2, p[1] - s * 0.7, s, s * 1.4); glow(p[0], p[1], Math.max(2, p[2] * 3), glowSpr('lan', P.lan), 0.3);
      const m = pr(c, lerp(Hs.x0, Hs.x1, 0.2 + 0.3 * q), -Hs.h * (0.3 + 0.3 * hash(Hs.k, 780 + q)), z); if (m) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.drawImage(glowSpr('lan', P.lan), m[0] - s, m[1] - s * 6, s * 2, s * 12); ctx.restore(); } } }
  FOG = 0; };
// 一片荷叶在 t 时：被锦鲤顶起（lift）、被风翻过来（flip，绕 z 轴转），平的浮在水上、高的挑在梗上
const leafPose = (L, t, st) => { const lf = st.lift ? st.lift(L, t) : 0, fl = st.flip ? st.flip(L, t) : 0, sw = 0.05 * Math.sin(t * 0.8 + L.rot * 3);
  const ax = L.tx + sw + fl, N = [Math.sin(ax) * Math.cos(L.tz), Math.cos(ax) * Math.cos(L.tz), Math.sin(L.tz) + 0.25 * lf], C = [L.x + 0.2 * Math.sin(fl) * L.r, L.y + 0.45 * lf + 0.5 * L.r * Math.abs(Math.sin(fl)), L.z]; return { C, N: nrmT(N) }; };
const pondFF = (F0, t, st) => { const w = st.windF ? st.windF(F0.x, t) : 0; return [F0.x + 0.6 * Math.sin(t * F0.v + F0.ph) + w * 6, F0.y + 0.3 * Math.sin(t * 1.3 * F0.v + F0.ph * 2) + w * 1.5, F0.z + 0.6 * Math.cos(t * 0.7 * F0.v + F0.ph)]; };
// 水上
const framePondAbove = (ctx, c, t, st) => {
  sky(ctx, c, t, st); pondTown(ctx, c, t);
  const wp = clipP(c, [[-400, 0, c.z - 5], [-400, 0, 600], [400, 0, 600], [400, 0, c.z - 5]]);
  if (wp) { const hy = c.oy + c.f * Math.tan(c.pitch), g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, css(hx('#262a62'))); g.addColorStop(0.25, css(P.water)); g.addColorStop(1, css(hx('#03061a'))); ctx.beginPath(); sub(ctx, wp); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); const mp = pr(c, c.x + Math.sin(0.42) * Math.cos(0.5) * 1e5, c.y - Math.sin(0.5) * 1e5, c.z + Math.cos(0.42) * Math.cos(0.5) * 1e5); if (mp) { ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 40; k++) { const yy = hy + (mp[1] - hy) * Math.pow(k / 40, 0.7), w = 30 + 60 * hash(k, 791); ctx.fillStyle = `rgba(220,215,180,${0.12 + 0.1 * Math.sin(t * 2.3 + k)})`; ctx.fillRect(mp[0] - w / 2 + 12 * Math.sin(t * 1.7 + k * 0.9), yy, w, 2); } } ctx.restore(); }
  const items = [];
  for (const L of PLV) { if (L.z < c.z - 2) continue; const { C, N } = leafPose(L, t, st), d = depth(c, ...C); if (d < 0.3 || d > 160) continue; items.push([d, () => { ctx.save(); ctx.globalAlpha = clamp((d - 0.3) / 2.5); if (L.raised) { ctx.beginPath(); seg(ctx, c, [C[0], 0, C[2]], C); ctx.strokeStyle = F(hx('#1f4a30')); ctx.lineWidth = Math.max(0.6, 0.025 * (pr(c, ...C) || [0, 0, 1])[2]); ctx.stroke(); } leaf(ctx, c, C, N, L.r, L.rot, L.raised ? 0.15 : 0.03); ctx.restore(); }]); }   // 贴着镜头的淡掉（审片：171.3 秒「风起」一片荷叶在镜头前翻过去，后面的亮天一下露出来）
  for (const Fl of PFL) { const sw = (st.windF ? st.windF(Fl.x, t) : 0) * 0.6 + 0.05 * Math.sin(t + Fl.ph), C = [Fl.x + sw * Fl.y, Fl.y, Fl.z], d = depth(c, ...C); if (d < 0.3 || Fl.z < c.z - 1) continue;
    items.push([d - 0.05, () => { const p = pr(c, ...C), b = pr(c, Fl.x, 0, Fl.z); if (!p) return; if (b) { ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(b[0], (b[1] + p[1]) / 2, p[0], p[1]); ctx.strokeStyle = F(hx('#1f4a30')); ctx.lineWidth = Math.max(0.6, p[2] * 0.02); ctx.stroke(); }
      const w = Fl.s * p[2] * 2.2, h = w * 110 / 120; ctx.save(); ctx.globalAlpha = 1 - FOG * 0.5; ctx.translate(p[0], p[1]); ctx.rotate(sw * 0.6); ctx.drawImage(flowerSpr(Fl.red, Fl.bud), -w / 2, -h * 0.82, w, h); ctx.restore(); if (Fl.red && st.redK) glow(p[0], p[1] - h * 0.3, p[2] * 1.2, glowSpr('redl', [255, 60, 50], 0.2), 0.6 * st.redK); }]); }
  for (const k of st.koi || []) items.push([depth(c, ...window.JZ.koi.center(k, t)), () => window.JZ.koi.draw(ctx, c, k, t, false)]);
  if (st.items) st.items(items, ctx, c, false);
  items.sort((a, b) => b[0] - a[0]); for (const [d, fn] of items) { FOG = clamp((d - 15) / 160, 0, 0.6); fn(); } FOG = 0;
  // 萤火：一点黄绿，一闪一闪
  for (const F0 of PFF) { const p3 = pondFF(F0, t, st), p = pr(c, ...p3); if (!p) continue; const bl = 0.4 + 0.6 * Math.max(0, Math.sin(t * (1.5 + F0.v) + F0.ph)); glow(p[0], p[1], Math.max(2, p[2] * 0.25), glowSpr('ff', hx('#d8ff8a'), 0.15), 0.9 * bl); ctx.fillStyle = `rgba(240,255,190,${0.9 * bl})`; const s = Math.max(1, p[2] * 0.02); ctx.fillRect(p[0] - s / 2, p[1] - s / 2, s, s); }
  if (st.fx) st.fx(ctx, c, wp);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); GLOWS.length = 0; };
// 水下：抬头看水面（正上方亮、斜着看暗下去），荷叶是逆光的剪影、边透亮，荷梗伸到底，光柱、悬浮的颗粒；水面上的萤火隔着水糊成光点
const framePondUnder = (ctx, c, t, st) => { const hy = c.oy + c.f * Math.tan(c.pitch), g = ctx.createLinearGradient(0, hy - c.f * 0.9, 0, hy + c.f * 0.6); g.addColorStop(0, '#174650'); g.addColorStop(0.45, '#08262e'); g.addColorStop(1, '#01080e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);   // 夜里的池子：水下是暗青的
  const sp = clipP(c, [[-200, 0, c.z - 120], [-200, 0, c.z + 300], [200, 0, c.z + 300], [200, 0, c.z - 120]]);
  if (sp) { const a = pr(c, c.x, 0, c.z + 0.5) || [W / 2, 0, 1], b = pr(c, c.x, 0, c.z + 40); ctx.save(); ctx.beginPath(); sub(ctx, sp); ctx.clip(); const gs = ctx.createLinearGradient(0, b ? b[1] : hy, 0, a[1] < 0 ? 0 : a[1]); const nk = 0.55 + 0.45 * clamp(-c.y / 1.0); gs.addColorStop(0, 'rgba(12,38,46,1)'); gs.addColorStop(1, `rgba(${84 * nk | 0},${140 * nk | 0},${150 * nk | 0},1)`); ctx.fillStyle = gs; ctx.fillRect(0, 0, W, H);
    // 透光窗（斯涅尔窗）：头顶一圈能看见天的亮窗，边上一道亮圈；水面底下晃着焦散光纹
    const rs = Math.abs(c.y) * 1.13 + 0.3, snp = clipP(c, Array.from({ length: 32 }, (_, k) => [c.x + rs * Math.cos(k / 32 * TAU), -0.01, c.z + rs * Math.sin(k / 32 * TAU)]));
    const sw = clamp((Math.abs(c.y) - 0.3) / 0.6);   // 贴近水面时透光窗在画面上会盖满：淡掉
    if (snp && sw > 0) { ctx.beginPath(); sub(ctx, snp); ctx.fillStyle = `rgba(140,195,205,${0.35 * sw})`; ctx.fill(); ctx.strokeStyle = `rgba(215,248,255,${0.45 * sw})`; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.5; for (let k = 0; k < 26; k++) { const z0 = c.z + 1 + 1.1 * k, ph = k * 1.7; ctx.beginPath(); let on = false; for (let x = c.x - 12; x <= c.x + 12; x += 0.6) { const q = pr(c, x, -0.02, z0 + 0.35 * Math.sin(x * 1.3 + t * 1.6 + ph) + 0.2 * Math.sin(x * 2.9 - t * 2.2)); if (!q) { on = false; continue; } on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; } ctx.strokeStyle = 'rgba(190,240,235,0.1)'; ctx.stroke(); }
    for (const F0 of PFF) { const p3 = pondFF(F0, t, st), p = pr(c, p3[0], 0, p3[2]); if (!p) continue; const bl = 0.4 + 0.6 * Math.max(0, Math.sin(t * (1.5 + F0.v) + F0.ph)); ctx.globalAlpha = 0.5 * bl; const r = Math.max(3, p[2] * 0.5); ctx.drawImage(glowSpr('ff', hx('#d8ff8a'), 0.15), p[0] - r, p[1] - r, 2 * r, 2 * r); } ctx.restore(); }
  HZ = hx('#0b2c3c'); const items = [];
  { const a = pr(c, c.x, -2.5, c.z + 1.5), b = pr(c, c.x, -2.5, c.z + 45); let fl = F(hx('#1e2e26')); if (a && b && Math.abs(a[1] - b[1]) > 1) { fl = ctx.createLinearGradient(0, a[1], 0, b[1]); fl.addColorStop(0, css(hx('#2a3428'))); fl.addColorStop(0.5, css(hx('#16262a'))); fl.addColorStop(1, css(hx('#0c2430'))); }
    fillP(ctx, c, [[-200, -2.5, c.z - 5], [-200, -2.5, c.z + 200], [200, -2.5, c.z + 200], [200, -2.5, c.z - 5]], fl); }
  // 水底的焦散：两组交错的波纹线，连成一张晃的光网
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.2; for (const fam of [0, 1]) for (let k = 0; k < 22; k++) { const z0 = c.z + 1.5 + 1.2 * k; ctx.beginPath(); let on = false; for (let x = c.x - 12; x <= c.x + 12; x += 0.5) { const zz = z0 + 0.45 * Math.sin(x * (fam ? 1.1 : 1.6) + t * (fam ? 1.3 : -1.0) + k * 2.1); const q = pr(c, x, -2.49, zz); if (!q) { on = false; continue; } on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; }
    FOG = clamp((z0 - c.z) / 40, 0, 0.9); ctx.strokeStyle = F(hx('#7ac0b0'), 0.13); ctx.stroke(); } ctx.restore();
  // 卵石、水草（一丛丛，跟着水摆）
  for (let i = 0; i < 110; i++) { const h = (k) => hash(i, 931 + k), x = c.x + (h(0) - 0.5) * 16, z = Math.floor(c.z / 30) * 30 + h(1) * 60; if (z < c.z || z > c.z + 35) continue; items.push([depth(c, x, -2.5, z), () => { const q = pr(c, x, -2.48, z); if (!q) return; FOG = clamp((z - c.z) / 38, 0, 0.9); const r = q[2] * (0.06 + 0.12 * h(2));
    ctx.fillStyle = F(mx(hx('#2c3a34'), hx('#5a6a5e'), h(3))); ctx.beginPath(); ctx.ellipse(q[0], q[1], r, r * 0.45, 0, 0, TAU); ctx.fill(); ctx.fillStyle = F(hx('#7a8c80'), 0.35); ctx.beginPath(); ctx.ellipse(q[0] - r * 0.2, q[1] - r * 0.15, r * 0.5, r * 0.18, 0, 0, TAU); ctx.fill(); }]); }
  for (let i = 0; i < 46; i++) { const h = (k) => hash(i, 951 + k), x = c.x + (h(0) - 0.5) * 14, z = Math.floor(c.z / 30) * 30 + h(1) * 60; if (z < c.z + 1 || z > c.z + 35) continue; items.push([depth(c, x, -2.2, z), () => { FOG = clamp((z - c.z) / 38, 0, 0.9);
    for (let k = 0; k < 6; k++) { const len = 0.4 + 0.6 * hash(i, 960 + k), a0 = (k - 2.5) * 0.12, pts = []; for (let j = 0; j <= 4; j++) { const f = j / 4, sw = 0.12 * f * f * Math.sin(t * 1.2 + i + k) + a0 * f; const q = pr(c, x + sw + (k - 2.5) * 0.03, -2.5 + len * f, z); if (!q) return; pts.push(q); }
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.strokeStyle = F(mx(hx('#1f5a3a'), hx('#6aa46a'), hash(i, 970 + k) * 0.6)); ctx.lineWidth = Math.max(0.8, pts[0][2] * 0.02); ctx.lineCap = 'round'; ctx.stroke(); } }]); }
  // 远处三群小鱼的剪影，绕着慢慢游
  for (let sc = 0; sc < 3; sc++) { const ang = t * (0.25 + 0.08 * sc) + sc * 2.1, cx0 = c.x + 5 * Math.cos(ang) + (sc - 1) * 4, cz0 = c.z + 14 + 6 * sc + 4 * Math.sin(ang), cy0 = -1.2 - 0.4 * sc;
    for (let i = 0; i < 14; i++) { const h = (k) => hash(i, 981 + k + sc * 10), x = cx0 + (h(0) - 0.5) * 2.4, y = cy0 + (h(1) - 0.5) * 0.8, z = cz0 + (h(2) - 0.5) * 2.4; items.push([depth(c, x, y, z), () => { const q = pr(c, x, y, z), q2 = pr(c, x - Math.sin(ang) * 0.3, y, z + Math.cos(ang) * 0.3); if (!q || !q2) return; FOG = clamp((z - c.z) / 40, 0, 0.85);
      const a = Math.atan2(q2[1] - q[1], q2[0] - q[0]), L = Math.max(2, q[2] * 0.16); ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(a + Math.PI); ctx.fillStyle = F(hx('#0c2a30'), 0.8); ctx.beginPath(); ctx.ellipse(0, 0, L, L * 0.35, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-L * 0.8, 0); ctx.lineTo(-L * 1.5, -L * 0.4); ctx.lineTo(-L * 1.5, L * 0.4); ctx.closePath(); ctx.fill(); ctx.restore(); }]); } }
  for (const L of PLV) { if (L.z < c.z - 3 || L.z > c.z + 70) continue; const { C, N } = leafPose(L, t, st), d = depth(c, ...C); if (d < 0.2) continue;
    items.push([d, () => { FOG = clamp(d / 50, 0, 0.85); ctx.save(); ctx.globalAlpha = clamp((d - 0.2) / 2.3);   // 贴着镜头的荷叶、荷梗淡掉（用户审片：168.7 秒一根荷梗穿过镜头那一帧一下没了，算闪） const top = pr(c, C[0], Math.min(C[1], 0) - 0.02, C[2]), bot = pr(c, C[0] + 0.3 * Math.sin(L.rot), -2.5, C[2] + 0.3 * Math.cos(L.rot)); if (top && bot) { const lw = Math.max(0.8, top[2] * 0.03), cxm = top[0] + 6 * Math.sin(t * 0.7 + L.i); ctx.lineCap = 'round'; for (const [col, a, w, ox] of [[hx('#071810'), 0.9, lw + 2, 0], [hx('#2a5a40'), 0.9, lw, 0], [hx('#6a9a78'), 0.45, Math.max(0.5, lw * 0.3), lw * 0.25]]) { ctx.beginPath(); ctx.moveTo(top[0] + ox, top[1]); ctx.quadraticCurveTo(cxm + ox, (top[1] + bot[1]) / 2, bot[0] + ox, bot[1]); ctx.strokeStyle = F(col, a); ctx.lineWidth = w; ctx.stroke(); } }
      leaf(ctx, c, C, N, L.r, L.rot, L.raised ? 0.15 : 0.03, true); ctx.restore(); }]); }
  for (const Fl of PFL) { if (Fl.z < c.z - 3 || Fl.z > c.z + 60) continue; const d = depth(c, Fl.x, 0, Fl.z); if (d < 0.3) continue; items.push([d, () => { FOG = clamp(d / 50, 0, 0.85); const top = pr(c, Fl.x, 0, Fl.z), bot = pr(c, Fl.x, -2.5, Fl.z + 0.4), nf = clamp((d - 0.3) / 3); if (!top || !bot) return; ctx.beginPath();   // nf：贴着镜头的荷花（梗、光晕）淡掉，不在穿过镜头那一帧一下没了 ctx.moveTo(top[0], top[1]); ctx.lineTo(bot[0], bot[1]); ctx.strokeStyle = F(hx('#1d4a34'), 0.8 * nf); ctx.lineWidth = Math.max(0.8, top[2] * 0.025); ctx.stroke();
    if (Fl.red && st.redK) glow(top[0], top[1], top[2] * 1.4, glowSpr('redl', [255, 60, 50], 0.2), 0.7 * st.redK * nf); else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * (1 - FOG) * nf; const r = top[2] * 0.4; ctx.drawImage(glowSpr('flw', hx('#ffb0c8'), 0.2), top[0] - r, top[1] - r, 2 * r, 2 * r); ctx.restore(); } }]); }
  for (const k of st.koi || []) items.push([depth(c, ...window.JZ.koi.center(k, t)), () => { FOG = 0; window.JZ.koi.draw(ctx, c, k, t, false); }]);
  if (st.items) st.items(items, ctx, c, false);
  items.sort((a, b) => b[0] - a[0]); for (const [, fn] of items) fn(); FOG = 0; HZ = null;
  // 光柱：从水面斜斜地照下来，慢慢晃
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 0; k < 9; k++) { const x = c.x - 6 + 12 * hash(k, 801) + 0.6 * Math.sin(t * 0.4 + k), z = c.z + 3 + 20 * hash(k, 802), a = pr(c, x, 0, z), b = pr(c, x + 1.2, -2.5, z + 0.8), w0 = pr(c, x + 0.5, 0, z); if (!a || !b || !w0) continue; const wd = Math.abs(w0[0] - a[0]) + 4;
    const gr = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, `rgba(190,240,230,${0.07 + 0.04 * Math.sin(t * 0.9 + k)})`); gr.addColorStop(1, 'rgba(190,240,230,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(a[0] - wd, a[1]); ctx.lineTo(a[0] + wd, a[1]); ctx.lineTo(b[0] + wd * 2, b[1]); ctx.lineTo(b[0] - wd * 2, b[1]); ctx.closePath(); ctx.fill(); }
  for (let i = 0; i < 240; i++) { const p = pr(c, c.x + (hash(i, 811) - 0.5) * 8, -2.5 * hash(i, 812) + 0.1 * Math.sin(t * 0.5 + i), c.z + 0.5 + hash(i, 813) * 22); if (!p) continue; ctx.globalAlpha = 0.22; ctx.fillStyle = '#c8f0e0'; const r = Math.max(0.6, p[2] * 0.012); ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); } ctx.restore();
  if (st.fx) st.fx(ctx, c, null);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); GLOWS.length = 0; };
const framePond = (ctx, s, st) => { if (!PLV) buildPond(); const c = st.cam; if (c.y < 0) framePondUnder(ctx, c, s.t, st); else framePondAbove(ctx, c, s.t, st); post(ctx, { ...st, bloom: st.bloom ?? (c.y < 0 ? 0.7 : 0.5) }); };

// ---------------- 画一帧 ----------------
// st：{ cam, lit(x, y, z) → 0..1, litM（水里的倒影另算，可不给）, koi: [...], lotus, sky, unfurl, ball, glint, wind, waves, bloom, townGlow, under（水下）, fx(ctx, c, 水面多边形), items(列表, …)（往深度排序里加东西） }
// 飞出天外以后：只画星空（st.space）、st.items、st.fx，光晕和后期照旧
const frameSpace = (ctx, s, st) => { const c = st.cam, items = []; st.space(ctx, c); if (st.items) st.items(items, ctx, c, false);
  items.sort((a, b) => b[0] - a[0]); FOG = 0; for (const [, fn] of items) fn(); if (st.fx) st.fx(ctx, c, null);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
  post(ctx, st); };
T.frame = (ctx, s, st) => {
  const t = s.t, c = st.cam; GLOWS.length = 0; GA = st.glowK ?? 1;
  M.resetTransform(ctx);
  if (st.under) return frameUnder(ctx, s, st);
  if (st.world === 'gate') return frameGate(ctx, s, st);
  if (st.world === 'space') return frameSpace(ctx, s, st);
  if (st.world === 'lane') return frameLane(ctx, s, st);
  if (st.world === 'pond') return framePond(ctx, s, st);
  const wp = clipP(c, waterPoly(c));
  drawWorld(ctx, c, false, () => { reflect(ctx, c, st, t); GLOWS.length = 0; }, st, t);
  // 倒影里灯笼拖成竖的光带
  if (wp) { ctx.save(); ctx.beginPath(); sub(ctx, wp); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, r, spr, a] of GLOWS) { if (r < 2) continue; const hy = c.oy + c.f * Math.tan(c.pitch), my = 2 * hy - y; if (my < hy) continue; const L = Math.min(260, (my - hy) * 0.9);
      ctx.globalAlpha = a * 0.35; ctx.drawImage(spr, x - r * 0.35, my - L * 0.45, r * 0.7, L);
      for (let k = 0; k < 5; k++) { const yy = my - L * 0.4 + L * 0.8 * hash(k, (x | 0) + 7), w2 = r * (0.3 + 0.6 * hash(k, (y | 0) + 3)), dx = Math.sin(t * 2.6 + k * 1.7 + x * 0.01) * r * 0.25;
        ctx.globalAlpha = a * 0.5 * (0.5 + 0.5 * Math.sin(t * 3.1 + k * 2.3 + x)); ctx.fillStyle = css(hx('#ffc070')); ctx.fillRect(x - w2 / 2 + dx, yy, w2, Math.max(1, r * 0.04)); } }
    ctx.restore(); }
  if (st.fx) st.fx(ctx, c, wp);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, spr, a] of GLOWS) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); }
  ctx.restore();
  post(ctx, st);
};

T.lanSpr = lanSpr; T.glowSpr = glowSpr; T.lotusSpr = lotusSpr; T.skySpr = skySpr; T.ballSpr = ballSpr; T.glow = glow; T.lantern = lantern; T.GLOWS = GLOWS;
T.init = (m) => { M = m; SC = m.SC; hash = m.hash; build(); };
})();
