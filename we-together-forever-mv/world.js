// world.js —— 那条路、那棵树、天和天气。画面只由参数和时间 t 算出来，不记上一帧。
// 世界坐标（米）：x 向右，y 向上，z 沿着路往前。树在 (TREE_X, 0, 0)，路沿 z 轴，家在路尽头。
(() => {
const TAU = Math.PI * 2, W = 1920, H = 1080;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const mod = (x, m) => ((x % m) + m) % m;
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => { if (k <= 0 || a === b) return a; if (k >= 1) return b; const p = rgb(a), q = rgb(b); return '#' + p.map((v, i) => Math.round(lerp(v, q[i], k)).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => { const p = rgb(h); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
let M, hash, SC;
const WD = (window.WORLD = { mix, rgba, TREE_X: 4.2 });
const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC); const g = c.getContext('2d'); g.setTransform(SC, 0, 0, SC, 0, 0); return [c, g]; };

// ---------------- 天色（画风卡的色板）----------------
// sky：天顶 → 地平线；mtn：远 → 近；ground：远 → 近；blade：草根 → 草尖；amb：罩在人和东西上的环境色；rim：轮廓光；key：光从哪边来（屏幕方向）
const MOODS = WD.MOODS = {
  snowNight: { sky: ['#060b26', '#101d4e', '#27407f', '#5c78b8'], stars: 0.55, moon: [1500, 210], cl: { lit: '#8ea4dc', shade: '#1d2c62', kind: 'low' },
    mtn: ['#5a72b4', '#40569a', '#2a3b78'], haze: '#7f98d4', ground: ['#a9bcea', '#8196d2', '#566cb0'], road: ['#93a8de', '#6379bb'], blade: ['#4a5c96', '#c9d6f4'], snow: 1,
    amb: '#8fa4ea', rim: '#e6eeff', key: [0.6, -0.6], bark: ['#191c3a', '#6a7bb6'], win: 1 },
  dawn: { sky: ['#3550a8', '#8f86d0', '#ffad9a', '#ffe3a8'], stars: 0, sun: [1010, 742], cl: { lit: '#fff0d0', shade: '#c58ab0', kind: 'dawn' },
    mtn: ['#c2a9d8', '#9a8bc8', '#7470b4'], haze: '#ffd9c0', ground: ['#dfe9a4', '#8fcc6a', '#3f9a58'], road: ['#ecd3ac', '#bd946c'], blade: ['#2f8a50', '#cbf08a'], flowers: 1,
    amb: '#ffe2d4', rim: '#fff3c4', key: [-0.7, -0.4], bark: ['#3a2430', '#c08a72'], win: 0.3 },
  dusk: { sky: ['#2f4fa0', '#6f8fd6', '#f7b58a', '#ffe2a6'], stars: 0, sun: [1640, 700], cl: { lit: '#fff1d6', shade: '#c88a9a', kind: 'cumulus' },
    mtn: ['#a9b6dc', '#7890c8', '#526cac'], haze: '#ffd8b0', ground: ['#d3e28c', '#7fbf5a', '#2f8a4a'], road: ['#e8c99c', '#b88c62'], blade: ['#2a7a44', '#d8ee7c'], flowers: 0.5,
    amb: '#ffe0c8', rim: '#fff0b8', key: [0.7, -0.4], bark: ['#3b2a2a', '#d0905c'], win: 0.2 },
  starNight: { sky: ['#030719', '#0a1440', '#1a2d6e', '#3a5aa6'], stars: 1, milky: 1, cl: { lit: '#5f7cc4', shade: '#101c4c', kind: 'low' },
    mtn: ['#33488a', '#22346e', '#141f4c'], haze: '#4a68b4', ground: ['#2c4c74', '#183c56', '#0c2638'], road: ['#3c568a', '#243660'], blade: ['#0c2c34', '#4a9a96'],
    amb: '#8298e4', rim: '#cfe0ff', key: [-0.3, -0.7], bark: ['#0e1228', '#40528c'], win: 1 },
  autumn: { sky: ['#5f86c8', '#a9c3e8', '#f3d9b4', '#fbe9c8'], stars: 0, sun: [1820, 520], cl: { lit: '#ffffff', shade: '#c9b8c4', kind: 'wind' },
    mtn: ['#b7c1dc', '#9a9cc0', '#8a7a9a'], haze: '#f6e2c4', ground: ['#ead28c', '#d2a44c', '#a8742a'], road: ['#ebd4ac', '#bd9466'], blade: ['#8a5a1e', '#f2ca62'],
    amb: '#ffe9d2', rim: '#fff2cc', key: [0.6, -0.5], bark: ['#3a2622', '#bd8658'], win: 0.25 },
};
const MD = (md) => typeof md === 'string' ? { a: md, b: md, k: 0 } : md;
// 两种天色之间取色：col(md, 'ground', 2)
const col = WD.col = (md, key, i) => { md = MD(md); const a = MOODS[md.a][key], b = MOODS[md.b][key]; return mix(i == null ? a : a[i], i == null ? b : b[i], md.k); };

// ---------------- 远景底图：天、云、星、山、树线、家（每种天色画一次缓存）----------------
const PW = 2400, PH = 1000, PHY = 760;   // 底图上地平线在 y=760
function cloud(G, cx, cy, w, h, seed, lit, shade, lx, a = 1) {   // 一朵积云：一堆圆叠出轮廓，再从受光那侧一个个打亮
  const pad = h * 0.6, cw = w + pad * 2, chh = h * 1.5 + pad, [c, g] = mkc(cw, chh), ox = pad + w / 2, oy = pad + h * 1.2, P = [];
  for (let i = 0, n = Math.round(14 + w / 28); i < n; i++) { const u = hash(seed, i) * 2 - 1, env = Math.sqrt(1 - u * u), v = hash(seed, i + 50); P.push([ox + u * w * 0.46, oy - env * h * v * 0.85, (0.16 + 0.26 * hash(seed, i + 90)) * h * (0.55 + 0.45 * env)]); }
  P.sort((p, q) => q[1] - p[1]);
  g.fillStyle = shade; for (const [x, y, r] of P) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-atop';
  for (const [x, y, r] of P) { const gx = x + lx * r * 0.45, gy = y - r * 0.4, gr = g.createRadialGradient(gx, gy, r * 0.1, gx, gy, r * 1.05); gr.addColorStop(0, lit); gr.addColorStop(0.55, rgba(lit, 0.75)); gr.addColorStop(1, rgba(lit, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.1, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'destination-out'; const er = g.createLinearGradient(0, oy - h * 0.14, 0, oy + h * 0.3); er.addColorStop(0, 'rgba(0,0,0,0)'); er.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = er; g.fillRect(0, oy - h * 0.14, cw, h);
  G.save(); G.globalAlpha = a; G.filter = 'blur(0.9px)'; G.drawImage(c, cx - ox, cy - oy, cw, chh); G.restore();
}
function streak(G, cx, cy, w, h, c0, a) {   // 一条拉长的云带
  G.save(); G.translate(cx, cy); G.scale(1, h / w); const gr = G.createRadialGradient(0, 0, 0, 0, 0, w / 2); gr.addColorStop(0, rgba(c0, a)); gr.addColorStop(0.6, rgba(c0, a * 0.5)); gr.addColorStop(1, rgba(c0, 0)); G.fillStyle = gr; G.beginPath(); G.arc(0, 0, w / 2, 0, TAU); G.fill(); G.restore();
}
function ridge(g, base, amp, fr, seed, c0, haze, kx, snow) {   // 一层山：脊状噪声出山脊线，受光坡留一道亮边
  const ys = [], path = (dx, dy) => { g.beginPath(); g.moveTo(-40, PH); for (let i = 0; i < ys.length; i++) g.lineTo(i * 4 - 20 + dx, ys[i] + dy); g.lineTo(PW + 40, PH); g.closePath(); };
  for (let x = -20; x <= PW + 20; x += 4) { let n = 0, a = 1, f = fr, s = 0; for (let o = 0; o < 5; o++) { n += a * (1 - Math.abs(M.noise(x * f + seed, o * 7.3))); s += a; a *= 0.5; f *= 2.1; } ys.push(base - amp * Math.pow(n / s, 1.7)); }
  const gr = g.createLinearGradient(0, base - amp, 0, PHY + 20); gr.addColorStop(0, mix(c0, '#ffffff', 0.22)); gr.addColorStop(1, mix(c0, haze, 0.55));
  path(0, 0); g.fillStyle = gr; g.fill();
  g.save(); g.clip(); const g2 = g.createLinearGradient(0, base - amp, 0, PHY + 20); g2.addColorStop(0, c0); g2.addColorStop(1, mix(c0, haze, 0.6)); path(-kx * 16, 9); g.fillStyle = g2; g.fill();
  if (snow) { const g3 = g.createLinearGradient(0, base - amp, 0, base - amp * 0.35); g3.addColorStop(0, 'rgba(240,246,255,.85)'); g3.addColorStop(1, 'rgba(240,246,255,0)'); path(-kx * 5, 3); g.fillStyle = g3; g.fill(); }
  g.restore();
}
function paintPlate(g, m, name) {
  const sk = g.createLinearGradient(0, 0, 0, PHY); m.sky.forEach((c, i) => sk.addColorStop([0, 0.42, 0.8, 1][i], c)); g.fillStyle = sk; g.fillRect(0, 0, PW, PH);
  if (m.stars) {
    if (m.milky) {   // 银河：一条斜带，先晕一层光，再撒密星
      const ax = 250, ay = 40, bx = 2250, by = 650;
      for (let i = 0; i < 70; i++) { const u = hash(i, 301), x = lerp(ax, bx, u) + (hash(i, 302) - .5) * 180, y = lerp(ay, by, u) + (hash(i, 303) - .5) * 150, r = 120 + 170 * hash(i, 304), gr = g.createRadialGradient(x, y, 0, x, y, r), c0 = ['#6a7cff', '#b08cff', '#5fd0e8', '#ffb8d8'][i % 4];
        gr.addColorStop(0, rgba(c0, 0.085)); gr.addColorStop(1, rgba(c0, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (let i = 0; i < 9000; i++) { const u = hash(i, 311), off = (hash(i, 312) + hash(i, 313) + hash(i, 314) - 1.5) * 150, x = lerp(ax, bx, u) + off * 0.35, y = lerp(ay, by, u) - off; if (y > PHY - 30) continue;
        g.globalAlpha = 0.25 + 0.6 * hash(i, 315); g.fillStyle = ['#ffffff', '#cfe0ff', '#ffe9c8', '#e6d4ff'][i % 4]; const r = 0.35 + 0.8 * hash(i, 316) ** 2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      for (let i = 0; i < 26; i++) { const u = 0.1 + 0.8 * hash(i, 321), x = lerp(ax, bx, u) + (hash(i, 322) - .5) * 60, y = lerp(ay, by, u) + (hash(i, 323) - .5) * 40 + 10, r = 40 + 70 * hash(i, 324), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(4,7,26,.22)'); gr.addColorStop(1, 'rgba(4,7,26,0)'); g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    }
    for (let i = 0; i < 2600; i++) { const x = hash(i, 1) * PW, y = hash(i, 2) * PHY * 0.98, b = hash(i, 3) ** 3; g.globalAlpha = (0.35 + 0.65 * b) * m.stars * (1 - (y / PHY) ** 3 * 0.8); g.fillStyle = ['#ffffff', '#cfe0ff', '#ffe9c8', '#bcd0ff'][i % 4]; g.beginPath(); g.arc(x, y, 0.5 + 1.5 * b, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
  if (m.moon) { const [x, y] = m.moon, gr = g.createRadialGradient(x, y, 0, x, y, 300); gr.addColorStop(0, 'rgba(190,210,255,.5)'); gr.addColorStop(0.12, 'rgba(160,185,255,.22)'); gr.addColorStop(1, 'rgba(160,185,255,0)'); g.fillStyle = gr; g.fillRect(x - 300, y - 300, 600, 600);
    g.fillStyle = '#f2f6ff'; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); g.fillStyle = 'rgba(150,170,220,.35)'; for (const [dx, dy, r] of [[-8, -6, 8], [9, 5, 6], [2, 12, 4], [-12, 9, 3]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); } }
  if (m.sun) { const [x, y] = m.sun; for (const [r, a] of [[900, 0.35], [420, 0.5], [150, 0.9]]) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,244,214,${a})`); gr.addColorStop(0.4, `rgba(255,214,160,${a * 0.4})`); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(x, y, 34, 0, TAU); g.fill(); }
  const cl = m.cl, lx = m.key[0] > 0 ? 0.9 : -0.9, S0 = name.length * 131;
  if (cl.kind === 'cumulus') {
    for (const [x, y, w, h, sd] of [[330, 640, 760, 400, 3], [900, 700, 420, 190, 5], [2060, 660, 700, 330, 8], [1380, 715, 380, 130, 12], [20, 720, 420, 170, 15]]) cloud(g, x, y, w, h, S0 + sd, cl.lit, cl.shade, lx);
    for (let i = 0; i < 9; i++) streak(g, hash(i, S0) * PW, 180 + hash(i, S0 + 1) * 300, 380 + 500 * hash(i, S0 + 2), 22 + 30 * hash(i, S0 + 3), '#ffffff', 0.32);
  } else if (cl.kind === 'dawn') {
    for (let i = 0; i < 16; i++) { const y = 400 + hash(i, S0 + 1) * 330; streak(g, hash(i, S0) * PW, y, 500 + 800 * hash(i, S0 + 2), 26 + 46 * hash(i, S0 + 3), mix(cl.shade, cl.lit, (y - 400) / 330), 0.6); }
    for (const [x, y, w, h, sd] of [[260, 600, 620, 250, 2], [2080, 560, 640, 280, 7], [1560, 690, 360, 120, 9], [760, 705, 300, 100, 11]]) cloud(g, x, y, w, h, S0 + sd, cl.lit, cl.shade, lx, 0.95);
  } else if (cl.kind === 'wind') {
    for (let i = 0; i < 22; i++) { g.save(); g.translate(hash(i, S0) * PW, 120 + hash(i, S0 + 1) * 500); g.rotate(-0.16); streak(g, 0, 0, 500 + 900 * hash(i, S0 + 2), 14 + 30 * hash(i, S0 + 3), cl.lit, 0.55); g.restore(); }
    for (const [x, y, w, h, sd] of [[420, 690, 520, 170, 4], [1900, 700, 560, 180, 6]]) cloud(g, x, y, w, h, S0 + sd, cl.lit, cl.shade, lx, 0.9);
  } else {
    for (let i = 0; i < 12; i++) { const y = 480 + hash(i, S0 + 1) * 250; streak(g, hash(i, S0) * PW, y, 600 + 700 * hash(i, S0 + 2), 30 + 50 * hash(i, S0 + 3), i % 3 ? cl.shade : cl.lit, i % 3 ? 0.55 : 0.2); }
  }
  ridge(g, PHY - 30, 330, 0.0016, 11, m.mtn[0], m.haze, m.key[0], m.snow);
  ridge(g, PHY - 14, 215, 0.0027, 47, m.mtn[1], m.haze, m.key[0], m.snow);
  ridge(g, PHY - 2, 120, 0.0046, 83, m.mtn[2], m.haze, m.key[0], m.snow);
  // 山脚的树线
  const tc = mix(m.mtn[2], m.ground[0], 0.3);
  for (let x = -10; x < PW; x += 7) { const r = 5 + 13 * hash(x, 61) ** 2; g.fillStyle = mix(tc, m.haze, 0.25 * hash(x, 62)); g.beginPath(); g.ellipse(x, PHY - r * 0.55, r * 0.9, r, 0, 0, TAU); g.fill(); }
  // 路尽头的家：一栋小房子，一扇亮着的窗
  const hx = 1216, hyy = PHY - 3, hc = mix(m.mtn[2], '#20182a', 0.45);
  g.fillStyle = hc; g.fillRect(hx - 17, hyy - 15, 34, 15); g.beginPath(); g.moveTo(hx - 22, hyy - 14); g.lineTo(hx - 2, hyy - 29); g.lineTo(hx + 22, hyy - 14); g.closePath(); g.fill(); g.fillRect(hx + 8, hyy - 28, 4, 8);
  const wg = g.createRadialGradient(hx - 6, hyy - 8, 0, hx - 6, hyy - 8, 46); wg.addColorStop(0, `rgba(255,214,130,${0.75 * m.win})`); wg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = wg; g.fillRect(hx - 52, hyy - 54, 92, 92);
  g.fillStyle = '#ffdf9a'; g.fillRect(hx - 9, hyy - 11, 6, 6);
  // 地平线上的一层大气
  const hz = g.createLinearGradient(0, PHY - 150, 0, PHY + 10); hz.addColorStop(0, rgba(m.haze, 0)); hz.addColorStop(1, rgba(m.haze, 0.6)); g.fillStyle = hz; g.fillRect(0, PHY - 150, PW, 160);
}
WD.plate = (name) => M.cached('plate_' + name, PW, PH, (g) => paintPlate(g, MOODS[name], name), true);
WD.backdrop = (ctx, md, cam, ox = 0) => {
  md = MD(md); const x = -240 + ox - cam.x * 2, y = cam.hy - PHY;
  if (y > 0) { ctx.fillStyle = col(md, 'sky', 0); ctx.fillRect(0, 0, W, y + 2); }
  ctx.drawImage(WD.plate(md.a), x, y, PW, PH);
  if (md.k > 0) { ctx.globalAlpha = md.k; ctx.drawImage(WD.plate(md.b), x, y, PW, PH); ctx.globalAlpha = 1; }
};
// 底图上的点（太阳、月亮）现在在屏幕哪里
WD.plateXY = (cam, p, ox = 0) => [p[0] - 240 + ox - cam.x * 2, p[1] + cam.hy - PHY];
// 会闪的亮星：盖在底图上
WD.twinkle = (ctx, cam, t, a = 1, n = 140) => {
  const spr = WD.dot('#ffffff');
  for (let i = 0; i < n; i++) { const x = hash(i, 71) * W, y = hash(i, 72) * (cam.hy - 60), f = 0.55 + 0.45 * Math.sin(t * (1.2 + 2.5 * hash(i, 73)) + i * 1.7), r = (2 + 5 * hash(i, 74) ** 2) * (0.7 + 0.5 * f);
    ctx.globalAlpha = a * f; ctx.drawImage(spr, x - r * 2, y - r * 2, r * 4, r * 4);
    if (i % 5 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 3, y - 0.5, r * 6, 1); ctx.fillRect(x - 0.5, y - r * 3, 1, r * 6); } }
  ctx.globalAlpha = 1;
};

// ---------------- 透视 ----------------
// cam = { x, y 机位高度, z, f 焦距（像素）, hy 地平线在屏幕上的 y }
const proj = WD.proj = (cam, x, y, z) => { const s = cam.f / Math.max(0.05, z - cam.z); return [W / 2 + (x - cam.x) * s, cam.hy - (y - cam.y) * s, s]; };

// ---------------- 小零件：光点、草丛、叶簇、花簇 ----------------
WD.dot = (c0) => M.cached('dot' + c0, 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(c0, 1)); gr.addColorStop(0.25, rgba(c0, 0.8)); gr.addColorStop(0.5, rgba(c0, 0.25)); gr.addColorStop(1, rgba(c0, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, true);
const clump = (name, v) => M.cached(`clump_${name}_${v}`, 240, 180, (g) => {
  const m = MOODS[name], sd = v * 17 + 3, by = 174;
  if (m.snow) { g.save(); g.translate(120, 150); g.scale(1, 0.3); const sg = g.createRadialGradient(-20, -30, 0, 0, 0, 100); sg.addColorStop(0, 'rgba(246,249,255,.95)'); sg.addColorStop(0.6, 'rgba(220,230,252,.5)'); sg.addColorStop(1, 'rgba(200,214,248,0)'); g.fillStyle = sg; g.beginPath(); g.arc(0, 0, 100, 0, TAU); g.fill(); g.restore(); }
  const n = m.snow ? 5 : 15;
  for (let i = 0; i < n; i++) { const bx = 120 + (hash(sd, i) - .5) * (m.snow ? 60 : 110), lean = (hash(sd, i + 20) - .5) * 80, hgt = (m.snow ? 44 : 60) + hash(sd, i + 40) * 84, wd = m.snow ? 3 : 5 + 4.5 * hash(sd, i + 60);
    const gr = g.createLinearGradient(0, by, 0, by - hgt); gr.addColorStop(0, m.snow ? '#8a7d6e' : m.blade[0]); gr.addColorStop(1, m.snow ? '#e6dcc6' : mix(m.blade[1], m.blade[0], 0.5 * hash(sd, i + 80)));
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx - wd, by); g.quadraticCurveTo(bx - wd + lean * 0.25, by - hgt * 0.6, bx + lean, by - hgt); g.quadraticCurveTo(bx + wd + lean * 0.35, by - hgt * 0.55, bx + wd, by); g.closePath(); g.fill(); }
  g.globalCompositeOperation = 'destination-out'; const fd = g.createLinearGradient(0, 140, 0, 178); fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = fd; g.fillRect(0, 140, 240, 40); g.globalCompositeOperation = 'source-over';
  if (m.flowers && hash(sd, 99) < m.flowers * 0.55) for (let i = 0; i < 2; i++) { const fx = 60 + hash(sd, i + 110) * 120, fy = 40 + hash(sd, i + 120) * 60, fr = 3.4 + 2.2 * hash(sd, i + 130); g.fillStyle = ['#ffffff', '#ffe36a', '#ffc2d8', '#ffffff'][(v + i) % 4]; for (let q = 0; q < 5; q++) { g.beginPath(); g.arc(fx + Math.cos(q * TAU / 5) * fr * 1.1, fy + Math.sin(q * TAU / 5) * fr * 1.1, fr, 0, TAU); g.fill(); } g.fillStyle = '#ffb030'; g.beginPath(); g.arc(fx, fy, fr * 0.6, 0, TAU); g.fill(); }
}, true);
// 一簇叶子 / 一簇花：kind = leaf（夏）、fall（秋）、blos（花）；shade 0 = 背光的后层，1 = 受光的前层
const puff = (kind, shade, v) => M.cached(`puff_${kind}_${shade}_${v}`, 96, 96, (g) => {
  const sd = v * 31 + shade * 7 + kind.length;
  if (kind === 'blos') {
    for (let i = 0; i < 7; i++) { const bx = 48 + (hash(sd, i + 200) - .5) * 44, by = 48 + (hash(sd, i + 210) - .5) * 40, br = 14 + 12 * hash(sd, i + 220), gr = g.createRadialGradient(bx, by - br * 0.3, 0, bx, by, br); gr.addColorStop(0, shade ? '#ffdcea' : '#eeb6dc'); gr.addColorStop(0.6, shade ? 'rgba(255,176,208,.85)' : 'rgba(206,138,198,.85)'); gr.addColorStop(1, 'rgba(255,170,205,0)'); g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
    for (let i = 0; i < 26; i++) { const fx = 48 + (hash(sd, i) - .5) * 62, fy = 48 + (hash(sd, i + 30) - .5) * 58, r = 3.2 + 2.6 * hash(sd, i + 60), rot = hash(sd, i + 90) * TAU; if (Math.hypot(fx - 48, fy - 48) > 34) continue;
      g.fillStyle = shade ? ['#fff3f8', '#ffd9e8', '#ffc4da'][i % 3] : ['#f0c8ea', '#e2b4e2', '#d39ed6'][i % 3]; for (let q = 0; q < 5; q++) { const a = rot + q * TAU / 5; g.beginPath(); g.ellipse(fx + Math.cos(a) * r * 0.62, fy + Math.sin(a) * r * 0.62, r * 0.62, r * 0.42, a, 0, TAU); g.fill(); }
      g.fillStyle = shade ? '#f0709a' : '#b866a8'; g.beginPath(); g.arc(fx, fy, r * 0.2, 0, TAU); g.fill(); }
  } else {
    const cs = kind === 'leaf' ? ['#1f6a3a', '#3f9a4a', '#8fd05a', '#d8f08a'] : ['#8a2a1a', '#d2521e', '#f08a24', '#ffd45a'];
    for (let i = 0; i < 26; i++) { const lx = 48 + (hash(sd, i) - .5) * 60, ly = 48 + (hash(sd, i + 40) - .5) * 60, r = 7 + 6 * hash(sd, i + 80), a = hash(sd, i + 120) * TAU, k = clamp((1 - ly / 96) * 1.1 + (hash(sd, i + 160) - .5) * 0.5);
      g.fillStyle = mix(cs[shade ? 1 : 0], cs[shade ? 3 : 2], k * (shade ? 1 : 0.55)); g.beginPath(); g.ellipse(lx, ly, r, r * 0.46, a, 0, TAU); g.fill(); }
  }
}, true);
const petalSpr = (v) => M.cached('petal' + v, 32, 32, (g) => { const gr = g.createLinearGradient(6, 6, 26, 26); gr.addColorStop(0, '#fff6fa'); gr.addColorStop(1, ['#ffb7d0', '#ffc9dc', '#ff9fc0', '#ffe3ee'][v]); g.fillStyle = gr; g.beginPath(); g.moveTo(16, 3); g.bezierCurveTo(30, 8, 28, 26, 16, 29); g.bezierCurveTo(13, 27, 13, 27, 16, 25); g.bezierCurveTo(2, 26, 2, 8, 16, 3); g.fill(); }, true);
const leafSpr = (v) => M.cached('leaf' + v, 32, 32, (g) => { g.fillStyle = ['#e8641e', '#f4a428', '#c8381a', '#ffcf4a'][v]; g.beginPath(); g.moveTo(3, 16); g.quadraticCurveTo(14, 2, 29, 16); g.quadraticCurveTo(14, 30, 3, 16); g.fill(); g.strokeStyle = 'rgba(120,40,10,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(3, 16); g.lineTo(29, 16); g.stroke(); }, true);
// 一片会翻的花瓣 / 叶子：spin 翻面（压扁成一条再翻回来），rot 自转
WD.flake = (ctx, kind, v, x, y, r, rot, spin, a = 1) => { const fl = Math.cos(spin); ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.25 + 0.75 * Math.abs(fl)); ctx.drawImage(kind === 'leaf' ? leafSpr(v % 4) : petalSpr(v % 4), -r, -r, 2 * r, 2 * r); ctx.restore(); };

// ---------------- 地：草地、土路、路边的电线杆 ----------------
WD.ground = (ctx, cam, md, road = true) => {
  md = MD(md); const hy = cam.hy, g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, col(md, 'ground', 0)); g.addColorStop(0.22, col(md, 'ground', 1)); g.addColorStop(1, col(md, 'ground', 2));
  ctx.fillStyle = g; ctx.fillRect(0, hy - 1, W, H - hy + 1);
  if (!road) return;
  // 土路：两道车辙，中间一条草
  const strip = (x0, x1, c0) => { ctx.beginPath(); const ds = []; for (let d = 0.6; d < 900; d *= 1.18) ds.push(d); for (const d of ds) { const p = proj(cam, x0, 0, cam.z + d); ctx.lineTo(p[0], p[1]); } for (const d of ds.reverse()) { const p = proj(cam, x1, 0, cam.z + d); ctx.lineTo(p[0], p[1]); } ctx.closePath(); ctx.fillStyle = c0; ctx.fill(); };
  const rg = ctx.createLinearGradient(0, hy, 0, H); rg.addColorStop(0, col(md, 'road', 0)); rg.addColorStop(1, col(md, 'road', 1)); strip(-1.75, 1.75, rg);
  const dk = rgba(mix(col(md, 'road', 1), '#201828', 0.5), 0.22); strip(-1.15, -0.55, dk); strip(0.55, 1.15, dk);
  const mg = ctx.createLinearGradient(0, hy, 0, H); mg.addColorStop(0, rgba(col(md, 'ground', 1), 0.75)); mg.addColorStop(1, rgba(col(md, 'ground', 2), 0.75)); strip(-0.28, 0.28, mg);
};
// 草丛：世界格子里撒，镜头往前走它们不跳。z0–z1 是离镜头多远的那一段（分段画，人站在中间）
WD.grass = (ctx, cam, md, t, d0, d1, wind = 0.3) => {
  if (WD.NOGRASS) return;
  md = MD(md); const A = MOODS[md.a], B = MOODS[md.b];
  const band = (cell, da, db, big) => {
    const i1 = Math.floor((cam.z + Math.min(db, d1)) / cell), i0 = Math.ceil((cam.z + Math.max(da, d0)) / cell);
    for (let iz = i1; iz >= i0; iz--) { const zz = iz * cell, d = zz - cam.z, half = 960 * d / cam.f + cell * 2, j0 = Math.floor((cam.x - half) / cell), j1 = Math.ceil((cam.x + half) / cell);
      for (let ix = j0; ix <= j1; ix++) { const x = (ix + hash(ix, iz) - 0.5) * cell, z = zz + (hash(ix, iz + 7777) - 0.5) * cell; if (WD.ROAD !== false && Math.abs(x) < 1.95 && (Math.abs(x) > 0.3 || hash(ix, iz + 55) < 0.5)) continue;   // 路上不长草（scene.js 换景时关掉）
        const [sx, sy, s] = proj(cam, x, 0, z); if (z - cam.z < 0.4) continue; const v = Math.floor(hash(ix + 31, iz) * 6), sz = (0.55 + 0.5 * hash(ix, iz + 99)) * big, w = sz * 1.05 * s, h = sz * 0.79 * s;
        const sway = wind * (0.16 * Math.sin(t * 1.9 + x * 0.7 + z * 0.45) + 0.1 * Math.sin(t * 3.1 + x * 1.3)) * h, fade = clamp((d - da) / (cell * 2)) * clamp((db - d) / (cell * 3));
        const one = (name, a, k) => { if (a <= 0.01) return; if (MOODS[name].snow && hash(ix + 5, iz + 9) < 0.55) return; ctx.globalAlpha = a * fade; M.resetTransform(ctx); ctx.transform(1, 0, -sway / h, 1, sx, sy); ctx.drawImage(clump(name, v), -w / 2, -h * k * 0.97, w, h * k); };
        one(md.a, 1 - md.k, 1); if (md.k > 0) one(md.b, md.k, 0.45 + 0.55 * md.k);
      } }
  };
  ctx.save(); band(0.55, 0.5, 24, 1); band(1.9, 21, 150, 2.8); ctx.restore(); ctx.globalAlpha = 1;
};
WD.poles = (ctx, cam, md, d0 = 2, d1 = 400) => {
  md = MD(md); const gap = 28, px = -4.6, c0 = col(md, 'bark', 0), hz = col(md, 'haze'), snow = lerp(MOODS[md.a].snow || 0, MOODS[md.b].snow || 0, md.k);
  const top = (k) => proj(cam, px, 7.2, k * gap + 9);
  for (let k = Math.floor((cam.z + d1) / gap); k * gap + 9 > cam.z + d0; k--) { const z = k * gap + 9, d = z - cam.z, [sx, sy, s] = proj(cam, px, 0, z), fc = mix(c0, hz, clamp(d / 260) * 0.8), w = Math.max(1, 0.2 * s);
    ctx.fillStyle = fc; ctx.fillRect(sx - w / 2, sy - 7.6 * s, w, 7.6 * s); ctx.fillRect(sx - 0.9 * s, sy - 7.2 * s, 1.8 * s, Math.max(1, 0.12 * s)); ctx.fillRect(sx - 0.6 * s, sy - 6.6 * s, 1.2 * s, Math.max(1, 0.1 * s));
    if (snow > 0.1) { ctx.fillStyle = rgba('#f2f6ff', snow); ctx.fillRect(sx - 0.9 * s, sy - 7.2 * s - 0.07 * s, 1.8 * s, Math.max(1, 0.08 * s)); ctx.fillRect(sx - w * 0.6, sy - 7.66 * s, w * 1.2, Math.max(1, 0.08 * s)); }
    { const [ax, ay, as] = top(k), [bx, by, bs] = proj(cam, px, 7.2, Math.max(cam.z + 0.3, z - gap)); ctx.strokeStyle = rgba(fc, 0.8); ctx.lineWidth = Math.max(0.7, 0.03 * s);
      for (const off of [-0.85, 0.85]) { ctx.beginPath(); ctx.moveTo(ax + off * as, ay); ctx.quadraticCurveTo((ax + off * as + bx + off * bs) / 2, (ay + by) / 2 + 0.9 * (as + bs) / 2, bx + off * bs, by); ctx.stroke(); } }
  }
};
// 脚下、树下的一团影子
WD.shadow = (ctx, cam, x, z, rx, a = 0.3, c0 = '#101030') => { const [sx, sy, s] = proj(cam, x, 0, z), g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, rgba(c0, a)); g.addColorStop(1, rgba(c0, 0)); ctx.save(); ctx.translate(sx, sy); ctx.scale(rx * s, rx * s * 0.2); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore(); };

// ---------------- 那棵树 ----------------
// 递归长枝；枝画进缓存（树皮 + 受光面一层、积雪一层），叶、芽、花是挂在枝上的点，每帧按时间画
let TREE = null; const TW = 1900, TH = 1300, TRX = 950, TRY = 1270, TPM = 100;   // 缓存图：100 像素 = 1 米，树根在 (950, 1270)
function growTree() {
  let n = 0; const rnd = () => hash(7919, n++), segs = [], pts = [];
  const add = (x, y, z, dist) => pts.push({ x: x + (rnd() - .5) * 0.9, y: Math.max(1.6, y + (rnd() - .5) * 0.9), z: z + (rnd() - .5) * 1.4, dist, r: rnd(), r2: rnd(), v: Math.floor(rnd() * 4) });
  const grow = (x, y, z, a, len, w, d, dist) => {
    const k = d < 2 ? 4 : 3, x00 = x, y00 = y, d00 = dist;
    for (let i = 0; i < k; i++) {
      a += (rnd() - 0.5) * (d === 0 ? 0.12 : 0.32); if (d >= 1 && d <= 3) a *= 0.95; if (d >= 5) a += Math.sign(a || 1) * 0.07; a = clamp(a, -1.5, 1.5);   // 大枝往上长，细枝往外垂一点
      const l = len / k, x1 = x + Math.sin(a) * l, y1 = y + Math.cos(a) * l, w1 = w * 0.9;
      segs.push({ x0: x, y0: y, x1, y1, w0: w, w1, z, d, a }); x = x1; y = y1; w = w1; dist += l;
    }
    for (let j = 0, m = [0, 0, 0, 2, 3, 3, 2][d]; j < m; j++) { const u = (j + rnd()) / m; add(lerp(x00, x, u), lerp(y00, y, u), z, lerp(d00, dist, u)); }
    if (d >= 6) { add(x, y, z, dist); return; }
    const nb = d === 0 ? 5 : d < 3 ? 3 : rnd() < 0.4 ? 3 : 2;
    for (let i = 0; i < nb; i++) { const u = i / (nb - 1) - 0.5; grow(x, y, z + (rnd() - .5) * 1.4, a + u * (d === 0 ? 2.0 : 1.1) + (rnd() - .5) * 0.3, len * (0.7 + rnd() * 0.12), w * (d === 0 ? 0.55 : nb === 2 ? 0.72 : 0.6), d + 1, dist); }
  };
  grow(0, 0, 0, 0.04, 2.3, 0.78, 0, 0);
  const maxDist = Math.max(...pts.map(p => p.dist)); for (const p of pts) p.u = p.dist / maxDist;
  pts.sort((p, q) => p.z - q.z);
  return { segs, pts };
}
const treeSpr = (name) => M.cached('tree_' + name, TW, TH, (g) => {
  const m = MOODS[name]; g.lineCap = 'round';
  const pass = (c0, kw, ox, oy) => { g.strokeStyle = c0; for (const s of TREE.segs) { const w = (s.w0 + s.w1) / 2 * TPM; g.lineWidth = Math.max(0.8, w * kw); g.beginPath(); g.moveTo(TRX + s.x0 * TPM + ox * w, TRY - s.y0 * TPM + oy * w); g.lineTo(TRX + s.x1 * TPM + ox * w, TRY - s.y1 * TPM + oy * w); g.stroke(); } };
  pass(m.bark[0], 1, 0, 0); pass(mix(m.bark[0], m.bark[1], 0.55), 0.55, m.key[0] * 0.2, -0.06); pass(m.bark[1], 0.2, m.key[0] * 0.36, -0.1);
  // 树干上的树皮纹、根
  g.strokeStyle = rgba(m.bark[0], 0.7); g.lineWidth = 1.6; for (let i = 0; i < 16; i++) { const x = TRX + (hash(i, 501) - .5) * 52, y = TRY - 20 - hash(i, 502) * 200; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y - 20, x + (hash(i, 503) - .5) * 8, y - 36 - 20 * hash(i, 504)); g.stroke(); }
  g.fillStyle = m.bark[0]; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(TRX + sx * 26, TRY - 30); g.quadraticCurveTo(TRX + sx * 46, TRY - 6, TRX + sx * 84, TRY + 4); g.lineTo(TRX + sx * 10, TRY + 4); g.closePath(); g.fill(); }
}, true);
const treeSnow = () => M.cached('treeSnow', TW, TH, (g) => {
  g.lineCap = 'round';
  for (const [c0, up, kw] of [['#8ea2dc', 0.18, 0.62], ['#dfe8ff', 0.3, 0.5]]) { g.strokeStyle = c0; for (const s of TREE.segs) { if (Math.abs(Math.sin(s.a)) < 0.3) continue; const w = (s.w0 + s.w1) / 2 * TPM, lw = Math.max(1.6, w * kw + 1.5); g.lineWidth = lw; g.beginPath(); g.moveTo(TRX + s.x0 * TPM, TRY - s.y0 * TPM - w * up - 1); g.lineTo(TRX + s.x1 * TPM, TRY - s.y1 * TPM - w * up - 1); g.stroke(); } }
}, true);
// st = { x, z, snow 0..1, back(pt)/front 由 fol 决定 }；fol = [{ kind, f(pt) → 大小 0..1.3（0 不画） }]
WD.tree = (ctx, cam, t, md, st) => {
  md = MD(md); const [sx, sy, s] = proj(cam, st.x ?? WD.TREE_X, 0, st.z ?? 0), k = s / TPM, wind = st.wind ?? 0.3;
  const fol = (front) => { for (const F of st.fol || []) for (const p of TREE.pts) { if ((p.z > 0.6) !== front) continue; const f = F.f(p); if (f <= 0.02) continue;
    const fx = sx + (p.x + wind * 0.05 * Math.sin(t * 1.6 + p.r * 40)) * s * (1 + p.z * 0.012), fy = sy - (p.y + wind * 0.03 * Math.sin(t * 2.3 + p.r2 * 40)) * s;
    if (F.kind === 'bud') { const r = (0.035 + 0.04 * p.r2) * s * f; ctx.fillStyle = front ? '#d6f58a' : '#8fcf6a'; ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill(); continue; }
    const sz = (0.85 + 0.85 * p.r2) * s * f * (F.size || 1); ctx.drawImage(puff(F.kind, front ? 1 : 0, p.v), fx - sz / 2, fy - sz / 2, sz, sz); } };
  fol(false);
  ctx.drawImage(treeSpr(md.a), sx - TRX * k, sy - TRY * k, TW * k, TH * k);
  if (md.k > 0) { ctx.globalAlpha = md.k; ctx.drawImage(treeSpr(md.b), sx - TRX * k, sy - TRY * k, TW * k, TH * k); ctx.globalAlpha = 1; }
  if (st.snow > 0.01) { ctx.globalAlpha = st.snow; ctx.drawImage(treeSnow(), sx - TRX * k, sy - TRY * k, TW * k, TH * k); ctx.globalAlpha = 1; }
  fol(true);
  return [sx, sy, s];
};
WD.treePts = () => TREE.pts;

// ---------------- 天气和光 ----------------
// 雪：三层远近，近的大而虚
WD.snowfall = (ctx, t, { n = 420, wind = 30, a = 1 } = {}) => {
  const spr = WD.dot('#ffffff');
  for (let i = 0; i < n; i++) { const L = i % 3, dep = [0.4, 0.75, 1.6][L] * (0.8 + 0.4 * hash(i, 5)), vy = 95 * dep + 30 * hash(i, 6), vx = wind * dep;
    const x = mod(hash(i, 1) * (W + 300) + vx * t + 26 * dep * Math.sin(t * (0.6 + hash(i, 7)) + i), W + 300) - 150, y = mod(hash(i, 2) * (H + 160) + vy * t, H + 160) - 80, r = (1.5 + 2.4 * hash(i, 3)) * dep * (L === 2 ? 2.2 : 1);
    ctx.globalAlpha = a * (L === 2 ? 0.42 : 0.9); ctx.drawImage(spr, x - r * 2, y - r * 2, r * 4, r * 4); }
  ctx.globalAlpha = 1;
};
// 光柱：从 (x, y) 往外散的一把光
let RAY = null;
WD.rays = (ctx, x, y, t, { n = 26, len = 1500, a = 0.5, c0 = '#fff0c0', a0 = 0, a1 = TAU } = {}) => {
  if (!RAY) { RAY = document.createElement('canvas'); RAY.width = Math.ceil(W * SC / 4); RAY.height = Math.ceil(H * SC / 4); }
  const r = RAY.getContext('2d'); r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.globalAlpha = 1; r.clearRect(0, 0, RAY.width, RAY.height); r.setTransform(SC / 4, 0, 0, SC / 4, 0, 0); r.globalCompositeOperation = 'lighter';
  const g = r.createRadialGradient(x, y, 0, x, y, len); g.addColorStop(0, rgba(c0, a)); g.addColorStop(0.45, rgba(c0, a * 0.35)); g.addColorStop(1, rgba(c0, 0)); r.fillStyle = g;
  for (let i = 0; i < n; i++) { const th = lerp(a0, a1, hash(i, 801)) + 0.05 * Math.sin(t * 0.35 + i * 2.1), hw = 0.015 + 0.06 * hash(i, 802) ** 2; r.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.3));
    r.beginPath(); r.moveTo(x, y); r.lineTo(x + Math.cos(th - hw) * len, y + Math.sin(th - hw) * len); r.lineTo(x + Math.cos(th + hw) * len, y + Math.sin(th + hw) * len); r.closePath(); r.fill(); }
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(7px)'; ctx.drawImage(RAY, 0, 0, W, H); ctx.restore();
};
// 镜头光晕：太阳上一团光、一条横向拉丝、沿着过画面中心那条线的几个光斑
WD.flare = (ctx, x, y, a, c0 = '#fff2d0') => {
  if (a <= 0.01) return; ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const [r, k] of [[520, 0.45], [200, 0.8], [70, 1]]) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c0, a * k)); g.addColorStop(1, rgba(c0, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (const [u, r, cc] of [[0.45, 34, '#ffb0a0'], [0.8, 60, '#a0c8ff'], [1.3, 110, '#ffd8a0'], [1.7, 46, '#c0a0ff']]) { const gx = lerp(x, W / 2, u), gy = lerp(y, H / 2, u), g = ctx.createRadialGradient(gx, gy, r * 0.6, gx, gy, r); g.addColorStop(0, rgba(cc, a * 0.1)); g.addColorStop(0.8, rgba(cc, a * 0.16)); g.addColorStop(1, rgba(cc, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
};
// 把人、物先画到一张单独的层上，再统一罩环境色（正片叠底）、加轮廓光，贴回画面
WD.lit = (ctx, key, md, draw, { rim = 1, rimW = 3, amb = 1, at = null } = {}) => {
  md = MD(md); const L = M.layer('lit_' + key), T = M.layer('litm_' + key), l = L.getContext('2d'), tt = T.getContext('2d'), kx = lerp(MOODS[md.a].key[0], MOODS[md.b].key[0], md.k), ky = lerp(MOODS[md.a].key[1], MOODS[md.b].key[1], md.k);
  const clr = (x) => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.filter = 'none'; x.clearRect(0, 0, L.width, L.height); };
  clr(l); l.setTransform(SC, 0, 0, SC, 0, 0); l.save(); draw(l); l.restore();
  clr(tt); tt.drawImage(L, 0, 0);
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'multiply'; l.fillStyle = typeof amb === 'string' ? amb : mix('#ffffff', col(md, 'amb'), amb); l.fillRect(0, 0, L.width, L.height);
  l.globalCompositeOperation = 'destination-in'; l.drawImage(T, 0, 0);
  if (at) { const [gx, gy, gr] = at, g = l.createLinearGradient((gx + kx * gr) * SC, (gy + ky * gr) * SC, (gx - kx * gr) * SC, (gy - ky * gr) * SC); g.addColorStop(0, rgba(col(md, 'rim'), 0.3)); g.addColorStop(0.45, rgba(col(md, 'rim'), 0)); g.addColorStop(0.55, 'rgba(16,20,70,0)'); g.addColorStop(1, 'rgba(16,20,70,.3)'); l.globalCompositeOperation = 'source-atop'; l.fillStyle = g; l.fillRect(0, 0, L.width, L.height); }
  if (rim > 0) { tt.globalCompositeOperation = 'source-in'; tt.fillStyle = col(md, 'rim'); tt.fillRect(0, 0, T.width, T.height); tt.globalCompositeOperation = 'destination-out'; tt.drawImage(L, -kx * rimW * SC, -ky * rimW * SC);
    l.globalCompositeOperation = 'source-atop'; l.globalAlpha = rim; l.drawImage(T, 0, 0); l.globalAlpha = 1; }
  ctx.drawImage(L, 0, 0, W, H);
};
// 泛光 + 暗角里的一点冷暖：整张画面最后过一遍
let BL = null;
WD.post = (ctx, { bloom = 0.5, warm = null } = {}) => {
  if (!BL) { BL = document.createElement('canvas'); BL.width = Math.ceil(W * SC / 4); BL.height = Math.ceil(H * SC / 4); }
  const b = BL.getContext('2d'); b.globalCompositeOperation = 'copy'; b.drawImage(ctx.canvas, 0, 0, BL.width, BL.height); b.globalCompositeOperation = 'multiply'; b.drawImage(BL, 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = bloom; ctx.filter = 'blur(10px)'; ctx.drawImage(BL, 0, 0, W, H); ctx.globalAlpha = bloom * 0.7; ctx.filter = 'blur(34px)'; ctx.drawImage(BL, 0, 0, W, H); ctx.restore();
  if (warm) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, warm[0]); g.addColorStop(1, warm[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
};
// 一根挂着的链子（围巾尾、发梢）：verlet，从 t0 一步步算到 t
WD.chain = (key, t0, t, n, seg, anchor, force) => M.sim(key, t0, t, () => { const [ax, ay] = anchor(t0), p = []; for (let i = 0; i < n; i++) p.push([ax, ay + i * seg, ax, ay + i * seg]); return { p }; }, (st, tt, dt) => {
  const p = st.p, [ax, ay] = anchor(tt);
  for (let i = 1; i < n; i++) { const [fx, fy] = force(tt, i), q = p[i], vx = (q[0] - q[2]) * 0.985, vy = (q[1] - q[3]) * 0.985; q[2] = q[0]; q[3] = q[1]; q[0] += vx + fx * dt * dt; q[1] += vy + fy * dt * dt; }
  p[0][0] = ax; p[0][1] = ay;
  for (let k = 0; k < 4; k++) for (let i = 1; i < n; i++) { const a = p[i - 1], b = p[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-6, e = (d - seg) / d; if (i === 1) { b[0] -= dx * e; b[1] -= dy * e; } else { a[0] += dx * e * 0.5; a[1] += dy * e * 0.5; b[0] -= dx * e * 0.5; b[1] -= dy * e * 0.5; } }
}).p;

WD.init = (m) => { M = m; hash = m.hash; SC = m.SC; TREE = growTree(); };
})();
