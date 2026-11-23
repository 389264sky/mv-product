// jz_town_shots.js —— 后半段（bar57–123，灯火长街）每一镜：机位、锦鲤的路线、灯怎么亮。画面只由绝对时间 s.t 算出（同一时刻哪一镜来问都一样，叠化时上一镜也能照常画）。
// 第十一次会话：定妆（b11_fly + 锦鲤定妆表）用户点头后照 plan.md「第十一次会话」的分镜铺开。
(() => {
const T = JZ.town, K = JZ.koi, { sm, clamp, lerp, hx, css } = T;
let M0 = null, R = null, ctx0 = null;   // ctx0：龙的 extra（月亮）要画进这一帧的画布
const B = (x) => R.b57 + (x - 57) * R.bl;   // 第 x 小节（可带小数）的秒数
// 非均匀 Catmull-Rom：过每个关键帧，速度连续；两头按端点的速度往外延（不在端点停）
const spline = (K) => { const n = K.length, d = K[0].length - 1, tan = K.map((_, i) => { const a = K[Math.max(0, i - 1)], b = K[Math.min(n - 1, i + 1)]; const o = []; for (let j = 1; j <= d; j++) o.push((b[j] - a[j]) / (b[0] - a[0])); return o; });
  return (t) => { if (t <= K[0][0]) return K[0].slice(1).map((v, j) => v + tan[0][j] * (t - K[0][0])); if (t >= K[n - 1][0]) return K[n - 1].slice(1).map((v, j) => v + tan[n - 1][j] * (t - K[n - 1][0]));
    let i = 0; while (K[i + 1][0] < t) i++; const a = K[i], b = K[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
    return a.slice(1).map((v, j) => (2 * u3 - 3 * u2 + 1) * v + (u3 - 2 * u2 + u) * h * tan[i][j] + (-2 * u3 + 3 * u2) * b[j + 1] + (u3 - u2) * h * tan[i + 1][j]); }; };
const camOf = (sp, t) => { const [x, y, z, yaw, pitch, f] = sp(t); return T.cam({ x, y, z, yaw, pitch, f: f ?? 1250 }); };
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)], nrm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add3 = (...v) => [0, 1, 2].map(j => v.reduce((s, a) => s + a[j], 0)), mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const bump = (t, t0, up = 0.5, hold = 2.5, down = 2.5) => sm(t0 - 0.15, t0 + up, t) * (1 - sm(t0 + hold, t0 + hold + down, t));

// ---------------- 关键帧（init 里按小节换成秒）----------------
let CAM = {}, KOI = {}, passZ = null, laneP = null, pondP = null;
// 尾声的月亮（有远近，当龙珠）：在龙门那一镜月亮的方向上，150 米外；金龙 bar113 起绕着它转（φ 往小转：先从月亮后面绕过去）
// 尾声 t_sky1：锦鲤用尾巴的光写一个「祥」（用户 2026-11-20；字形 ZhiMangXing，title_glyphs.js）。字在一块正对镜头的竖板上：u 往右、v 往下，0..1 对应 XS 米，字心 XC
// 笔顺 XSTK 是照字形描的中线（out/tmp/xiang_grid.png），每一笔是一串点；笔和笔之间抬笔，那段不出光、游得快一些
const XS = 10, XC = [0, 44, 445], xw = (u, v) => [XC[0] + (u - 0.45) * XS, XC[1] - (v - 0.5) * XS, XC[2]];
const XSTK = [[[0.215, 0.045], [0.29, 0.07], [0.325, 0.1], [0.275, 0.145], [0.23, 0.165]],   // 礻的点
  [[0.07, 0.4], [0.16, 0.355], [0.24, 0.3], [0.29, 0.27], [0.31, 0.3], [0.26, 0.4], [0.21, 0.5], [0.165, 0.58], [0.16, 0.66]],   // 横撇
  [[0.3, 0.33], [0.295, 0.45], [0.29, 0.58], [0.285, 0.74]],   // 竖
  [[0.43, 0.09], [0.445, 0.15], [0.45, 0.2], [0.49, 0.15], [0.55, 0.09], [0.63, 0.05], [0.69, 0.06], [0.705, 0.11], [0.65, 0.165], [0.57, 0.23]],   // 羊上面两点（连成一笔）
  [[0.35, 0.35], [0.46, 0.33], [0.6, 0.28], [0.7, 0.25], [0.765, 0.255]],   // 第一横
  [[0.48, 0.41], [0.56, 0.39], [0.64, 0.36], [0.71, 0.375], [0.67, 0.43], [0.625, 0.49], [0.7, 0.515], [0.78, 0.53], [0.835, 0.56]],   // 第二、三横（连笔）
  [[0.54, 0.46], [0.46, 0.53], [0.38, 0.59], [0.34, 0.62], [0.42, 0.64], [0.52, 0.62], [0.62, 0.6], [0.72, 0.585], [0.8, 0.58]],   // 撇接最后一横
  [[0.555, 0.32], [0.56, 0.5], [0.565, 0.7], [0.575, 0.95]]];   // 中间一竖
let XI = null, XSMP = null, XP = null;   // XI：每一笔开始、写完的时刻；XSMP：每一笔按时间取的 [时刻, u, v]；XP：字形
const MO = [0, 108, 103], RMO = 13;   // 龙门上空的月亮（3D，bar108.7 起接替天上画的月亮，龙从它前面往上飞过去）
const dragonPos = (tt) => KOI.gate(tt);
let SP = null;   // 尾声上天以后：DIR、圈心 Cc、off(t)、星系、行星（init 里算）
// bar111.8 以后龙头的路线（每 0.25 小节一行）：沿 DIR 越飞越快（17.5 → 40 米/秒，到星系前慢回 22），左右、上下摆；bar117.8–119.8 拐进圈心 Cc、半径 22 米、正对镜头的圈，每秒 22 米（龙身 42 米占三成圈）
const spaceRows = () => { const D = JZ.space.DIR, E2 = [1, 0, 0], U = nrm3([D[1] * E2[2] - D[2] * E2[1], D[2] * E2[0] - D[0] * E2[2], D[0] * E2[1] - D[1] * E2[0]]), P0 = [-5, 144, 56], rows = [];
  SP = { D, U }; let sd = 0; const A = []; for (let b = 111.8; b <= 125.01; b += 0.25) { const tau = (b - 111.8) * R.bl, rk = sm(111.8, 112.8, b), lt = [7 * Math.sin(1.6 * tau), 4 * Math.sin(1.1 * tau + 0.8)];
    A.push([b, P0.map((v, j) => v + D[j] * sd + rk * (E2[j] * lt[0] + U[j] * lt[1]))]); sd += lerp(17.5, 40, sm(111.8, 113, b)) * lerp(1, 0.55, sm(117.2, 118.4, b)) * 0.25 * R.bl; }
  const at = (b) => A[Math.round((b - 111.8) / 0.25)][1]; SP.Cc = at(118.5).map((v, j) => v + D[j] * 30);
  for (const [b, a] of A) { if (b < 111.9) continue; const ph = -Math.PI / 2 + (b - 118.6) * R.bl, cr = SP.Cc.map((v, j) => v + 22 * (E2[j] * Math.cos(ph) + U[j] * Math.sin(ph))), w = sm(117.8, 119.8, b);
    rows.push([b, ...a.map((v, j) => lerp(v, cr[j], w))]); }
  return rows; };
const init = () => {
  const r = (k) => M0.ref(k); R = { b57: r('bar57'), bl: r('bar58') - r('bar57') };
  Object.assign(R, { luo: r('line25@落'), fire: r('line32@火'), red: r('line36@红'), wind: r('line37@风起'), jing: r('line39@惊'), qing: r('line44@清'), zhuo: r('line44@浊') });
  const S = (rows) => spline(rows.map(([b, ...v]) => [B(b), ...v]));
  // 锦鲤沿河的一路（A9 化形 → A10 → B11 跃出前），在水下 0.3 米
  KOI.river = S([[57.9, 0, -0.6, 22], [58.5, 0.2, -0.35, 22.8], [59.2, 0.3, -0.05, 24], [60, 0.2, -0.02, 26.5], [60.9, 0.3, -0.06, 29.5], [61.5, 0.5, -0.3, 33], [62, 0.2, -0.4, 37.5], [63, 0.1, -0.45, 48], [64, 0.4, -0.45, 55], [65, 0.2, -0.45, 62]]);
  // A9 的机位见 camA9（跟着锦鲤的眼睛算，不写关键帧）
  // A10 红伞巷（自己一套坐标，jz_town.js 的 LN）：锦鲤在水巷里游，bar70.1「落」甩尾，bar71.7 跃进水门下的大灯笼（中心 y 2.6、z 63.4）
  KOI.lane = S([[65, 0.3, -0.35, 3.5], [66, -0.4, -0.3, 11], [67, 0.5, -0.3, 19], [68, -0.4, -0.3, 26.5], [69, 0.4, -0.3, 34], [69.8, 0, -0.25, 40.5], [70.1, 0.3, -0.15, 43], [70.6, -0.2, -0.3, 47], [71, 0.2, -0.3, 52], [71.4, 0, -0.2, 57.5], [71.7, 0, 1.4, 61.8], [71.95, 0, 2.6, 63.4]]);
  // 机位：正下方看那把接月亮的伞 → 低头看巷子 → 进廊下侧面横移 →（L）冲到水线上（半水半天）→ 出水、看水门 → 小鱼群迎面扫过
  CAM.lane = S([[65, 0, 0.6, 6, 0, 1.5698, 1250], [65.6, 0.2, 0.9, 7.5, 0.1, 0.7, 1250], [66.3, -0.6, 1.4, 11, 0.35, 0.0, 1250], [66.9, -1.6, 1.3, 16, 0.6, -0.05, 1000], [67.5, -1.6, 0.9, 19.5, 0.75, 0.04, 800], [68.9, -1.6, 0.9, 30, 0.75, 0.04, 800],
    [69.5, -1.5, 0, 36, 0.8, 0, 1250], [70.9, -1.5, 0, 46, 0.8, 0, 1250], [71.3, -0.8, 0.9, 48.5, 0.25, 0.06, 1250], [71.8, -0.3, 1.2, 50.5, 0.05, 0.1, 1250], [72.4, 0, 1.2, 52, 0, 0.1, 1250], [72.95, 0, 1.2, 53, 0, 0.1, 1250]]);
  laneP = []; { let zi = -20; for (let t = B(64.5); t < B(72) && zi <= 64; t += 0.02) { const z = KOI.lane(t)[2]; while (zi <= 64 && z >= zi) laneP[zi++ + 20] = t; } }
  // B11–B12：从 B11 的末尾接（位置、速度都接上）→ 掠过水面、钻一下水、跃过第二座桥（z 200）→ 一路升到镇子上空 30 米，bar78.2 分身成鱼群（这时锦鲤藏起来，鱼群的漩涡中心沿这条线慢慢往下）→ bar80.4 收回一条 → 扎进河里（z 249，那里漂着荷叶）
  const kb = (b) => [b, ...b11Pos(B(b))], cb = (b) => [b, ...b11Cam(B(b))];
  KOI.b12 = S([kb(74.8), kb(75), [75.5, 0, 1.2, 181], [75.9, 0.3, -0.2, 186], [76.3, 0.2, 2.5, 192], [76.65, 0, 7.5, 198], [76.95, 0, 9.2, 202.5], [77.5, -0.4, 14, 212], [78, 0, 21, 224], [78.2, 0, 24, 230], [80.4, 0, 16, 236], [80.6, 0, 7.6, 241], [80.9, 0, 3.0, 246.5], [81.05, 0, -0.6, 249]]);
  // 机位：从 B11 的末尾接 → 降到第二座桥前的水面上，仰拍锦鲤跃过桥 →（L）冲上 30 米看全镇和鱼群漩涡 → 跟着收回的锦鲤俯冲到水面（C 接水下）
  CAM.b12 = S([cb(74.8), cb(75), [75.7, 1.2, 1.4, 176, 0, 0.05, 1180], [76.3, 1.6, 0.45, 186, -0.08, 0.38, 1150], [76.7, 1.6, 0.5, 189, -0.12, 0.6, 1100], [77, 1.6, 1.8, 190, -0.1, 0.55, 1100], [78, 6, 30, 186, -0.08, -0.3, 1050], [78.8, 4, 36, 212, -0.1, -0.68, 950],
    [79.6, 3, 30, 218, -0.05, -0.55, 1000], [80.6, 0.5, 7, 232, 0, -0.2, 1150], [80.9, 0, 3.5, 237.5, 0, -0.3, 1250], [81.0, 0, 0.4, 243.5, 0, -0.48, 1250]]);
  // C13 水下
  // C13 荷塘（自己一套坐标）：扎进水里 → 贴着水面在荷梗间穿（顶起荷叶）→ 沉下去（鳞片微距）→ 往红荷那儿浮 → bar87.5 逆风跃出，飞向镇子
  KOI.pond = S([[80.95, 0, 0.6, -6.5], [81.05, 0, -0.5, -4], [81.6, 0.6, -0.8, -1], [82.3, -0.8, -0.5, 2.5], [83, 0.7, -0.45, 6], [83.7, -0.5, -0.5, 9.5], [84.4, 0.3, -0.8, 12.5], [85.2, -0.2, -0.9, 15.5], [86, 0.4, -0.7, 19], [86.6, 0, -0.4, 22], [87, 0, -0.25, 25], [87.5, 0, 0.6, 28.5], [88, 0.5, 3.5, 34], [88.5, 1.0, 6.5, 42], [89, 1.2, 9, 52]]);
  CAM.pond = S([[81, 0, -0.35, -8, 0, -0.12], [81.6, -1.5, -1.0, -4.8, 0.42, 0.18], [82.5, -0.6, -1.3, -1, 0.1, 0.38],   // bar81.6 往左让开（用户 2026-11-20：鱼扎下水身子变长——镜头贴在它正后方，身子压成一团、尾鳍贴着镜头拉成长条）：3/4 侧后方看它扎下去 [83.3, -1.2, -1.3, 4, 0.4, 0.35], [84, -3.0, -1.0, 9.8, 1.1, 0.08], [84.6, -3.4, -1.0, 12.4, 1.2, 0.08], [85.2, -3.3, -1.1, 14.6, 1.0, 0.25], [85.8, -2.6, -1.2, 15.6, 0.85, 0.42], [86.3, -1.4, -0.8, 18, 0.35, 0.3], [86.9, -0.1, -0.2, 21.8, 0, 0.16],
    [87, 0, 0.12, 23, 0, 0.18], [87.4, -0.3, 0.35, 24.5, 0, 0.06], [88, -0.5, 1.2, 27, 0.02, 0.08], [88.9, -0.3, 3.0, 31, 0.03, 0.12]]);
  pondP = []; { let zi = -10; for (let t = B(80.9); t < B(87.6) && zi <= 40; t += 0.02) { const z = KOI.pond(t)[2]; while (zi <= 40 && z >= zi) pondP[zi++ + 10] = t; } }
  // 「风起」：出水贴水看街，锦鲤逆风跃出、往右岸屋顶上冲
  KOI.wind = S([[87, 0.2, -0.4, 279], [87.6, 0.5, 0.6, 283], [88.3, 2.4, 4.6, 287], [89, 5.0, 9.8, 291], [89.5, 6.5, 11.2, 295], [90, 8.5, 11.2, 300], [90.5, 8.8, 10.9, 306], [91, 8, 11, 311],
    [91.5, 3, 14, 315], [92, -8.5, 11, 319], [92.5, -3, 14.5, 323], [93, 8.5, 11, 327], [93.5, 3, 15, 331], [94, -8.5, 11.2, 335], [95, 0, 18, 341], [96, 0, 26, 346], [97, 0, 34, 351]]);
  CAM.wind = S([[87, -0.2, 0.22, 269.6, 0, 0.42], [87.4, -0.1, 0.6, 271, 0, 0.14], [88.2, 0.4, 2.0, 276, 0.12, 0.2], [89, 1.5, 6.5, 281, 0.22, 0.22], [89.6, 2.5, 12, 287, 0.12, -0.12], [90.5, 3.5, 13, 296, 0.05, -0.2], [91, 5.0, 13.5, 303.5, 0.0, -0.26],
    [91.8, 10.5, 13.0, 315, -0.3, -0.45]]);   // bar91 不减速（用户 2026-11-20：镜头卡了一下——原来这里慢到 4 米/秒，切过去一下冲到 25）：已经往锦鲤那边加速，t_pov 从这里接着贴上去
  // D14：t_roof 沿用 KOI.wind、CAM.wind（bar89–91）；t_pov 锦鲤从右岸屋顶扑下来，贴着灯笼串底下沿河冲（镜头就是它的眼睛）；t_spout 它在河心（z 425）打旋，卷起水龙卷，坐着水龙卷升上去
  KOI.pov = S([[90.6, 8.3, 10.9, 307], [91, 8, 11, 311], [91.4, 3.5, 5, 318], [91.8, 0.5, 3.6, 326], [92.4, -1.2, 3.4, 337], [93, 1.0, 3.9, 348], [93.6, -0.8, 3.3, 359], [94, 0, 2.2, 367], [94.4, 0, 0.6, 378]]);
  CAM.spout = S([[93.6, -0.8, 3.3, 359, 0, 0.05, 1250], [94.2, 0, 7, 366, 0, -0.05, 1150], [95, 5, 13, 393, 0.04, 0.02, 1050], [96, 6, 19, 400, 0.02, 0.28, 1000], [96.95, 5, 22, 405, 0.04, 0.45, 1050]]);
  // 尾声 t_sky1：从水龙卷顶上（y 35）接着往前、往上游，镜头跟在后下方，灯海里越来越亮
  // 拐到字板前，bar97.95–100.5 写「祥」（笔里每米一样快，抬笔那段按 0.6 算时间），写完从字底下往右下一甩、尾巴一扬再往左下扎（接龙门：扎进潭里）
  { const T0 = B(97.95), T1 = B(100.5), rows = []; let len = 0, last = null; for (const stk of XSTK) stk.forEach(([u, v], i) => { const p = xw(u, v); if (last) len += Math.hypot(p[0] - last[0], p[1] - last[1]) * (i ? 1 : 0.6); last = p; });
    let tt = T0; last = null; XI = []; for (const stk of XSTK) { stk.forEach(([u, v], i) => { const p = xw(u, v); if (last) tt += Math.hypot(p[0] - last[0], p[1] - last[1]) * (i ? 1 : 0.6) * (T1 - T0) / len; rows.push([tt, ...p]); last = p; if (!i) XI.push([tt]); }); XI[XI.length - 1].push(tt); }
    KOI.sky = spline([[B(96.6), 0, 34, 425], [B(97.2), 2, 36, 432], [B(97.6), 0.5, 42.5, 440], ...rows, [T1 + 0.25 * R.bl, ...xw(0.75, 1.25)], [B(101), 5, 39.5, 447], [B(101.3), 3.5, 38, 447.5], [B(101.6), 2, 35.5, 448], [B(101.8), 1, 33, 448.5]]);   // 甩完尾巴一扬，再往左下扎（龙门那一镜接着就是扎进潭里，画面上同一条路）
    XSMP = XI.map(([a, b]) => { const o = []; for (let e = a; e < b + 1 / 240; e += 1 / 120) { const p = KOI.sky(Math.min(e, b)); o.push([Math.min(e, b), (p[0] - XC[0]) / XS + 0.45, 0.5 - (p[1] - XC[1]) / XS]); } return o; }); }
  // 镜头：从水龙卷脚下跟着升上去，到字板前 18 米慢慢推（行距按减速排，不冲过头再退）
  CAM.sky = S([[96.95, 5, 22, 405, 0.04, 0.45, 1050], [97.5, 2.5, 33, 417, 0.02, 0.25, 1080], [97.8, 1.2, 39, 422.5, 0.01, 0.1, 1090], [98.1, 0.4, 41.6, 425.4, 0, 0.05, 1100], [98.5, 0.15, 42.3, 426.4, 0, 0.035, 1110],
    [99.2, 0.05, 42.6, 427.4, 0, 0.03, 1120], [100.5, 0, 43, 429.3, 0, 0.025, 1150], [101.6, 0, 43.3, 431, 0, 0.025, 1150]]);
  // 尾声「鲤跃龙门化龙」（龙门的世界自己一套坐标，jz_town.js 的 GT：瀑布面 z 26、水口 y 20、牌坊 z 28、屋脊 y 31.4）。
  // 锦鲤从天上扎进潭里 → 贴着瀑布之字形往上冲（路线微微往瀑布里斜，背朝镜头）→ 在牌坊前跃起、越过屋脊、挡住月亮 → 化成龙往上、往镜头这边盘过来
  // → bar108 起（用户 2026-11-20：龙一直往上飞到宇宙）从月亮前面往上冲出灯海 → bar111.8 起沿 DIR 越飞越快、身子左右摆 → bar118.2 起拐进一个正对镜头的圈，绕着星系的核（当龙珠）盘
  CAM.gate = S([[101, 0, 6, -30, 0, 0.16, 1150], [102.5, 0, 4.5, -16, 0, 0.3, 1200], [104, 0, 4, -8, 0, 0.5, 1250], [105, 0, 5, -3, 0, 0.72, 1450], [106, -1, 7, 0, -0.06, 0.9, 1500], [107, -2, 10, 3, -0.12, 1.0, 1250], [108.5, -2, 14, 5, -0.05, 1.05, 1100]]);
  // 龙门转场（用户 2026-11-20：转场时鱼和上一个画面的位置不在同一个地方）：灯笼擦过去那 0.8 秒（到 bar101.4）里，锦鲤在画面上的位置、大小和 t_sky1 里一样——
  // 按它在 t_sky1 画面上的位置和远近（远近按两边的身长、焦距换算），从龙门的镜头反推回世界坐标；擦完它从那儿往左一拐、扎进潭里（入水时刻 R.gateIn，水花在 t_gate 的 fx）
  const unproj = (c, sx, sy, d) => { const x1 = (sx - c.ox) * d / c.f, y2 = (c.oy - sy) * d / c.f, dy = y2 * c.cp + d * c.sp, z1 = -y2 * c.sp + d * c.cp; return [c.x + x1 * c.cy + z1 * c.sy, c.y + dy, c.z - x1 * c.sy + z1 * c.cy]; };
  const gateIn = () => [100.9, 101, 101.1, 101.2, 101.3, 101.4].map(b => { const cs = camOf(CAM.sky, B(b)), q = T.toC(cs, ...KOI.sky(B(b))), s = T.scr(cs, q), cg = camOf(CAM.gate, B(b)); return [b, ...unproj(cg, s[0], s[1], q[2] * (4 / 2.4) * (cg.f / cs.f))]; });
  KOI.gate = S([...gateIn(), [101.8, -0.3, 0.2, 12], [102.3, 0.8, 0.5, 22.3], [102.8, 0, 2.5, 25.0], [103.3, -1.6, 6.5, 25.2], [103.8, 1.4, 10.5, 25.4], [104.3, -1.2, 14.5, 25.6], [104.7, 0.4, 19.0, 25.4],
    [105, 0, 27.5, 25.0], [105.3, 0, 34, 25.8], [105.6, 0, 38, 27.8], [106, -2.5, 43, 29], [106.5, -8, 49, 26], [107, -13, 54, 19], [107.6, -12, 60, 10], [108.2, -4, 66, 4], [108.8, 2, 75, 8], [109.4, 6, 86, 14],
    [110, 5, 99, 22], [110.6, 1, 113, 32], [111.2, -3, 128, 43], [111.8, -5, 144, 56], ...spaceRows()]);
  // 飞了多远（星尘、星云团、行星、星系按它往后流）：速度按小节排，0.01 秒一步积出来；bar114.2–116.3 每秒 2600 米是穿梭
  { const VR = [[110.4, 0], [111.2, 40], [112, 220], [113.5, 360], [114.2, 2600], [116.3, 2600], [117.2, 700], [117.8, 120], [118.5, 40], [119.5, 15], [125, 15]];
    const vAt = (b) => { for (let i = 1; i < VR.length; i++) if (b <= VR[i][0]) return lerp(VR[i - 1][1], VR[i][1], sm(VR[i - 1][0], VR[i][0], b)); return 15; };
    const OFF = [], t0 = B(110.4); let o = 0; for (let i = 0; t0 + i * 0.01 <= B(125); i++) { OFF.push(o); o += vAt(57 + (t0 + i * 0.01 - R.b57) / R.bl) * 0.01; }
    SP.off = (tt) => { const x = (tt - t0) / 0.01; if (x <= 0) return 0; const i = Math.min(OFF.length - 2, Math.floor(x)); return lerp(OFF[i], OFF[i + 1], Math.min(1, x - i)); };
    SP.v = (tt) => vAt(57 + (tt - R.b57) / R.bl);
    // 星系：最后在圈心正前方 3600 米（镜头、圈心、核在一条线上，核就是龙珠），盘面和视线斜 55°
    const D = SP.D, U = SP.U, g = [0, 1, 2].map(j => SP.Cc[j] + D[j] * (3600 + SP.off(B(121))));
    SP.gal = { c: g, n: nrm3([0, 1, 2].map(j => D[j] * 0.57 + U[j] * 0.82)), r: 2600 };
 }
  // 锦鲤每米经过的时刻（灯、红绸按它亮、铺开）
  passZ = []; let zi = 0; for (let t = B(57.9); t < B(73) + 1 && zi <= 160; t += 0.02) { const z = KOI.river(t)[2]; while (zi <= 160 && z >= zi) passZ[zi++] = t; }
};
const pondPass = (z) => pondP[Math.floor(z) + 10] ?? 1e9;   // 荷塘里锦鲤经过 z 的时刻
const lanePass = (z) => z < -20 ? B(64.5) : (laneP[Math.floor(z) + 20] ?? 1e9);   // 红伞巷里锦鲤经过 z 的时刻
const passAt = (z) => z < 22 ? B(57.9) : (passZ[Math.floor(z)] ?? 1e9);

// ---------------- 全片共用：灯、红绸、绣球、河灯、孔明灯、屋瓦、风 ----------------
const lit = (x, y, z, t) => { let k = 0;
  if (t >= B(60.5) && Math.abs(z - 48) < 6) k = sm(0, 0.6, t - B(60.5) - Math.abs(x) / 25);   // 第一座桥的灯：瞳孔里倒映着它亮起（bar60.5），柳条扫过后看到
  return Math.max(k, sm(0, 0.35, t - B(73) - 0.4 - (Math.abs(z - 158.2) + 0.3 * Math.abs(x)) / 48)); };
const litM = (x, y, z, t) => t < B(65) ? Math.max(lit(x, y, z, t), z < 70 ? 0.9 * sm(0, 0.6, t - passAt(z) - 0.25 - Math.abs(x) / 30) : 0) : lit(x, y, z, t);   // A9：水里的倒影先亮
const zLuo = () => KOI.river(R.luo)[2];
const lotusSt = { a: (L, t) => sm(0, 0.45, t - B(73) - 0.6 - Math.abs(L.z - 158.2) / 45), lit: (L, t) => sm(0, 0.45, t - B(73) - 0.7 - Math.abs(L.z - 158.2) / 45),
  lift: (L, t) => { const t0 = R.qing + 0.15 + L.u * 3.5; return t > t0 ? Math.pow(t - t0, 1.35) * (1.1 + L.s) : 0; }, drift: (L, t) => 4.5 * sm(R.wind - 0.1, R.wind + 3.5, t) };
const skySt = { at: (Lk) => R.qing + 0.4 + (Math.abs(Lk.x) / 180 * 0.5 + Lk.u * 0.5) * 8, a: (Lk, t) => sm(0, 1.2, t - skySt.at(Lk)) };
const base = (t) => ({ lit: (x, y, z) => lit(x, y, z, t), litM: (x, y, z) => litM(x, y, z, t),
  unfurl: (Rb) => { if (t < B(73)) return 0; return sm(-0.2, 1.0, t - B(73) - 0.3 - Math.abs(Rb.z - 158.2) / 40); },   // 河道的灯、红绸、河灯都等 B11 跃出那一刻往两头亮开（A10 在红伞巷）
  ball: (Rb) => sm(0, 0.3, t - R.fire - Math.abs(Rb.z - 241) / 50),
  lotus: t > B(73) ? lotusSt : null, sky: t > R.qing ? skySt : null,
  glint: (X, z) => { const d = t - R.jing - (Math.abs(z - 296) + Math.abs(X)) / 40; let g = d > -0.4 ? Math.exp(-d * d / 0.03) : 0;
    if (t > B(89) && t < B(97)) { const kp = KOI.wind(t); g = Math.max(g, 0.85 * Math.exp(-((X - kp[0]) ** 2 + (z - kp[2]) ** 2) / 30)); } return g; },
  wind: 1 + 1.4 * bump(t, R.fire) + 2.4 * bump(t, R.wind, 0.6, 3, 3), townGlow: sm(B(73), B(74.5), t) });

// ---------------- 效果小件 ----------------
const splash = (ctx, c, p0, d, n, seed, power = 1) => { if (d < 0 || d > 1.6) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const h1 = M0.hash(i, seed), h2 = M0.hash(i, seed + 1), h3 = M0.hash(i, seed + 2), a = h1 * Math.PI * 2, r = Math.sqrt(h2) * 2.4 * power, vy = (2.2 + 5.5 * h3 * h3) * power;
    const at = (dd) => [p0[0] + Math.cos(a) * r * dd, p0[1] + vy * dd - 4.9 * dd * dd, p0[2] + Math.sin(a) * r * dd + 2.5 * dd * power]; const q = at(d); if (q[1] < -0.02) continue;
    const qa = T.proj(c, ...at(Math.max(0, d - 0.018))), qb = T.proj(c, ...q); if (!qa || !qb) continue;
    ctx.strokeStyle = css(T.mx(hx('#fff6e0'), hx('#ffb45a'), h1), (1 - d / 1.6) * (0.55 + 0.45 * h3)); ctx.lineWidth = Math.max(0.8, (0.012 + 0.03 * h2) * qb[2]); ctx.beginPath(); ctx.moveTo(qa[0], qa[1]); ctx.lineTo(qb[0], qb[1]); ctx.stroke(); }
  ctx.restore(); };
const ring = (ctx, c, wp, x, z, d, life = 2.6, R0 = 2.6, a0 = 0.7) => { if (d <= 0 || d > life) return; const Rr = 0.2 + R0 * Math.pow(d, 0.6), a = (1 - d / life) * a0; ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const an = i / 40 * Math.PI * 2, p = T.proj(c, x + Math.cos(an) * Rr, 0.01, z + Math.sin(an) * Rr); if (!p) continue; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  ctx.strokeStyle = css(hx('#ffd9a0'), a); const p = T.proj(c, x, 0, z); ctx.lineWidth = p ? Math.max(0.8, p[2] * 0.03) : 1; ctx.stroke(); };
const inWater = (ctx, wp, fn) => { if (!wp) return; ctx.save(); ctx.beginPath(); ctx.moveTo(wp[0][0], wp[0][1]); for (const p of wp) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip(); fn(); ctx.restore(); };
// 锦鲤在水下游：水面上拖一串涟漪（尾迹）
const wake = (ctx, c, wp, k, t, from) => inWater(ctx, wp, () => { const st = 0.2; for (let e = Math.ceil(Math.max(from, t - 2.2) / st) * st; e <= t; e += st) { const p = k.pos(e); if (p[1] < -0.9) continue; ring(ctx, c, wp, p[0], p[2], t - e, 2.2, 1.3, 0.35); } });
const sparks = (ctx, c, k, t, from, life = 1.2, seed = 3, rate = 90, spread = 0.9, to = Infinity) => { ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let e = Math.ceil(Math.max(from, t - life) * rate) / rate; e <= Math.min(t, to); e += 1 / rate) { const idx = Math.round(e * rate), age = t - e, h1 = M0.hash(idx, seed), h2 = M0.hash(idx, seed + 1), h3 = M0.hash(idx, seed + 2);
    const p0 = K.tail(k, e), p = [p0[0] + (h1 - 0.5) * spread * age, p0[1] + (0.3 + 0.5 * h2) * age, p0[2] + (h3 - 0.5) * spread * age], q = T.proj(c, ...p); if (!q) continue;
    const Rr = Math.min(7, Math.max(1.2, (0.03 + 0.05 * h2) * q[2] * (k.L / 2.4))) * (1 - age / life * 0.6); ctx.globalAlpha = (1 - age / life) * 0.9;
    ctx.drawImage(T.glowSpr('spk', h1 > 0.5 ? [255, 210, 120] : [255, 120, 50], 0.2), q[0] - Rr * 2, q[1] - Rr * 2, Rr * 4, Rr * 4); }
  ctx.restore(); };
const bubbles = (ctx, c, k, t, from) => { ctx.save(); for (let e = Math.ceil(Math.max(from, t - 4) / 0.12) * 0.12; e <= t; e += 0.12) { const idx = Math.round(e / 0.12), h1 = M0.hash(idx, 61), h2 = M0.hash(idx, 62); if (h1 > 0.45) continue;
    const p0 = k.pos(e), age = t - e, y = p0[1] + 0.55 * age; if (y > -0.02) continue; const q = T.proj(c, p0[0] + 0.12 * Math.sin(age * 5 + idx), y, p0[2] + (h2 - 0.5) * 0.3); if (!q) continue;
    const r = Math.max(1, (0.015 + 0.03 * h2) * q[2]); if (r > 22) continue; ctx.strokeStyle = 'rgba(210,245,255,0.6)'; ctx.lineWidth = Math.max(0.6, r * 0.25); ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(q[0] - r * 0.4, q[1] - r * 0.5, r * 0.35, r * 0.35); }
  ctx.restore(); };
// 前景划过（F）：一样东西在画面上横着扫过，k 0..1 是扫的进度；叠一层模糊（离镜头很近，虚的）
const sweep = (ctx, k, draw, f = 'blur(6px)') => { if (k <= 0 || k >= 1) return; ctx.save(); ctx.filter = f; draw(ctx, 2300 - 3000 * k); ctx.filter = 'none'; ctx.restore(); };
const lotusSweep = (ctx, k) => sweep(ctx, k, (g, x) => { g.globalAlpha = 0.95; g.drawImage(T.lotusSpr(0), x - 700, 120, 1400, 1050); }, 'blur(6px) brightness(0.55)');
const silkSweep = (ctx, k) => sweep(ctx, k, (g, x) => { g.beginPath(); g.moveTo(x - 500, -50); g.bezierCurveTo(x + 200, 300, x - 300, 700, x + 300, 1150); g.lineTo(x + 900, 1150); g.bezierCurveTo(x + 300, 700, x + 800, 300, x + 100, -50); g.closePath();
  const gr = g.createLinearGradient(x - 500, 0, x + 900, 0); gr.addColorStop(0, '#6e0a22'); gr.addColorStop(0.45, '#d61f3a'); gr.addColorStop(0.6, '#ff8c86'); gr.addColorStop(1, '#8a1028'); g.fillStyle = gr; g.fill(); });
const lanternSweep = (ctx, k) => sweep(ctx, k, (g, x) => { g.drawImage(T.skySpr(), x - 380, -140, 760, 1140); }, 'blur(6px) brightness(0.3)');

const SH = {};
// ===== A9 bar57–64：那一点光落进河心（正上方俯拍），化成锦鲤；推到鱼眼，瞳孔里亮起第一盏灯；侧面贴水跟着它游，穿过桥洞，抬头看月亮 =====
const koiRiver = (t) => ({ L: 2.4, pos: KOI.river, freq: 1.4, amp: 1, reflect: true, under: 0.75, glow: t < B(58.9) ? 1 + 2.5 * (1 - sm(B(58), B(58.9), t)) : 1 - 0.65 * sm(B(59.6), B(60.2), t) * (1 - sm(B(60.9), B(61.4), t)), alpha: sm(B(57.95), B(58.7), t),
  finK: sm(B(58.3), B(59.5), t), eyeLight: sm(B(60.35), B(60.7), t),
  emit: (s) => { const w = (t - B(58.1)) / (B(59.3) - B(58.1)); return Math.max(0.45 * (1 - sm(B(58), B(58.7), t)), w > -0.3 && w < 1.4 ? 0.85 * Math.exp(-(((s - w) / 0.09) ** 2)) : 0); } });   // 化形：光从头扫到尾，鳍展开
const fallY = (t) => { const u = clamp((t - B(57)) / (B(57.9) - B(57))); return 48 * (1 - u * u); };   // 那一点光从镜头下面 7 米往下掉，一直在画面正中（H：接 E8 卷回的那一点）
// 机位：俯拍（55 → 14 米，慢慢转正）→ 绕下来推到锦鲤左眼前 0.3 米 → 拉开成侧面贴水横移 → 过桥洞后抬头、拉长焦，月亮停在画面正中（E 接红伞）
const camA9 = (t) => { const k = koiRiver(t), e = K.eye(k, t, 1), kc = K.center(k, t);
  const tgt = mix3(mix3([0, 0, 22], e.p, sm(B(58.2), B(59), t)), kc, sm(B(60.85), B(61.4), t));
  const w12 = sm(B(59), B(60.3), t), w23 = sm(B(60.85), B(61.4), t), dir = nrm3(mix3(mix3([0, 1, 0], e.n, w12), nrm3([-1, 0.14, -0.6]), w23));
  const Rd = t < B(59) ? lerp(55, 14, Math.pow(sm(B(57), B(59), t), 0.8)) : w23 > 0 ? lerp(0.3, 2.9, w23) : Math.exp(lerp(Math.log(14), Math.log(0.3), w12));
  const pos = [tgt[0] + dir[0] * Rd, Math.max(tgt[1] + dir[1] * Rd, 0.08 + 0.27 * w23), tgt[2] + dir[2] * Rd], lk = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]], hz = Math.hypot(lk[0], lk[2]), hf = hz / (Math.hypot(hz, lk[1]) || 1);
  const yawTop = lerp(1.05, Math.PI / 2, sm(B(57), B(59), t)), yawL = Math.atan2(lk[0], lk[2]); let yaw = hf < 0.3 ? lerp(yawTop, yawL, hf / 0.3) : yawL, pitch = Math.max(-Math.PI / 2 + 1e-3, Math.atan2(lk[1], hz)), f = 1250;
  const m = sm(B(63.4), B(64.9), t); if (m > 0) { yaw = lerp(yaw, 0.42, m); pitch = lerp(pitch, 0.5, m); f = lerp(1250, 2600, m * m); }
  return T.cam({ x: pos[0], y: pos[1], z: pos[2], yaw, pitch, f }); };
// 前景划过（F）：柳条
const willowSweep = (ctx, k) => sweep(ctx, k, (g, x) => { g.strokeStyle = 'rgba(8,18,22,0.92)'; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const x0 = x - 700 + i * 110 + 40 * Math.sin(i * 2.1), w = 5 + 9 * ((i * 0.37) % 1); g.lineWidth = w; g.beginPath(); g.moveTo(x0, -60); g.bezierCurveTo(x0 + 60, 300, x0 - 50, 700, x0 + 30, 1150); g.stroke();
    for (let j = 0; j < 14; j++) { const yy = 40 + j * 80, xx = x0 + 30 * Math.sin(yy / 260 + i); g.lineWidth = w * 0.8; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + (j % 2 ? 26 : -26), yy + 34); g.stroke(); } } }, 'blur(5px)');
const a9 = (s) => { const t = s.t, tS = B(57.9), k = koiRiver(t), st = base(t);
  return { ...st, cam: camA9(t), koi: t > B(57.95) ? [k] : [], fog: 1, waves: 0.8, moonR: 1 + 4 * sm(B(63.6), B(64.95), t),
    fx: (ctx, c, wp) => {
      const dk = 1 - sm(B(57), B(58.2), t); if (dk > 0) { ctx.save(); ctx.fillStyle = `rgba(2,3,10,${0.92 * dk})`; ctx.fillRect(0, 0, 1920, 1080); ctx.restore(); }   // 接 E8 的黑夜，慢慢亮成靛蓝
      if (t < tS + 0.05) { const p = T.proj(c, 0, fallY(t), 22), gs = 1 + 1.4 * (1 - sm(B(57), B(57.6), t)); if (p) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(T.glowSpr('fallc', [255, 244, 220], 0.3), p[0] - 26 * gs, p[1] - 26 * gs, 52 * gs, 52 * gs);   // gs：接宇宙那一粒光的大小，落下去慢慢变小
        ctx.globalAlpha = 0.55; ctx.drawImage(T.glowSpr('fallh', [255, 200, 130], 0.12), p[0] - 110 * gs, p[1] - 110 * gs, 220 * gs, 220 * gs); ctx.restore(); } }
      const d = t - tS; if (d > 0) { inWater(ctx, wp, () => { for (let n = 0; n < 5; n++) ring(ctx, c, wp, 0, 22, d - n * 0.3, 2.4, 4.5, 0.8); }); splash(ctx, c, [0, 0, 22], d, 70, 7, 0.55);
        const p = T.proj(c, 0, -0.4, 22); if (p) { const gk = Math.exp(-d * 1.1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * gk; ctx.drawImage(T.glowSpr('birth', [255, 190, 110], 0.15), p[0] - p[2] * 2.2, p[1] - p[2] * 1.6, p[2] * 4.4, p[2] * 3.2); ctx.restore(); } }
      if (t > B(58.3)) wake(ctx, c, wp, k, t, B(58.3));
      willowSweep(ctx, (t - B(60.85)) / (B(61.2) - B(60.85))); } };
};
SH.t_fall = SH.t_eye = SH.t_side = SH.t_arch = a9;
// ===== A10 bar65–72：红伞巷。月亮叠化成头顶一把红伞（E）→ 低头，满巷红伞 → 廊下侧面横移，锦鲤游过的地方灯先亮、头顶的伞转一圈 →（L）半水半天，「落」一甩尾掀起一片弧形水幕 →
// 跃进水门下的大灯笼（纸上透出它的影子），灯笼化成光屑、光屑化成一群小鱼，迎面从镜头前扫过（F 接 B11）=====
const koiLane = (t) => ({ L: 2.4, pos: KOI.lane, freq: 1.5, amp: 1, reflect: false, under: 0.75, glow: 1, alpha: 1 - sm(B(71.75), B(71.9), t) });
const fishSpr = () => M0.cached('tfish', 96, 40, (g) => { const gr = g.createLinearGradient(8, 0, 70, 0); gr.addColorStop(0, '#fff4e0'); gr.addColorStop(0.35, '#ff6a2a'); gr.addColorStop(1, '#d01a20'); g.fillStyle = gr; g.beginPath(); g.ellipse(46, 20, 30, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,240,225,0.9)'; g.beginPath(); g.ellipse(38, 17, 9, 5, 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,170,110,0.75)'; g.beginPath(); g.moveTo(18, 20); g.quadraticCurveTo(4, 4, 0, 6); g.quadraticCurveTo(8, 20, 0, 34); g.quadraticCurveTo(4, 36, 18, 20); g.fill();
  g.fillStyle = '#1a0606'; g.beginPath(); g.arc(68, 18, 2.2, 0, Math.PI * 2); g.fill(); }, true);
const BIG = [0, 2.6, 63.4];   // 水门下大灯笼的中心
const bez = (P0, P1, P2, P3, u) => { const v = 1 - u; return [0, 1, 2].map(i => v * v * v * P0[i] + 3 * v * v * u * P1[i] + 3 * v * u * u * P2[i] + u * u * u * P3[i]); };
const fishAt = (i, t) => { const h = (k) => M0.hash(i, 601 + k), a = h(0) * 6.283, b = Math.acos(2 * h(1) - 1), dir = [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)], P0 = [BIG[0] + dir[0] * 1.1, BIG[1] + dir[1] * 1.3, BIG[2] + dir[2] * 1.1];
  const off = [(h(2) - 0.5) * 3.2, (h(3) - 0.5) * 1.8], P1 = [P0[0] + dir[0] * 2.5, P0[1] + dir[1] * 1.5, P0[2] - 3], P2 = [off[0], 1.2 + off[1], 58], P3 = [off[0] * 1.6, 1.2 + off[1] * 1.6, 48];
  const u = clamp((t - B(72.35) - 0.3 * h(4)) / (1.15 + 0.25 * h(5))); return { u, p: bez(P0, P1, P2, P3, Math.pow(u, 1.25)), q: bez(P0, P1, P2, P3, Math.pow(Math.min(1, u + 0.02), 1.25)) }; };
// 半水半天（用户 2026-11-19：水的颜色变得太快）：镜头往下沉时水线从画面底升到中间，出水时再降回去，不一下切成水下
const lane = (s) => { const t = s.t, k = koiLane(t), c = camOf(CAM.lane, t), splitK = Math.min(sm(B(69.25), B(69.6), t), 1 - sm(B(70.75), B(71.05), t)), split = splitK > 0; if (splitK >= 1) c.y = 0;
  const laneLit = (z) => Math.max(Math.abs(z - 6) < 2.5 ? sm(B(64.9), B(65.05), t) : 0, sm(0, 0.5, t - lanePass(z - 7)));
  const d = t - R.luo, P0 = K.tail(k, R.luo);
  return { world: 'lane', lit: () => 1, cam: c, koi: [k], split, splitK, laneLit, spin: (z) => 6.283 * sm(0, 1.4, t - lanePass(z)), townGlow: 0.4, bloom: 0.55,
    // 大灯笼：锦鲤跃进去时更亮、纸上透出它的影子；bar72 化成光屑
    big: (ctx, c) => { const p = T.proj(c, ...BIG); if (!p) return; const a = 1 - sm(B(72.02), B(72.3), t), w = 2.2 * p[2], h = w * 200 / 120, hot = sm(B(71.6), B(71.9), t) * (1 - sm(B(72), B(72.3), t)); if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.drawImage(T.lanSpr(1), p[0] - w / 2, p[1] - h * 82 / 200, w, h);
      const ins = sm(B(71.85), B(71.95), t) * (1 - sm(B(72.0), B(72.08), t)); if (ins > 0) { ctx.beginPath(); ctx.ellipse(p[0], p[1], w * 0.36, w * 0.42, 0, 0, 6.283); ctx.clip(); ctx.translate(p[0], p[1]); ctx.rotate(0.4 * Math.sin(t * 5)); ctx.fillStyle = `rgba(90,10,10,${0.55 * ins})`;
        ctx.beginPath(); ctx.ellipse(0, 0, w * 0.22, w * 0.07, 0, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.moveTo(-w * 0.2, 0); ctx.quadraticCurveTo(-w * 0.32, -w * 0.12, -w * 0.38, -w * 0.1); ctx.quadraticCurveTo(-w * 0.3, 0, -w * 0.38, w * 0.1); ctx.quadraticCurveTo(-w * 0.32, w * 0.12, -w * 0.2, 0); ctx.fill(); }
      ctx.restore(); T.glow(p[0], p[1], p[2] * 1.6, T.glowSpr('lanc', [255, 241, 184]), (0.6 + 0.4 * hot) * a); T.glow(p[0], p[1], p[2] * 5, T.glowSpr('lan', [255, 90, 34]), (0.45 + 0.25 * hot) * a); },
    fx: (ctx, c, wp) => {
      // 「落」：一甩尾掀起一片弧形的水珠帘（沿一段弧线往外、往上甩出几百颗水珠，按抛物线飞起落下），底下一层很淡的水膜，映着红伞
      if (d > 0 && d < 2.4) { ctx.save(); const film = []; for (let j = 0; j <= 16; j++) { const ph = -1.5 + 3 * j / 16, hc = 1.9 * Math.sin(Math.PI * clamp(d / 1.5)) * (0.7 + 0.3 * Math.cos(ph)), ro = 0.5 + 1.2 * (1 - Math.exp(-d * 2.5)); film.push([T.proj(c, P0[0] + ro * Math.cos(ph), 0, P0[2] + ro * Math.sin(ph)), T.proj(c, P0[0] + (ro + 0.25 * hc) * Math.cos(ph), hc, P0[2] + (ro + 0.25 * hc) * Math.sin(ph))]); }
        for (let j = 0; j < 16; j++) { const [a0, a1] = film[j], [b0, b1] = film[j + 1]; if (!a0 || !a1 || !b0 || !b1) continue; const g = ctx.createLinearGradient(a0[0], a0[1], a1[0], a1[1]); g.addColorStop(0, 'rgba(210,230,255,0.04)'); g.addColorStop(1, 'rgba(255,215,210,0.16)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(a1[0], a1[1]); ctx.closePath(); ctx.fill(); }
        ctx.lineCap = 'round'; for (let i = 0; i < 420; i++) { const h1 = M0.hash(i, 611), h2 = M0.hash(i, 612), h3 = M0.hash(i, 613), ph = -1.55 + 3.1 * h1, tau = d - 0.25 * h2; if (tau <= 0) continue; const vh = 0.8 + 1.6 * h3, vy = (3.2 + 3.4 * (1 - h3)) * (0.7 + 0.3 * Math.cos(ph)), ro = 0.5 + vh * tau;
          const pt = (u) => [P0[0] + (ro - vh * u) * Math.cos(ph), vy * (tau - u) - 4.9 * (tau - u) * (tau - u), P0[2] + (ro - vh * u) * Math.sin(ph)], q0 = pt(0), q1 = pt(0.035); if (q0[1] < -0.05) continue; const a = T.proj(c, ...q0), b = T.proj(c, ...q1); if (!a || !b) continue;
          ctx.strokeStyle = h2 > 0.8 ? 'rgba(255,205,190,0.45)' : 'rgba(225,238,255,0.4)'; ctx.lineWidth = Math.max(1, (0.025 + 0.03 * h2) * a[2]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        ctx.restore(); }
      // 大灯笼化成光屑（往外飞、慢慢暗），光屑化成小鱼
      const db = t - B(72.02); if (db > 0 && db < 1.2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 220; i++) { const h1 = M0.hash(i, 621), h2 = M0.hash(i, 622), a = h1 * 6.283, b = Math.acos(2 * h2 - 1), r = 1.1 + 3 * (1 - Math.exp(-db * 2.5)) * (0.5 + M0.hash(i, 623));
          const q = T.proj(c, BIG[0] + r * Math.sin(b) * Math.cos(a), BIG[1] + r * Math.cos(b) * 1.2, BIG[2] + r * Math.sin(b) * Math.sin(a)); if (!q) continue; const rr = Math.max(1.5, 0.12 * q[2]); ctx.globalAlpha = 0.8 * (1 - db / 1.2); ctx.drawImage(T.glowSpr('spk', h1 > 0.5 ? [255, 210, 120] : [255, 110, 60], 0.2), q[0] - rr * 2, q[1] - rr * 2, rr * 4, rr * 4); } ctx.restore(); }
      if (t > B(72.35)) { const fs = []; for (let i = 0; i < 70; i++) { const f = fishAt(i, t); if (f.u <= 0 || f.u >= 1) continue; const a = T.proj(c, ...f.p), b = T.proj(c, ...f.q); if (!a || !b) continue; fs.push([a[2], a, b, f.u]); }
        fs.sort((x, y) => x[0] - y[0]); for (const [, a, b, u] of fs) { const w = 0.5 * a[2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), near = sm(150, 700, w); if (w < 2 || w > 1600) continue; ctx.save(); ctx.globalAlpha = sm(0, 0.12, u); ctx.translate(a[0], a[1]); ctx.rotate(ang); if (near > 0) ctx.filter = `blur(${(6 * near).toFixed(1)}px) brightness(${(1 - 0.6 * near).toFixed(2)})`; ctx.drawImage(fishSpr(), -w * 0.7, -w * 0.21, w, w * 0.42); ctx.filter = 'none';   // 贴着镜头的几条是暗的虚影（扫过镜头的前景不能是亮的）
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 * (1 - near); ctx.drawImage(T.glowSpr('fishg', [255, 120, 50], 0.2), -w * 0.6, -w * 0.4, w * 1.2, w * 0.8); ctx.restore(); } } },
    fxUnder: (ctx, c) => { bubbles(ctx, c, k, t, B(69)); } };
};
SH.t_umbr = SH.t_lane = SH.t_split = SH.t_lantern = lane;
// ===== B11 bar73–74：定妆镜。锦鲤从右往左横着跃过河，整条街的灯从它跃出的地方往两头一路亮开；过了最高点不落水，接着飞 =====
// B11 定妆镜：锦鲤从右往左横着跃过河，整条街的灯从它跃出的地方往两头一路亮开；过了最高点不落水，接着往前飞（t_leap 从这里接）
const b11Pos = (tt) => { const t0 = B(73), tb = 0.35, zb = 158.2, vy = 8.2, g = 8.8, vz = 4.6, vx = -3.4, dA = vy / g, l = tt - t0; if (l < tb) { const q = l / tb; return [2.4, -1.0 + 0.55 * q * q, zb - vz * (tb - l)]; } const d = l - tb;
  if (d < dA) return [2.4 + vx * d, -0.45 + vy * d - 0.5 * g * d * d, zb + vz * d]; const e = d - dA, yA = -0.45 + vy * dA - 0.5 * g * dA * dA, x = 2.4 + vx * dA + vx * 0.6 * (1 - Math.exp(-e * 1.5)) / 1.5 * 1.5;
  return [x * Math.exp(-e * 0.5), yA - 0.5 * (1 - Math.exp(-e * 1.2)), zb + vz * dA + vz * e * 1.15]; };
const b11Cam = (t) => { const lt = t - B(73); return [1.2 - 0.6 * sm(1.8, 3.9, lt), 1.0 + 0.35 * sm(0, 1.5, lt) + 2.2 * sm(1.8, 3.9, lt), 150 + 4.4 * lt, -0.06 + 0.04 * sm(1.8, 3.9, lt), 0.04 + 0.2 * sm(0.3, 1.35, lt) - 0.16 * sm(1.6, 3.9, lt), 1180]; };
SH.b11_fly = (s) => { const t = s.t, t0 = B(73), lt = t - t0, tb = 0.35, zb = 158.2, st = base(t);
  const koi = { L: 2.4, pos: b11Pos, freq: 2.0, amp: 1, glow: 1, reflect: true, sag: 0 }, cv = b11Cam(t);
  // 用户 2026-11-20：光太亮（街尽头的灯光晕叠成一道白，泛光再放大）→ 光晕 1 → 0.4、泛光 0.5 → 0.35；t_leap 开头接着用这一档，升到高处再回到 0.65、0.5
  return { ...st, cam: T.cam({ x: cv[0], y: cv[1], z: cv[2], yaw: cv[3], pitch: cv[4], f: cv[5] }), koi: [koi], wind: 1, glowK: 0.4, bloom: 0.35,
    fx: (ctx, c, wp) => { const d = lt - tb; inWater(ctx, wp, () => { for (let n = 0; n < 3; n++) ring(ctx, c, wp, 2.4, zb, d + 0.05 - n * 0.22); }); splash(ctx, c, [2.4, 0, zb], d, 90, 11, 0.6); sparks(ctx, c, koi, t, t0 + tb - 0.05, 1.3); } };
};
// ===== B11–B12 bar75–80：仰拍锦鲤跃过第二座桥 →（L）冲上去看全镇大远景，锦鲤分身成上千条光鲤，在镇子上空卷成漩涡 → 鱼群收回一条；「火」它打一个滚，火星飞到每个绣球上（G），红绸扬起，扎进漂着荷叶的河里（C）=====
const koiAir = (sp) => ({ L: 2.4, pos: sp, freq: 1.8, amp: 1, glow: 1, reflect: true });
const fishSprG = () => M0.cached('tfishg', 96, 40, (g) => { g.drawImage(fishSpr(), 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,200,80,0.55)'; g.fillRect(0, 0, 96, 40); }, true);
const NF = 1100, swarmAt = (i, t) => { const h = (k) => M0.hash(i, 631 + k), so = sm(B(78.2), B(78.95), t), si = sm(B(80.1), B(80.45), t), V = KOI.b12(Math.min(t, B(80.4))), yy = (h(2) - 0.5) * 9 * so, r = (2.5 + 11 * Math.sqrt(h(1))) * (0.55 + 0.6 * (yy / 16 + 0.5)) * so * (1 - si);
  const th = (i % 3) * 2.094 + 0.42 * r + 0.35 * (h(0) - 0.5) + (1.4 + 0.3 * h(3)) / (0.4 + r / 7) * (t - B(78.2)), wob = 0.6 * Math.sin(t * 2 + i); return [V[0] + r * Math.cos(th), V[1] + yy * (1 - si) + wob, V[2] + r * Math.sin(th) * 0.8]; };   // 三条旋臂（离中心越远越往后卷）
const leavesRiver = (items, ctx, c) => { for (let i = 0; i < 46; i++) { const h = (k) => M0.hash(i, 651 + k), C = [(h(0) - 0.5) * 7.2, 0.02, 238 + 26 * h(1)]; if (Math.hypot(C[0], C[2] - 249) < 1.2) continue; const d = T.toC(c, ...C)[2]; if (d < 0.3) continue;
  items.push([d, () => T.leaf(ctx, c, C, [0.04 * Math.sin(i), 1, 0.04 * Math.cos(i)], 0.35 + 0.45 * h(2), h(3) * 6.283, 0.03)]); } };
SH.t_leap = SH.t_swarm = (s) => { const t = s.t, st = base(t), vis = (1 - sm(B(78.1), B(78.3), t)) + sm(B(80.35), B(80.55), t), k = { ...koiAir(KOI.b12), alpha: Math.min(1, vis), glow: (1 - 0.8 * sm(B(80.85), B(81.05), t)) * (1 + 0.6 * sm(B(80.3), B(80.6), t) * (1 - sm(B(80.7), B(81), t))) };   // 收回一条时亮一下（原来 2.5 倍，镜头正贴着它俯冲，审片 157.6 秒算闪）
  k.roll = (tt) => 6.283 * sm(R.fire - 0.3, R.fire + 0.5, tt);
  const hiK = sm(B(76.8), B(77.8), t);   // 贴水那段接 b11_fly 压暗的一档，升到高处看全镇再放开
  return { ...st, glowK: lerp(0.4, 0.65, hiK), bloom: lerp(0.35, 0.5, hiK), cam: camOf((tt) => { const [x, y, ...r] = CAM.b12(tt); return [x, Math.max(0.4, y), ...r]; }, t), koi: vis > 0.01 ? [k] : [], items: leavesRiver,   // C 转场里机位往下延会钻到水下：停在 0.4 米
    fx: (ctx, c, wp) => {
      if (vis > 0.01) sparks(ctx, c, k, t, B(74.5), 1.3);
      // 跃出水面（bar75.9 入水、76.1 出水）的水花和水圈
      const dj = t - B(76.1); if (dj > -0.3) { inWater(ctx, wp, () => { for (let n = 0; n < 3; n++) ring(ctx, c, wp, 0.25, 188.5, dj + 0.3 - n * 0.22); }); splash(ctx, c, [0.25, 0, 188.5], dj, 80, 23, 0.7); }
      // 鱼群：上千条小光鲤卷成漏斗形的漩涡（越往上越宽、越往里转得越快），从锦鲤身上散开、最后收回一条
      if (t > B(78.1) && t < B(80.6)) { const al = sm(B(78.1), B(78.35), t) * (1 - sm(B(80.4), B(80.58), t)), fs = []; for (let i = 0; i < NF; i++) { const p0 = swarmAt(i, t), p1 = swarmAt(i, t + 0.03), a = T.proj(c, ...p0), b = T.proj(c, ...p1); if (!a || !b) continue; fs.push([a[2], a, b, i]); }
        fs.sort((x, y) => x[0] - y[0]); ctx.save(); for (const [, a, b, i] of fs) { const w = 0.55 * a[2]; if (w < 1.5) { ctx.globalAlpha = al * 0.8; ctx.fillStyle = i % 3 ? '#ff8a40' : '#ffd070'; ctx.fillRect(a[0] - 1, a[1] - 1, 2, 2); continue; }
          ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0])); ctx.globalAlpha = al; ctx.drawImage(i % 3 ? fishSpr() : fishSprG(), -w * 0.7, -w * 0.21, w, w * 0.42); ctx.restore(); }
        ctx.globalCompositeOperation = 'lighter'; for (const [, a, , i] of fs) { const r = Math.max(2, 0.5 * a[2]); ctx.globalAlpha = al * 0.22; ctx.drawImage(T.glowSpr('spk', i % 3 ? [255, 120, 50] : [255, 200, 110], 0.2), a[0] - r, a[1] - r, 2 * r, 2 * r); } ctx.restore(); }
      // 粒子重组（G）：「火」前 0.35 秒起，锦鲤身上的火星一股股飞到附近每个绣球上
      const kp = k.pos(R.fire - 0.35); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const Rb of T.ribbons) { if (Rb.z < c.z || Rb.z > c.z + 90) continue; const ta = R.fire - 0.35 + Math.abs(Rb.z - 241) / 50, dd = (t - ta) / 0.5; if (dd <= 0 || dd >= 1.15) continue; const bp = [Rb.dz / 2, Rb.y - Rb.sag - 0.35, Rb.z + Rb.dz / 2];
        for (let i = 0; i < 26; i++) { const f = clamp(dd - i * 0.012), w = Math.sin(f * Math.PI) * 1.5 * (M0.hash(i, Rb.z | 0) - 0.5), p = T.proj(c, lerp(kp[0], bp[0], f) + w, lerp(kp[1], bp[1], f) + w * 0.6, lerp(kp[2], bp[2], f)); if (!p || f <= 0 || f >= 1) continue;
          const r = Math.max(1.5, p[2] * 0.06); ctx.globalAlpha = 0.8 * (1 - f * 0.4); ctx.drawImage(T.glowSpr('spk', [255, 200, 110], 0.2), p[0] - r * 2, p[1] - r * 2, r * 4, r * 4); } }
      ctx.restore();
      const de = t - B(81.0); if (de > -0.3) inWater(ctx, wp, () => { for (let n = 0; n < 3; n++) ring(ctx, c, wp, 0, 249, de + 0.3 - n * 0.2, 2.5, 2.5, 0.8); }); splash(ctx, c, [0, 0, 249], t - B(80.98), 80, 41, 0.6); } };
};
// ===== C13 bar81–88：荷塘。扎进水里（C）→ 水下仰看荷叶底、荷梗，锦鲤贴着水面在梗间穿、一路顶起荷叶，萤火飞起 →（A）推到鳞片微距，每片鳞上一点灯光 →「红」一朵红荷的光在水里化开 →
// 顶出水面（I）：「风起」一阵风从左往右扫过，荷叶一片片翻过来露出银白的背面、花瓣被卷起，锦鲤逆风跃出，飞向镇子；一片吹飞的荷叶扫过镜头（F 接屋顶）=====
const leafSweep = (ctx, k) => sweep(ctx, k, (g, x) => { g.fillStyle = '#0d2a1c'; g.beginPath(); g.ellipse(x, 540, 760, 520, 0.35, 0.25, 6.0); g.lineTo(x, 540); g.closePath(); g.fill(); g.strokeStyle = 'rgba(70,120,90,0.5)'; g.lineWidth = 6; for (let k = 0; k < 12; k++) { const a = 0.35 + k * 0.5; g.beginPath(); g.moveTo(x, 540); g.lineTo(x + Math.cos(a) * 700, 540 + Math.sin(a) * 480); g.stroke(); } }, 'blur(8px) brightness(0.6)');
// t_scale（用户 2026-11-19：鳞片微距看不懂，换景别）：改成水下侧面横移，锦鲤在一片荷梗林里穿行（荷梗从近处划过）；「红」时镜头抬头看那朵红荷，红光在水里化开
const pond = (s) => { const t = s.t, kz = KOI.pond(t);
  const k = { L: 2.4, pos: KOI.pond, freq: 1.4, amp: 1, reflect: false, under: kz[1] < 0 ? 0.6 : 0, glow: 1 };
  const cv = CAM.pond(t);
  if (s.scene === 't_scale') cv[1] = Math.min(cv[1], -0.05); if (s.scene === 't_wind') cv[1] = Math.max(cv[1], 0.05);   // 转场里还画上一镜：机位钳在水面那一侧
  const xw = (tt) => -40 + 30 * (tt - R.wind), windF = (x, tt) => tt < R.wind ? 0 : sm(0, 0.3, xw(tt) - x) * Math.exp(-Math.max(0, xw(tt) - x) / 18);
  return { world: 'pond', lit: () => 1, cam: T.cam({ x: cv[0], y: cv[1], z: cv[2], yaw: cv[3], pitch: cv[4], f: cv[5] ?? 1250 }), koi: [k], townGlow: 0.5, redK: sm(R.red - 0.2, R.red + 0.6, t),
    lift: (L, tt) => { const pt = pondPass(L.z); if (pt > 1e8 || tt < pt - 1) return 0; const kp = KOI.pond(pt), dx = Math.abs(L.x - kp[0]); if (dx > 1.2 || kp[1] < -0.7) return 0; return (1 - dx / 1.2) * Math.exp(-(((tt - pt - 0.1) / 0.45) ** 2)); },
    flip: (L, tt) => { if (tt < R.wind) return 0; const u = xw(tt) - L.x; return 2.5 * sm(0, 0.35, u) * (1 - 0.75 * sm(0.9, 2.6, u)) * (L.raised ? 1 : 0.85); }, windF,
    fx: (ctx, c, wp) => { if (c.y < 0) { bubbles(ctx, c, k, t, B(80.95));
        // 扎进水里那一下的一团气泡
        const de = t - B(81); if (de < 1.8) { ctx.save(); for (let i = 0; i < 90; i++) { const h1 = M0.hash(i, 71), h2 = M0.hash(i, 72), p = T.proj(c, (h1 - 0.5) * 2.4, -0.3 - 1.6 * h2 + (0.8 + h1) * de, -4.5 + (M0.hash(i, 73) - 0.5) * 2.4); if (!p || p[2] <= 0) continue; const r = Math.max(1, (0.02 + 0.04 * h2) * p[2]); ctx.globalAlpha = 0.7 * (1 - de / 1.8); ctx.strokeStyle = '#d8f6ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.283); ctx.stroke(); } ctx.restore(); }
        // 「红」：红荷的光像一团团烟在水里化开
        const dr = t - R.red; if (dr > 0) { ctx.save(); for (let i = 0; i < 46; i++) { const h1 = M0.hash(i, 81), h2 = M0.hash(i, 82), h3 = M0.hash(i, 83), age = dr - h3 * 0.6; if (age <= 0) continue; const sp = Math.sqrt(age), a = h1 * 6.283;
          const p = T.proj(c, 0.6 + Math.cos(a) * sp * (0.4 + 0.9 * h2), -0.2 - sp * (0.5 + 0.9 * h2) + 0.15 * Math.sin(age + i), 18 + Math.sin(a) * sp * (0.4 + 0.9 * h2)); if (!p) continue; const r = (0.25 + 0.55 * sp) * p[2];
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.18 * Math.exp(-age * 0.35); ctx.drawImage(T.glowSpr('redc', [200, 20, 40], 0.4), p[0] - r, p[1] - r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22 * Math.exp(-age * 0.5); ctx.drawImage(T.glowSpr('redl', [255, 60, 50], 0.2), p[0] - r * 0.7, p[1] - r * 0.7, r * 1.4, r * 1.4); } ctx.restore(); }
        return; }
      // 水上：锦鲤跃出的水花，风里卷起的花瓣，一片吹飞的荷叶扫过镜头
      const dj = t - B(87.4); splash(ctx, c, [0, 0, 27.5], dj, 90, 91, 0.7); inWater(ctx, wp, () => { for (let n = 0; n < 3; n++) ring(ctx, c, wp, 0, 27.5, dj + 0.2 - n * 0.2); }); sparks(ctx, c, k, t, B(87.3), 1.2);
      if (t > R.wind) { ctx.save(); for (let i = 0; i < 170; i++) { const h1 = M0.hash(i, 831), h2 = M0.hash(i, 832), h3 = M0.hash(i, 833), x0 = -30 + 50 * h1, tt = t - R.wind - (x0 + 40) / 30; if (tt <= 0) continue;
          const p = T.proj(c, x0 + 7 * tt + 0.6 * Math.sin(tt * 3 + i), 0.4 + 2.5 * h2 + 1.2 * tt - 0.4 * tt * tt + 0.3 * Math.sin(tt * 5 + i), 2 + 40 * h3); if (!p) continue; const r = Math.max(1.2, 0.07 * p[2]), sp = t * (3 + 4 * h1) + i;
          ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(sp); ctx.scale(1, Math.abs(Math.cos(sp * 0.7)) + 0.2); ctx.globalAlpha = 0.9 * (1 - sm(3, 4, tt)); ctx.fillStyle = h1 > 0.5 ? '#ffb6cc' : '#fff0f4'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, 6.283); ctx.fill(); ctx.restore(); } ctx.restore(); }
    } };
};
SH.t_under = SH.t_scale = SH.t_wind = pond;
// ===== D14 bar89–96：屋顶的瓦浪上一拍一跳，「惊」一道金光扫过全镇屋瓦 →（L）主观视角：从屋顶扑下来，贴着灯笼串、红绸底下沿河冲过整条街 →（A）拉高成大远景：锦鲤在河心打旋，卷起直上天的水龙卷，
// 附近的河灯被卷进去绕着往上转；「清」它们从顶上冲出去，全镇的孔明灯一起放起来（G）=====
SH.t_roof = (s) => { const t = s.t, k = koiAir(KOI.wind), st = base(t); k.reflect = false; k.freq = 2.2;
  return { ...st, cam: camOf(CAM.wind, t), koi: [k], fog: 0.8, fx: (ctx, c) => sparks(ctx, c, k, t, B(88.5), 1.5) }; };
const SPC = [0, 0, 425], spH = (t) => 35 * sm(B(94.6), B(95.8), t);   // 水龙卷的中心、高度
const spAxis = (y, t) => { const H = Math.max(1, spH(t)), k = y / H; return [SPC[0] + 1.6 * k * Math.sin(0.07 * y + t * 0.6), y, SPC[2] + 1.1 * k * Math.cos(0.05 * y + t * 0.5)]; };   // 轴线随高度慢慢弯、来回晃
const spR = (y, t) => (1.0 + 0.11 * y) * (1 + 0.14 * Math.sin(y * 0.45 - t * 3.2));   // 半径，鼓包顺着往上走
const spoutPt = (th, y, t, rk = 1) => { const A = spAxis(y, t), r = spR(y, t) * rk, a = th + 3.2 * t + 0.09 * y; return [A[0] + r * Math.cos(a), y, A[2] + r * Math.sin(a)]; };
const koiSpout = (tt) => { if (tt < B(94.6)) return KOI.pov(tt); const u = tt - B(94.6), y = Math.min(34, 0.6 + 17 * u * u / (1 + u)), a = 6.5 * u; return tt < B(96.6) ? [SPC[0] + 2.4 * Math.cos(a), y, SPC[2] + 2.4 * Math.sin(a)] : KOI.sky(tt); };
// 河灯被水龙卷卷上去（t_spout、t_sky1 共用同一个位置，切镜头时不跳回河里）
const spoutLotus = (lo) => lo ? { ...lo, pos: (L, tt, p0) => { if (tt < B(94.7)) return p0; const dd = Math.hypot(p0[0] - SPC[0], p0[2] - SPC[2]); if (dd > 30) return p0; const tc = B(94.7) + dd / 22, w = sm(tc, tc + 0.9, tt); if (w <= 0) return p0;
      const u = Math.max(0, tt - tc), hh = Math.min(spH(tt) + 3, 4 * u * u + 2 * u), out = Math.max(0, tt - R.qing), sp = spoutPt(L.ph * 6.283, hh, tt), q = [sp[0] + out * 7 * Math.cos(L.ph * 9), sp[1] + out * 9, sp[2] + out * 7 * Math.sin(L.ph * 9)]; return [lerp(p0[0], q[0], w), lerp(p0[1], q[1], w), lerp(p0[2], q[2], w)]; } } : null;
SH.t_pov = SH.t_spout = (s) => { const t = s.t, st = base(t), k = { ...koiAir(koiSpout), freq: 2.4 }, pov = 1 - sm(B(93.55), B(93.95), t), into = sm(B(91), B(91.8), t);   // 贴到身后：从切点起、0.8 小节（原来切点前就开始、0.4 小节，焦距还一下从 1250 跳到 1050）
  let c; if (t < B(93.95)) { const p = KOI.pov(t), q = KOI.pov(t + 0.05), cw = CAM.wind(t), dv = nrm3([q[0] - p[0], q[1] - p[1], q[2] - p[2]]), ch = [p[0] - dv[0] * 3.4, p[1] - dv[1] * 3.4 + 1.0, p[2] - dv[2] * 3.4], tg = [p[0] + dv[0] * 4, p[1] + dv[1] * 4 - 0.2, p[2] + dv[2] * 4];
    const yw = Math.atan2(tg[0] - ch[0], tg[2] - ch[2]), pw = Math.atan2(tg[1] - ch[1], Math.hypot(tg[0] - ch[0], tg[2] - ch[2])), cv = [lerp(cw[0], ch[0], into), lerp(cw[1], ch[1], into), lerp(cw[2], ch[2], into), lerp(cw[3], yw, into), lerp(cw[4], pw, into)], sv = CAM.spout(t), w = 1 - pov; c = T.cam({ x: lerp(cv[0], sv[0], w), y: lerp(cv[1], sv[1], w), z: lerp(cv[2], sv[2], w), yaw: lerp(cv[3], sv[3], w), pitch: lerp(cv[4], sv[4], w), f: lerp(lerp(1250, 1050, into), sv[5], w) }); }
  else c = camOf(CAM.spout, t);
  const lotusSp = spoutLotus(st.lotus);
  return { ...st, glowK: 0.75, lotus: lotusSp, cam: c, koi: [k], fog: 0.85,
    fx: (ctx, c, wp) => { if (t > B(93.9)) sparks(ctx, c, k, t, B(93.9), 1.4, 5, 70, 1.5);
      const H = spH(t); if (H <= 0.1) return; drawSpout(ctx, c, wp, t, H); } };
};
// 水龙卷：水面上一个转着的旋涡、一圈水雾裙边、往外甩的水珠；柱身是几百段顺着螺旋往上流的短水纹（朝镜头那面亮、背面淡，左边月光冷白、右边镇子的灯暖金），两侧一道亮边；一圈水珠绕着它往上盘；顶上散成一团水雾
const drawSpout = (ctx, c, wp, t, H) => { const fc = Math.atan2(c.x - SPC[0], c.z - SPC[2]), q0 = T.proj(c, SPC[0], H * 0.5, SPC[2]), px = q0 ? q0[2] : 30, gw = sm(0, 6, H);
  // 旋涡：水面上五条螺旋臂慢慢转，越往外越淡
  inWater(ctx, wp, () => { ctx.lineCap = 'round'; for (let k = 0; k < 5; k++) { ctx.beginPath(); let on = false; for (let r = 1.5; r < 16; r += 0.4) { const a = k * 1.2566 + 0.45 * r - 2.2 * t, q = T.proj(c, SPC[0] + r * Math.cos(a), 0.02, SPC[2] + r * Math.sin(a)); if (!q) { on = false; continue; } on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; }
    ctx.strokeStyle = `rgba(215,235,255,${0.3 * gw})`; ctx.lineWidth = Math.max(1, px * 0.06); ctx.stroke(); }
    const gc = T.proj(c, SPC[0], 0, SPC[2]); if (gc) { const R = Math.min(700, 7 * gc[2]); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * gw; ctx.drawImage(T.glowSpr('mist', [205, 228, 255], 0.3), gc[0] - R, gc[1] - R * 0.4, 2 * R, R * 0.8); } });
  const ex = [Math.cos(fc), 0, -Math.sin(fc)], LE = [], RE = []; for (let y = 0; y <= H; y += H / 24) { const A = spAxis(y, t), r = spR(y, t), a = T.proj(c, A[0] - ex[0] * r, y, A[2] - ex[2] * r), b = T.proj(c, A[0] + ex[0] * r, y, A[2] + ex[2] * r); if (a && b) { LE.push(a); RE.push(b); } }
  if (LE.length > 3) { const m = LE.length >> 1, g = ctx.createLinearGradient(LE[m][0], LE[m][1], RE[m][0], RE[m][1]); g.addColorStop(0, 'rgba(225,240,255,0.42)'); g.addColorStop(0.22, 'rgba(200,225,250,0.2)'); g.addColorStop(0.5, 'rgba(185,212,245,0.13)'); g.addColorStop(0.78, 'rgba(230,215,200,0.2)'); g.addColorStop(1, 'rgba(255,220,170,0.4)');
    // 先画进一层，再用竖着的渐变把上段遮淡（顶上化开成水雾，不是一刀切平的杯口）
    const Ly = M0.layer('spout'), g2 = Ly.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, Ly.width, Ly.height); M0.resetTransform(g2);
    g2.fillStyle = g; g2.globalAlpha = gw; g2.beginPath(); LE.forEach((q, i) => i ? g2.lineTo(q[0], q[1]) : g2.moveTo(q[0], q[1])); for (let i = RE.length - 1; i >= 0; i--) g2.lineTo(RE[i][0], RE[i][1]); g2.closePath(); g2.fill(); g2.globalAlpha = 1;
    const yT = (LE[LE.length - 1][1] + RE[RE.length - 1][1]) / 2, yB = (LE[0][1] + RE[0][1]) / 2, vm = g2.createLinearGradient(0, yT, 0, yB); vm.addColorStop(0, 'rgba(0,0,0,0)'); vm.addColorStop(0.3, 'rgba(0,0,0,1)'); vm.addColorStop(1, 'rgba(0,0,0,1)');
    g2.globalCompositeOperation = 'destination-in'; g2.fillStyle = vm; g2.fillRect(0, 0, 1920, 1080); g2.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(Ly, 0, 0); ctx.restore(); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // 底下一圈白水沫（水柱根上最密）
  for (let i = 0; i < 24; i++) { const a = M0.hash(i, 865) * 6.283 + 2.4 * t, y = 0.5 + 5 * M0.hash(i, 866), A = spAxis(y, t), rr = spR(y, t) * (0.6 + 0.7 * M0.hash(i, 867)), q = T.proj(c, A[0] + rr * Math.cos(a), y, A[2] + rr * Math.sin(a)); if (!q) continue; const R = Math.min(400, (1.2 + 1.2 * M0.hash(i, 868)) * q[2]); ctx.globalAlpha = 0.12 * gw; ctx.drawImage(T.glowSpr('mist', [235, 245, 255], 0.3), q[0] - R, q[1] - R, 2 * R, 2 * R); }
  // 水雾裙边（底下一圈，转着往外散）和柱身外的一层雾
  for (let i = 0; i < 40; i++) { const h1 = M0.hash(i, 861), a = h1 * 6.283 + 1.5 * t, rr = 2 + 4.5 * M0.hash(i, 862), q = T.proj(c, SPC[0] + rr * Math.cos(a), 0.6 + 2.8 * M0.hash(i, 863), SPC[2] + rr * Math.sin(a)); if (!q) continue; const R = Math.min(400, (1.6 + 1.8 * M0.hash(i, 864)) * q[2]); ctx.globalAlpha = 0.07 * gw; ctx.drawImage(T.glowSpr('mist', [205, 228, 255], 0.3), q[0] - R, q[1] - R, 2 * R, 2 * R); }
  for (let y = 2; y < H; y += 2.5) { const A = spAxis(y, t), q = T.proj(c, ...A); if (!q) continue; const R = Math.min(500, spR(y, t) * q[2] * 2.0); ctx.globalAlpha = 0.09; ctx.drawImage(T.glowSpr('mist', [205, 228, 255], 0.3), q[0] - R, q[1] - R, 2 * R, 2 * R); }
  // 顶上散开的水雾
  for (let i = 0; i < 16; i++) { const a = M0.hash(i, 871) * 6.283 + 0.8 * t, rr = spR(H, t) * (0.6 + 1.2 * M0.hash(i, 872)), A = spAxis(H, t), q = T.proj(c, A[0] + rr * Math.cos(a), H + 2 * M0.hash(i, 873), A[2] + rr * Math.sin(a)); if (!q) continue; const R = Math.min(500, (2.5 + 2 * M0.hash(i, 874)) * q[2]); ctx.globalAlpha = 0.08 * gw; ctx.drawImage(T.glowSpr('mist', [215, 232, 255], 0.3), q[0] - R, q[1] - R, 2 * R, 2 * R); }
  ctx.restore();
  // 两侧的亮边（水柱边上看到的是斜着的一层水，最亮）
  ctx.save(); ctx.lineCap = 'round'; for (const sd of [-1, 1]) { ctx.beginPath(); let on = false; for (let y = 0; y <= H * 0.8; y += 0.8) { const A = spAxis(y, t), r = spR(y, t), q = T.proj(c, A[0] + sd * ex[0] * r, y, A[2] + sd * ex[2] * r); if (!q) { on = false; continue; } on ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); on = true; }
    ctx.strokeStyle = sd < 0 ? 'rgba(225,240,255,0.22)' : 'rgba(255,215,160,0.2)'; ctx.lineWidth = Math.max(4, px * 0.45); ctx.stroke(); ctx.strokeStyle = sd < 0 ? 'rgba(235,245,255,0.6)' : 'rgba(255,220,170,0.55)'; ctx.lineWidth = Math.max(1.5, px * 0.1); ctx.stroke(); } ctx.restore();
  // 柱身的水纹：每段在螺旋上占 0.6 弧度，顺着往上流，内外两层
  const segs = []; for (let i = 0; i < 500; i++) { const h1 = M0.hash(i, 881), h2 = M0.hash(i, 882), h3 = M0.hash(i, 883), u = (h1 + t * 0.32 * (1 + 0.6 * h2)) % 1, y0 = u * H, th0 = h3 * 6.283, rk = i % 3 ? 1 : 0.82, pts = [];
    for (let k = 0; k <= 8; k++) { const yy = Math.min(H, y0 + k * 0.45), p3 = spoutPt(th0 - k * 0.1, yy, t, rk); pts.push(p3); }
    const mid = pts[4], ang = Math.atan2(mid[0] - spAxis(mid[1], t)[0], mid[2] - spAxis(mid[1], t)[2]), face = Math.cos(ang - fc), side = Math.sin(ang - fc), fade = Math.sin(Math.PI * u);
    segs.push([T.toC(c, ...mid)[2], pts, face, side, fade, rk]); }
  segs.sort((x, y) => y[0] - x[0]); ctx.save(); ctx.lineCap = 'round';
  for (const [, pts, face, side, fade, rk] of segs) { const q = pts.map(p => T.proj(c, ...p)); if (q.some(x => !x)) continue; const al = (0.12 + 0.6 * Math.max(0, face)) * fade * (rk < 1 ? 0.6 : 1) * (1 - sm(0.72 * H, H, pts[4][1]));
    const col = side > 0.2 ? [255, 214, 160] : side < -0.2 ? [228, 242, 255] : [240, 246, 255]; ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${al.toFixed(3)})`; ctx.lineWidth = Math.max(1, q[4][2] * (0.1 + 0.08 * Math.max(0, face)));
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let k = 1; k < q.length; k++) ctx.lineTo(q[k][0], q[k][1]); ctx.stroke(); }
  // 绕着柱子往上盘的水珠
  ctx.fillStyle = 'rgba(235,245,255,0.75)'; for (let i = 0; i < 220; i++) { const h1 = M0.hash(i, 891), u = (h1 + t * 0.5) % 1, y = u * H, a = M0.hash(i, 892) * 6.283 + 3.6 * t + 0.1 * y, A = spAxis(y, t), rr = spR(y, t) * (1.25 + 0.4 * M0.hash(i, 893)), q = T.proj(c, A[0] + rr * Math.cos(a), y, A[2] + rr * Math.sin(a)); if (!q) continue;
    const r = Math.min(5, Math.max(1, 0.06 * q[2])); ctx.globalAlpha = Math.sin(Math.PI * u) * (0.4 + 0.6 * Math.max(0, Math.cos(a - fc))); ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); }
  // 底下往外甩的水珠、顶上落下的水珠
  for (let i = 0; i < 260; i++) { const h1 = M0.hash(i, 851), h2 = M0.hash(i, 852), age = ((t * 0.7 + h1) % 1) * 1.6, a = h2 * 6.283, v = 4 + 6 * M0.hash(i, 853), top = i % 2 === 0, y0 = top ? H : 0.3, A = spAxis(y0, t);
    const q = T.proj(c, A[0] + (spR(y0, t) + v * age) * Math.cos(a), y0 + (top ? 3 : 4) * age - 4.9 * age * age * (top ? 0.6 : 1), A[2] + (spR(y0, t) + v * age) * Math.sin(a)); if (!q || age < 0.02) continue; const r = Math.min(5, Math.max(1, 0.06 * q[2])) * (1 - age / 1.8); ctx.globalAlpha = 1 - age / 1.6; ctx.fillRect(q[0] - r / 2, q[1] - r / 2, r, r); }
  ctx.restore(); };
// ===== 尾声 E15 bar97–100：跟着光升进灯海（H），锦鲤（4 米，后面在龙门化龙）在孔明灯之间往镇子尽头游；一盏孔明灯的暗影扫过镜头（F 接龙门）=====
// 「祥」：先满铺字形，再只留尾巴走过的那一圈（destination-in），写完 0.6 秒里补齐，再一道光从左扫到右；外面叠一层模糊的当光晕
const xiang = (ctx, c, t, k) => { const T0 = XI[0][0], T1 = XI[XI.length - 1][1];
  const a = KOI.sky(t - 0.01), b = KOI.sky(t + 0.01), tR = t - k.L * 0.74 / Math.max(1.2, 50 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));   // 光从尾巴上出来：显到尾巴走过的地方
  if (tR < T0) return; const A = T.proj(c, ...xw(0, 0)), U = T.proj(c, ...xw(1, 0)), V = T.proj(c, ...xw(0, 1)); if (!A || !U || !V) return;
  if (!XP) { XP = new Path2D(); for (const cs of window.SCRIPT_FONTS.zhimangxing.glyphs['祥'].c) { for (let i = 0; i < cs.length; i += 2) i ? XP.lineTo(cs[i], cs[i + 1] + 0.9) : XP.moveTo(cs[i], cs[i + 1] + 0.9); XP.closePath(); } }
  const Ly = M0.layer('xiang'), g = Ly.getContext('2d'), sk = Ly.width / 1920; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, Ly.width, Ly.height); M0.resetTransform(g);
  g.transform(U[0] - A[0], U[1] - A[1], V[0] - A[0], V[1] - A[1], A[0], A[1]);
  const gr = g.createLinearGradient(0, 0, 0, 1); gr.addColorStop(0, '#fff3cf'); gr.addColorStop(0.45, '#ffcf6a'); gr.addColorStop(1, '#ff9038'); g.fillStyle = gr; g.fill(XP);
  g.globalCompositeOperation = 'destination-in'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = 0.13; g.strokeStyle = '#fff'; g.beginPath();
  for (const sp of XSMP) { if (sp[0][0] > tR) break; g.moveTo(sp[0][1], sp[0][2]); for (const [e, u, v] of sp) { if (e > tR) break; g.lineTo(u, v); } } g.stroke();
  const full = sm(T1 - 0.1, T1 + 0.5, t); if (full > 0) { g.globalCompositeOperation = 'destination-over'; g.globalAlpha = full; g.fill(XP); g.globalAlpha = 1; }
  const sw = (t - T1 - 0.15) / 0.9; if (sw > 0 && sw < 1) { const x = -0.3 + 1.6 * sw, gs = g.createLinearGradient(x - 0.2, 0, x + 0.2, 0.1); gs.addColorStop(0, 'rgba(255,250,235,0)'); gs.addColorStop(0.5, 'rgba(255,250,235,0.85)'); gs.addColorStop(1, 'rgba(255,250,235,0)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gs; g.fillRect(-0.1, -0.1, 1.2, 1.2); }
  g.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${(18 * sk).toFixed(1)}px)`; ctx.globalAlpha = 0.5; ctx.drawImage(Ly, 0, 0); ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9; ctx.drawImage(Ly, 0, 0); ctx.restore(); };
// 用户 2026-11-20：接水龙卷那一下鱼突然变大 → 长短、摆尾、亮度都和 t_spout 一样（koiAir），写字时才慢慢亮起来；写字时背朝镜头（竖着游不翻身），往远处游时背慢慢转回朝天
SH.t_sky1 = (s) => { const t = s.t, st = base(t), T0 = XI[0][0], T1 = XI[XI.length - 1][1], fade = 1 - sm(B(97.1), B(98.8), t);
  const k = { ...koiAir(KOI.sky), freq: 2.4, glow: 1 + 0.4 * sm(T0 - 0.6, T0, t), reflect: false, up: (tt, tg) => { const w = sm(B(97.3), B(97.9), tt), a = tg[2] * tg[2]; return [0, 1 - w + w * a, -w * (1 - a)]; } };
  return { ...st, lotus: spoutLotus(st.lotus), glowK: 0.8, cam: camOf(CAM.sky, t), koi: [k], fog: 0.7, bloom: 0.65,
    items: (items, ctx, c, mirror) => { if (!mirror) items.push([T.toC(c, ...XC)[2] + 0.6, () => xiang(ctx, c, t, k)]); },
    fx: (ctx, c, wp) => {
    // 笔尖：写字时尾巴上一团金光，一路洒金屑
    const wk = sm(T0 - 0.2, T0 + 0.1, t) * (1 - sm(T1, T1 + 0.4, t)); if (wk > 0) { const q = T.proj(c, ...K.tail(k, t)); if (q) { const r = Math.min(160, q[2] * 1.1); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * wk; ctx.drawImage(T.glowSpr('xtip', [255, 214, 130], 0.18), q[0] - r, q[1] - r, 2 * r, 2 * r); ctx.restore(); } }
    if (t > T0) sparks(ctx, c, k, t, T0, 1.8, 21, 110, 1.4, T1 + 0.2);
    // 水龙卷没有一下消失：画进一层，整体慢慢淡掉、高度往下塌，水落回河里
    if (fade > 0) { const Ly = M0.layer('spout2'), g3 = Ly.getContext('2d'); g3.setTransform(1, 0, 0, 1, 0, 0); g3.clearRect(0, 0, Ly.width, Ly.height); M0.resetTransform(g3); drawSpout(g3, c, wp, t, 35 * (1 - 0.45 * sm(B(97.3), B(98.8), t)));
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = fade; ctx.drawImage(Ly, 0, 0); ctx.restore(); }
    sparks(ctx, c, k, t, B(96.5), 2, 5, 60, 2.5); } };
};
// ===== 尾声 bar101–123「鲤跃龙门化龙」→ 侧面横移跟着金龙穿灯海 → 金龙绕月 → 拉开，停在灯海里 =====
// 锦鲤逆着瀑布冲上去，在牌坊前跃起、越过屋脊挡住月亮；bar105 起身子沿来路拉长（龙身从瀑布里抽出来）、金色从头扫到尾，长出角、须、鬃、背鳍、四爪，冲进灯海
// bar108.4 起追着龙往上：在龙头后面 65 米（沿 DIR 往回）、右边 38 米、低 10 米，看它前面 15 米（整条龙斜着看得见，穿梭时光线从画面偏左迸出来）；bar118.2 起拉到圈心正后方 97 → 115 米，视线往上偏 12.5°（圈心和星系的核落在画面 y 800 上下，圈顶在 550 以下，上面留给片尾歌名和歌手）
const lookAt = (P, L, f) => { const d = [L[0] - P[0], L[1] - P[1], L[2] - P[2]]; return [...P, Math.atan2(d[0], d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2])), f]; };
const gateCam = (t) => { const g0 = CAM.gate(Math.min(t, B(108.5))); if (t < B(108.4)) return g0;
  const D = SP.D, U = SP.U, h = dragonPos(t - 0.35), hl = dragonPos(t), ch = lookAt([0, 1, 2].map(j => h[j] - D[j] * 65 + [38, 0, 0][j] - U[j] * 10), [0, 1, 2].map(j => hl[j] + D[j] * 15), 1100);
  const dc = lerp(97, 115, sm(B(119), B(123.6), t)), C = SP.Cc, en = lookAt(C.map((v, j) => v - D[j] * dc), C.map((v, j) => v + U[j] * dc * 0.222), 1100);
  const w1 = sm(B(108.4), B(109.4), t), w2 = sm(B(118.2), B(119.6), t); return g0.map((v, q) => lerp(lerp(v, ch[q], w1), en[q], w2)); };
// ---- 尾声 bar113–117 多元宇宙穿梭（用户 2026-11-20：龙飞向宇宙太单一，加多元宇宙穿梭、粒子变换）：每个小节头穿过一道门，门里是这支片子前面的一个世界——
// 冬夜冰湖和月亮、水下化开的那滴血、雷劈成的光树、宇宙网，最后一道门回到星空。门里的世界是现场渲染的（JZ.recall），时间从 w0 起往后走
const VERSE = [{ w: 'lake', b: 113, w0: 13.2 }, { w: 'deep', b: 114, w0: 57.3 }, { w: 'tree', b: 115, w0: 64.3 }, { w: 'cosmos', b: 116, w0: 88.3 }, { w: null, b: 117 }], OPEN = 0.6;   // 门在穿过前 OPEN 小节出现
const verseOf = (t) => { let i = -1; while (i + 1 < VERSE.length && t >= B(VERSE[i + 1].b)) i++; return { cur: i >= 0 ? VERSE[i] : null, nxt: VERSE[i + 1] || null }; };   // 现在在哪个世界（null = 星空）、下一道门
const recall = (v, t, name) => { const L = M0.layer(name), g = L.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.width, L.height); M0.resetTransform(g); JZ.recall(g, v.w, v.w0 + t - B(v.b - OPEN)); return L; };
const blit = (ctx, L) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L, 0, 0); ctx.restore(); };
// 门：开在龙穿过它的那一点（龙一头钻进门心），迎面飞过去越来越大（半径 ∝ 1 / 离穿过还有多久），最后几帧撑满画面；门框是一圈转着的彩膜、外面一层光、一串绕着转的光点
const portal = (ctx, c, t, v, L) => { const tc = B(v.b), dt = tc - t; if (dt <= 0 || dt > OPEN * R.bl) return; const fp = T.proj(c, ...dragonPos(tc + 0.2)) || T.proj(c, c.x + SP.D[0] * 1e5, c.y + SP.D[1] * 1e5, c.z + SP.D[2] * 1e5); if (!fp) return;
  const r = 52 / Math.pow(dt, 1.1), a = sm(0, 0.25, OPEN * R.bl - dt), cx = fp[0], cy = fp[1];
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.clip(); ctx.globalAlpha = a; blit(ctx, L || M0.layer('vSpace'));
  const iv = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r); iv.addColorStop(0, 'rgba(6,4,20,0)'); iv.addColorStop(1, 'rgba(6,4,20,0.55)'); ctx.fillStyle = iv; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); ctx.restore();   // 门里边上压暗一圈：像隔着一层膜
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const ph = t * 0.9 + v.b, g = ctx.createConicGradient(ph, cx, cy);
  [[0, '#ffd27a'], [0.25, '#ff6ad5'], [0.5, '#6ae8ff'], [0.75, '#a888ff'], [1, '#ffd27a']].forEach(([k, col]) => g.addColorStop(k, col)); ctx.strokeStyle = g;
  ctx.globalAlpha = 0.35 * a; ctx.lineWidth = Math.max(6, r * 0.14); ctx.filter = `blur(${Math.min(40, 4 + r * 0.05).toFixed(1)}px)`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke(); ctx.filter = 'none';
  ctx.globalAlpha = 0.9 * a; ctx.lineWidth = Math.max(1.5, r * 0.022); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
  for (let i = 0; i < 56; i++) { const h1 = M0.hash(i, 181 + v.b), an = i / 56 * 6.2832 + t * (0.5 + 0.6 * h1) * (i % 2 ? 1 : -1), rr = r * (1 + 0.05 * Math.sin(t * 3 + i)), s = Math.max(2, r * 0.02) * (1.5 + h1);
    ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 5 + i * 1.7)); ctx.drawImage(T.glowSpr('spk', [[255, 214, 120], [255, 120, 220], [120, 230, 255]][i % 3], 0.2), cx + rr * Math.cos(an) - s * 2, cy + rr * Math.sin(an) - s * 2, s * 4, s * 4); }
  ctx.restore(); };
const verseBack = (ctx, c, t, P) => { const { cur, nxt } = verseOf(t), open = nxt && t > B(nxt.b - OPEN);
  if (cur && cur.w) blit(ctx, recall(cur, t, 'vA')); else JZ.space.back(ctx, c, t, P, M0);
  if (open) { let L = null; if (nxt.w) L = recall(nxt, t, 'vB'); else { const Ls = M0.layer('vSpace'), g = Ls.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, Ls.width, Ls.height); M0.resetTransform(g); JZ.space.back(g, c, t, P, M0); L = Ls; } portal(ctx, c, t, nxt, L); } };
const verseIn = (t) => t >= B(VERSE[0].b) && t < B(VERSE[VERSE.length - 1].b);
// ---- 尾声 bar117–119 粒子变换：出了最后一道门，金龙从尾到头散成上万粒光（bar117.1–117.45），绕着它飞的路卷成一团星尘，
// 聚成一尾星光锦鲤游一小段（鲤跃龙门的来处，bar117.95–118.3），再从头到尾聚回金龙（到 bar118.8），接片尾绕着星系的核盘起来。光点位置只由 t 算
const NPM = 2600, PM = { a: 117.1, b: 117.45, k0: 117.6, k1: 117.95, d0: 118.3, d1: 118.8 }, PMK = { L: 40, pos: (tt) => dragonPos(tt), freq: 0.9, amp: 0.9, reflect: false };
const morphA = (t) => 1 - sm(B(PM.a), B(PM.b) + 0.05, t) + sm(B(PM.d1) - 0.3, B(PM.d1) + 0.05, t);   // 龙身本体的不透明度
const morphPts = (dr, t) => { const Fd = JZ.dragon.spine(dr, t), Fk = K.spine(PMK, t), out = [];
  for (let i = 0; i < NPM; i++) { const h = (k) => M0.hash(i, 911 + k), fin = h(5) < 0.22, s = fin ? 1 : Math.pow(h(0), 0.9), th = h(1) * 6.2832, dl = B(PM.a) + (B(PM.b) - B(PM.a)) * (1 - s) + 0.04 * h(2);   // 尾巴先散
    if (t < dl) continue; const r = JZ.dragon.at(Fd, fin ? 0.7 + 0.29 * h(7) : Math.min(s, 0.995)), body = JZ.dragon.surfA(r, th), u = t - dl;   // 蝶尾那批散回龙身后段（不全挤到尾尖）
    const rad = 10 * (1 - Math.exp(-u * 1.5)) * (0.35 + 0.65 * h(3)), an = th + 2.4 * u * (0.6 + h(4)), sw = add3(body, mul3(r.S, rad * Math.cos(an)), mul3(r.U, rad * Math.sin(an)), mul3(r.T, -7 * u * h(6)));   // 绕着身子卷开、往后拖
    let kp; if (fin) { const n = Fk.P.length - 1, a = h(7), b = h(8) - 0.5; kp = add3(Fk.P[n], mul3(Fk.Tn[n], -PMK.L * 0.28 * a), mul3(Fk.U[n], PMK.L * 0.5 * a * b), mul3(Fk.S[n], PMK.L * 0.04 * Math.sin(t * 6 + a * 4))); }   // 蝶尾：一把扇子
    else kp = K.surfS(Fk, s, th);
    const kd = 0.12 * R.bl * (1 - s), wk = sm(B(PM.k0) + kd, B(PM.k1) + kd, t), rd = 0.25 * R.bl * s, wd = sm(B(PM.d0) + rd, B(PM.d1) - 0.25 * R.bl + rd, t);   // 聚成锦鲤：头先成形；聚回龙：头先回去
    const p = mix3(mix3(sw, kp, wk), body, wd), red = !fin && K.redF(s, th) > 0, col = wk > 0.5 && wd < 0.5 ? (red ? [255, 92, 50] : fin ? [255, 170, 110] : [255, 244, 226]) : [255, 206, 120];
    out.push([p, col, sm(0, 0.1, u) * Math.min(1, 0.3 + 2 * u) * (1 - sm(B(PM.d1) - 0.15, B(PM.d1) + 0.2, t)), h(9)]); }   // 刚散出来挤在一起，先淡一点
  return out; };
const morph = (ctx, c, dr, t) => { if (t < B(PM.a) || t > B(PM.d1) + 0.25) return; const A = morphPts(dr, t), Bp = morphPts(dr, t - 0.03);
  const gk = sm(B(PM.k0) + 0.1 * R.bl, B(PM.k1) + 0.1 * R.bl, t) * (1 - sm(B(PM.d0), B(PM.d0) + 0.2 * R.bl, t));   // 星光锦鲤：光点后面叠一层半透明的锦鲤，一眼看得出是鱼
  if (gk > 0) { const L = M0.layer('pmk'), g = L.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.width, L.height); M0.resetTransform(g); K.draw(g, c, { ...PMK, glow: 1.6 }, t, false);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * gk; ctx.drawImage(L, 0, 0); ctx.restore(); }   // 先画进一层再叠加上来：亮的地方发光，暗的鳍不成一片褐色
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  A.forEach(([p, col, a, hh], i) => { const q = T.proj(c, ...p); if (!q || a <= 0) return; const r = Math.min(9, Math.max(1.2, 0.09 * q[2] * (0.6 + 0.8 * hh))), q0 = Bp[i] && T.proj(c, ...Bp[i][0]);
    if (q0) { ctx.globalAlpha = 0.22 * a; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = r * 0.6; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }   // 一小段拖影
    ctx.globalAlpha = 0.5 * a; ctx.drawImage(T.glowSpr('spk', col, 0.2), q[0] - r * 2, q[1] - r * 2, r * 4, r * 4); });
  ctx.restore(); };
// 每到小节头（bar113–118）龙头炸开一蓬金、紫、青的光点
const burst = (ctx, c, t) => { const n0 = Math.floor(57 + (t - R.b57) / R.bl); for (let n = Math.max(113, n0 - 1); n <= Math.min(118, n0); n++) { const tb = B(n), d = t - tb; if (d < 0 || d > 1.8) continue; const h0 = dragonPos(tb), col = [[255, 214, 120], [190, 140, 255], [120, 230, 255]][n % 3];
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 200; i++) { const h1 = M0.hash(i + n * 211, 171), h2 = M0.hash(i + n * 211, 172), h3 = M0.hash(i + n * 211, 173), a = h1 * 6.283, b = Math.acos(2 * h2 - 1), v = 8 + 16 * h3, r = v * (1 - Math.exp(-d * 1.4)) / 1.4;
    const p = T.proj(c, h0[0] + r * Math.sin(b) * Math.cos(a), h0[1] + r * Math.cos(b), h0[2] + r * Math.sin(b) * Math.sin(a)); if (!p) continue; const Rr = Math.min(14, Math.max(2.5, 0.35 * p[2])) * (1 - d / 2.2);
    ctx.globalAlpha = 0.8 * (1 - d / 1.8); ctx.drawImage(T.glowSpr('spk', h1 > 0.35 ? col : [255, 230, 190], 0.2), p[0] - Rr * 2, p[1] - Rr * 2, Rr * 4, Rr * 4); }
  ctx.restore(); } };
SH.t_gate = SH.t_climb = SH.t_warp = SH.t_end = (s) => { const t = s.t, g = sm(B(105), B(105.9), t), cp = gateCam(t), hp = dragonPos(t), up = t >= B(112.2);
  const P = { k: sm(B(110.2), B(112), t), off: SP.off(t), v: SP.v(t), gal: SP.gal };   // 上天：bar110.2–112 星空盖住夜空、孔明灯淡掉，bar112.2 起只画宇宙
  const koi = { L: 4, pos: KOI.gate, freq: 2.2, amp: 1.1, glow: 1.2 + 2 * sm(B(104.6), B(105), t), alpha: 1 - sm(B(105.05), B(105.35), t) };
  const dr = { L: 42, Lk: 4, g, pos: dragonPos, extra: t > B(108.7) && !up ? (c) => [[T.toC(c, ...MO)[2], () => T.moonObj(ctx0, c, MO, RMO, 1 - sm(B(111.3), B(112.1), t))]] : null, freq: 0.45, amp: 1, glow: 1 + 1.5 * (1 - g), up: [cp[0] - hp[0], cp[1] - hp[1] + 8, cp[2] - hp[2]], key: [0.25, 0.35, -0.9], alpha: Math.min(1, morphA(t)) };
  return { world: up ? 'space' : 'gate', space: P.k > 0 ? (ctx, c) => verseBack(ctx, c, t, P) : null, lanA: 1 - sm(B(110.6), B(112), t), lit: () => 1, cam: camOf(gateCam, t), moonU: 0, moonE: 0.78, moonR: t > B(108.7) ? 0.0001 : 4, bloom: 0.6 - 0.15 * sm(B(111), B(113), t), glowK: 1 - 0.2 * sm(B(111), B(113), t), townGlow: 1,
    // 龙穿过龙门那几秒（用户 2026-11-19：「龙门」两个字前一刻被挡、下一刻又出来）：它整个在牌坊、瀑布、水雾前面，深度钳在 z 22 那一层前
    items: (items, ctx, c) => { ctx0 = ctx; if (t >= B(105)) { const dz = T.toC(c, ...JZ.dragon.center(dr, t))[2]; items.push([t < B(108.7) ? Math.min(dz, T.toC(c, 0, 12, 22)[2]) : dz, () => JZ.dragon.draw(ctx, c, dr, t)]); }
      // 锦鲤逆瀑往上冲时（用户 2026-11-20：bar104 鱼不见了）：瀑布按半高那一点排深度，鱼过了半高就算到瀑布后面去了；和龙一样钳在 z 22 那一层前
      if (koi.alpha > 0) items.push([Math.min(T.toC(c, ...K.center(koi, t))[2] - 1, T.toC(c, 0, 12, 22)[2]), () => { ctx.save(); ctx.globalAlpha = koi.alpha; K.draw(ctx, c, koi, t, false); ctx.restore(); }]); },
    fx: (ctx, c) => { if (koi.alpha > 0) sparks(ctx, c, koi, t, B(102.8), 1.2, 7, 70, 1.2);
      if (t > B(102.6) && t < B(105.2)) { ctx.save(); ctx.fillStyle = 'rgba(235,248,255,0.7)'; for (let e = Math.ceil(Math.max(B(102.7), t - 0.7) * 80) / 80; e <= Math.min(t, B(104.75)); e += 1 / 80) { const idx = Math.round(e * 80), age = t - e, h1 = M0.hash(idx, 131), h2 = M0.hash(idx, 132), h3 = M0.hash(idx, 133), p0 = KOI.gate(e);
          const p = T.proj(c, p0[0] + (h1 - 0.5) * 5 * age, p0[1] + (1.5 + 2.5 * h2) * age - 6 * age * age, p0[2] - 0.3 - (1 + 3 * h3) * age); if (!p) continue; const r = Math.max(1, 0.07 * p[2]) * (1 - age / 0.8); ctx.globalAlpha = 1 - age / 0.7; ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r); } ctx.restore(); }
      // 化龙那一下：三道金环从龙头往外扩，一蓬金色火星炸开
      const d0 = t - B(105.05); if (d0 > 0 && d0 < 2.2) { const h0 = KOI.gate(B(105.05)); ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) { const d = d0 - 0.14 * k; if (d <= 0 || d > 1.4) continue; const R = 1 + 13 * Math.pow(d / 1.4, 0.6), pts = [];
          for (let i = 0; i <= 48; i++) { const a = i / 48 * 6.283, p = T.proj(c, h0[0] + R * Math.cos(a), h0[1] + R * Math.sin(a) * 0.9, h0[2] + R * Math.sin(a) * 0.45); if (p) pts.push(p); }
          if (pts.length < 10) continue; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = `rgba(255,170,70,${0.35 * (1 - d / 1.4)})`; ctx.lineWidth = Math.max(4, pts[0][2] * 0.6); ctx.stroke(); ctx.strokeStyle = `rgba(255,226,160,${0.7 * (1 - d / 1.4)})`; ctx.lineWidth = Math.max(1.5, pts[0][2] * 0.18); ctx.stroke(); }
        for (let i = 0; i < 240; i++) { const h1 = M0.hash(i, 121), h2 = M0.hash(i, 122), h3 = M0.hash(i, 123), a = h1 * 6.283, b = Math.acos(2 * h2 - 1), v = 5 + 10 * h3, r = v * (1 - Math.exp(-d0 * 1.6)) / 1.6;
          const p = T.proj(c, h0[0] + r * Math.sin(b) * Math.cos(a), h0[1] + r * Math.cos(b) - 1.2 * d0 * d0, h0[2] + r * Math.sin(b) * Math.sin(a)); if (!p) continue; const Rr = Math.min(9, Math.max(1.5, 0.09 * p[2])) * (1 - d0 / 2.2);
          ctx.globalAlpha = 0.9 * (1 - d0 / 2.2); ctx.drawImage(T.glowSpr('spk', h1 > 0.4 ? [255, 214, 120] : [255, 140, 60], 0.2), p[0] - Rr * 2, p[1] - Rr * 2, Rr * 4, Rr * 4); }
        ctx.restore(); }
      if (P.k > 0) JZ.space.front(ctx, c, t, verseIn(t) ? { ...P, k: P.k * 0.45 } : P, M0); burst(ctx, c, t); morph(ctx, c, dr, t);   // 在别的世界里时星尘淡一点；bar117–119 粒子变换
      // 金龙身上的光点一路洒在身后（到星系前、盘成圈时越来越多，G）
      if (t > B(109)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rate = 40 + 80 * sm(B(117), B(120), t), life = 2.6; for (let e = Math.ceil(Math.max(B(109), t - life) * rate) / rate; e <= t; e += 1 / rate) { const idx = Math.round(e * rate), h1 = M0.hash(idx, 141), h2 = M0.hash(idx, 142), h3 = M0.hash(idx, 143), age = t - e, p0 = dragonPos(e - 3 * h1);
          const p = T.proj(c, p0[0] + (h2 - 0.5) * 6 * age, p0[1] - 1.5 * age + (h3 - 0.5) * 3 * age, p0[2] + (h3 - 0.5) * 6 * age); if (!p) continue; const r = Math.min(10, Math.max(1.5, 0.12 * p[2])) * (1 - age / life * 0.5); ctx.globalAlpha = 0.85 * (1 - age / life); ctx.drawImage(T.glowSpr('spk', h2 > 0.4 ? [255, 214, 120] : [255, 150, 60], 0.2), p[0] - r * 2, p[1] - r * 2, r * 4, r * 4); } ctx.restore(); } } };
};
// ---- 龙的定妆表：侧面、俯看、四分之三正面、头部特写（T.SHEET = 'dragon' 时 b11_fly 开头 0.2 秒画）----
const dsheet = (ctx, s, M) => {
  M.resetTransform(ctx); const W = 1920, H = 1080;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1036'); g.addColorStop(1, '#1d1542'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const t0 = s.t, dr = { L: 10, g: 1, pos: (tt) => { const u = tt - t0; return [u * 4, 0.9 * Math.sin(u * 1.6), 0.35 * Math.sin(u * 0.9)]; }, freq: 0.5, amp: 0.6, glow: 0.5 };
  const look = (ox, oy, from, to, f) => { const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; return T.cam({ x: from[0], y: from[1], z: from[2], yaw: Math.atan2(d[0], d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])), f, ox, oy }); };
  const views = [['侧面', 0, 0, look(480, 285, [-5, 0.3, -15], [-5, 0, 0], 1150)], ['俯看', 960, 0, T.cam({ x: -5, y: 15, z: 0, yaw: 0, pitch: -Math.PI / 2 + 1e-4, f: 1100, ox: 1440, oy: 285 })],
    ['四分之三正面', 0, 540, look(480, 825, [5, 2.2, -6.5], [-2.5, 0, 0], 900)], ['头部特写', 960, 540, look(1440, 825, [1.3, 0.45, -1.9], [-0.4, -0.05, 0], 1050)]];
  for (const [name, x0, y0, c] of views) { ctx.save(); ctx.beginPath(); ctx.rect(x0 + 8, y0 + 8, 944, 524); ctx.clip();
    const bg = ctx.createRadialGradient(x0 + 480, y0 + 270, 40, x0 + 480, y0 + 270, 600); bg.addColorStop(0, '#24285e'); bg.addColorStop(1, '#0a0d2c'); ctx.fillStyle = bg; ctx.fillRect(x0, y0, 960, 540);
    JZ.dragon.draw(ctx, c, dr, s.t); ctx.restore(); ctx.fillStyle = 'rgba(255,240,220,0.8)'; ctx.font = '28px sans-serif'; ctx.fillText(name, x0 + 30, y0 + 50); }
};
// ---- 锦鲤定妆表：侧面、俯看、四分之三正面、头部特写 ----
const sheet = (ctx, s, M) => {
  M.resetTransform(ctx); const W = 1920, H = 1080;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1036'); g.addColorStop(1, '#1d1542'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const koi = { L: 1, pos: () => [0, 0, 0], dir: [1, 0, 0], freq: 0.6, amp: 0.8, glow: 0.6 };
  const look = (ox, oy, from, to, f) => { const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; return T.cam({ x: from[0], y: from[1], z: from[2], yaw: Math.atan2(d[0], d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])), f, ox, oy }); };
  const views = [['侧面', 0, 0, look(480, 285, [-0.45, 0, -2.0], [-0.45, 0, 0], 900)], ['俯看（在水里）', 960, 0, T.cam({ x: -0.45, y: 2.0, z: 0, yaw: 0, pitch: -Math.PI / 2 + 1e-4, f: 900, ox: 1440, oy: 285 })],
    ['四分之三正面', 0, 540, look(480, 800, [1.1, 0.45, -1.3], [-0.3, 0, 0], 900)], ['头部特写', 960, 540, look(1440, 800, [0.32, 0.12, -0.42], [0.04, 0, 0], 900)]];
  for (const [name, x0, y0, c] of views) { ctx.save(); ctx.beginPath(); ctx.rect(x0 + 8, y0 + 8, 944, 524); ctx.clip();
    const bg = ctx.createRadialGradient(x0 + 480, y0 + 270, 40, x0 + 480, y0 + 270, 600); bg.addColorStop(0, name.includes('水') ? '#173a5c' : '#24285e'); bg.addColorStop(1, '#0a0d2c'); ctx.fillStyle = bg; ctx.fillRect(x0, y0, 960, 540);
    K.draw(ctx, c, koi, s.t, false); ctx.restore(); ctx.fillStyle = 'rgba(255,240,220,0.8)'; ctx.font = '28px sans-serif'; ctx.fillText(name, x0 + 30, y0 + 50); }
};

// 转场里要两镜同时画的：E 叠化（≤ 6 帧）、C 扎进水里（水线从下往上扫）、I 水下顶出水面（水线从上往下扫）
// 「擦」（F，用户 2026-11-19：转场太快、没平滑过渡）：一样前景从右往左横过画面，新画面跟在它后面露出来，交界羽化；前景是暗的虚影（扫过镜头的前景不能是亮的）
const fishWall = (ctx, k, xm, t) => { for (let i = 0; i < 46; i++) { const h1 = M0.hash(i, 901), h2 = M0.hash(i, 902), h3 = M0.hash(i, 903), y = -80 + 1240 * h1, w = 160 + 420 * h3 * h3, x = xm + (h2 - 0.5) * 380 + 30 * Math.sin(t * 6 + i);
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.rotate(0.25 * Math.sin(t * 5 + i)); ctx.filter = `blur(${(2 + 8 * h3).toFixed(1)}px) brightness(${(0.75 - 0.35 * h3).toFixed(2)})`; ctx.drawImage(fishSpr(), -w * 0.7, -w * 0.21, w, w * 0.42); ctx.restore(); } };
const leafWall = (ctx, k, xm, t) => { for (const [dx, dy, sc] of [[0, 0, 1], [260, -380, 0.55], [-200, 420, 0.6]]) { ctx.save(); ctx.translate(xm + dx, 540 + dy); ctx.rotate(0.35 + 0.6 * k + dx * 0.001); ctx.scale(sc, sc); ctx.filter = 'blur(8px) brightness(0.6)';
  ctx.fillStyle = '#0d2a1c'; ctx.beginPath(); ctx.ellipse(0, 0, 760, 520, 0, 0.25, 6.0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(70,120,90,0.5)'; ctx.lineWidth = 6; for (let j = 0; j < 12; j++) { const a = 0.35 + j * 0.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 700, Math.sin(a) * 480); ctx.stroke(); } ctx.restore(); } };
const lanternWall = (ctx, k, xm, t) => { for (const [dx, dy, sc] of [[0, 0, 1], [300, 260, 0.45], [-260, -300, 0.5]]) { ctx.save(); ctx.translate(xm + dx, 400 + dy); ctx.rotate(0.06 * Math.sin(t + dx)); ctx.scale(sc, sc); ctx.filter = 'blur(6px) brightness(0.3)'; ctx.drawImage(T.skySpr(), -380, -540, 760, 1140); ctx.restore(); } };
const TR = { b11_fly: { prev: 't_lantern', dur: 0.7, kind: 'wipe', cover: fishWall }, t_roof: { prev: 't_wind', dur: 0.7, kind: 'wipe', cover: leafWall }, t_gate: { prev: 't_sky1', dur: 0.8, kind: 'wipe', cover: lanternWall }, t_umbr: { prev: 't_arch', dur: 0.1, kind: 'fade' }, t_under: { prev: 't_swarm', dur: 0.2, kind: 'up' }, t_wind: { prev: 't_scale', dur: 0.2, kind: 'down' } };
T.draw = (ctx, s, M) => { M0 = M; if (!R) init();
  if (T.SHEET && s.scene === 'b11_fly' && s.lt < 0.2) return (T.SHEET === 'dragon' ? dsheet : sheet)(ctx, s, M);
  const scn = s.scene;
  T.frame(ctx, s, SH[scn]({ ...s, scene: scn }));
  const tr = TR[scn]; if (!tr || s.lt >= tr.dur) return;
  const Lr = M.layer('xf'), g = Lr.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, Lr.width, Lr.height);
  const sp = { ...s, scene: tr.prev }; T.frame(g, sp, SH[tr.prev](sp));
  const k = s.lt / tr.dur; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (tr.kind === 'fade') { ctx.globalAlpha = 1 - k; ctx.drawImage(Lr, 0, 0); ctx.restore(); return; }
  if (tr.kind === 'wipe') { const sk = Lr.width / 1920, ke = k * k * (3 - 2 * k), xm = 1920 * (1.2 - 1.4 * ke), gm = g.createLinearGradient((xm - 170) * sk, 0, (xm + 170) * sk, 0); gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.fillStyle = gm; g.fillRect(0, 0, Lr.width, Lr.height); g.globalCompositeOperation = 'source-over';
    ctx.drawImage(Lr, 0, 0); ctx.restore(); ctx.save(); M.resetTransform(ctx); tr.cover(ctx, k, xm, s.t); ctx.restore(); return; }
  // 水线：带波纹的一条线；'up' 线以上还是上一镜（水面上），'down' 线以下还是上一镜（水下）
  const Hp = Lr.height, Wp = Lr.width, y0 = tr.kind === 'up' ? Hp * (1.05 - 1.15 * k) : Hp * (-0.05 + 1.15 * k), wave = (x) => y0 + Hp * 0.02 * Math.sin(x / Wp * 9 + s.t * 7) + Hp * 0.008 * Math.sin(x / Wp * 31 - s.t * 11);
  ctx.beginPath(); ctx.moveTo(0, wave(0)); for (let x = 0; x <= Wp; x += Wp / 48) ctx.lineTo(x, wave(x)); if (tr.kind === 'up') { ctx.lineTo(Wp, 0); ctx.lineTo(0, 0); } else { ctx.lineTo(Wp, Hp); ctx.lineTo(0, Hp); } ctx.closePath();
  ctx.save(); ctx.clip(); ctx.drawImage(Lr, 0, 0); ctx.restore();
  ctx.beginPath(); ctx.moveTo(0, wave(0)); for (let x = 0; x <= Wp; x += Wp / 48) ctx.lineTo(x, wave(x)); ctx.strokeStyle = 'rgba(220,250,255,0.75)'; ctx.lineWidth = Hp * 0.006; ctx.stroke(); ctx.restore();
};
T.SHEET = false;   // 定妆表：改 true 时 b11_fly 开头 0.2 秒画锦鲤定妆表（out/stills/锦鲤定妆表.jpg），改 'dragon' 画龙的定妆表
T.B = (x) => B(x);
T.camAt = (scn, t) => SH[scn]({ t, scene: scn }).cam; T.KOI = KOI;   // 调试时在页面里查机位、路线用：画过一帧以后才能调
})();
