// people.js —— 两个主角，古风，照 照片/aaa.jpg 画。
// 她：中分、双髻扎红花和飘带、风里的长发、额间花钿、耳坠；红襦白领、白到红的长裙。他：束发、鬓边两缕；长袍（夏天月白、秋天靛蓝）。
// 只管画人：姿势、表情、衣服由参数给；环境色和轮廓光由调用方（WORLD.lit）统一罩。
// 画法：不描边。脸和衣服的明暗是一团团软的颜色，头发是一绺绺根宽梢尖的发片上再拉细丝。
// 单位：1 = 半个头宽（头整体再缩到 HS，人才修长）。原点在脸中心，y 向下：肩 1.6，腰 4.3，脚底 12.8。
(() => {
const TAU = Math.PI * 2, lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const P = (window.PEOPLE = {}); let hash;
P.init = (M) => { hash = M.hash; };
const HS = 0.88, CORAL = '#ff7a68', RED = '#d8323a', SCF = '#fff6ef', SCF_D = '#d9b4aa';
const PAL = {   // 皮肤：亮面 skinHi、底色 skin、背光 skinSh、最深的缝 skinDp；头发：底 hair、丝 hairHi、受光那半边 hairWarm、最亮的丝 hairGl、暗的丝 hairLn
  her: { skin: '#fdeae4', skinHi: '#fffaf7', skinSh: '#f0b4b0', skinDp: '#c97f86', line: '#b27a76', hair: '#191b2c', hairHi: '#4f4a66', hairWarm: '#a47a68', hairGl: '#f6d2ba', hairLn: '#0d0e1a', iris: ['#231823', '#75596c', '#c8a4b2'], glow: '#ffa0b0', lash: '#1a1016', brow: '#6a4a48', blush: '#ff7078', shadow: '#e2434e', lipU: '#d5505e', lipL: '#f08088', lipLn: '#8a2c3c' },
  him: { skin: '#f7dfd0', skinHi: '#fff3ea', skinSh: '#dcaa98', skinDp: '#b0766c', line: '#a5746a', hair: '#14151f', hairHi: '#454c68', hairWarm: '#6f6a78', hairGl: '#aab6d8', hairLn: '#090a10', iris: ['#0e0c10', '#33262a', '#6a5050'], glow: '#c8aaa0', lash: '#15131a', brow: '#221f28', blush: '#ff8278', shadow: '#cf9488', lipU: '#b9706c', lipL: '#d39088', lipLn: '#7c4444' },
};
// 衣服：robe 袍子底色 / hi 亮面 / sh 暗面，band 领缘和袖缘，inner 里衣，sash 腰封，sk0 → sk1 下摆从腰到脚的颜色，shoe 鞋
const HER = { robe: '#d63a32', hi: '#ff7a62', sh: '#8e1b2b', band: '#fcf6f1', inner: '#1c2858', sash: '#1c2858', sk0: '#fdf1ec', sk1: '#d63a32', shoe: '#a8242c' };
const HIM = { robe: '#34407a', hi: '#6072b8', sh: '#171e48', band: '#f3f5fc', inner: '#c9d3f0', sash: '#141a40', sk0: '#34407a', sk1: '#1c2452', shoe: '#12142a' };
const FIT = {   // 按季节：她秋天加白围巾，冬天再披一件白斗篷；他夏天月白袍、秋冬靛蓝袍
  her: { summer: HER, autumn: { ...HER, scarf: 1 }, winter: { ...HER, scarf: 1, cloak: 1 } },
  him: { summer: { robe: '#edf0fa', hi: '#ffffff', sh: '#aab6dc', band: '#34407a', inner: '#b9c6ea', sash: '#34407a', sk0: '#edf0fa', sk1: '#c3cdea', shoe: '#1a1d33' }, autumn: HIM, winter: HIM },
};
const ink = (c, col, w) => { const a = c.globalAlpha; c.strokeStyle = col; c.lineWidth = w; c.lineJoin = c.lineCap = 'round'; c.globalAlpha = a * 0.5; c.stroke(); c.globalAlpha = a; };
// 一道软的线（衣褶、暗缝）：同一条路径由宽到窄描三遍
const soft = (c, col, w, a) => { const a0 = c.globalAlpha; c.strokeStyle = col; c.lineCap = c.lineJoin = 'round'; for (const [k, al] of [[2.6, 0.25], [1.5, 0.4], [0.7, 0.7]]) { c.lineWidth = w * k; c.globalAlpha = a0 * a * al; c.stroke(); } c.globalAlpha = a0; };
const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const bz = (p0, p1, p2, p3, t) => { const s = 1 - t; return s * s * s * p0 + 3 * s * s * t * p1 + 3 * s * t * t * p2 + t * t * t * p3; };
// 一团软的颜色：椭圆，中间浓、往边上散开
const blob = (c, x, y, rx, ry, col, a) => { c.save(); c.translate(x, y); c.scale(rx, ry); const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.55)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore(); };

// ---------------- 脸 ----------------
// 五官的位置和大小：她照 aaa（眼大而长、眼尾上挑、眉细长、唇小而厚）；他同一个画法，眼细长、眉平而浓
// ey 眼高，ex 眼离中线，ew / eh 眼宽 / 眼高，by 眉，ny 鼻尖，ns 鼻子大小，my 嘴缝，mw 嘴宽，lu / ll 上 / 下唇厚
const FACE = {
  her: { ey: 0.16, ex: 0.4, ew: 0.48, eh: 0.21, by: -0.11, ny: 0.67, ns: 1, my: 0.89, mw: 0.37, lu: 0.065, ll: 0.1 },
  him: { ey: 0.13, ex: 0.39, ew: 0.44, eh: 0.15, by: -0.09, ny: 0.65, ns: 1.12, my: 0.88, mw: 0.4, lu: 0.045, ll: 0.07 },
};
// yaw 0..1：脸朝画面右转多少（朝左由调用方镜像）；pit：抬头为正；m：他（下颌宽一点）。鹅蛋脸，收到一个小而圆的下巴
const facePath = (c, yaw, pit, m) => { const jw = m ? 0.6 : 0.58, ch = (m ? 1.14 : 1.15) - 0.07 * pit, ck = m ? 0.84 : 0.8, cw = m ? 0.24 : 0.2, jy = 0.64 - 0.04 * pit, xl = -jw + 0.1 * yaw, xr = jw - 0.05 * yaw; c.beginPath(); c.moveTo(-ck - 0.04, -0.3);
  c.bezierCurveTo(-ck - 0.05, 0.15, xl - 0.05, jy - 0.21, xl, jy); c.bezierCurveTo(xl + 0.06, ch - 0.24, -cw + 0.18 * yaw, ch, 0.02 + 0.2 * yaw, ch);
  c.bezierCurveTo(cw + 0.04 + 0.12 * yaw, ch, xr - 0.06, ch - 0.24, xr, jy); c.bezierCurveTo(xr + 0.05 - 0.04 * yaw, jy - 0.21, ck + 0.05 - 0.17 * yaw, 0.15, ck + 0.04 - 0.17 * yaw, -0.3);
  c.bezierCurveTo(0.9, -1.05, -0.9, -1.05, -ck - 0.04, -0.3); c.closePath(); };
// 一只眼：side 是外眼角朝哪边；o = { open 0..1.2, gx, gy 看哪, happy 闭眼时往上弯, wet 含泪, smile 笑的时候下眼睑往上托 }
const eye = (c, pal, x, y, w, h, side, o, her, lx) => {
  const op = clamp(o.open ?? 1, 0, 1.2), xi = x - side * w / 2, xo = x + side * w / 2, lw = her ? 0.036 : 0.03; c.lineCap = 'round'; c.strokeStyle = pal.lash;
  if (op < 0.15) { const k = o.happy ? -1 : 1, y0 = y + 0.12 * h;   // 闭眼：一道弯，她带几根睫毛
    c.beginPath(); c.moveTo(xi, y0); c.quadraticCurveTo(x, y0 + k * h * 0.9, xo, y0 - 0.04 * h); c.lineWidth = lw; c.stroke();
    if (her) for (let i = 0; i < 5; i++) { const u = 0.42 + i * 0.13, ex = lerp(xi, xo, u), eyy = y0 + k * h * 0.45 * (1 - (2 * u - 1) ** 2); c.beginPath(); c.moveTo(ex, eyy); c.lineTo(ex + side * 0.04, eyy + k * 0.055 + 0.012); c.lineWidth = 0.012; c.stroke(); } return; }
  const sq = 0.18 * clamp(o.smile ?? 0.4), hh = h * (0.3 + 0.7 * op), top = y - hh * 0.6, bot = y + hh * (0.4 - sq), yi = y + 0.14 * h, yo = y - 0.2 * h;
  const U = [xi, yi, xi + side * w * 0.18, top - hh * 0.02, xo - side * w * 0.4, top - hh * 0.2, xo, yo], lower = () => c.bezierCurveTo(xo - side * w * 0.2, bot + hh * 0.12, xi + side * w * 0.45, bot + hh * 0.1, xi, yi);
  c.save(); c.beginPath(); c.moveTo(xi, yi); c.bezierCurveTo(U[2], U[3], U[4], U[5], xo, yo); lower(); c.closePath(); c.fillStyle = '#f1dfdc'; c.fill(); c.clip(); blob(c, x, y + hh * 0.05, w * 0.42, hh * 0.7, '#ffffff', 1);
  const r = h * (her ? 0.7 : 0.72), ix = x + (o.gx || 0) * w * 0.12, iy = y - hh * 0.08 + (o.gy || 0) * h * 0.2;
  let g = c.createRadialGradient(ix, iy + r * 0.3, r * 0.1, ix, iy, r); g.addColorStop(0, pal.iris[2]); g.addColorStop(0.55, pal.iris[1]); g.addColorStop(0.88, pal.iris[0]); g.addColorStop(1, pal.iris[0]); c.fillStyle = g; c.beginPath(); c.arc(ix, iy, r, 0, TAU); c.fill();
  c.strokeStyle = rgba(pal.iris[2], 0.4); c.lineWidth = r * 0.035; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + hash(i, 61), r1 = r * (0.74 + 0.16 * hash(i, 62)); c.beginPath(); c.moveTo(ix + Math.cos(a) * r * 0.42, iy + Math.sin(a) * r * 0.42); c.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); c.stroke(); }   // 虹膜的纹
  c.fillStyle = '#080506'; c.beginPath(); c.arc(ix, iy, r * 0.4, 0, TAU); c.fill(); blob(c, ix, iy + r * 0.66, r * 0.8, r * 0.5, pal.glow, 0.6);
  g = c.createLinearGradient(0, top - hh * 0.1, 0, top + hh * 0.62); g.addColorStop(0, 'rgba(40,18,30,.78)'); g.addColorStop(1, 'rgba(40,18,30,0)'); c.fillStyle = g; c.fillRect(x - w, top - hh * 0.3, 2 * w, hh);   // 上眼睑投在眼球上的影
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ix + lx * r * 0.36, iy - r * 0.32, r * 0.25, r * 0.19, -0.4 * lx, 0, TAU); c.fill(); c.globalAlpha *= 0.85; c.beginPath(); c.arc(ix - lx * r * 0.4, iy + r * 0.4, r * 0.1, 0, TAU); c.fill(); c.globalAlpha /= 0.85;
  if (o.wet) { blob(c, x, bot - hh * 0.02, w * 0.4, hh * 0.16, '#ffffff', 0.95 * o.wet); c.globalAlpha *= o.wet; c.beginPath(); c.arc(ix + lx * r * 0.05, iy + r * 0.55, r * 0.14, 0, TAU); c.fill(); }
  c.restore();
  // 上睫毛线：往外眼角变粗的一条，尾巴挑出去
  c.beginPath(); c.moveTo(xi, yi); c.bezierCurveTo(U[2], U[3], U[4], U[5], xo, yo); c.lineTo(xo + side * w * (her ? 0.13 : 0.04), yo - (her ? 0.2 : 0.04) * h); c.bezierCurveTo(U[4], U[5] - lw * 1.5, U[2], U[3] - lw, xi - side * w * 0.03, yi - 0.008); c.closePath(); c.fillStyle = pal.lash; c.fill();
  if (her) { c.strokeStyle = pal.lash; c.lineWidth = 0.01; for (let i = 0; i < 5; i++) { const tt = 0.6 + i * 0.1, px = bz(U[0], U[2], U[4], U[6], tt), py = bz(U[1], U[3], U[5], U[7], tt) - lw * 0.7, l = 0.03 + 0.04 * tt; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + side * l * 0.5, py - l * 0.5, px + side * l * (0.5 + 0.8 * tt), py - l * (0.9 - 0.6 * tt)); c.stroke(); }   // 一根根睫毛，越往外眼角越长越斜
    c.beginPath(); c.moveTo(xi + side * w * 0.12, top + hh * 0.16 - 0.04); c.quadraticCurveTo(x, top - hh * 0.2 - 0.045, xo - side * w * 0.02, yo - 0.05); c.strokeStyle = rgba('#8e4a52', 0.55); c.lineWidth = 0.012; c.stroke(); }   // 双眼皮
  c.beginPath(); c.moveTo(xo, yo); lower(); c.strokeStyle = her ? 'rgba(138,58,64,.5)' : rgba(pal.lash, 0.35); c.lineWidth = 0.012; c.stroke();
  if (her) for (let i = 0; i < 3; i++) { const px = xo - side * w * (0.08 + 0.09 * i), py = lerp(yo, bot + hh * 0.07, Math.min(1, 0.45 + 0.3 * i)); c.beginPath(); c.moveTo(px, py); c.lineTo(px + side * 0.018, py + 0.03); c.strokeStyle = rgba(pal.lash, 0.5); c.lineWidth = 0.008; c.stroke(); }
};
// 嘴：上唇薄而有唇峰，下唇厚一点、中间一块高光；sm 嘴角翘多少（负的往下撇），mo 张多大（露一点牙）
const mouth = (c, pal, F, mx, my, kx, o, her, lx) => { const sm = o.smile ?? 0.4, mo = o.mouth || 0, w = F.mw * (1 + 0.16 * sm), hu = F.lu, hl = F.ll, cy = -0.05 * sm, dip = 0.012 + 0.03 * sm, op = mo > 0.05 ? 0.03 + 0.13 * mo : 0;
  c.save(); c.translate(mx, my); c.scale(kx, 1);
  if (op) { c.beginPath(); c.moveTo(-w / 2, cy); c.bezierCurveTo(-w * 0.2, dip, w * 0.2, dip, w / 2, cy); c.bezierCurveTo(w * 0.22, dip + op * 1.3, -w * 0.22, dip + op * 1.3, -w / 2, cy); c.closePath(); c.fillStyle = '#5e1f2c'; c.fill();
    c.save(); c.clip(); c.fillStyle = '#fff6f2'; c.fillRect(-w / 2, dip - 0.04, w, 0.04 + op * 0.36); blob(c, 0, dip + op * 1.05, w * 0.3, op * 0.5, '#e8787c', 0.9); c.restore(); }
  c.beginPath(); c.moveTo(-w / 2, cy); c.quadraticCurveTo(-w * 0.3, cy * 0.4 - hu * 0.8, -w * 0.11, -hu); c.quadraticCurveTo(-w * 0.04, -hu * 1.02, 0, -hu * 0.74); c.quadraticCurveTo(w * 0.04, -hu * 1.02, w * 0.11, -hu); c.quadraticCurveTo(w * 0.3, cy * 0.4 - hu * 0.8, w / 2, cy); c.bezierCurveTo(w * 0.2, dip, -w * 0.2, dip, -w / 2, cy); c.closePath(); c.fillStyle = pal.lipU; c.fill();
  c.beginPath(); c.moveTo(-w / 2, cy); c.bezierCurveTo(-w * 0.2, dip + op, w * 0.2, dip + op, w / 2, cy); c.bezierCurveTo(w * 0.3, dip + op + hl * 1.25, -w * 0.3, dip + op + hl * 1.25, -w / 2, cy); c.closePath();
  const g = c.createLinearGradient(0, dip + op, 0, dip + op + hl); g.addColorStop(0, pal.lipU); g.addColorStop(0.45, pal.lipL); g.addColorStop(1, pal.lipU); c.fillStyle = g; c.fill();
  blob(c, lx * w * 0.08, dip + op + hl * 0.45, w * 0.2, hl * 0.3, '#ffffff', her ? 0.6 : 0.3);
  c.beginPath(); c.moveTo(-w / 2 - 0.014, cy - 0.007 * (1 + sm)); c.lineTo(-w / 2, cy); c.bezierCurveTo(-w * 0.2, dip, w * 0.2, dip, w / 2, cy); c.lineTo(w / 2 + 0.014, cy - 0.007 * (1 + sm)); c.strokeStyle = rgba(pal.lipLn, 0.65); c.lineWidth = 0.014; c.lineCap = c.lineJoin = 'round'; c.stroke();
  for (const sx of [-1, 1]) blob(c, sx * (w / 2 + 0.01), cy, 0.035, 0.03, pal.skinDp, 0.5);   // 嘴角的小窝
  c.restore(); };
const features = (c, who, o, yaw, pit, lx) => {
  const her = who === 'her', pal = PAL[who], F = FACE[who], cx = 0.2 * yaw, ey = F.ey - 0.1 * pit, h = F.eh, xn = cx - F.ex, xf = cx + F.ex * (1 - 0.14 * yaw), op = o.open ?? 1;
  eye(c, pal, xn, ey, F.ew, h, -1, { ...o, open: Array.isArray(op) ? op[0] : op }, her, lx); eye(c, pal, xf, ey, F.ew * (1 - 0.26 * yaw), h, 1, { ...o, open: Array.isArray(op) ? op[1] : op }, her, lx);
  // 鼻子：一侧暗、鼻梁和鼻尖亮、鼻底一小团影、两个鼻孔
  const s = F.ns, nx = cx + 0.02 + 0.1 * yaw, ny = F.ny - 0.1 * pit, bx = lerp(cx, nx, 0.6), bym = lerp(ey, ny, 0.5), bh = (ny - ey) * 0.55;
  blob(c, bx - lx * 0.08 * s, bym, 0.06 * s, bh * 1.1, pal.skinSh, 0.5); blob(c, bx + lx * 0.012, bym - 0.02, 0.032 * s, bh, '#ffffff', 0.7);
  blob(c, nx, ny + 0.07 * s, 0.15 * s, 0.05 * s, pal.skinDp, 0.42); blob(c, nx + lx * 0.01, ny - 0.035 * s, 0.065 * s, 0.055 * s, '#ffffff', 0.7);
  for (const sx of [-1, 1]) { const k = sx > 0 ? 1 - 0.5 * yaw : 1 + 0.15 * yaw; c.beginPath(); c.ellipse(nx + sx * 0.07 * s * k, ny + 0.048 * s, 0.032 * s * k, 0.014 * s, -sx * 0.35, 0, TAU); c.fillStyle = rgba(pal.skinDp, 0.6); c.fill();
    c.beginPath(); c.moveTo(nx + sx * 0.115 * s * k, ny - 0.03 * s); c.quadraticCurveTo(nx + sx * 0.15 * s * k, ny + 0.035 * s, nx + sx * 0.1 * s * k, ny + 0.062 * s); c.strokeStyle = rgba(pal.skinDp, 0.4); c.lineWidth = 0.012; c.stroke(); }
  if (yaw > 0.25) blob(c, bx + 0.085 * s, bym + 0.04, 0.05 * s, bh, pal.skinSh, 0.55 * yaw);   // 侧过去时鼻梁另一边也暗下去
  mouth(c, pal, F, cx * 0.95, F.my - 0.1 * pit, 1 - 0.12 * yaw, o, her, lx);
  // 眼泪：tear 0..1，先在眼眶里打转（wet），再沿脸颊滚下去
  if (o.tear > 0.3) { const u = (o.tear - 0.3) / 0.7, tx = xn - 0.1 - 0.03 * u, y0 = ey + h * 0.4, ty = lerp(y0, 0.9, u * u); c.beginPath(); c.moveTo(xn - 0.1, y0); c.quadraticCurveTo(tx - 0.02, (y0 + ty) / 2, tx, ty); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.026; c.stroke();
    c.beginPath(); c.moveTo(tx, ty - 0.1); c.bezierCurveTo(tx + 0.07, ty, tx + 0.05, ty + 0.07, tx, ty + 0.07); c.bezierCurveTo(tx - 0.05, ty + 0.07, tx - 0.07, ty, tx, ty - 0.1); c.fillStyle = 'rgba(214,236,255,.9)'; c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(tx - 0.015, ty + 0.01, 0.014, 0, TAU); c.fill(); }
};
const brows = (c, who, o, yaw, pit) => { const her = who === 'her', pal = PAL[who], F = FACE[who], cx = 0.2 * yaw, by = F.by - 0.12 * pit - 0.05 * (o.brow || 0), sad = o.sad || 0, w = F.ew * (her ? 1.2 : 1.12), th = her ? 0.036 : 0.07, a0 = c.globalAlpha;
  for (const [x, side, k] of [[cx - F.ex, -1, 1], [cx + F.ex * (1 - 0.14 * yaw), 1, 1 - 0.26 * yaw]]) { const xi = x - side * w * 0.5 * k, yi = by + 0.035 - sad * 0.1, xo = x + side * w * 0.56 * k, yo = by + (her ? 0.03 : -0.035) + sad * 0.06, xm = x + side * w * 0.12 * k, ym = by - (her ? 0.022 : 0.035) - sad * 0.02;
    const g = c.createLinearGradient(xi, 0, xo, 0); g.addColorStop(0, rgba(pal.brow, 0.2)); g.addColorStop(0.25, rgba(pal.brow, her ? 0.7 : 0.9)); g.addColorStop(0.8, rgba(pal.brow, her ? 0.65 : 0.85)); g.addColorStop(1, rgba(pal.brow, 0.25));
    for (const sc of [1.6, 1]) { c.beginPath(); c.moveTo(xi, yi - th * sc * 0.3); c.quadraticCurveTo(xm, ym - th * sc * 0.5, xo, yo); c.quadraticCurveTo(xm, ym + th * sc * 0.5, xi, yi + th * sc * 0.4); c.closePath(); c.globalAlpha = a0 * (sc > 1 ? 0.3 : 1); c.fillStyle = g; c.fill(); } } c.globalAlpha = a0; };

// ---------------- 头发 ----------------
// 一片头发：A、B 是它的两条边（各是一条贝塞尔 [x0,y0, x1,y1, x2,y2, x3,y3]，从发根到发梢）。band 是两条边围出来的形
const band = (c, A, B) => { c.beginPath(); c.moveTo(A[0], A[1]); c.bezierCurveTo(A[2], A[3], A[4], A[5], A[6], A[7]); c.lineTo(B[6], B[7]); c.bezierCurveTo(B[4], B[5], B[2], B[3], B[0], B[1]); c.closePath(); };
// lock 在两条边之间排 n 绺：每绺根宽梢尖、深浅不一、一绺压一绺。lit 受光多少（0..1，或者 u => 0..1，u 是这一绺在两条边之间的位置），ragged 发梢长短差多少，ring 离发根多远有一圈高光
const lock = (c, pal, A, B, n, sd, { lit = 0.5, ragged = 0.12, over = 1.7, ring = 0 } = {}) => { const at = (u, k) => lerp(A[k], B[k], u);
  for (let i = 0; i < n; i++) { const u0 = Math.max(0, (i - 0.3) / n), u1 = Math.min(1, (i + over) / n), um = (u0 + u1) / 2, h = hash(i, sd), sh = 1 - ragged * hash(i, sd + 1), L = typeof lit === 'function' ? lit(um) : lit, v = h * 0.6 + L * 0.4;
    const tx = bz(at(um, 0), at(um, 2), at(um, 4), at(um, 6), sh), ty = bz(at(um, 1), at(um, 3), at(um, 5), at(um, 7), sh);
    c.beginPath(); c.moveTo(at(u0, 0), at(u0, 1)); c.bezierCurveTo(at(u0, 2), at(u0, 3), lerp(at(u0, 4), tx, 0.35), lerp(at(u0, 5), ty, 0.35), tx, ty); c.bezierCurveTo(lerp(at(u1, 4), tx, 0.35), lerp(at(u1, 5), ty, 0.35), at(u1, 2), at(u1, 3), at(u1, 0), at(u1, 1)); c.closePath();
    c.fillStyle = pal.hair; c.fill(); c.fillStyle = v > 0.6 ? rgba(L > 0.7 ? pal.hairWarm : pal.hairHi, (v - 0.6) * (L > 0.7 ? 2.2 : 1.5)) : rgba(pal.hairLn, (0.6 - v) * 0.9); c.fill();
    if (ring) { const g = c.createLinearGradient(at(um, 0), at(um, 1), tx, ty); g.addColorStop(Math.max(0, ring - 0.22), rgba(pal.hairGl, 0)); g.addColorStop(ring, rgba(pal.hairGl, 0.4 * (0.3 + h) * (0.4 + L))); g.addColorStop(Math.min(1, ring + 0.22), rgba(pal.hairGl, 0)); c.fillStyle = g; c.fill(); }
    c.strokeStyle = rgba(pal.hairLn, 0.4); c.lineWidth = 0.008; c.stroke(); } };
// strands 在两条边之间拉 n 根细丝。splay：发梢散开多少；w：丝多粗；a：整体多淡
const strands = (c, pal, A, B, n, sd, { lit = 0.5, splay = 0.05, w = 0.02, a = 1 } = {}) => { const a0 = c.globalAlpha; c.lineCap = 'round';
  for (let i = 0; i < n; i++) { const u = (i + hash(i, sd)) / n, h = hash(i, sd + 1), p = A.map((v, k) => lerp(v, B[k], u) + (k < 2 ? 0 : (hash(i * 8 + k, sd + 2) - 0.5) * splay * (k < 6 ? 1 : 2.2)));
    const L = typeof lit === 'function' ? lit(u) : lit, gl = h > 1 - 0.32 * L, dk = h < 0.42;
    c.beginPath(); c.moveTo(p[0], p[1]); c.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); c.strokeStyle = gl ? pal.hairGl : dk ? pal.hairLn : L > 0.7 ? pal.hairWarm : pal.hairHi; c.globalAlpha = a0 * a * (gl ? 0.5 : dk ? 0.6 : 0.42); c.lineWidth = w * (gl ? 0.5 : 0.6 + hash(i, sd + 3)); c.stroke(); }
  c.globalAlpha = a0; };
// 她头顶的两片：中分，往两边梳到耳后。脸转过去时远的那半边压窄
const herTop = (yaw) => { const R = 1 - 0.13 * yaw, px = 0.06 + 0.1 * yaw; return [[[px, -0.56, -0.35, -0.58, -0.76, -0.4, -0.9, 0.1], [px, -1.2, -0.7, -1.32, -1.12, -0.8, -1.03, 0.12]], [[px, -0.56, 0.45 * R, -0.58, 0.8 * R, -0.4, 0.9 * R, 0.1], [px, -1.2, 0.74 * R, -1.32, 1.12 * R, -0.8, 1.03 * R, 0.12]]]; };
// 一个发髻：一团头发，丝往一个方向旋。L 受光多少
const bun = (c, pal, x, y, r, L, sd) => { const a0 = c.globalAlpha; c.lineCap = 'round';
  c.beginPath(); c.ellipse(x, y, r, r * 0.9, 0, 0, TAU); c.fillStyle = pal.hair; c.fill(); c.save(); c.clip(); blob(c, x + r * 0.3, y - r * 0.35, r * 0.9, r * 0.7, L > 0.7 ? pal.hairWarm : pal.hairHi, 0.8);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + sd, h = hash(i, sd + 1); c.beginPath(); c.arc(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32, r * 0.72, a + 0.5, a + 2.3); c.strokeStyle = h > 1 - 0.45 * L ? pal.hairGl : h < 0.5 ? pal.hairLn : pal.hairHi; c.globalAlpha = a0 * (0.3 + 0.3 * h); c.lineWidth = 0.02 + 0.03 * h; c.stroke(); } c.globalAlpha = a0; c.restore(); };
// 发髻根上的一朵红花、两条飘带（跟着风）
const bunTie = (c, x, y, sw) => { c.lineCap = 'round';
  for (const k of [0, 1]) { const sg = x < 0 ? -1 : 1, ex = x + sg * (0.2 + 0.12 * k) - sw * (0.7 + 0.4 * k), ey = y + 0.6 + 0.3 * k; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + sg * 0.2, y + 0.15, lerp(x, ex, 0.5) - sw * 0.25, lerp(y, ey, 0.6), ex, ey); c.strokeStyle = RED; c.lineWidth = 0.06; c.stroke(); c.strokeStyle = 'rgba(255,170,150,.6)'; c.lineWidth = 0.016; c.stroke(); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - 0.3; c.beginPath(); c.arc(x + Math.cos(a) * 0.07, y + Math.sin(a) * 0.07, 0.06, 0, TAU); c.fillStyle = i % 2 ? '#e8414a' : RED; c.fill(); } c.beginPath(); c.arc(x, y, 0.036, 0, TAU); c.fillStyle = '#ffd98a'; c.fill(); };
// 耳坠：三颗红珠、一朵白花、一条红穗，跟着风摆
const earring = (c, x, y, sw) => { c.save(); c.translate(x, y); c.rotate(-sw * 0.5); c.strokeStyle = '#c9a26a'; c.lineWidth = 0.012; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 0.5); c.stroke();
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0.07 + i * 0.1, 0.038, 0, TAU); c.fillStyle = RED; c.fill(); c.beginPath(); c.arc(-0.012, 0.058 + i * 0.1, 0.012, 0, TAU); c.fillStyle = 'rgba(255,220,210,.9)'; c.fill(); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; c.beginPath(); c.arc(Math.cos(a) * 0.05, 0.44 + Math.sin(a) * 0.05, 0.04, 0, TAU); c.fillStyle = '#fff8f2'; c.fill(); } c.beginPath(); c.arc(0, 0.44, 0.022, 0, TAU); c.fillStyle = '#ffd98a'; c.fill();
  c.beginPath(); c.moveTo(-0.025, 0.5); c.lineTo(0.025, 0.5); c.lineTo(0.06, 0.92); c.lineTo(-0.06, 0.92); c.closePath(); c.fillStyle = RED; c.fill(); c.strokeStyle = 'rgba(120,20,30,.5)'; c.lineWidth = 0.008; for (const dx of [-0.02, 0.01, 0.035]) { c.beginPath(); c.moveTo(dx * 0.5, 0.52); c.lineTo(dx, 0.92); c.stroke(); }
  c.restore(); };
const BUN = (sx, yaw) => sx * 0.62 * (sx > 0 ? 1 - 0.13 * yaw : 1) + 0.12 * yaw;
const herBuns = (c, pal, yaw, lx) => { for (const sx of [-1, 1]) bun(c, pal, BUN(sx, yaw), -1.16, 0.31, sx * lx > 0 ? 0.95 : 0.25, 40 + sx); };
const herTies = (c, yaw, sw) => { for (const sx of [-1, 1]) bunTie(c, BUN(sx, yaw) * 0.97, -0.9, sw); };
// 她的头发（正面，盖在脸上面的那些）：耳后垂到胸前的两绺、头顶两片、双髻、鬓边细发、被风带起来的散发、耳坠、额前几根碎发
const hairHer = (c, pal, yaw, sw, lx) => { const T = herTop(yaw), R = 1 - 0.13 * yaw, d = sw * 0.5, L = (sx) => sx * lx > 0 ? 0.95 : 0.25;
  for (const sx of [-1, 1]) { const k = sx > 0 ? R : 1, A = [sx * 1.04 * k, 0.0, sx * 1.16 * k, 0.9, sx * 0.96 * k + d * 0.4, 2.2, sx * 1.06 * k + d * 1.3, 3.75], B = [sx * 0.97 * k, -0.02, sx * 1.05 * k, 0.8, sx * 0.88 * k + d * 0.4, 2.0, sx * 1.0 * k + d * 1.3, 3.55];
    lock(c, pal, A, B, 2, 50 + sx, { lit: L(sx), ragged: 0.3 }); strands(c, pal, A, B, 9, 54 + sx, { lit: L(sx), splay: 0.1, w: 0.014 }); }
  herBuns(c, pal, yaw, lx);
  T.forEach(([A, B], i) => { band(c, A, B); c.fillStyle = pal.hair; c.fill(); lock(c, pal, A, B, 8, 60 + i, { lit: L(i ? 1 : -1), ragged: 0.04, ring: 0.5 }); strands(c, pal, A, B, 22, 64 + i, { lit: L(i ? 1 : -1), w: 0.012 }); });
  herTies(c, yaw, sw);
  for (const sx of [-1, 1]) { const k = sx > 0 ? R : 1;
    strands(c, pal, [sx * 0.5 * k, -0.6, sx * 0.84 * k, -0.25, sx * 0.94 * k + d * 0.2, 0.5, sx * 0.84 * k + d * 0.7, 1.4], [sx * 0.62 * k, -0.52, sx * 0.86 * k, -0.15, sx * 0.9 * k + d * 0.2, 0.4, sx * 0.8 * k + d * 0.7, 1.05], 5, 70 + sx, { w: 0.014, splay: 0.06, a: 0.9, lit: L(sx) });
    strands(c, pal, [sx * 0.7, -1.0, sx * 1.1, -1.0, sx * 1.3 + sw * 0.6, -0.5, sx * 1.35 + sw * 1.2, 0.3], [sx * 1.0, -0.3, sx * 1.15, 0.2, sx * 1.25 + sw * 0.6, 0.9, sx * 1.3 + sw * 1.2, 1.9], 5, 74 + sx, { w: 0.01, splay: 0.16, a: 0.55, lit: L(sx) });
    if (sx < 0 || yaw < 0.6) earring(c, sx * 0.8 * k + (sx > 0 ? 0.03 : 0.1) * yaw, 0.52, sw); }
};
// 身后的长发：她到腰下，他到背心。正面时画在身体后面，背面时盖在背上；s1 是发梢被风带出去多少
const backHair = (c, pal, her, back, sw, lx) => { const b = her ? (back ? 5.9 : 5.4) : (back ? 4.6 : 4.0), s1 = (sw + (her || back ? 0 : 0.55)) * 0.9, hw = her ? (back ? 1.08 : 1.0) : 0.62, lit = (u) => lx > 0 ? u : 1 - u;
  const A = [-0.5, -1.15, -1.32, -0.9, -hw - 0.12 + s1 * 0.4, 2.4, -hw + 0.1 + s1, b], B = [0.5, -1.15, 1.32, -0.9, hw + 0.12 + s1 * 0.4, 2.4, hw - 0.1 + s1, b];
  c.beginPath(); c.ellipse(0, -0.12, 1.04, 1.1, 0, 0, TAU); c.fillStyle = pal.hair; c.fill();
  lock(c, pal, A, B, back ? 16 : 12, 13, { lit, ragged: 0.14, ring: back ? 0.13 : 0 }); strands(c, pal, A, B, back ? 44 : 26, 11, { lit, splay: 0.14, w: 0.016 });
  strands(c, pal, [-0.9, 0.5, -1.3 + s1 * 0.5, 1.5, -1.3 + s1, 3, -1.2 + s1 * 2, b - 1], [0.9, 0.5, 1.3 + s1 * 0.5, 1.5, 1.3 + s1, 3, 1.2 + s1 * 2, b - 1], 8, 15, { w: 0.01, splay: 0.3, a: 0.5, lit }); };
// 他的高马尾：头顶扎一个结，发带两条带尾。正面往马尾那边飘，背面垂在背上
const knot = (c, pal, sw, back) => { c.lineCap = 'round';
  for (const k of [0, 1]) { c.beginPath(); c.moveTo(0.02, -1.26); if (back) c.bezierCurveTo((k ? 0.3 : -0.3), -0.6, (k ? 0.35 : -0.3) + sw * 0.5, 1.2, (k ? 0.3 : -0.25) + sw * 1.3, 2.5 + 0.4 * k); else c.bezierCurveTo(0.5, -1.55, 1.0 + sw * 0.3, -1.1 + 0.3 * k, 1.2 + 0.2 * k + sw * 0.8, -0.2 + 0.7 * k); c.strokeStyle = '#e9edfb'; c.lineWidth = 0.055; c.stroke(); c.strokeStyle = 'rgba(120,135,200,.6)'; c.lineWidth = 0.014; c.stroke(); }
  c.beginPath(); c.ellipse(0.02, -1.38, 0.24, 0.17, 0, 0, TAU); c.fillStyle = pal.hair; c.fill(); c.save(); c.clip(); blob(c, 0.1, -1.46, 0.2, 0.12, pal.hairHi, 0.9); c.restore();
  c.beginPath(); c.moveTo(-0.2, -1.25); c.quadraticCurveTo(0.02, -1.2, 0.24, -1.25); c.strokeStyle = '#34407a'; c.lineWidth = 0.1; c.stroke(); };
// 他的头发（正面）：往头顶梳成高马尾，发际线是一道弧；额前中分，两片刘海顺着脸垂到颧骨
const hairHim = (c, pal, yaw, sw, lx) => { const R = 1 - 0.12 * yaw, d = sw * 0.5;
  c.beginPath(); c.moveTo(-0.93, 0.12); c.bezierCurveTo(-1.1, -0.5, -0.9, -1.3, 0.02, -1.28); c.bezierCurveTo(0.9 * R, -1.3, 1.1 * R, -0.5, 0.93 * R, 0.12); c.lineTo(0.86 * R, -0.3); c.quadraticCurveTo(0.62 * R, -0.56, 0.1 * yaw, -0.52); c.quadraticCurveTo(-0.62, -0.56, -0.86, -0.3); c.closePath(); c.fillStyle = pal.hair; c.fill(); c.save(); c.clip();
  for (const sx of [-1, 1]) { const k = sx > 0 ? R : 1, A = [0.02, -1.3, sx * 0.6 * k, -1.36, sx * 1.14 * k, -0.9, sx * 0.98 * k, 0.1], B = [0.02, -1.2, sx * 0.04, -1.0, sx * 0.06, -0.8, 0.1 * yaw, -0.5]; lock(c, pal, A, B, 8, 80 + sx, { lit: sx * lx > 0 ? 0.85 : 0.3, ragged: 0, ring: 0.5 }); strands(c, pal, A, B, 14, 84 + sx, { w: 0.012, splay: 0.03, a: 0.8 }); } c.restore();
  for (const sx of [-1, 1]) { const k = sx > 0 ? R : 1, x0 = 0.1 * yaw, A = [x0, -0.6, x0 + sx * 0.5 * k, -0.66, sx * 0.98 * k, -0.25, sx * 0.9 * k + d * 0.8, 0.85], B = [x0, -0.4, x0 + sx * 0.24 * k, -0.34, sx * 0.64 * k, -0.08, sx * 0.8 * k + d * 0.8, 0.45]; lock(c, pal, A, B, 4, 88 + sx, { ragged: 0.25, lit: sx * lx > 0 ? 0.8 : 0.3, ring: 0.4 }); strands(c, pal, A, B, 7, 90 + sx, { w: 0.012, splay: 0.05, a: 0.9 }); }
  knot(c, pal, sw, false); };

// ---------------- 整个人 ----------------
// o = { view 'front'|'back', fit 'summer'|'autumn'|'winter', yaw, pit, turn（背面时头往右转露侧脸 0..1）, open, gx, gy, happy, smile, mouth, blush, sad, brow, tear, wet,
//       sway 头发衣摆被风带 -1..1, walk 步态相位 0..1（不写 = 站着）, sit 坐着, armL/armR { a 上臂外展角, b 小臂内弯角 }, scarf [[尾巴点…], …]（本地坐标）, lx 光从左(-1)还是右(1), over(c) 最后再画点东西 }
P.person = (c, who, o = {}) => {
  const her = who === 'her', pal = PAL[who], fit = FIT[who][o.fit || 'summer'], back = o.view === 'back', sw = o.sway || 0, lx = o.lx ?? 1;
  const sh = her ? 1.08 : 1.4, wa = her ? 0.66 : 0.92, lw = her ? 0.84 : 1, wk = o.walk == null ? 0 : 1, ph = o.walk || 0;
  const lift = [wk * Math.max(0, Math.sin(TAU * ph)), wk * Math.max(0, -Math.sin(TAU * ph))], yaw = clamp(o.yaw || 0), pit = o.pit || 0, turn = o.turn || 0;
  c.save(); c.lineJoin = c.lineCap = 'round'; if (wk) c.translate(0.05 * Math.sin(TAU * ph), -0.12 * Math.abs(Math.sin(TAU * ph)));
  const head = (fn) => { c.save(); c.translate(0, 1); c.scale(HS, HS); c.translate(0, -1); fn(); c.restore(); };
  // 一边暗、一边亮：罩在一块布上（先 clip）
  const sides = (w, y0, y1, a = 0.45) => { const g = c.createLinearGradient(-lx * w, 0, lx * w, 0); g.addColorStop(0, rgba(fit.sh, a)); g.addColorStop(0.5, rgba(fit.sh, 0)); g.addColorStop(1, 'rgba(255,255,255,.16)'); c.fillStyle = g; c.fillRect(-w - 3, y0, 2 * w + 6, y1 - y0); };
  // 下摆：她是长裙（腰上白、往下染成红），他是袍子的下半截；走路时摆、坐下时摊在地上。鞋尖露在下面
  const lower = () => { const sit = o.sit, y0 = 4.2, y1 = sit ? 5.6 : her ? 12.4 : 12.1, w1 = sit ? (her ? 2.3 : 1.8) : her ? 1.6 : 1.22, n = her ? 9 : 6, dx = sit ? 0 : sw * 0.5 + wk * 0.16 * Math.sin(TAU * ph);
    const hem = (i) => [lerp(-w1, w1, i / n) + dx, y1 + 0.05 * Math.cos(i * 1.7)];
    if (!sit) for (const i of [0, 1]) { const sx = i ? 1 : -1, lf = lift[i], fx = sx * 0.42 * (1 - 0.2 * lf) + dx * 0.8, fy = 12.62 - lf * 0.3; c.beginPath(); c.ellipse(fx + sx * 0.05, fy, 0.26, 0.19, sx * 0.15, 0, TAU); c.fillStyle = fit.shoe; c.fill(); blob(c, fx + sx * 0.05, fy - 0.06, 0.16, 0.08, '#ffffff', 0.25); }
    c.beginPath(); c.moveTo(-wa, y0); c.bezierCurveTo(-wa - 0.35, lerp(y0, y1, 0.3), -w1 + dx * 0.5, lerp(y0, y1, 0.65), -w1 + dx, y1); for (let i = 1; i <= n; i++) { const [x, y] = hem(i); c.quadraticCurveTo(lerp(-w1, w1, (i - 0.5) / n) + dx, y1 + 0.2 + 0.07 * Math.sin(i * 2.4 + sw * 3 + ph * TAU), x, y); } c.bezierCurveTo(w1 + dx * 0.5, lerp(y0, y1, 0.65), wa + 0.35, lerp(y0, y1, 0.3), wa, y0); c.closePath();
    const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, fit.sk0); g.addColorStop(her ? 0.45 : 0.3, fit.sk0); g.addColorStop(1, fit.sk1); c.fillStyle = g; c.fill();
    c.save(); c.clip(); sides(w1, y0, y1 + 1);
    for (let i = 1; i < n; i++) { const [x, y] = hem(i), xt = lerp(-wa, wa, i / n) * 0.8; c.beginPath(); c.moveTo(xt, y0 + 0.5); c.quadraticCurveTo(lerp(xt, x, 0.4), lerp(y0, y, 0.5), x, y + 0.2); soft(c, i % 2 ? fit.sh : '#ffffff', 0.05, i % 2 ? 0.3 : 0.25); }
    if (!her && !back && !sit) { c.beginPath(); c.moveTo(-wa + 0.05, y0 + 0.4); c.quadraticCurveTo(-wa - 0.1, 8, -w1 * 0.45 + dx, y1 + 0.2); c.strokeStyle = fit.band; c.lineWidth = 0.1; c.stroke(); }   // 袍子的衣襟一直斜到脚边
    c.restore(); };
  // 冬天的斗篷：披在肩上、垂到小腿。正面画在身体后面，背面盖住整个背
  const cape = () => { const y1 = 10.9, w1 = 2.0, dx = sw * 0.6 + wk * 0.1 * Math.sin(TAU * ph), n = 8;
    c.beginPath(); c.moveTo(-0.34, 1.3); c.quadraticCurveTo(-sh * 0.8, 1.36, -sh - 0.14, 1.78); c.bezierCurveTo(-sh - 0.5, 4.5, -w1 + dx * 0.5, 8, -w1 + dx, y1); for (let i = 1; i <= n; i++) c.quadraticCurveTo(lerp(-w1, w1, (i - 0.5) / n) + dx, y1 + 0.2 + 0.07 * Math.sin(i * 2.1 + sw * 3), lerp(-w1, w1, i / n) + dx, y1 + 0.04 * Math.cos(i * 1.3)); c.bezierCurveTo(w1 + dx * 0.5, 8, sh + 0.5, 4.5, sh + 0.14, 1.78); c.quadraticCurveTo(sh * 0.8, 1.36, 0.34, 1.3); c.closePath();
    const g = c.createLinearGradient(0, 1.3, 0, y1); g.addColorStop(0, '#fffaf4'); g.addColorStop(1, '#ead6cc'); c.fillStyle = g; c.fill(); c.save(); c.clip();
    { const g2 = c.createLinearGradient(-lx * w1, 0, lx * w1, 0); g2.addColorStop(0, 'rgba(190,150,150,.45)'); g2.addColorStop(0.5, 'rgba(190,150,150,0)'); g2.addColorStop(1, 'rgba(255,255,255,.3)'); c.fillStyle = g2; c.fillRect(-w1 - 3, 1, 2 * w1 + 6, y1); }
    for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(lerp(-sh, sh, i / n) * 0.8, 2.2); c.quadraticCurveTo(lerp(-sh, sh, i / n), 6, lerp(-w1, w1, i / n) + dx, y1 + 0.2); soft(c, i % 2 ? '#c9a39c' : '#ffffff', 0.06, 0.3); }
    c.beginPath(); c.moveTo(-w1 + dx, y1 - 0.25); for (let i = 1; i <= n; i++) c.quadraticCurveTo(lerp(-w1, w1, (i - 0.5) / n) + dx, y1 - 0.05 + 0.07 * Math.sin(i * 2.1 + sw * 3), lerp(-w1, w1, i / n) + dx, y1 - 0.25); c.strokeStyle = RED; c.lineWidth = 0.09; c.stroke();   // 下摆一道红边
    c.restore(); };
  // 上身：交领。正面看得到脖子下面一小块皮肤、里衣的领子、压在上面的白领缘（右衽，一直斜到腰）
  const torso = () => { const y0 = 1.62, yb = 4.5, wb = wa + 0.05;
    c.beginPath(); c.moveTo(-0.32, 1.3); c.quadraticCurveTo(-sh * 0.7, 1.38, -sh, y0 + 0.12); c.quadraticCurveTo(-sh - 0.1, y0 + 0.5, -sh + 0.08, y0 + 1.0); c.bezierCurveTo(-wa - 0.14, 3.0, -wa - 0.02, 3.9, -wb, yb);
    c.lineTo(wb, yb); c.bezierCurveTo(wa + 0.02, 3.9, wa + 0.14, 3.0, sh - 0.08, y0 + 1.0); c.quadraticCurveTo(sh + 0.1, y0 + 0.5, sh, y0 + 0.12); c.quadraticCurveTo(sh * 0.7, 1.38, 0.32, 1.3); c.closePath();
    c.fillStyle = fit.robe; c.fill(); c.save(); c.clip(); blob(c, -lx * 0.8, 3.0, 0.75, 2.2, fit.sh, 0.75); blob(c, lx * 0.5, 2.4, 0.45, 1.0, fit.hi, 0.6);
    const edge = (w, col) => { c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = w + 0.08; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
    if (back) { c.beginPath(); c.moveTo(-0.44, 1.3); c.quadraticCurveTo(0, 1.56, 0.44, 1.3); edge(0.2, fit.band); c.beginPath(); c.moveTo(0, 1.6); c.lineTo(0, yb); soft(c, fit.sh, 0.04, 0.4); }
    else { c.beginPath(); c.moveTo(-0.34, 1.2); c.lineTo(0, 2.25); c.lineTo(0.34, 1.2); c.closePath(); c.fillStyle = pal.skinSh; c.fill(); blob(c, lx * 0.08, 1.5, 0.14, 0.3, pal.skin, 0.9);
      c.beginPath(); c.moveTo(-0.2, 1.24); c.quadraticCurveTo(-0.1, 1.75, 0, 2.08); c.quadraticCurveTo(0.1, 1.75, 0.2, 1.24); edge(0.15, fit.inner);
      if (her) for (const [x, y, col] of [[-0.13, 1.6, '#cfe0ff'], [0.11, 1.72, '#ffffff'], [-0.04, 1.96, '#9fc0ff']]) for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x + Math.cos(i * 1.257) * 0.022, y + Math.sin(i * 1.257) * 0.022, 0.016, 0, TAU); c.fillStyle = col; c.fill(); }   // 里衣领子上的小花
      c.beginPath(); c.moveTo(-0.38, 1.2); c.quadraticCurveTo(-0.24, 1.85, 0, 2.3); edge(0.2, fit.band);
      c.beginPath(); c.moveTo(0.38, 1.2); c.quadraticCurveTo(0.24, 1.85, 0, 2.3); c.quadraticCurveTo(-0.34, 3.25, -wa + 0.02, 4.3); edge(0.2, fit.band);
      c.beginPath(); c.moveTo(lx * 0.5, 2.0); c.quadraticCurveTo(lx * 0.6, 3.0, lx * 0.35, 3.9); soft(c, fit.sh, 0.04, 0.3); }
    c.restore(); };
  // 腰封：她系一根绳、打个结、垂两条带子；他挂一块玉佩
  const sash = () => { c.beginPath(); c.moveTo(-wa - 0.1, 3.9); c.quadraticCurveTo(0, 4.08, wa + 0.1, 3.9); c.lineTo(wa + 0.06, 4.6); c.quadraticCurveTo(0, 4.8, -wa - 0.06, 4.6); c.closePath(); c.fillStyle = fit.sash; c.fill(); c.save(); c.clip(); blob(c, lx * 0.3, 4.2, 0.5, 0.3, '#ffffff', 0.22); blob(c, -lx * 0.6, 4.3, 0.4, 0.5, '#000000', 0.3); c.restore();
    if (back || o.sit) return; const dx = sw * 0.5;
    if (her) { c.beginPath(); c.moveTo(-wa - 0.08, 4.2); c.quadraticCurveTo(0, 4.4, wa + 0.08, 4.2); c.strokeStyle = '#fbe9dc'; c.lineWidth = 0.06; c.stroke();
      for (const k of [0, 1]) { c.beginPath(); c.moveTo(-0.18, 4.36); c.bezierCurveTo(-0.3 + 0.2 * k, 5.2, -0.35 + 0.3 * k + dx * 0.5, 6.0, -0.3 + 0.28 * k + dx, 6.9 + 0.5 * k); c.strokeStyle = '#fbe9dc'; c.lineWidth = 0.08; c.stroke(); c.strokeStyle = CORAL; c.lineWidth = 0.02; c.stroke(); }
      c.beginPath(); c.ellipse(-0.18, 4.36, 0.12, 0.08, 0, 0, TAU); c.fillStyle = CORAL; c.fill(); }
    else { c.beginPath(); c.moveTo(0.4, 4.6); c.quadraticCurveTo(0.42 + dx * 0.3, 5.1, 0.42 + dx * 0.6, 5.5); c.strokeStyle = '#e9edfb'; c.lineWidth = 0.03; c.stroke(); c.beginPath(); c.arc(0.42 + dx * 0.6, 5.68, 0.15, 0, TAU); c.strokeStyle = '#bfe8d4'; c.lineWidth = 0.07; c.stroke();
      for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(0.42 + dx * 0.6, 5.85); c.lineTo(0.42 + dx * 0.9 + k * 0.05, 6.7); c.strokeStyle = '#e9edfb'; c.lineWidth = 0.03; c.stroke(); } } };
  // 胳膊：广袖。袖口顺着手腕张开，手抬起来时靠下的那个角垂下去；手从袖口露出半截
  const arm = (i) => { const sx = i ? 1 : -1, A = (i ? o.armR : o.armL) || {}, a = A.a ?? 0.1, b = A.b ?? 0.08, swg = wk * 0.16 * Math.sin(TAU * ph) * (i ? -1 : 1);
    const x0 = sx * (sh - 0.17), y0 = 1.95, L1 = 1.95, L2 = 1.85 * (1 - Math.abs(swg) * 0.6), a1 = sx * a, x1 = x0 + Math.sin(a1) * L1, y1 = y0 + Math.cos(a1) * L1, a2 = a1 - sx * b, x2 = x1 + Math.sin(a2) * L2, y2 = y1 + Math.cos(a2) * L2;
    const hx = x2 + Math.sin(a2) * 0.36, hy = y2 + Math.cos(a2) * 0.36; c.save(); c.translate(hx, hy); c.rotate(-a2); c.fillStyle = pal.skin; c.beginPath(); c.ellipse(-sx * 0.13, -0.1, 0.07, 0.17, sx * 0.5, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, 0, 0.17 * lw, 0.29, 0, 0, TAU); c.fill(); blob(c, -sx * 0.06, 0.05, 0.14, 0.26, pal.skinSh, 0.6); c.restore();
    const n1 = [sx * Math.cos(a1), -sx * Math.sin(a1)], n2 = [sx * Math.cos(a2), -sx * Math.sin(a2)], w0 = 0.36 * lw, wc = 0.52 * lw, dr = (her ? 1.3 : 1.0) * Math.abs(Math.sin(a2));
    const So = [x0 + n1[0] * w0 * 0.55, y0 + n1[1] * w0 * 0.55 - 0.2], Eo = [x1 + (n1[0] + n2[0]) * 0.3 * lw, y1 + (n1[1] + n2[1]) * 0.3 * lw], C1 = [x2 + n2[0] * wc, y2 + n2[1] * wc], C2 = [x2 - n2[0] * wc, y2 - n2[1] * wc], Pi = [x0 - n1[0] * w0, y0 - n1[1] * w0 + 0.4];
    const low = C1[1] > C2[1] ? C1 : C2; low[0] += sw * 0.3; low[1] += dr; const Ei = [x1 - (n1[0] + n2[0]) * 0.34 * lw + sw * 0.1, y1 - (n1[1] + n2[1]) * 0.34 * lw + dr * 0.5];
    c.beginPath(); c.moveTo(So[0], So[1]); c.quadraticCurveTo(Eo[0], Eo[1], C1[0], C1[1]); c.lineTo(C2[0], C2[1]); c.quadraticCurveTo(Ei[0], Ei[1], Pi[0], Pi[1]); c.closePath(); c.fillStyle = c.strokeStyle = fit.robe; c.lineWidth = 0.16; c.stroke(); c.fill();
    c.save(); c.clip(); blob(c, Ei[0], Ei[1], 0.5, 1.3, fit.sh, 0.7); blob(c, Eo[0], Eo[1], 0.3, 0.9, fit.hi, lx * sx > 0 ? 0.6 : 0.25);
    c.beginPath(); c.moveTo(lerp(So[0], Pi[0], 0.5), y0 + 0.3); c.quadraticCurveTo(x1, y1, lerp(C1[0], C2[0], 0.6), lerp(C1[1], C2[1], 0.6)); soft(c, fit.sh, 0.04, 0.35);
    c.beginPath(); c.moveTo(C1[0], C1[1]); c.lineTo(C2[0], C2[1]); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.42; c.stroke(); c.strokeStyle = fit.band; c.lineWidth = 0.34; c.stroke(); c.restore();
    return [x2, y2]; };
  const neck = () => { const nw = her ? 0.23 : 0.34; c.beginPath(); c.moveTo(-nw, 0.6); c.lineTo(-nw - 0.05, 1.55); c.lineTo(nw + 0.05, 1.55); c.lineTo(nw, 0.6); c.closePath(); c.fillStyle = back ? pal.skin : pal.skinSh; c.fill(); if (!back) { c.save(); c.clip(); blob(c, 0, 0.95, 0.5, 0.42, pal.skinDp, 0.6); blob(c, lx * 0.14, 1.5, 0.14, 0.28, pal.skin, 0.9); c.restore(); } };   // 下巴投在脖子上的影
  const ribbon = (pts, wd) => { if (!pts || pts.length < 2) return; const L = [], R = []; pts.forEach((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)], a = Math.atan2(q[1] - r[1], q[0] - r[0]), nx = -Math.sin(a) * wd / 2, ny = Math.cos(a) * wd / 2; L.push([p[0] + nx, p[1] + ny]); R.push([p[0] - nx, p[1] - ny]); });
    c.beginPath(); L.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); R.reverse().forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fillStyle = SCF; c.fill(); ink(c, SCF_D, 0.03);
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); ink(c, 'rgba(255,255,255,.7)', wd * 0.16);
    const e = pts[pts.length - 1], f = pts[pts.length - 2], a = Math.atan2(e[1] - f[1], e[0] - f[0]); c.lineCap = 'butt'; for (const q of [0.25, 0.7]) { const mx = lerp(e[0], f[0], q), my = lerp(e[1], f[1], q); c.beginPath(); c.moveTo(mx - Math.sin(a) * wd / 2, my + Math.cos(a) * wd / 2); c.lineTo(mx + Math.sin(a) * wd / 2, my - Math.cos(a) * wd / 2); c.strokeStyle = CORAL; c.lineWidth = 0.1; c.stroke(); } c.lineCap = 'round'; for (let k = -2; k <= 2; k++) { c.beginPath(); const bx = e[0] - Math.sin(a) * k * wd / 5, by = e[1] + Math.cos(a) * k * wd / 5; c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * 0.2, by + Math.sin(a) * 0.2); ink(c, SCF_D, 0.035); } };
  const scarf = () => { if (!fit.scarf || !her) return; for (const pts of o.scarf || []) ribbon(pts, 0.3);   // 围巾：绕脖子一圈，下巴露在外面
    const y0 = back ? 1.05 : 1.2, fy = (u, i) => y0 + (back ? 0.1 : 0.3) * Math.sin(Math.PI * u) + 0.03 * Math.sin(i * 2.3);   // 毛领：一圈毛茸茸的白团，底下压一层暗的
    for (const [dy, col] of [[0.1, SCF_D], [0, '#fffaf6']]) for (let i = 0; i <= 12; i++) { c.beginPath(); c.arc(lerp(-0.66, 0.66, i / 12), fy(i / 12, i) + dy, 0.16 + 0.025 * Math.sin(i * 1.7), 0, TAU); c.fillStyle = col; c.fill(); }
    for (let i = 0; i <= 12; i++) blob(c, lerp(-0.66, 0.66, i / 12) + 0.03, fy(i / 12, i) - 0.04, 0.12, 0.1, '#ffffff', 0.9); };
  const faceFront = () => {
    const F = FACE[who], cx = 0.2 * yaw, ch = (her ? 1.15 : 1.14) - 0.07 * pit, bl = o.blush ?? (her ? 0.45 : 0.1), ey = F.ey - 0.1 * pit;
    for (const sx of yaw < 0.3 ? [-1, 1] : yaw < 0.75 ? [-1] : []) { const ex = sx * 0.92 - (sx > 0 ? 0.17 * yaw : 0); c.beginPath(); c.ellipse(ex, 0.22, 0.12, 0.22, sx * 0.12, 0, TAU); c.fillStyle = pal.skinSh; c.fill(); blob(c, ex - sx * 0.02, 0.22, 0.06, 0.14, pal.skinDp, 0.55); }   // 耳朵
    facePath(c, yaw, pit, !her); { const g = c.createLinearGradient(-lx * 0.95, 0, lx * 0.95, 0); g.addColorStop(0, pal.skinSh); g.addColorStop(0.42, pal.skin); g.addColorStop(1, pal.skinHi); c.fillStyle = g; c.fill(); }
    c.save(); c.clip();
    for (const [w, a] of [[0.5, 0.1], [0.28, 0.14], [0.12, 0.2]]) { facePath(c, yaw, pit, !her); c.strokeStyle = rgba(pal.skinSh, a); c.lineWidth = w; c.stroke(); }   // 边上一圈往里暗下去：脸是圆的
    blob(c, cx - lx * 0.66, 0.35, 0.45, 0.95, pal.skinSh, 0.4); blob(c, cx + lx * 0.3, 0.42, 0.34, 0.3, pal.skinHi, 0.7); blob(c, cx + lx * 0.1, -0.35, 0.5, 0.25, pal.skinHi, 0.6);   // 背光的半边；受光的脸颊、额头
    if (yaw > 0.15) blob(c, cx + 0.76 - 0.17 * yaw, 0.3, 0.3, 0.9, pal.skinSh, 0.7 * Math.min(1, yaw * 1.6));   // 转过去的那半边
    blob(c, cx - 0.1, -0.56, 0.85, 0.26, pal.skinSh, 0.8); for (const sx of [-1, 1]) { blob(c, cx + sx * 0.82, -0.05, 0.2, 0.5, pal.skinSh, 0.3); blob(c, cx + sx * 0.7, 0.8, 0.2, 0.3, pal.skinSh, 0.3); blob(c, cx + sx * 0.19, ey - 0.03, 0.09, 0.12, pal.skinSh, 0.3); }   // 头发投在额头上的影；太阳穴、下颌两侧、眼窝靠鼻梁的地方暗下去
    for (const [x, side, k] of [[cx - F.ex, -1, 1], [cx + F.ex * (1 - 0.14 * yaw), 1, 1 - 0.26 * yaw]]) {
      blob(c, x + side * F.ew * 0.1 * k, ey - 0.02, F.ew * 0.78 * k, F.eh * (her ? 1.15 : 1.5), pal.shadow, her ? 0.5 : 0.28);   // 眼窝一圈
      blob(c, x, ey + F.eh * 0.56, F.ew * 0.36 * k, 0.03, pal.skinHi, 0.5); blob(c, x, ey + F.eh * 0.56 + 0.05, F.ew * 0.42 * k, 0.022, pal.skinSh, 0.2);   // 卧蚕
      const bx = x + side * 0.07 * k, by = F.ny - 0.08 - 0.08 * pit; blob(c, bx, by, 0.32 * k, 0.2 * k, pal.blush, 0.55 * bl); if (bl > 0.7) blob(c, bx, by, 0.2 * k, 0.12 * k, pal.blush, 0.5 * (bl - 0.5)); }
    if (bl > 0.7) blob(c, cx + 0.03 * yaw, F.ny - 0.14, 0.3, 0.09, pal.blush, 0.35 * (bl - 0.5));   // 害羞到鼻梁上
    blob(c, cx * 0.95, F.my - 0.1 * pit + F.ll + 0.07, 0.15, 0.045, pal.skinSh, 0.75); blob(c, cx + 0.02, ch - 0.13, 0.11, 0.075, pal.skinHi, 0.6);   // 下唇底下的影、下巴的光
    if (her) for (const a of [-0.75, 0, 0.75]) { c.save(); c.translate(cx * 0.9, -0.36 - 0.1 * pit); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.04, -0.07, 0, -0.14 + 0.03 * Math.abs(a)); c.quadraticCurveTo(-0.04, -0.07, 0, 0); c.fillStyle = '#e02a3a'; c.fill(); c.restore(); }   // 额间花钿
    c.restore(); facePath(c, yaw, pit, !her); c.strokeStyle = rgba(pal.line, 0.28); c.lineWidth = 0.012; c.stroke();
    features(c, who, o, yaw, pit, lx); brows(c, who, o, yaw, pit);
  };

  if (fit.cloak && !back) cape();
  if (!back) head(() => backHair(c, pal, her, false, sw, lx));
  lower(); neck();
  if (back) { arm(0); arm(1); torso(); sash(); if (fit.cloak) cape(); } else { torso(); sash(); arm(0); arm(1); }
  head(() => {
    if (back) {
      if (!her) for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * 0.96, 0.2, 0.12, 0.22, sx * 0.1, 0, TAU); c.fillStyle = pal.skinSh; c.fill(); }
      if (turn > 0.2) { c.beginPath(); c.moveTo(0.6, -0.5); c.bezierCurveTo(0.96 + 0.2 * turn, -0.3, 0.98 + 0.3 * turn, 0.36, 0.7 + 0.2 * turn, 0.68); c.quadraticCurveTo(0.6, 0.95, 0.3, 1.0); c.lineTo(0.2, -0.4); c.closePath(); c.fillStyle = pal.skin; c.fill(); blob(c, 0.8 + 0.2 * turn, 0.45, 0.2, 0.14, pal.blush, 0.35);
        c.beginPath(); c.moveTo(0.86 + 0.2 * turn, 0.16); c.quadraticCurveTo(0.96 + 0.2 * turn, 0.2, 1.02 + 0.22 * turn, 0.14); c.strokeStyle = pal.lash; c.lineWidth = 0.03; c.stroke(); }   // 回头时露出来的一点侧脸
      c.save(); c.translate(-0.12 * turn, 0); backHair(c, pal, her, true, sw, lx); if (her) { herBuns(c, pal, 0, lx); herTies(c, 0, sw); } else knot(c, pal, sw, true); c.restore();
    } else { faceFront(); if (her) hairHer(c, pal, yaw, sw, lx); else hairHim(c, pal, yaw, sw, lx); }
  });
  scarf(); if (o.over) o.over(c);
  c.restore();
};

// ---------------- 手（近一点的镜头用）----------------
// 单位：1 = 手掌宽。原点在手腕，指尖朝上。o = { fist 握拳 0..1, side 1 / -1 镜像, sleeve 袖子颜色 }
P.hand = (c, who, o = {}) => {
  const pal = PAL[who], f = o.fist || 0, L = lerp(1.05, 0.5, f);
  c.save(); c.scale(o.side || 1, 1); c.lineJoin = c.lineCap = 'round';
  c.beginPath(); c.moveTo(-0.3, 0.05); c.lineTo(-0.4, 2.8); c.lineTo(0.4, 2.8); c.lineTo(0.3, 0.05); c.closePath(); c.fillStyle = pal.skin; c.fill(); blob(c, -0.3, 1.2, 0.25, 1.6, pal.skinSh, 0.7);
  if (o.sleeve) { c.beginPath(); c.moveTo(-0.78, 0.8); c.quadraticCurveTo(0, 0.6, 0.78, 0.8); c.lineTo(1.1, 2.9); c.lineTo(-1.1, 2.9); c.closePath(); c.fillStyle = o.sleeve; c.fill(); c.save(); c.clip(); blob(c, -0.8, 2, 0.6, 1.6, '#000000', 0.32); blob(c, 0.45, 1.7, 0.4, 1.2, '#ffffff', 0.2); c.restore();
    c.beginPath(); c.moveTo(-0.78, 0.8); c.quadraticCurveTo(0, 0.6, 0.78, 0.8); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.3; c.stroke(); c.strokeStyle = '#fbf5f0'; c.lineWidth = 0.22; c.stroke(); }
  const th = lerp(0.7, 0.2, f), tx = -0.36 - Math.sin(th) * 0.42, ty = -0.2 - Math.cos(th) * 0.42; c.beginPath(); c.moveTo(-0.32, -0.12); c.lineTo(tx, ty); c.lineTo(tx - Math.sin(th * 0.4) * 0.3, ty - Math.cos(th * 0.4) * 0.3); c.strokeStyle = pal.skin; c.lineWidth = 0.27; c.stroke(); c.strokeStyle = rgba(pal.skinSh, 0.6); c.lineWidth = 0.08; c.stroke();   // 拇指
  c.beginPath(); c.moveTo(-0.3, 0.1); c.bezierCurveTo(-0.5, -0.3, -0.52, -0.7, -0.46, -0.95); c.bezierCurveTo(-0.44, -0.95 - L * 0.9, -0.2, -0.95 - L * 1.05, -0.02, -0.95 - L); c.bezierCurveTo(0.2, -0.95 - L * 0.98, 0.42, -0.95 - L * 0.8, 0.47, -0.9); c.bezierCurveTo(0.52, -0.55, 0.4, -0.2, 0.3, 0.1); c.closePath();
  { const g = c.createLinearGradient(-0.5, 0, 0.5, 0); g.addColorStop(0, pal.skinSh); g.addColorStop(0.4, pal.skin); g.addColorStop(1, pal.skinHi); c.fillStyle = g; c.fill(); }
  c.save(); c.clip(); blob(c, 0, 0.1, 0.5, 0.3, pal.skinSh, 0.7);
  for (const x of [-0.22, 0.02, 0.25]) { c.beginPath(); c.moveTo(x, -0.95 - L * 1.1); c.quadraticCurveTo(x + 0.02, -1.0 - L * 0.5, x + 0.01, -0.98 - L * 0.08); soft(c, pal.skinDp, 0.016, 0.55); }
  if (f > 0.5) { c.beginPath(); c.moveTo(-0.46, -1.0); c.quadraticCurveTo(0, -1.12, 0.47, -0.95); soft(c, pal.skinDp, 0.03, 0.4); } else for (const x of [-0.34, -0.1, 0.14, 0.36]) blob(c, x, -0.86 - L * 0.9 + 0.12 * Math.abs(x), 0.07, 0.1, '#ffffff', 0.45);
  c.restore(); c.restore();
};
})();
