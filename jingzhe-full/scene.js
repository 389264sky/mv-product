// scene.js —— 《惊蛰》的画面。引擎和歌词在 jz_core.js，每个世界一个文件（jz_tree.js…）；什么时候切写在 cues.json。
// 前奏、A2（整首 bar1–16）是湖这个世界的冬天（jz_lake.js 里按时间切）。片内 bar1–31 的四个世界在整首 bar17–47：它们拿的是 W（JZ.seg 换过号的 M），不是 M。
// 规矩：画面只由时间决定（随机用 M.hash / M.rng，粒子位置是出生时刻的函数）。
// bar8→9：镜头扎进水里，水线从画面底下升上去，线上面还是湖，线下面已经是水下（bar9 前 0.2 秒到后 0.1 秒）
let W;
const dunk = (ctx, s, W) => {
  const k = (s.t - W.ref('bar9') + 0.2) / 0.3;
  if (k <= 0) return JZ.lake.draw(ctx, s, W); if (k >= 1) return JZ.deep.draw(ctx, s, W);
  JZ.blend(ctx, W, () => JZ.lake.pose(s.t, W), () => JZ.deep.pose(s.t, W), { y: -0.05 + 1.15 * k, wave: 0.012, ysoft: 0.006 });
};
// bar16→17：镜头顺着旋涡的气芯升出水面，水线从画面顶上降下去，线上面是第三段的雷暴，线下面还是水下（bar17 前 0.28 秒到前 0.02 秒）
const rise = (ctx, s, W) => {
  const k = (s.t - W.ref('bar17') + 0.28) / 0.26;
  if (k <= 0) return JZ.deep.draw(ctx, s, W); if (k >= 1) return JZ.tree.draw(ctx, s, W);
  JZ.blend(ctx, W, () => JZ.tree.pose(s.t, W), () => JZ.deep.pose(s.t, W), { y: 1.1 - 1.15 * k, wave: 0.012, ysoft: 0.006 });
};
// 前奏、A2（bar1–16）成片画 Blender 渲的帧（blender/build.py，机位和湖这个世界共用 jz_lake.js 的路径）；预览、还没渲过时画着色器版本当代理
// bar6→7 E：冰里那颗圆气泡 → 月亮。Blender 两台相机各渲一份（cam_w_ice、cam_w_moon），bar7 前后 0.05 秒（6 帧）叠化，同 jz_lake.js 的 W.draw
const winter = (ctx, s, M) => {
  const p = M.plate(), k = (M.t - JZ.lake.cams().BB[7] + 0.05) / 0.1;
  if (p && k > 0 && k < 1) { const a = M.plate('w_ice'), b = M.plate('w_moon'); if (a && b) { ctx.drawImage(a, 0, 0, M.W, M.H); ctx.globalAlpha = k; ctx.drawImage(b, 0, 0, M.W, M.H); ctx.globalAlpha = 1; return; } }
  if (p) return ctx.drawImage(p, 0, 0, M.W, M.H); JZ.lake.draw(ctx, s, W);
};
// bar56→57 H（用户 2026-11-20：转场太快）：宇宙卷回的那一点光就是古镇河心落下的那一点。古镇开头 0.7 秒把宇宙那一帧叠在上面慢慢淡掉：星空淡出、古镇从黑里浮出来，光点一直在画面正中
const fall = (ctx, s, M) => {
  JZ.town.draw(ctx, s, M); const k = M.smooth(M.ref('bar57'), M.ref('bar57') + 0.7, s.t); if (k >= 1) return;
  const L = M.layer('xc'), g = L.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L.width, L.height); M.resetTransform(g); JZ.cosmos.draw(g, s, W);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - k; ctx.drawImage(L, 0, 0); ctx.restore();
};
MV.scene({
  bg: '#020306',
  async setup(M) { await JZ.init(M);
    W = JZ.seg(M, 16, 4, M.ref('bar17'), M.ref('bar57')); JZ.tree.build(W); JZ.lake.build(W); JZ.deep.build(W); JZ.cosmos.build(W); JZ.town.init(M);   // seg 到 bar57：E8（bar48–56）也在宇宙这个世界里
    JZ.recall = (g, w, t) => JZ[w].draw(g, { t }, W); },   // 尾声多元宇宙穿梭（jz_town_shots.js 的 VERSE）：把前面某个世界在 t 那一刻的样子画进 g
  shots: {   // 一行一个（cue_lint 按行认名字）；JZ.todo = 还没做
    todo: (ctx, s, M) => JZ.todo(),
    w_sky: (ctx, s, M) => winter(ctx, s, M),
    w_fall: (ctx, s, M) => winter(ctx, s, M),
    w_ice: (ctx, s, M) => winter(ctx, s, M),
    w_moon: (ctx, s, M) => winter(ctx, s, M),
    w_melt: (ctx, s, M) => winter(ctx, s, M),
    w_hole: (ctx, s, M) => winter(ctx, s, M),
    w_rise: (ctx, s, M) => winter(ctx, s, M),
    w_thaw: (ctx, s, M) => winter(ctx, s, M),
    ember: (ctx, s, M) => JZ.lake.draw(ctx, s, W),
    plume: (ctx, s, M) => JZ.lake.draw(ctx, s, W),
    rings: (ctx, s, M) => JZ.lake.draw(ctx, s, W),
    ridge: (ctx, s, M) => JZ.lake.draw(ctx, s, W),
    ridge_fire: (ctx, s, M) => JZ.lake.draw(ctx, s, W),
    ignite: (ctx, s, M) => dunk(ctx, s, W),
    dive: (ctx, s, M) => dunk(ctx, s, W),
    deep: (ctx, s, M) => JZ.deep.draw(ctx, s, W),
    drop: (ctx, s, M) => JZ.deep.draw(ctx, s, W),
    gale: (ctx, s, M) => JZ.deep.draw(ctx, s, W),
    eye: (ctx, s, M) => rise(ctx, s, W),
    strike: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    tree: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    limb: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    bloom: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    swarm: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    split: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    taiji: (ctx, s, M) => JZ.tree.draw(ctx, s, W),
    bang: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    nebula: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    galaxy: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    hole: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    web: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    web_out: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    ember_end: (ctx, s, M) => JZ.lake.drawEnd(ctx, s, W),
    startree: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    e8_fly: (ctx, s, M) => JZ.cosmos.draw(ctx, s, W),
    // 后半段（第十一次起）：灯火长街 + 锦鲤，全走 jz_town_shots.js
    t_fall: (ctx, s, M) => fall(ctx, s, M),
    t_eye: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_side: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_arch: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_umbr: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_lane: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_split: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_lantern: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    b11_fly: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_leap: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_swarm: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_under: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_scale: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_wind: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_roof: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_pov: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_spout: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_sky1: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_climb: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_gate: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_warp: (ctx, s, M) => JZ.town.draw(ctx, s, M),
    t_end: (ctx, s, M) => JZ.town.draw(ctx, s, M),
  },
  overlay(o, M) { JZ.title(o, M); JZ.lyrics(o, M); },   // 片头片尾的歌名歌手（jz_title.js）；右下角歌词（字体 MaShanZheng；JZ.lyrics 里调 M.logLyric）
});
