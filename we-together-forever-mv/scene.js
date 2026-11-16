// scene.js —— 《我会等》整首的镜头。天地在 world.js；她和他是用户的 VRM 模型，Blender 渲成透明底的人物层（blender/build.py），这里用 people() 叠进来；这里只管每个镜头怎么摆、怎么动。
// 片子按历程走：每个历程一张日期卡 + 一句告白（CARDS），歌词只在右下角逐字涂色（words）。
// 规矩：画面只由时间决定（随机用 M.hash，模拟用 M.sim / WORLD.chain）。
const WD = window.WORLD, TAU = Math.PI * 2;

// 景深：远处的东西先画到单独一层，糊着贴回来
const soft = (ctx, M, key, px, draw) => { const L = M.layer(key), l = L.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.globalAlpha = 1; l.globalCompositeOperation = 'source-over'; l.filter = 'none'; l.clearRect(0, 0, L.width, L.height); M.resetTransform(l); l.save(); draw(l); l.restore(); ctx.save(); ctx.filter = `blur(${px}px)`; ctx.drawImage(L, -24, -14, M.W + 48, M.H + 28); ctx.restore(); };

const mod = (x, m) => ((x % m) + m) % m;
// 她和他：两团光，珊瑚粉是她、靛蓝是他。P(t) 给 [x, y, 每米像素]，rm 是半径（米；屏幕坐标时 P 的第三项给 1，rm 就是像素），身后拖一小段光尾
const ORB = { her: ['#ff7a68', '#ffc8ba'], him: ['#5a6cff', '#c8d0ff'], };
const orb = (c, who, P, t, rm, a = 1) => { if (a <= 0.01) return; const [c0, c1] = ORB[who], d0 = WD.dot(c0), d1 = WD.dot(c1), [x, y, s] = P(t), r = rm * s * (1 + 0.06 * Math.sin(t * 3.1 + (who === 'her' ? 0 : 1.7)));
  c.save(); c.globalAlpha = 0.55 * a; c.drawImage(d0, x - 3 * r, y - 3 * r, 6 * r, 6 * r); c.globalAlpha = 0.8 * a; c.drawImage(d0, x - 1.6 * r, y - 1.6 * r, 3.2 * r, 3.2 * r); c.globalCompositeOperation = 'lighter';
  for (let k = 6; k > 0; k--) { const [tx, ty, ts] = P(t - k * 0.05), tr = rm * ts * (1 - k / 8); c.globalAlpha = a * 0.25 * (1 - k / 7); c.drawImage(d1, tx - tr, ty - tr, 2 * tr, 2 * tr); }
  c.globalAlpha = a; c.drawImage(d0, x - 1.8 * r, y - 1.8 * r, 3.6 * r, 3.6 * r); c.drawImage(d1, x - r, y - r, 2 * r, 2 * r); c.drawImage(WD.dot('#ffffff'), x - 0.45 * r, y - 0.45 * r, 0.9 * r, 0.9 * r); c.restore(); };
// 网页预览、草稿里的 3D 代理：blender/scene.glb（没摆姿势的人物和房子）和 blender/poses.json（每个镜头摆好的骨头）都是 `blender.py <项目> glb` 导出的（build.py 结尾）。
// 渲过 Blender 帧的镜头用渲好的帧，没渲过的用它；这个镜头不在 poses.json 里（新加的镜头还没重跑 track.py 和 glb）就还是光团和平面房子。光影粗，以 Blender 原帧为准。
let PX = null;
const PX_FACE = { happy: 'Fcl_ALL_Joy', fun: 'Fcl_ALL_Fun', sad: 'Fcl_ALL_Sorrow', surprised: 'Fcl_ALL_Surprised', angry: 'Fcl_ALL_Angry', blink: 'Fcl_EYE_Close', smile: 'Fcl_MTH_Fun', aa: 'Fcl_MTH_A', oh: 'Fcl_MTH_O' };   // 跟 build.py 的 FACE 一样
const proxyInit = async (M) => {
  if (!(await fetch('blender/poses.json', { method: 'HEAD' })).ok) return;   // 还没导出过：照旧画光团
  const [THREE, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
  const [g, poses] = await Promise.all([new GLTFLoader().loadAsync('blender/scene.glb'), fetch('blender/poses.json').then((r) => r.json())]);
  const SS = 2, GL = document.createElement('canvas'); GL.width = M.W * M.SC * SS; GL.height = M.H * M.SC * SS;   // 固定 2× 超采样，不用 MSAA
  const R = new THREE.WebGLRenderer({ canvas: GL, alpha: true, antialias: false, preserveDrawingBuffer: true, precision: 'highp', powerPreference: 'high-performance' });
  R.setPixelRatio(1); R.setSize(GL.width, GL.height, false); R.setClearColor(0x000000, 0);
  if (R.getContext().drawingBufferWidth !== GL.width) throw new Error(`WebGL 画布开不到 ${GL.width}×${GL.height}，画质会悄悄变低`);
  const sc = g.scene, drop = [], mats = {}, bars = [], col = (h) => new THREE.Color(h);
  sc.traverse((o) => { if (o.isLight || o.isCamera) drop.push(o); if (!o.isMesh) return; o.frustumCulled = false; const m = o.material;
    if (m.map) o.material = new THREE.MeshBasicMaterial({ map: m.map, transparent: m.transparent, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite });   // 人物：贴图的颜色照原样出
    else { mats[m.name] = mats[m.name] || (['glass', 'lamp', 'inside', 'photo'].includes(m.name) ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial({ color: m.color })); o.material = mats[m.name]; }
    if (['bar', 'bar.001'].includes(o.userData.name)) bars.push(o); });   // 大窗的窗棂
  drop.forEach((o) => o.removeFromParent()); mats.photo.map = null;
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sc.add(sun, new THREE.AmbientLight(0xffffff, 1.5));
  const base = Object.fromEntries(Object.entries(mats).filter(([, m]) => m.isMeshLambertMaterial).map(([k, m]) => [k, m.color.clone()]));
  sc.updateMatrixWorld(true);
  const rig = (who) => { const root = sc.getObjectByName(who), bones = [], by = {}, faces = [];
    root.traverse((o) => { if (o.isBone) { bones.push(o); by[o.userData.name || o.name] = o; o.userData.q0 = o.quaternion.clone(); o.userData.p0 = o.position.clone(); o.userData.m0 = o.getWorldQuaternion(new THREE.Quaternion()); o.userData.m = new THREE.Quaternion(); }
      if (o.isMesh && o.morphTargetDictionary && 'Fcl_ALL_Joy' in o.morphTargetDictionary) faces.push(o); });
    poses.bones[who].forEach((n, i) => { by[n].userData.i = i; });
    return { root, bones, faces, hips: bones.find((b) => /Hips/.test(b.userData.name || b.name)) }; };
  const cam = new THREE.PerspectiveCamera();
  PX = { THREE, R, GL, sc, cam, sun, poses, mats, base, bars, tex: {}, her: rig('her'), him: rig('him'), house: sc.getObjectByName('house'), door: sc.getObjectByName('door'), photo: sc.getObjectByName('photo'),
    qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), v: new THREE.Vector3(), night: col('#2a3160'), g0: col('#33405e'), g1: col('#ffcf7a'), lamp: col('#ffd38a'), inside: col('#ffcf8a') };
  R.compile(sc, cam);
};
const has3d = (M) => { try { if (M.plate()) return true; } catch (e) { if (!window.TRACKING) throw e; } return !!(PX && PX.poses.shots[M.s.id]); };   // 这个镜头有 Blender 帧或者代理
// 这一帧的代理：照 cam 摆相机（跟 WORLD.proj 一样只平移，地平线高低用偏心的视锥对）、照 poses.json 摆骨头、照 A 摆位置、表情和房子，渲到透明底的画布上返回；没有就返回 null
const proxy = (M, s, cam, key, A) => { const sh = PX && PX.poses.shots[s.id]; if (!sh) return null;
  const { THREE, R, sc, qa, qb, v } = PX, n = 0.05, k = n / cam.f, c = PX.cam;
  c.position.set(cam.x, cam.y, -cam.z); c.projectionMatrix.makePerspective(-M.W / 2 * k, M.W / 2 * k, cam.hy * k, -(M.H - cam.hy) * k, n, 400); c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  PX.sun.position.set(key[0], -key[1], 0.6);
  const u = M.clamp((s.t * 60 - sh.f0) / sh.step, 0, sh.frames.length - 1), i = Math.floor(u), F0 = sh.frames[i], F1 = sh.frames[Math.min(i + 1, sh.frames.length - 1)], ku = u - i;
  for (const w of ['her', 'him']) { const g = PX[w], a = A[w], p0 = F0[w], p1 = F1[w] || p0; g.root.visible = !!(a && !(a.hide > 0.5) && p0); if (!g.root.visible) continue;
    g.root.position.set(a.x, a.y || 0, -a.z); g.root.rotation.set(0, Math.PI - (a.yaw || 0) * Math.PI / 180, 0);
    for (const b of g.bones) { const d = b.userData, pm = b.parent.isBone ? b.parent.userData.m : null, j = d.i * 4;
      if (d.i === undefined) { b.quaternion.copy(d.q0); pm ? d.m.copy(pm).multiply(d.q0) : d.m.copy(d.q0); continue; }
      qa.set(p0.q[j + 1], p0.q[j + 3], -p0.q[j + 2], p0.q[j]); qb.set(p1.q[j + 1], p1.q[j + 3], -p1.q[j + 2], p1.q[j]); qa.slerp(qb, ku);   // Blender 的 (w x y z)、z 朝上 → three 的 y 朝上
      d.m.copy(qa).multiply(d.m0); pm ? b.quaternion.copy(pm).invert().multiply(d.m) : b.quaternion.copy(d.m);
      if (b === g.hips) { v.set(M.lerp(p0.h[0], p1.h[0], ku), M.lerp(p0.h[2], p1.h[2], ku), -M.lerp(p0.h[1], p1.h[1], ku)); if (pm) v.applyQuaternion(qb.copy(pm).invert()); b.position.copy(d.p0).add(v); } }
    for (const f of g.faces) { const D = f.morphTargetDictionary; for (const q in D) if (q.startsWith('Fcl_')) f.morphTargetInfluences[D[q]] = 0; if (p0.f) { const fb = p1.f || p0.f; for (const q in { ...p0.f, ...fb }) { const t = D[q]; if (t !== undefined) f.morphTargetInfluences[t] = M.clamp(M.lerp(p0.f[q] || 0, fb[q] || 0, ku)); } }   // 表情用 poses.json 里滤过的（慢起慢收，带眨眼）
      else for (const q in a.face || {}) { const t = D[PX_FACE[q] || q]; if (t !== undefined) f.morphTargetInfluences[t] = M.clamp(a.face[q]); } } }
  const h = A.house; PX.house.visible = !!h;
  if (h) { const m = PX.mats, ph = h.ph && M.img[h.ph]; PX.house.position.set(h.x, 0, -h.z); PX.door.rotation.set(0, -105 * Math.PI / 180 * h.door, 0);
    for (const q in PX.base) m[q].color.copy(PX.base[q]).lerp(PX.night, 0.6 * (h.night || 0));
    m.glass.color.copy(PX.g0).lerp(PX.g1, h.win); m.lamp.color.copy(PX.lamp).multiplyScalar(0.25 + 0.75 * h.win); m.inside.color.copy(PX.inside).multiplyScalar(Math.min(1, 0.3 + 1.2 * h.door));
    PX.photo.visible = !!ph; PX.bars.forEach((o) => { o.visible = !ph; });
    if (ph) { const tx = PX.tex[h.ph] = PX.tex[h.ph] || Object.assign(new THREE.Texture(ph), { colorSpace: THREE.SRGBColorSpace, flipY: false, needsUpdate: true }), kk = Math.min(1.7 / ph.width, 1.6 / ph.height) * 0.86;
      m.photo.map = tx; m.photo.color.setScalar(h.win); PX.photo.scale.set(ph.width * kk, ph.height * kk, 1); } }
  R.render(sc, c); R.getContext().finish(); return PX.GL; };
// 人物层（她、他是用户的 VRM 模型，Blender 渲，blender/build.py）：这一帧的相机 cam、光从哪边来、每个人的位置和姿势 A = { her: {...}, him: {...}, pts: {...} }
// 记进 window.__track（blender/track.py 导出给 build.py，姿势怎么写见 build.py 的 pose）；渲过 Blender 帧就罩上环境色、轮廓光叠进来，没渲过（预览、草稿）换成 3D 代理（上面的 proxy），代理也没有才画光团占位。
// o.rim / rimW / amb 给 WORLD.lit（amb 不给：夜里罩得重），o.shadow 脚下影子的浓淡（0 不画），o.alpha 整层透明度
const people = (ctx, M, s, cam, md, A, o = {}) => {
  const m = typeof md === 'string' ? { a: md, b: md, k: 0 } : md, key = [0, 1].map((i) => M.lerp(WD.MOODS[m.a].key[i], WD.MOODS[m.b].key[i], m.k)), night = M.lerp(WD.MOODS[m.a].stars, WD.MOODS[m.b].stars, m.k);
  (window.__track = window.__track || {})[s.id] = { cam, key, ...A };
  let p = null; try { p = M.plate(); } catch (e) { if (!window.TRACKING) throw e; }
  if (!p && !window.TRACKING) p = proxy(M, s, cam, key, A);
  for (const w of ['her', 'him']) { const a = A[w]; if (!a || a.hide > 0.5) continue;
    if (o.shadow !== 0) WD.shadow(ctx, cam, a.x, a.z, 0.5, (o.shadow ?? 0.45) * (1 - Math.min(1, (a.y || 0) / 2)));
    if (!p) orb(ctx, w, () => WD.proj(cam, a.x, (a.y || 0) + 1.0 - 0.5 * (a.sit || 0), a.z), s.t, 0.16); }
  if (p) { ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; WD.lit(ctx, 'ppl', md, (c) => c.drawImage(p, 0, 0, M.W, M.H), { rim: o.rim ?? 0.7, rimW: o.rimW ?? 3, amb: o.amb ?? M.lerp(0.55, 0.92, Math.min(1, night)) }); ctx.restore(); }
};
// 两个人并肩，背对镜头（她在左、他在右，他的左手牵她的右手）：mode 'walk' 沿路走 / 'sit' 坐在草里 / 'stand' 站着；z 这一刻在哪，dist 一共走了多少米。
// o: x 中线, gap 隔多远, yaw, gait 步子大小, hold 牵手 0..1, look 两人都看哪, lean 她往他肩上靠 0..1, her / him 再盖几项
const duo = (mode, z, dist = 0, o = {}) => { const sit = mode === 'sit' ? 1 : 0, gap = o.gap ?? (sit ? 0.46 : 0.5), x = o.x || 0, gait = o.gait ?? (mode === 'walk' ? 1 : 0), hold = o.hold ?? (sit ? 0 : 1), yaw = o.yaw || 0, lean = o.lean || 0;
  return { her: { x: x - gap / 2, z, yaw, sit, gait, walk: dist / 1.3, look: o.look, side: -12 * lean, head: [0, 0, -10 * lean], armR: [82 - 14 * hold, 3, 14], wristR: -25 * hold, turnR: 80 * hold, gripR: 0.45 * hold, calmR: hold, ...o.her },   // 牵手：她把手朝他伸出；掌心朝前的手 wrist 要负值才是往自己这边勾来（胳膊离开身体），两条小臂在中间碰上成 Y 字：两人手腕都往里勾，两只手并在一起朝下（不勾就各顺着小臂交叉成 X）；她掌心朝前、他掌心朝后，掌心贴掌心，手指扣住
    him: { x: x + gap / 2, z, yaw, sit, gait, walk: dist / 1.45 + 0.5, look: o.look, handL: ['her.holdR', hold], wristL: 25 * hold, turnL: -80 * hold, gripL: 0.5 * hold, calmL: hold, ...o.him } }; };
// 照片清单在 photos.js（photos.py 按时间线排的）：键 = 组名 + 序号，ALLPH 是全部照片按时间线
const PHS = window.PHOTOS, ALLPH = PHS.all;
let MM = null;   // setup 里记下运行库，给不带 M 的零件（换景）用
// 照片缩到长边 px 缓存；原图横着存的（PHS.rot）在这里转正。返回 card 要的 [图, sx, sy, sw, sh]
const upright = (M, key, px) => { const im = M.img[key], r = PHS.rot[key] || 0, sw = r % 180 ? im.height : im.width, sh = r % 180 ? im.width : im.height, k = Math.min(1, px / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
  return [M.cached('up' + px + key, w, h, (g) => { g.imageSmoothingQuality = 'high'; g.translate(w / 2, h / 2); g.rotate(r * Math.PI / 180); const dw = r % 180 ? h : w, dh = r % 180 ? w : h; g.drawImage(im, -dw / 2, -dh / 2, dw, dh); }), 0, 0, w, h]; };
// 照片的方形裁切，缓存成 400 px，免得每帧从原图缩；返回 card 要的 [图, sx, sy, 边长]
const sq = (M, key) => [M.cached('sq' + key, 400, 400, (g) => { const [im, , , w, h] = upright(M, key, 900), m = Math.min(w, h), k = 400 / m; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h, -(w - m) / 2 * k, -Math.min(h - m, Math.max(0, h * 0.42 - m / 2)) * k, w * k, h * k); }), 0, 0, 400];
// 一张带白边的相片：(x, y) 是照片中心，w 照片宽，rot 转角；pic 第 5 项给了就按原比例（高 = w × sh / sw）
const card = (c, pic, x, y, w, rot = 0, a = 1) => { if (a <= 0.01 || w < 2) return; const b = w * 0.06; c.save(); c.globalAlpha *= a; c.translate(x, y); c.rotate(rot);
  c.shadowColor = 'rgba(0,0,20,.45)'; c.shadowBlur = w * 0.08; c.shadowOffsetY = w * 0.03; c.fillStyle = '#fbf7ee'; const sh = pic[4] ?? pic[3], h = w * sh / pic[3]; c.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b + w * 0.14); c.shadowColor = 'transparent';
  c.drawImage(pic[0], pic[1], pic[2], pic[3], sh, -w / 2, -h / 2, w, h); c.restore(); };
// 一整条路的远景和中景：天、地、电线杆、草、树。最近一层草由调用方接着画（dP = 前景离镜头多远）
// 换景（不是每一镜都是那条土路）。人站的地方（离镜头 13 米以内）都是实地。
const nightK = (md) => { const m = typeof md === 'string' ? { a: md, b: md, k: 0 } : md; return M_lerp(WD.MOODS[m.a].stars, WD.MOODS[m.b].stars, m.k); };
const skyLight = (md) => { const m = typeof md === 'string' ? { a: md, b: md, k: 0 } : md, A = WD.MOODS[m.k > 0.5 ? m.b : m.a]; return A.sun || A.moon; };
// 水：天和山倒映在里面，波纹慢慢走，太阳 / 月亮底下一条碎光；sea 海边（沙滩、浪花）/ 否则湖边（草岸）；shore = false 不画岸（镜头在水面上飞）
const water = (ctx, cam, md, t, sea, shore = true) => { const W = 1920, H = 1080, hy = cam.hy, C = (k, i) => WD.col(md, k, i), h = MM.hash, nk = nightK(md);
  ctx.save(); ctx.beginPath(); ctx.rect(0, hy, W, H - hy); ctx.clip();
  ctx.save(); ctx.translate(0, 2 * hy); ctx.scale(1, -1); WD.backdrop(ctx, md, cam); ctx.restore();
  const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, WD.rgba(C('sky', 2), sea ? 0.5 : 0.28)); g.addColorStop(0.5, WD.rgba(WD.mix(C('sky', 1), '#0c3c6c', 0.45), sea ? 0.78 : 0.6)); g.addColorStop(1, WD.rgba(WD.mix(C('sky', 0), '#06284c', 0.5), 0.9)); ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
  ctx.lineCap = 'round'; for (let i = 0; i < (sea ? 240 : 120); i++) { const q = h(i, 901) ** 1.7, y = hy + 3 + (H - hy) * q, len = (16 + 150 * q) * (0.5 + h(i, 902)), x = mod(h(i, 903) * (W + 400) + t * (sea ? 26 : 8) * (0.3 + q) * (i % 2 ? 1 : -0.6), W + 400) - 200;
    ctx.strokeStyle = `rgba(255,255,255,${(0.08 + 0.2 * q) * (0.5 + 0.5 * Math.sin(t * (0.8 + h(i, 904)) + i)) * (1 - 0.5 * nk)})`; ctx.lineWidth = 1 + 2.5 * q; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 3 * q * (sea ? 2 : 1), x + len, y); ctx.stroke(); }
  const L = skyLight(md); if (L) { const [sx] = WD.plateXY(cam, L), sp = WD.dot('#fff2c8'); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 80; i++) { const q = h(i, 905) ** 1.5, y = hy + 4 + (H - hy) * q, x = sx + (h(i, 906) * 2 - 1) * (14 + 200 * q), r = 3 + 10 * q; ctx.globalAlpha = 0.55 * (0.4 + 0.6 * Math.sin(t * (2 + 3 * h(i, 907)) + i)) ** 2; ctx.drawImage(sp, x - 3 * r, y - r, 6 * r, 2 * r); } }
  ctx.restore(); if (!shore) return;
  const ys = hy + cam.y * cam.f / 13, lap = sea ? 14 * Math.sin(t * 0.9) : 0, edge = (x, d) => ys + d + lap * (0.6 + 0.4 * Math.sin(x / 500)) + 26 * Math.sin(x / 310 + 1.3 - cam.x * 0.2) + 12 * Math.sin(x / 97 - cam.x * 0.5), path = (d) => { ctx.beginPath(); for (let x = -20; x <= W + 20; x += 24) ctx.lineTo(x, edge(x, d)); };
  path(0); ctx.lineTo(W + 20, H); ctx.lineTo(-20, H); ctx.closePath(); const bg = ctx.createLinearGradient(0, ys - 40, 0, H);
  if (sea) { bg.addColorStop(0, WD.mix('#ead6a8', C('ground', 1), 0.2 + 0.6 * nk)); bg.addColorStop(1, WD.mix('#b8946a', C('ground', 2), 0.25 + 0.6 * nk)); } else { bg.addColorStop(0, C('ground', 1)); bg.addColorStop(1, C('ground', 2)); }
  ctx.fillStyle = bg; ctx.fill();
  if (sea) { ctx.save(); ctx.lineJoin = 'round'; path(16); ctx.strokeStyle = 'rgba(70,56,70,.16)'; ctx.lineWidth = 34; ctx.stroke(); path(-4); ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - 0.5 * nk)})`; ctx.lineWidth = 18; ctx.stroke(); path(-2); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - 0.5 * nk)})`; ctx.lineWidth = 6; ctx.stroke(); ctx.restore(); } };
// 花田：一垄一垄的紫色花往天边收，近处看得见花穗
const lavender = (ctx, cam, md, t) => { const W = 1920, H = 1080, hy = cam.hy, h = MM.hash, nk = nightK(md), C = (c, i) => WD.mix(c, WD.col(md, 'ground', i), 0.2 + 0.5 * nk);
  const g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, C('#cdb6ee', 0)); g.addColorStop(0.3, C('#9a78d8', 1)); g.addColorStop(1, C('#553a9c', 2)); ctx.fillStyle = g; ctx.fillRect(0, hy - 1, W, H - hy + 1);
  ctx.fillStyle = 'rgba(52,26,100,.24)'; for (let k = Math.floor(cam.x / 1.5) - 44; k <= cam.x / 1.5 + 44; k++) { const x = k * 1.5 + 0.75, a = WD.proj(cam, x - 0.3, 0, cam.z + 0.7), b = WD.proj(cam, x + 0.3, 0, cam.z + 0.7), c = WD.proj(cam, x, 0, cam.z + 400); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fill(); }
  const cols = ['#b08cf0', '#8a62dc', '#d4b8ff', '#a070e8']; ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 700; i++) { const q = h(i, 911) ** 2, y = hy + 4 + (H - hy) * 0.4 * q, r = 1.5 + 5 * q; ctx.globalAlpha = 0.7; ctx.fillStyle = cols[i % 4]; ctx.fillRect(h(i, 912) * W, y, r * 1.6, r); }
  for (let iz = Math.floor((cam.z + 24) / 0.9); iz * 0.9 > cam.z + 1.2; iz--) { const z = iz * 0.9, d = z - cam.z, half = 960 * d / cam.f + 1; for (let ix = Math.floor((cam.x - half) / 0.75); ix <= (cam.x + half) / 0.75; ix++) { const x = (ix + h(ix, iz) - 0.5) * 0.75, [sx, sy, sc] = WD.proj(cam, x, 0, z + (h(ix, iz + 77) - 0.5) * 0.9), hh = (0.4 + 0.3 * h(ix, iz + 9)) * sc, sw = 0.08 * hh * Math.sin(t * 1.6 + x * 0.8 + z * 0.5);
    ctx.globalAlpha = MM.clamp((24 - d) / 6); ctx.strokeStyle = 'rgba(74,120,84,.8)'; ctx.lineWidth = Math.max(1, 0.018 * sc); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy - hh); ctx.stroke(); ctx.fillStyle = cols[(ix + iz) & 3];
    for (let j = 0; j < 4; j++) { const u = 0.55 + 0.15 * j, r = (0.05 - 0.007 * j) * sc; ctx.beginPath(); ctx.arc(sx + sw * u, sy - hh * u, r, 0, TAU); ctx.fill(); } } }
  ctx.restore(); };
// 山顶云海：一层层云慢慢翻，远处几座峰从云里冒头；ledge 脚下的山石
const cloudsea = (ctx, cam, md, t, ledge = true) => { const W = 1920, H = 1080, hy = cam.hy, h = MM.hash, nk = nightK(md), C = (k, i) => WD.col(md, k, i);
  const g = ctx.createLinearGradient(0, hy - 2, 0, H); g.addColorStop(0, C('sky', 3)); g.addColorStop(1, WD.mix(C('sky', 1), '#ffffff', 0.3 * (1 - nk))); ctx.fillStyle = g; ctx.fillRect(0, hy - 2, W, H - hy + 2);
  const layer = (L) => { const y0 = hy - 16 + L * 46 + L * L * 9, sp = WD.dot(L % 2 ? '#ffffff' : WD.mix('#ffffff', C('sky', 3), 0.5)); ctx.save(); ctx.globalAlpha = 0.55 * (1 - 0.45 * nk);
    for (let j = 0; j < 18; j++) { const w = (300 + 340 * h(j, 921 + L)) * (0.7 + 0.28 * L), x = mod(h(j, 931 + L) * (W + 900) + t * (4 + 5 * L) * (L % 2 ? 1 : -1) - cam.x * 14 * (L + 1), W + 900) - 450, hh = w * 0.3; ctx.drawImage(sp, x - w / 2, y0 - hh / 2 + 14 * Math.sin(t * 0.3 + j + L), w, hh); } ctx.restore(); };
  const peak = (i) => { const x = mod(h(i, 941) * (W + 600) - cam.x * (20 + 10 * i), W + 600) - 300, w = 200 + 240 * h(i, 942), hh = 150 + 170 * h(i, 943), base = hy + 60 + 44 * i; ctx.beginPath(); ctx.moveTo(x - w, base + 60);
    for (let k = 0; k <= 24; k++) { const u = k / 12 - 1; ctx.lineTo(x + u * w, base - hh * (1 - Math.abs(u) ** 1.25) - 26 * h(k, 951 + i) * (1 - Math.abs(u))); } ctx.lineTo(x + w, base + 60); ctx.closePath(); const pg = ctx.createLinearGradient(0, base - hh, 0, base + 60); pg.addColorStop(0, WD.mix(C('mtn', 2), '#2a2438', 0.35)); pg.addColorStop(1, WD.mix(C('mtn', 1), C('sky', 3), 0.6)); ctx.fillStyle = pg; ctx.fill(); };
  layer(0); peak(0); peak(1); layer(1); peak(2); layer(2); peak(3); layer(3); layer(4); layer(5); layer(6);
  if (!ledge) return; const ys = hy + cam.y * cam.f / 12, edge = (x) => ys + 30 * Math.sin(x / 260 + 0.7 - cam.x * 0.3) + 16 * Math.sin(x / 71 - cam.x) + 8 * Math.sin(x / 23);
  ctx.beginPath(); for (let x = -20; x <= W + 20; x += 12) ctx.lineTo(x, edge(x)); ctx.lineTo(W + 20, H); ctx.lineTo(-20, H); ctx.closePath(); const rg = ctx.createLinearGradient(0, ys - 40, 0, H); rg.addColorStop(0, WD.mix('#7a6a84', C('sky', 0), 0.3 + 0.4 * nk)); rg.addColorStop(1, WD.mix('#2c2438', C('sky', 0), 0.3)); ctx.fillStyle = rg; ctx.fill();
  ctx.beginPath(); for (let x = -20; x <= W + 20; x += 12) ctx.lineTo(x, edge(x)); ctx.strokeStyle = `rgba(255,232,206,${0.4 * (1 - 0.6 * nk)})`; ctx.lineWidth = 3; ctx.stroke(); };
// 天、地和这一镜的景。o.place：'road' 土路和那棵树（默认）/ 'meadow' 没有路的草地 / 'sea' 海边 / 'lake' 湖边 / 'lavender' 花田 / 'cloud' 山顶云海；o.keepTree 草地上留着那棵树；o.shore = false 不画岸和山石。最近一层草由调用方接着画（dP = 前景离镜头多远）
const land = (ctx, cam, md, t, dP, o = {}) => { const dT = -cam.z, pl = o.place || 'road'; WD.backdrop(ctx, md, cam); if (o.stars) WD.twinkle(ctx, cam, t, o.stars, 140); if (o.sky) o.sky(ctx);
  WD.ROAD = pl === 'road'; WD.NOGRASS = pl === 'sea' || pl === 'cloud' || pl === 'lavender';
  if (pl === 'sea' || pl === 'lake') { water(ctx, cam, md, t, pl === 'sea', o.shore !== false); if (pl === 'lake' && o.shore !== false) WD.grass(ctx, cam, md, t, dP, 13, o.wind); return; }
  if (pl === 'cloud') return cloudsea(ctx, cam, md, t, o.shore !== false);
  WD.ground(ctx, cam, md, WD.ROAD); if (pl === 'lavender') return lavender(ctx, cam, md, t); if (WD.ROAD) WD.poles(ctx, cam, md);
  if ((WD.ROAD || o.keepTree) && dT > dP) { WD.grass(ctx, cam, md, t, dT + 0.4, 150, o.wind); WD.shadow(ctx, cam, WD.TREE_X, 0, 7, 0.3); if (o.tint) WD.lit(ctx, 'tree', md, (c) => WD.tree(c, cam, t, md, o.tree || {}), { rim: 0.55, rimW: 2, amb: o.tint }); else WD.tree(ctx, cam, t, md, o.tree || {}); WD.grass(ctx, cam, md, t, dP, dT + 0.4, o.wind); } else WD.grass(ctx, cam, md, t, dP, 150, o.wind); };
const LEAF = [{ kind: 'leaf', f: () => 1 }];
// 飘着的落叶：drift 是风已经把它们往右带了多少像素（风会变就传积分）
const leaves = (ctx, M, t, n, drift, a = 1) => { for (let i = 0; i < n; i++) { const dep = 0.45 + 1.7 * M.hash(i, 31) ** 2, x = mod(M.hash(i, 32) * 2300 + drift * dep + 50 * dep * Math.sin(t * (0.7 + M.hash(i, 33)) + i), 2300) - 190, y = mod(M.hash(i, 34) * 1300 + t * (70 + 60 * M.hash(i, 35)) * dep, 1300) - 110;
  WD.flake(ctx, 'leaf', i, x, y, (7 + 9 * M.hash(i, 36)) * dep, t * (1 + 2 * M.hash(i, 37)) + i, t * (2 + 4 * M.hash(i, 38)) + i, a * (dep > 1.6 ? 0.6 : 0.95)); } };
// 看得见的风：一把细长的白线从画面一头扫到另一头，dir = 1 往右
const gust = (ctx, M, t, t0, dir, n = 14) => { ctx.save(); ctx.lineCap = 'round'; for (let i = 0; i < n; i++) { const tau = t - t0 - 0.9 * M.hash(i, 41), life = 1.1 + 0.6 * M.hash(i, 42); if (tau <= 0 || tau >= life) continue;
  const p = tau / life, y0 = 140 + 780 * M.hash(i, 43), len = 380 + 420 * M.hash(i, 44), xh = dir > 0 ? -300 + 2700 * p : 2220 - 2700 * p, amp = 26 + 44 * M.hash(i, 45), w = 2 + 4 * M.hash(i, 46);
  for (let k = 0; k < 18; k++) { const q0 = k / 18, q1 = (k + 1) / 18, xa = xh - dir * len * q0, xb = xh - dir * len * q1; ctx.beginPath(); ctx.moveTo(xa, y0 + amp * Math.sin(xa * 0.006 + i)); ctx.lineTo(xb, y0 + amp * Math.sin(xb * 0.006 + i)); ctx.strokeStyle = `rgba(255,255,255,${0.55 * Math.sin(Math.PI * p) * (1 - q0)})`; ctx.lineWidth = w * (1 - 0.7 * q0); ctx.stroke(); } } ctx.restore(); };
// 他那辆旧自行车，从左后方看：(sx, sy) 是后轮着地点，s 是每米多少像素，spin 是轮子转过的弧度
const bike = (c, sx, sy, s, spin) => { c.save(); c.translate(sx, sy); c.scale(s, -s); c.lineCap = c.lineJoin = 'round';
  const wheel = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.strokeStyle = '#23242e'; c.lineWidth = 0.055; c.stroke(); c.beginPath(); c.ellipse(x, y, rx * 0.8, ry * 0.9, 0, 0, TAU); c.strokeStyle = '#c8ccd8'; c.lineWidth = 0.014; c.stroke();
    c.strokeStyle = 'rgba(222,228,240,.8)'; c.lineWidth = 0.006; for (let k = 0; k < 8; k++) { const a = spin + k * Math.PI / 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rx * 0.8 * Math.cos(a), y + ry * 0.9 * Math.sin(a)); c.stroke(); } };
  const line = (P, col, w) => { c.beginPath(); P.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  wheel(0.44, 0.38, 0.1, 0.3);
  for (const [col, w, d] of [['#2c4458', 0.05, 0], ['#6f9ab4', 0.03, 0.006]]) { line([[0.44, 0.38], [0.38, 0.96 + d], [0.37, 1.07 + d]], col, w); line([[0, 0.34], [0.06, 0.9 + d], [0.38, 0.97 + d]], col, w); line([[0, 0.34], [0.2, 0.33], [0.06, 0.9 + d]], col, w); line([[0.2, 0.33], [0.37, 0.88 + d]], col, w); }
  line([[-0.14, 0.73], [0.1, 0.75]], '#8a8f9c', 0.03); line([[-0.1, 0.73], [0, 0.34]], '#8a8f9c', 0.018);
  wheel(0, 0.34, 0.13, 0.34);
  c.beginPath(); c.ellipse(0.05, 0.95, 0.12, 0.045, -0.1, 0, TAU); c.fillStyle = '#5a3a2a'; c.fill(); c.strokeStyle = '#2e1c14'; c.lineWidth = 0.012; c.stroke();
  line([[0.18, 1.11], [0.37, 1.08], [0.56, 1.04]], '#9aa0ae', 0.028); line([[0.18, 1.11], [0.24, 1.1]], '#23242e', 0.045); line([[0.5, 1.05], [0.56, 1.04]], '#23242e', 0.045);
  c.restore(); };
// 狗尾草：从手里 (x, y) 往上长 len，梢上一穗毛；glow 是穗子亮了多少
const foxtail = (c, x, y, len, lean, glow) => { const P1 = [x, y - len * 0.6], P2 = [x + lean * len, y - len], bz = (q) => [(1 - q) ** 2 * x + 2 * (1 - q) * q * P1[0] + q * q * P2[0], (1 - q) ** 2 * y + 2 * (1 - q) * q * P1[1] + q * q * P2[1]];
  c.save(); c.lineCap = 'round'; c.strokeStyle = '#8fbf8a'; c.lineWidth = Math.max(1.2, len * 0.016); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]); c.stroke();
  for (let i = 0; i < 16; i++) { const q = 0.66 + 0.34 * i / 15, [bx, by] = bz(q), r = len * 0.04 * Math.sin(Math.PI * (0.12 + 0.8 * i / 15)) + 0.6; c.strokeStyle = 'rgba(226,244,180,.8)'; c.lineWidth = Math.max(0.8, len * 0.006); for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + sg * r * 2.2, by - r * 1.6); c.stroke(); } c.fillStyle = '#d9eeaa'; c.beginPath(); c.arc(bx, by, r, 0, TAU); c.fill(); }
  if (glow > 0.01) { const sp = WD.dot('#fff6c0'), [gx, gy] = bz(0.86), r = len * (0.5 + 0.9 * glow); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, glow); c.drawImage(sp, gx - r, gy - r, 2 * r, 2 * r); c.drawImage(sp, gx - r * 0.35, gy - r * 0.35, r * 0.7, r * 0.7); }
  c.restore(); };
// 最前面的一根枯枝（压着雪），梢上冒出第一颗芽；bud 0..1
const twig = (c, bud, bud2) => { c.save(); c.lineCap = c.lineJoin = 'round';
  const BR = [[[1990, 10], [1720, 150], [1480, 270], [1250, 392], 64, 15], [[1620, 200], [1590, 330], [1560, 420], [1486, 500], 26, 8], [[1800, 110], [1700, 60], [1620, 20], [1500, -10], 28, 9], [[1400, 318], [1340, 262], [1290, 226], [1222, 214], 18, 6]];
  const bz = (P, q) => [0, 1].map((k) => (1 - q) ** 3 * P[0][k] + 3 * (1 - q) ** 2 * q * P[1][k] + 3 * (1 - q) * q * q * P[2][k] + q ** 3 * P[3][k]);
  const pass = (col, kw, ox, oy, skip) => { c.strokeStyle = col; for (const P of BR) for (let i = 0; i < 22; i++) { if (skip && (i * 7 + P[4]) % 5 === 0) continue; const a = bz(P, i / 22), b = bz(P, (i + 1) / 22), w = M_lerp(P[4], P[5], i / 22); c.lineWidth = w * kw; c.beginPath(); c.moveTo(a[0] + ox * w, a[1] + oy * w); c.lineTo(b[0] + ox * w, b[1] + oy * w); c.stroke(); } };
  pass('#141730', 1, 0, 0); pass('#56669e', 0.3, -0.12, -0.22); pass('#aebde8', 0.62, 0.02, -0.5, 1); pass('#f2f6ff', 0.46, 0, -0.62, 1);
  const tip = (x, y, a, r, k) => { if (k <= 0.01) return; c.save(); c.translate(x, y); const sp = WD.dot('#f0ffb4'), gr = r * 5 * k; c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 * Math.min(1, k); c.drawImage(sp, -gr, -gr, 2 * gr, 2 * gr); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.rotate(a); c.scale(k, k);
    const g = c.createLinearGradient(-r * 0.5, 0, r * 0.6, 0); g.addColorStop(0, '#f2ffbe'); g.addColorStop(0.6, '#b4e678'); g.addColorStop(1, '#5fae52'); c.beginPath(); c.moveTo(0, r * 0.5); c.bezierCurveTo(-r * 0.75, r * 0.2, -r * 0.55, -r * 0.9, 0, -r * 1.35); c.bezierCurveTo(r * 0.55, -r * 0.9, r * 0.75, r * 0.2, 0, r * 0.5); c.fillStyle = g; c.fill(); c.strokeStyle = '#3d7d48'; c.lineWidth = r * 0.07; c.stroke();
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(0, r * 0.5); c.quadraticCurveTo(sg * r * 0.9, r * 0.25, sg * r * 0.8, -r * 0.45); c.quadraticCurveTo(sg * r * 0.4, -r * 0.1, 0, r * 0.5); c.fillStyle = '#7cc463'; c.fill(); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-r * 0.22, -r * 0.5, r * 0.09, r * 0.28, 0.2, 0, TAU); c.fill(); c.restore(); };
  tip(1242, 396, -1.08, 54, bud); tip(1480, 506, -2.3, 28, bud2); tip(1214, 213, -1.4, 24, bud2);
  c.restore(); };
const M_lerp = (a, b, k) => a + (b - a) * k;

// 每个历程：at 落卡的时刻，date / what 日期卡（date 和上一张一样就不再重新落一次；enDate 日期用 Allura 花体，en 小字后面接一段 Allura 花体英文），say 他写给她的告白（没有 say 的沿用上一句），pos 告白放哪 [x, y, 对齐]，end 只是收掉前面的卡
const CARDS = [
  { at: 0, say: '故事开始的那天，风很轻，你刚好路过。', lag: 1.0, early: 0.75, pos: [1330, 690, 'center'] },
  { at: 'bar2', date: '20XX.XX.XX', what: '我们第一次相遇', say: '后来才明白，那一眼就是一辈子的开头。' },
  { at: 'bar4', date: '20XX.XX.XX', what: '我们第一次相恋', say: '星星很多，可我抬头只找得到你。' },
  { at: 'bar7', date: '20XX.XX.XX', what: '我们第一次牵手', say: '手心有点出汗，但谁也没有松开。' },
  { at: 'bar9', date: '20XX.XX.XX', what: '你第一次抱我，被我羞涩拒绝', say: '那天我往后退了一步，心却向你跑了很远。' },
  { at: 'line6', say: '还好你没走，站在原地等我追上来。', lag: 0.3 },
  { at: 'bar12', date: '20XX.XX.XX', what: '我们第一次接吻', say: '雪停了，风停了，只有心跳停不下来。' },
  { at: 'bar13', date: '20XX.XX.XX', what: '我们第一次真正的在一起', say: '从今天起，「我」这个字改写成「我们」。' },
  { at: 'line7@花', date: '20XX.XX.XX', what: '我们第一次那么', en: 'perfect' },
  { at: 'bar14', date: '20XX — 20XX', what: '一起高中，一起大学', say: '同一条路，我们从少年走成了大人。' },
  { at: 'line9', date: '20XX — 20XX', what: '地点1 · 地点2' },
  { at: 'line10', date: '20XX — 20XX', what: '地点3 · 地点4 · 地点5 · 地点6', say: '去哪里都好，只要旁边的座位是你。' },
  { at: 'line12', date: '20XX', what: '地点6 · 我们大学毕业啦' },
  { at: 'line13', date: '20XX.XX', what: '地点7' },
  { at: 'line14', date: '20XX — 20XX', what: '地点8 · 地点9', say: '每一张车票的终点，其实都是同一个家。' },
  { at: 'line15', date: '20XX.XX', what: '地点10' },
  { at: 'bar21', date: '20XX.XX', what: '我们的婚纱照', say: '校服换成了婚纱，身边的人还是你。' },
  { at: 'bar22', date: '20XX.XX.XX', what: '我们领证了', say: '一个红本，两个名字，往后都写在一起。' },
  { at: 'bar23', date: '20XX.XX.XX', what: '我们结婚了', say: '这一天的你，我会记得很久很久。' },
  { at: 'line17', end: true },
  { at: 'line19@回答', date: '20XX.XX.XX', what: 'XX:XX · 我们的第一个孩子', say: '那一刻，我们有了新的名字：爸爸妈妈。' },
  { at: 'line20', date: '20XX — 20XX', what: '那些辛苦的日子', say: '雨再大也没关系，伞下一直是两个人。' },
  { at: 'bar34', date: '20XX.XX.XX', what: 'XX:XX · 我们的第二个孩子', say: '家又热闹了一点，幸福也多了一份。' },
  { at: 'line25', date: '20XX', what: '姐姐和妹妹，一家四口', say: '四个人的晚饭，是一天里最好的时候。' },
  { at: 'line26', date: '20XX — 20XX', what: '还是我和你', say: '孩子睡着以后，我们还是当年那两个人。' },
  { at: 'line28', date: '20XX', what: '我镜头里的你', say: '按下快门的时候，我总是先看见你笑。' },
  { at: 'line30', date: '20XX — 20XX', what: '孩子们，和烟火气里的你', say: '柴米油盐里的你，比哪一年都好看。' },
  { at: 'line31', date: '20XX', what: '地点11' },
  { at: 'line33', date: 'every\u00a0year', enDate: 1, what: '你的生日', say: '每年这一天，都想把最好的送给你。' },   // \u00a0：M.text 会吃掉普通空格
  { at: 'line34', end: true },
  { at: 'line35', date: '20XX — 20XX', what: '孩子们长大了', say: '看着孩子们长高，日子就这样慢慢变甜。' },
  { at: 'line37', date: '20XX — 余生', what: '我们和孩子们', say: '这首歌唱的是「我会等」，' },
  { at: 'line41', date: '20XX — 余生', what: '我们和孩子们', say: '而我想说的是：' },
  { at: 'line42', date: '20XX — 余生', what: '我们和孩子们', say: '谢谢你等我，余生换我等你。' },
  { at: 'bar52', end: true },
];
const TXT = { font: 'LXGWWenKai', fill: '#ffffff', stroke: '#232a5c', strokeW: 0.05, glow: 'rgba(24,32,96,.85)' }, CAP = { ...TXT, font: 'ZCOOLKuaiLe' };   // TXT 歌词，CAP 其他所有字（片名、日期卡、告白）
// 屏幕上的字：片名、日期卡、告白（左上），歌词（右下角两行轮换，逐字从左到右涂满颜色）
const words = (ctx, M) => {
  if (M.noLyrics) return;
  const t = M.t, E = M.ease, cl = M.clamp, C = CARDS.map((c) => ({ ...c, t0: M.ref(c.at) }));
  const aT = E.out3(cl((t - M.ref('bar1')) / 0.8)) * cl((M.ref('bar2') - 0.75 - t) / 0.4);
  if (aT > 0) { M.text(ctx, '我会等', 1330, 420 + 26 * (1 - aT), { ...CAP, size: 200, alpha: aT }); M.text(ctx, '写给 XX', 1330, 560, { ...CAP, size: 40, alpha: aT * 0.9 }); }
  C.forEach((c, i) => {
    const t1 = C[i + 1] ? C[i + 1].t0 : 1e9, on = E.out3(cl((t - c.t0) / 0.45)), a = on * cl((t1 - t) / 0.3);
    let j0 = i, j1 = i + 1; while (C[j0 - 1] && c.date && C[j0 - 1].date === c.date) j0--; while (C[j1] && c.date && C[j1].date === c.date) j1++;   // 同一个日期连着的几张卡算一段
    const onD = E.out3(cl((t - C[j0].t0) / 0.45)), aD = t >= c.t0 && t < t1 ? onD * cl(((C[j1] ? C[j1].t0 : 1e9) - t) / 0.3) : 0;
    if (c.date && aD > 0) M.text(ctx, c.date, 112, 126 - 26 * (1 - onD), { ...CAP, size: 104, align: 'left', alpha: aD, ...(c.enDate && { font: 'Allura', size: 150 }) });
    if (c.date && a > 0) { const w = M.text(ctx, c.what, 118, 212, { ...CAP, size: 44, align: 'left', alpha: a }); if (c.en) M.text(ctx, c.en, 118 + w + 10, 212, { ...CAP, font: 'Allura', size: 74, align: 'left', alpha: a }); }
    if (!c.say) return;
    let j = i + 1; while (C[j] && !C[j].say && !C[j].end) j++;
    const s0 = c.t0 + (c.lag ?? 0.5 * M.song.beat), s1 = (C[j] ? C[j].t0 : 1e9) - (c.early || 0), w = cl((t - s0) / 1.0), fa = cl((s1 - t) / 0.3);
    if (w <= 0 || fa <= 0) return;
    const [x, y, al] = c.pos || [118, 300, 'left'], size = 56, tw = M.measure(c.say, { ...CAP, size }), x0 = al === 'left' ? x : x - tw / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 30, y - size, (tw + 60) * E.out2(w), size * 2); ctx.clip(); M.text(ctx, c.say, x, y, { ...CAP, size, align: al, alpha: fa }); ctx.restore();
  });
  M.song.lines.forEach((L, q, LL) => {
    // 上一句还没唱完就先不出来；下一句紧跟着的，这一句唱完马上退
    const P = LL[q - 1], N = LL[q + 1], tin = Math.max(L.t0 - 0.35, P ? P.sung_end - 0.05 : -9), tight = N && N.t0 - L.sung_end < 0.6, a = cl((t - tin) / 0.25) * cl((L.sung_end + (tight ? 0.2 : 0.5) - t) / (tight ? 0.18 : 0.4)); if (a <= 0) return;
    const size = 48, st = { ...TXT, size }, xr = 1860, y = 954 + 68 * ((L.n + 1) % 2), txt = L.text, tw = M.measure(txt, st), idx = [];
    for (let q = 0; q < txt.length; q++) if (txt[q] !== ' ') idx.push(q);   // 第 j 个唱的字在 txt 里的位置（跳过空格）
    let done = 0;                                                           // 唱到哪儿涂到哪儿：每个字在自己开唱到下一个字开唱之间从左涂到右
    L.chars.forEach((ch, j) => { if (idx[j] == null) return; const e = Math.min(L.chars[j + 1] ? L.chars[j + 1].t : L.sung_end, ch.t + 0.8), f = cl((t - ch.t) / Math.max(0.05, e - ch.t)), w0 = M.measure(txt.slice(0, idx[j]), st), w1 = M.measure(txt.slice(0, idx[j] + 1), st); if (f > 0) done = w0 + f * (w1 - w0);
      if (window.__lyrLayout) window.__lyrLayout.push({ n: L.n, i: j, st: 1, c: ch.c, x: xr - tw + (w0 + w1) / 2, y, r: size / 2, a }); });
    M.text(ctx, txt, xr, y, { ...st, align: 'right', fill: 'rgba(255,255,255,.6)', alpha: a });
    ctx.save(); ctx.beginPath(); ctx.rect(xr - tw - 20, y - size, done + 20, size * 2); ctx.clip(); M.text(ctx, txt, xr, y, { ...st, align: 'right', fill: '#ffb07c', stroke: '#6a2440', alpha: a }); ctx.restore();
    M.logLyric(L.n, size, a, txt);
  });
};

// ======== 52 秒以后的镜头（整首版）：一起长大、领证、结婚、两个孩子、回家 ========
// 规矩同 scene.js：画面只由时间决定，随机用 M.hash。名字一律 ch 开头，免得和 scene.js 的全局常量撞。

// 照片按原比例缩到长边 900 px 缓存；返回 card 要的 [图, sx, sy, sw, sh]
const chPic = (M, key) => upright(M, key, 900);
const chMod = (x, m) => ((x % m) + m) % m;
// 雨：斜落的细线 + 地上溅起的小圈；wind 是每秒往右偏多少像素
const chRain = (ctx, M, t, { n = 260, wind = -140, a = 0.5, len = 70, splash = 40 } = {}) => { ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const dep = 0.4 + 1.2 * M.hash(i, 701), v = 1500 * dep, y = chMod(M.hash(i, 702) * 1400 + t * v, 1400) - 160, x = chMod(M.hash(i, 703) * 2300 + wind * (y + 160) / v, 2300) - 190, l = len * dep;
    ctx.strokeStyle = `rgba(214,226,255,${a * (0.25 + 0.4 * dep)})`; ctx.lineWidth = 0.8 + 1.1 * dep; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - wind / v * l, y - l); ctx.stroke(); }
  for (let i = 0; i < splash; i++) { const ph = chMod(t * (1.1 + 0.6 * M.hash(i, 704)) + M.hash(i, 705), 1), x = M.hash(i, 706) * 1920, y = 800 + 280 * M.hash(i, 707), r = 4 + 34 * ph * (0.5 + y / 1080);
    ctx.strokeStyle = `rgba(214,226,255,${a * 0.8 * (1 - ph)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.28, 0, 0, TAU); ctx.stroke(); }
  ctx.restore(); };
// 一张主照片：从下面落进来，慢慢推近、轻轻晃。o.x/o.y 照片中心，o.h 照片高（像素），返回 [x, y, 宽, 高]
const chHero = (ctx, M, s, key, o = {}) => { const t = s.t, on = M.ease.outBack(M.clamp((s.lt - (o.d0 || 0)) / 0.7), 1.4); if (on <= 0) return null;
  const pic = chPic(M, key), hh = (o.h || 600) * (1 + (o.push ?? 0.06) * s.p), w = hh * pic[3] / pic[4], x = (o.x ?? 1300) + 8 * Math.sin(t * 0.8 + (o.ph || 0)), y = (o.y ?? 650) + 70 * (1 - on) + 6 * Math.sin(t * 1.1 + (o.ph || 0));
  card(ctx, pic, x, y, w, (o.rot ?? -0.03) + 0.012 * Math.sin(t * 0.7 + (o.ph || 0)), M.clamp(on) * (o.a ?? 1)); return [x, y, w, hh]; };
// 一颗小小的心（发光用 lighter 叠）
const chHeart = (c, x, y, r, col, a) => { c.save(); c.globalAlpha = a; c.translate(x, y); c.scale(r / 16, r / 16); c.beginPath(); for (let k = 0; k <= 40; k++) { const q = k / 40 * TAU, hx = 16 * Math.sin(q) ** 3, hy = -(13 * Math.cos(q) - 5 * Math.cos(2 * q) - 2 * Math.cos(3 * q) - Math.cos(4 * q)); k ? c.lineTo(hx, hy) : c.moveTo(hx, hy); } c.fillStyle = col; c.fill(); c.restore(); };
// 心形曲线上的点（q 0..1），中心 (cx, cy)，k 每单位多少像素
const chHeartPt = (q, cx, cy, k) => { const a = q * TAU; return [cx + k * 16 * Math.sin(a) ** 3, cy - k * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]; };
// 背景虚着的天地，再压一层颜色（雨天、夜里）
const chBack = (ctx, M, s, md, blur, o = {}) => { const cam = { x: o.camx ?? -1.5, y: 1.5, z: -14 + 0.5 * s.p, f: 1500, hy: o.hy ?? 640 }; soft(ctx, M, 'far', blur, (c) => land(c, cam, md, s.t, 2, { tree: o.tree || { fol: LEAF }, stars: o.stars, place: o.place, keepTree: o.place === 'meadow' })); if (o.tint) { ctx.fillStyle = o.tint; ctx.fillRect(0, 0, M.W, M.H); } return cam; };
// 飘着的花瓣（屏幕坐标），vx 往左吹的速度
const chPetals = (ctx, M, t, n, a = 0.9, vx = 60, kind = 'petal') => { for (let i = 0; i < n; i++) { const dep = 0.5 + 1.4 * M.hash(i, 721) ** 2, x = chMod(M.hash(i, 722) * 2300 - vx * t * dep + 40 * Math.sin(t * 0.9 + i), 2300) - 190, y = chMod(M.hash(i, 723) * 1300 + t * (45 + 40 * M.hash(i, 724)) * dep, 1300) - 110;
  WD.flake(ctx, kind, i, x, y, (6 + 8 * M.hash(i, 725)) * dep, t * (1 + 2 * M.hash(i, 726)) + i, t * (2 + 3 * M.hash(i, 727)) + i, a); } };
// 烟花：tb 是炸开后过了几秒（炸之前 0.5 秒有一道升上去的尾迹）；火花按球面散开、带拖尾、往下坠，熄灭前闪烁。cols 外圈的几种颜色，内圈一律暖白
const chFirework = (ctx, M, tb, x, y, R, cols, seed) => { if (tb < -0.5 || tb > 2.6) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  if (tb < 0) { const k = M.ease.out3(1 + tb / 0.5), yy = M.H + (y - M.H) * k; ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffe9c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, yy + 14 + 90 * (1 - k)); ctx.lineTo(x, yy); ctx.stroke(); ctx.drawImage(WD.dot('#fff6d8'), x - 8, yy - 8, 16, 16); }
  else for (let i = 0; i < 160; i++) { const inner = i % 4 === 0, a = M.hash(i, seed) * TAU, z = 2 * M.hash(i, seed + 1) - 1, rr = R * (inner ? 0.45 : 1) * Math.sqrt(1 - z * z) * (0.88 + 0.12 * M.hash(i, seed + 2)), life = 1.5 + 1.1 * M.hash(i, seed + 3), al = M.clamp((life - tb) / 0.7) * (tb > 0.9 ? 0.55 + 0.45 * Math.sin(tb * 34 + i) : 1); if (al <= 0.01) continue;
    const at = (q) => { q = Math.max(0, q); const e = 1 - Math.exp(-3.4 * q); return [x + Math.cos(a) * rr * e, y + Math.sin(a) * rr * e + 55 * q * q]; }, [x1, y1] = at(tb), [x0, y0] = at(tb - 0.16), col = inner ? '#fff6d8' : cols[i % cols.length], r = inner ? 5 : 9;
    ctx.globalAlpha = 0.7 * al; ctx.strokeStyle = col; ctx.lineWidth = inner ? 2 : 4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = al; ctx.drawImage(WD.dot(col), x1 - r, y1 - r, 2 * r, 2 * r); }
  ctx.restore(); };
// 一把东西炸开：从 (x, y) 朝四面冲出去（头几帧最快），再减速、往下飘。kind: petal 花瓣 / heart 小心 / '#颜色' 发光的小点（光屑、萤火虫、水珠）；r0 一出来就散在多大一圈里；g 下坠多快（负的往上飘）
const chBurst = (ctx, M, tb, x, y, R, kind, n, seed, r0 = 0, g = 50) => { if (tb <= 0 || tb > 3) return; ctx.save(); if (kind[0] === '#') ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const a = M.hash(i, seed) * TAU, rr = R * (0.25 + 0.75 * M.hash(i, seed + 1)), e = r0 * Math.sqrt(M.hash(i, seed + 6)) + rr * (1 - Math.exp(-6 * tb)), px = x + Math.cos(a) * e + 30 * Math.sin(tb * 2 + i), py = y + Math.sin(a) * e * 0.7 + g * tb * tb, r = 11 + 19 * M.hash(i, seed + 2), al = M.clamp((2.2 + 0.8 * M.hash(i, seed + 3) - tb) / 0.8);
    if (kind[0] === '#') { ctx.globalAlpha = al * (0.6 + 0.4 * Math.sin(tb * 9 + i)); ctx.drawImage(WD.dot(kind), px - r, py - r, 2 * r, 2 * r); }
    else if (kind === 'heart') chHeart(ctx, px, py, r, ['#ff9ab4', '#ffd0dc', '#ff7a68'][i % 3], al); else WD.flake(ctx, kind, i, px, py, r, tb * (1.5 + 3 * M.hash(i, seed + 4)) + i, tb * (3 + 5 * M.hash(i, seed + 5)) + i, 0.95 * al); }
  ctx.restore(); };
// 路尽头的家：(x, z) 是正墙底边中点（世界坐标，米）；win 窗里的灯 0..1，night 夜里压暗多少，ph 大窗里挂的照片
// b3：房子已经在 Blender 人物层里（build.py 的 house）时，1 只画垫在人物层下面的（地上的灯光），2 只画叠在人物层上面的（灯晕、炊烟）
const chHouse = (ctx, M, cam, t, x, z, win, night, ph, b3) => { const P = (dx, dy) => WD.proj(cam, x + dx, dy, z), poly = b3 ? () => {} : (pts, fill) => { ctx.beginPath(); pts.forEach(([a, b], i) => { const [px, py] = P(a, b); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const dk = (c0) => WD.mix(c0, '#2a3160', night * 0.65), [gx, gy, gs] = P(0, 0);
  if (b3 !== 2) { ctx.save(); const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, 9 * gs); gl.addColorStop(0, `rgba(255,196,120,${0.45 * win})`); gl.addColorStop(1, 'rgba(255,196,120,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(gx, gy + 0.3 * gs, 9 * gs, 2.2 * gs, 0, 0, TAU); ctx.fill(); ctx.restore(); } if (b3 === 1) return;   // 门前地上的灯光
  poly([[2.1, 4.2], [2.1, 6.1], [2.75, 6.1], [2.75, 4.6]], dk('#8a4a3c'));   // 烟囱
  poly([[-3.1, 0], [3.1, 0], [3.1, 3.4], [-3.1, 3.4]], dk('#f1dcc0')); poly([[-3.1, 0], [3.1, 0], [3.1, 0.5], [-3.1, 0.5]], dk('#c9a88a'));   // 墙、墙脚
  poly([[-3.7, 3.25], [3.7, 3.25], [0, 6.0]], dk('#a8443a')); poly([[-3.7, 3.25], [3.7, 3.25], [3.5, 3.55], [0, 5.75], [-3.5, 3.55]], dk('#c45a48'));   // 屋顶
  poly([[-0.55, 0], [0.55, 0], [0.55, 2.15], [-0.55, 2.15]], dk('#7a4a32'));   // 门
  const glass = (x0, y0, w, h, photo) => { poly([[x0 - 0.12, y0 - 0.12], [x0 + w + 0.12, y0 - 0.12], [x0 + w + 0.12, y0 + h + 0.12], [x0 - 0.12, y0 + h + 0.12]], dk('#fbf3e6'));
    poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], WD.mix(dk('#33405e'), '#ffcf7a', win));
    const [ax, ay] = P(x0, y0 + h), [bx, by] = P(x0 + w, y0);
    if (photo && win > 0.05 && !b3) { const pic = chPic(M, photo), bw = bx - ax, bh = by - ay, k = Math.min(bw / pic[3], bh / pic[4]) * 0.86; ctx.save(); ctx.globalAlpha = win; ctx.drawImage(pic[0], (ax + bx) / 2 - pic[3] * k / 2, (ay + by) / 2 - pic[4] * k / 2, pic[3] * k, pic[4] * k); ctx.fillStyle = 'rgba(255,170,90,.12)'; ctx.fillRect(ax, ay, bw, bh); ctx.restore(); }
    ctx.save(); ctx.strokeStyle = dk('#fbf3e6'); ctx.lineWidth = Math.max(1, 0.07 * gs); if (!photo && !b3) { ctx.beginPath(); ctx.moveTo((ax + bx) / 2, ay); ctx.lineTo((ax + bx) / 2, by); ctx.moveTo(ax, (ay + by) / 2); ctx.lineTo(bx, (ay + by) / 2); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 * win; const r = 1.2 * (bx - ax); ctx.drawImage(WD.dot('#ffbf6a'), (ax + bx) / 2 - r, (ay + by) / 2 - r, 2 * r, 2 * r); ctx.restore(); };
  glass(-2.6, 1.0, 1.7, 1.6, ph); glass(1.1, 1.2, 1.2, 1.2);
  const [lx, ly] = P(0.8, 2.3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 * win; const lr = 0.9 * gs; ctx.drawImage(WD.dot('#ffd38a'), lx - lr, ly - lr, 2 * lr, 2 * lr); ctx.restore();   // 门灯
  if (night > 0.3) { const [cx0, cy0] = P(2.42, 6.1); ctx.save(); for (let i = 0; i < 5; i++) { const q = chMod(t * 0.25 + i / 5, 1), r = (0.3 + 0.8 * q) * gs; ctx.globalAlpha = 0.18 * (1 - q); ctx.drawImage(WD.dot('#c8d0f0'), cx0 - r + 0.6 * q * gs, cy0 - r - 2.2 * q * gs, 2 * r, 2 * r); } ctx.restore(); } };   // 炊烟

const CH = {
  // 第一缕朝霞：天亮了的土路，花开满树；光团们沿路往太阳走，唱到「朝霞」太阳亮一下。params: n 几个人, l 第几句
  sunrise(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params || {}, E = M.ease, k = E.inOut2(s.p), md = P.md || 'dawn', v = P.stand ? 0 : 0.78, cam = { x: 0.6, y: 1.4 + (P.stand ? 0.5 : 1.4) * k, z: -27 + (v + 0.15) * lt, f: 1500, hy: 720 + (P.stand ? 20 : 50) * k }, zO = (tt) => -19.5 + v * (tt - s.t0);
    land(ctx, cam, md, t, zO(t) - cam.z + 0.4, { place: P.place, tree: { wind: 0.5, fol: [{ kind: 'blos', f: () => 1, size: 1.1 }] } });
    const tZ = P.l ? M.word(P.l, '朝') : 1e9, zb = Math.exp(-Math.max(0, t - tZ) * 1.4) * M.smooth(tZ, tZ + 0.5, t);   // 唱到「朝霞」太阳亮起来（半秒升上去，不闪）
    const [sx, sy] = WD.plateXY(cam, WD.MOODS[md].sun); WD.flare(ctx, sx, sy - 46, 0.8 + 0.7 * zb);
    people(ctx, M, s, cam, md, duo(P.stand ? 'stand' : 'walk', zO(t), v * (t - s.t0), P.stand ? { lean: 0.7, look: [3, 3, 60] } : { lean: P.lean || 0 }));
    WD.grass(ctx, cam, md, t, 0.5, zO(t) - cam.z + 0.4);
    WD.rays(ctx, sx, sy - 46, t, { a: 0.42 + 0.35 * zb, n: 30, len: 1700, a0: -Math.PI * 0.98, a1: -Math.PI * 0.02 });
    if (!P.place) chPetals(ctx, M, t, 60);
    WD.post(ctx, { bloom: 0.42, warm: ['rgba(255,214,190,.24)', 'rgba(90,80,160,.12)'] });
  },

  // 「一场雨落下 把回忆都冲刷」：一张照片泡在雨里，水珠从相纸上滑下来；唱到「冲」一道光把它刷亮。params: l, ph, back（背后的两张）, md
  rain(ctx, s, M) {
    const t = s.t, P = s.params, cl = M.clamp, md = P.md || { a: 'starNight', b: 'dusk', k: 0.4 };
    chBack(ctx, M, s, md, 7, { place: P.place, tint: P.sun ? 'rgba(40,50,110,.12)' : 'rgba(18,26,70,.32)' });
    const rk = 0.35 + 0.65 * M.smooth(M.word(P.l, '雨') - 0.3, M.word(P.l, '雨') + 0.4, t);   // 唱到「雨」才下大
    chRain(ctx, M, t, { n: 150, a: 0.32 * rk, splash: 0 });
    const pc = chPic(M, P.ph), wide = pc[3] > pc[4];   // 主图是横图：三张排成一排，后面两张不被挡住
    (P.back || []).forEach((k, i) => { const b = chPic(M, k); chHero(ctx, M, s, k, { x: 1040 + 560 * i, y: 660 + 50 * i, h: 360, rot: i ? 0.13 : -0.12, d0: 0.25 + 0.2 * i, push: 0.02, ph: i + 1, ...(wide && { x: i ? 1530 : 380, y: 670, h: b[3] > b[4] ? 290 : 380 }) }); });
    const r = chHero(ctx, M, s, P.ph, wide ? { x: 980, y: 620, h: Math.min(400, 640 * pc[4] / pc[3]), rot: -0.035 } : { x: 1320, y: 640, h: 590, rot: -0.035 });   // 横图缩小，左上角不压告白
    if (r) { const [x, y, w, h] = r, tw = M.word(P.l, '冲');
      ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) { const sp = 40 + 120 * M.hash(i, 731), y0 = chMod(M.hash(i, 732) * h + t * sp, h + 80) - 40, x0 = x - w / 2 + w * M.hash(i, 733); ctx.strokeStyle = 'rgba(220,235,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y - h / 2 + y0 - 50); ctx.lineTo(x0 + 2, y - h / 2 + y0); ctx.stroke(); ctx.globalAlpha = 0.9; ctx.drawImage(WD.dot('#ffffff'), x0 - 5, y - h / 2 + y0 - 5, 10, 12); ctx.globalAlpha = 1; }
      const q = (t - tw) / 0.9; if (q > 0 && q < 1) { const sx = x - w + 2 * w * M.ease.inOut2(q), g = ctx.createLinearGradient(sx - 160, 0, sx + 160, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,250,235,${0.55 * Math.sin(Math.PI * q)})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h / 2, w, h); }
      ctx.restore();
      chBurst(ctx, M, t - tw, x, y, 0.75 * w + 300, '#d4e9ff', 230, 950, w / 2, 320); }   // 「冲」那一下：水花从相纸上溅开
    chRain(ctx, M, t + 7, { n: 200, a: (P.sun ? 0.45 : 0.6) * rk, len: 95 });
    if (P.sun) { const g = ctx.createRadialGradient(1700, 80, 0, 1700, 80, 900); g.addColorStop(0, 'rgba(255,226,170,.35)'); g.addColorStop(1, 'rgba(255,226,170,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H); }
    WD.post(ctx, { bloom: 0.34, warm: ['rgba(160,180,255,.14)', 'rgba(20,30,90,.22)'] });
  },

  // 「再与你一起去看 外面世界」：镜头沿着路往前飞，这些年的照片悬在路两边的空中迎面过来，唱到「外面世界」往前冲。params: ph, md, l2（「外面世界」在第几句）, dir（-1 倒着飞 = 回忆往回倒）
  fly(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, cl = M.clamp, dir = P.dir || 1, md = P.md || 'dawn', sp = P.sp || 5.6, run = dir > 0 ? lt : s.dur - lt;
    const tO = P.l2 ? M.word(P.l2, '外') : 1e9, surge = 8 * M.smooth(tO - 0.1, tO + 1.4, t), cam = { x: 0.35 * Math.sin(lt * 0.6), y: 2.2 + 0.5 * s.p + 0.8 * surge / 8, z: -30 + sp * run + surge, f: 1500, hy: 640 };   // 唱到「外面世界」往前冲一段
    land(ctx, cam, md, t, 5, { place: P.place, shore: false, keepTree: 1, tree: { fol: P.fol || LEAF }, stars: P.stars });
    if (md === 'dawn' || md === 'dusk') { const [sx, sy] = WD.plateXY(cam, WD.MOODS[md].sun); WD.flare(ctx, sx, sy, 0.6); }
    const N = P.ph.length, span = sp * s.dur + 16;
    P.ph.map((k, i) => { const side = i % 2 ? 1 : -1; return { k, i, x: side * (2.0 + 1.5 * M.hash(i, 711)), y: side > 0 ? 1.9 + 1.8 * M.hash(i, 712) : 1.0 + 1.0 * M.hash(i, 712), z: -25 + (i + 0.5) * span / N }; })
      .sort((a, b) => b.z - a.z).forEach(({ k, i, x, y, z }) => { const d = z - cam.z; if (d < 0.8 || d > 42) return; const [sx, sy, sc] = WD.proj(cam, x, y, z), pic = chPic(M, k), hh = 1.7 * sc, w = hh * pic[3] / pic[4];
        card(ctx, pic, sx, sy, w, 0.16 * (M.hash(i, 713) - 0.5) + 0.04 * Math.sin(t + i), cl((d - 0.8) / 1.4) * cl((42 - d) / 12)); });
    WD.grass(ctx, cam, md, t, 0.5, 5);
    if (dir < 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; for (let i = 0; i < 40; i++) { const y = M.hash(i, 741) * M.H, x = chMod(M.hash(i, 742) * 2400 - t * 2600, 2400) - 240; ctx.fillStyle = '#fff4dc'; ctx.fillRect(x, y, 240 + 300 * M.hash(i, 743), 2); } ctx.restore(); }   // 倒带的光丝
    chPetals(ctx, M, t, 24, 0.8);
    WD.post(ctx, { bloom: 0.38, warm: ['rgba(255,214,190,.18)', 'rgba(90,80,160,.12)'] });
  },

  // 「冬的雪融化 蒲扇里的夏」：树上挂着冬天的照片，雪化了、叶子长出来，照片一张张翻过来成了夏天的；左下角的蒲公英被风吹散。params: l, win, sum
  seasons(ctx, s, M) {
    const t = s.t, P = s.params, E = M.ease, cl = M.clamp, tR = M.word(P.l, '融'), tX = M.word(P.l, '夏'), tF = M.word(P.l, '蒲'), k = M.smooth(tR - 0.3, tR + 1.0, t);
    const md = { a: 'snowNight', b: 'dusk', k }, cam = { x: WD.TREE_X - 1.2, y: 2.0, z: -16.5 + 0.8 * E.inOut2(s.p), f: 1500, hy: 760 };
    WD.ROAD = false; WD.backdrop(ctx, md, cam); WD.twinkle(ctx, cam, t, 0.7 * (1 - k), 80); WD.ground(ctx, cam, md, false); WD.grass(ctx, cam, md, t, 16.9, 150);
    WD.shadow(ctx, cam, WD.TREE_X, 0, 7, 0.3);
    const [tx, ty, ts] = WD.tree(ctx, cam, t, md, { snow: 1 - k, wind: 0.5, fol: [{ kind: 'leaf', f: (p) => cl((t - tR - 0.2 - p.u * 0.8) / 0.4) }] });
    const crown = WD.treePts().filter((p) => p.y > 4.6).sort((a, b) => a.x - b.x), N = P.win.length;
    P.win.forEach((kw, i) => { const p = crown[Math.floor((i + 0.5) / N * crown.length)], fl = Math.cos(Math.PI * cl((t - tX - 0.18 * i) / 0.5)), key = fl > 0 ? kw : P.sum[i], pic = chPic(M, key), w = 1.25 * ts, rot = 0.12 * Math.sin(t * 1.4 + i * 2);
      ctx.save(); ctx.translate(tx + p.x * ts, ty - p.y * ts); ctx.rotate(rot); ctx.strokeStyle = 'rgba(255,250,235,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.25 * ts); ctx.stroke();
      ctx.translate(0, 0.25 * ts + w * pic[4] / pic[3] / 2 + 0.06 * w); ctx.scale(Math.max(0.02, Math.abs(fl)), 1); card(ctx, pic, 0, 0, w); ctx.restore(); });
    if (P.duo) { WD.grass(ctx, cam, md, t, 12.3, 16.9); people(ctx, M, s, cam, md, duo('sit', -4.5, 0, { x: 2.3, lean: 1, look: [WD.TREE_X, 5.5, 0] })); WD.grass(ctx, cam, md, t, 0.5, 12.3); } else WD.grass(ctx, cam, md, t, 0.5, 16.9);
    WD.snowfall(ctx, t, { n: 300, wind: -30, a: 1 - M.smooth(tR - 0.2, tR + 0.6, t) });
    if (k > 0.5) { const ff = WD.dot('#e6ff8a'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const x = 150 + 1600 * M.hash(i, 751) + 60 * Math.sin(t * 0.5 + i * 3), y = 600 + 380 * M.hash(i, 752) + 40 * Math.sin(t * 0.7 + i), r = 8 + 10 * M.hash(i, 753); ctx.globalAlpha = (k - 0.5) * 2 * Math.max(0, Math.sin(t * 1.3 + i * 2)) ** 2; ctx.drawImage(ff, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); }
    chBurst(ctx, M, t - tX, tx, ty - 5.5 * ts, 1000, '#e6ff8a', 230, 955, 3.5 * ts, -15);   // 「夏」那一下：一树萤火虫朝四面飞出来
    // 蒲公英：雪化了，左下角草里长出一片蒲公英；绒毛被风一颗颗吹起来，唱到「蒲」一阵风吹散一大片，飘过整个画面
    const fa = M.smooth(tR + 0.2, tR + 1.3, t); if (fa > 0) { const gust = M.smooth(tF - 0.2, tF + 0.2, t) * (1 - M.smooth(tF + 0.6, tF + 1.4, t)), PUFF = [[70, 250, 46], [170, 330, 60], [260, 210, 38], [345, 300, 54], [440, 180, 34], [520, 260, 44], [610, 150, 28]]; ctx.save(); ctx.lineCap = 'round';
      PUFF.forEach(([x, hh, R], n) => { const sw = 0.08 * Math.sin(t * 1.2 + n * 1.9) + 0.12 * gust, h = hh * fa, bx = x + Math.sin(sw) * h, by = 1085 - Math.cos(sw) * h, tip = (q) => { const a = q / 46 * TAU + n, rr = R * (0.7 + 0.3 * M.hash(q, 770 + n)); return [bx + Math.cos(a) * rr, by + Math.sin(a) * rr]; };
        ctx.globalAlpha = fa; ctx.strokeStyle = '#7fb36a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, 1085); ctx.quadraticCurveTo(x, 1085 - h * 0.5, bx, by); ctx.stroke();
        ctx.globalAlpha = 0.5 * fa; ctx.drawImage(WD.dot('#ffffff'), bx - R * 1.25, by - R * 1.25, R * 2.5, R * 2.5);
        ctx.globalAlpha = 0.7 * fa; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); for (let q = 0; q < 46; q++) { ctx.moveTo(bx, by); ctx.lineTo(...tip(q)); } ctx.stroke();
        ctx.fillStyle = '#ffffff'; for (let q = 0; q < 46; q++) { const [px, py] = tip(q); ctx.beginPath(); ctx.arc(px, py, 1.8, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = fa; ctx.fillStyle = '#c9b27a'; ctx.beginPath(); ctx.arc(bx, by, R * 0.1, 0, TAU); ctx.fill(); });
      for (let i = 0; i < 96; i++) { const [x0, hh] = PUFF[i % 7], tau = t - (i < 30 ? tR + 0.9 + 1.5 * M.hash(i, 761) : tF - 0.1 + 0.9 * M.hash(i, 762)); if (tau <= 0) continue;   // 前 30 颗零星飘，其余在「蒲」那阵风里一起飞
        const x = x0 + (520 + 420 * M.hash(i, 763)) * tau + 30 * Math.sin(t * 1.1 + i), y = 1085 - hh - (110 + 240 * M.hash(i, 764)) * tau + 26 * Math.sin(t * 1.3 + i * 2), r = 12 + 12 * M.hash(i, 765), a = 0.95 * cl(tau * 5) * cl((2050 - x) / 150); if (a <= 0.01) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(0.35 + 0.25 * Math.sin(t * 1.2 + i)); ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, 0); for (let q = -4; q <= 4; q++) { ctx.moveTo(0, 0); ctx.lineTo(Math.sin(q * 0.33) * r * 0.75, -Math.cos(q * 0.33) * r * 0.75); } ctx.stroke(); ctx.fillStyle = '#b89a66'; ctx.beginPath(); ctx.arc(0, r, 1.6, 0, TAU); ctx.fill(); ctx.restore(); }
      ctx.restore(); }
    WD.post(ctx, { bloom: 0.36, warm: [`rgba(255,210,170,${0.2 * k})`, `rgba(30,40,120,${0.24 * (1 - k)})`] });
  },

  // 「守着深夜里的星星 眨眼不说话」：星夜草坡，一张照片挂在天上；光团坐在草里守着，唱到「眨」一颗星眨了一下。params: l, ph, n
  night(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, cam = { x: -0.3, y: 0.9, z: -10.5 + 0.3 * lt, f: 1500, hy: 770 }, zP = -4.5;
    land(ctx, cam, 'starNight', t, zP - cam.z + 0.3, { place: P.place || 'meadow', keepTree: 1, stars: 1, tint: '#3c4f9a', tree: { fol: LEAF } });
    people(ctx, M, s, cam, 'starNight', duo('sit', zP, 0, { lean: 1, look: [3.5, 5, 12] }));
    WD.grass(ctx, cam, 'starNight', t, 0.5, zP - cam.z + 0.3);
    const ff = WD.dot('#e6ff8a'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 30; i++) { const x = 100 + 1700 * M.hash(i, 61) + 60 * Math.sin(t * 0.4 + i * 3), y = 760 + 280 * M.hash(i, 63) + 40 * Math.sin(t * 0.6 + i), r = 9 + 12 * M.hash(i, 65); ctx.globalAlpha = Math.max(0, Math.sin(t * 1.1 + i * 2)) ** 2 * 0.8; ctx.drawImage(ff, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
    const tS = M.word(P.l, '星'), sb = t > tS ? Math.exp(-(t - tS) * 1.6) : 0; if (sb > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const x = M.hash(i, 851) * M.W, y = 40 + 560 * M.hash(i, 852), r = (6 + 12 * M.hash(i, 853)) * (0.6 + 0.6 * sb); ctx.globalAlpha = sb * (0.5 + 0.5 * Math.sin(t * 9 + i)); ctx.drawImage(WD.dot('#fff6d8'), x - r, y - r, 2 * r, 2 * r); } ctx.restore(); }   // 唱到「星星」满天星闪一下
    (P.back || []).forEach((k, i) => { const b = chPic(M, k); chHero(ctx, M, s, k, { x: i ? 1670 : 1000, y: i ? 700 : 590, h: b[3] > b[4] ? 200 : 260, rot: i ? 0.1 : -0.09, d0: 0.3 + 0.25 * i, push: 0.02, ph: i + 1 }); });   // 同一趟的另外几张，小一点垫在后面
    const pc = chPic(M, P.ph), r = chHero(ctx, M, s, P.ph, pc[3] > pc[4] ? { x: 1400, y: 420, h: 380, rot: 0.03 } : { x: 1320, y: 470, h: 500, rot: 0.03 });   // 横图缩小、抬高，不挡坐着的两人
    const tz = M.word(P.l, '眨'), bl = 1 - 0.95 * Math.exp(-(((t - tz - 0.12) / 0.1) ** 2)), x0 = r ? r[0] + r[2] / 2 + 110 : 1700, y0 = r ? r[1] - r[3] / 2 + 10 : 250, rr = 34 * bl;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(WD.dot('#fff6d8'), x0 - rr * 1.6, y0 - rr * 1.6, rr * 3.2, rr * 3.2); ctx.strokeStyle = `rgba(255,248,220,${0.9 * bl})`; ctx.lineWidth = 2; for (const [dx, dy] of [[1, 0], [0, 1]]) { ctx.beginPath(); ctx.moveTo(x0 - dx * rr * 2.4, y0 - dy * rr * 2.4); ctx.lineTo(x0 + dx * rr * 2.4, y0 + dy * rr * 2.4); ctx.stroke(); }
    const q = (lt - 0.6) / 0.9; if (q > 0 && q < 1) { const sx = 1500 - 900 * q, sy = 90 + 260 * q; for (let k = 0; k < 14; k++) { ctx.globalAlpha = (1 - k / 14) * Math.sin(Math.PI * q); ctx.drawImage(WD.dot('#ffffff'), sx + k * 16 - 6, sy - k * 4.6 - 6, 12, 12); } }   // 流星
    ctx.restore();
    WD.post(ctx, { bloom: 0.4, warm: ['rgba(120,140,255,.14)', 'rgba(20,30,100,.2)'] });
  },

  // 一张张发出来的照片排成扇形（吃饭、讲笑话、一家人）。params: ph（按顺序发）, at（每张落下的时刻，可省）, md, h, roses（红玫瑰花瓣）
  fan(ctx, s, M) {
    const t = s.t, P = s.params, E = M.ease, cl = M.clamp, md = P.md || 'dusk';
    chBack(ctx, M, s, md, 9, { place: P.place, tree: P.roses ? { fol: [{ kind: 'blos', f: () => 1 }] } : undefined });
    if (P.roses) { const g = ctx.createRadialGradient(1300, 600, 100, 1300, 600, 1200); g.addColorStop(0, 'rgba(255,120,140,.12)'); g.addColorStop(1, 'rgba(120,20,60,.3)'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H); }
    const N = P.ph.length, T = P.at ? P.at.map((a) => M.ref(a)) : P.ph.map((_, i) => s.t0 + 0.1 + i * Math.max(0.25, (s.dur - 0.9) / N)), cx = P.cx ?? 1300, cy = P.cy ?? 700, R = 900, sw = 0.025 * Math.sin(t * 0.9);
    P.ph.forEach((k, i) => { if (t < T[i]) return; const q = E.outBack(cl((t - T[i]) / 0.6), 1.3), q2 = E.out3(cl((t - T[i]) / 0.6)), ang = (N > 1 ? (i - (N - 1) / 2) * Math.min(0.17, 0.75 / (N - 1)) : 0) + sw, pic = chPic(M, k), hh = P.h || 380, w = hh * pic[3] / pic[4];
      const tx = cx + Math.sin(ang) * R, ty = cy + R - Math.cos(ang) * R, x = M.lerp(cx + 500, tx, q2), y = M.lerp(1500, ty, q), rot = M.lerp(0.6, ang, q2);
      card(ctx, pic, x, y, w, rot); if (q2 < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * (1 - q2); const rr = 0.8 * hh; ctx.drawImage(WD.dot('#fff2d0'), x - rr, y - rr, 2 * rr, 2 * rr); ctx.restore(); } });
    if (P.roses) { ctx.save(); for (let i = 0; i < 46; i++) { const dep = 0.5 + 1.3 * M.hash(i, 761), x = chMod(M.hash(i, 762) * 2300 - 40 * t * dep, 2300) - 190, y = chMod(M.hash(i, 763) * 1300 + t * 70 * dep, 1300) - 110, r = (9 + 9 * M.hash(i, 764)) * dep; ctx.save(); ctx.translate(x, y); ctx.rotate(t * (1 + M.hash(i, 765)) + i); ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, TAU); ctx.fillStyle = ['#c8102e', '#e0294a', '#a00d26'][i % 3]; ctx.globalAlpha = 0.85; ctx.fill(); ctx.restore(); } ctx.restore(); }
    else chPetals(ctx, M, t, 26, 0.7);
    WD.post(ctx, { bloom: 0.36, warm: ['rgba(255,214,170,.2)', 'rgba(110,70,120,.14)'] });
  },

  // 一张照片在柔光里：慢慢推近，身后飘起发光的小心，唱到「美梦」炸开一圈。params: ph, md, h, l
  dream(ctx, s, M) {
    const t = s.t, P = s.params, md = P.md || 'dawn';
    chBack(ctx, M, s, md, 13, { place: P.place, tree: { fol: [{ kind: 'blos', f: () => 1 }] } });
    const g = ctx.createRadialGradient(1300, 600, 60, 1300, 600, 1100); g.addColorStop(0, 'rgba(255,220,230,.3)'); g.addColorStop(1, 'rgba(90,60,140,.28)'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(WD.dot('#ffd6e4'), 1300 - 560, 640 - 560, 1120, 1120); ctx.restore();
    if (P.back) chHero(ctx, M, s, P.back, { x: (P.x ?? 1300) - 340, y: 760, h: 340, rot: -0.1, d0: 0.2, push: 0.04, ph: 1 });   // 同一趟的另一张，小一点垫在后面
    chHero(ctx, M, s, P.ph, { x: P.x ?? 1300, y: 650, h: P.h || 620, rot: 0.025, push: 0.1 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 30; i++) { const ph = chMod(t * (0.16 + 0.1 * M.hash(i, 771)) + M.hash(i, 772), 1), x = 820 + 1000 * M.hash(i, 773) + 40 * Math.sin(t * 1.3 + i), y = 1100 - 1000 * ph, r = 10 + 14 * M.hash(i, 774);
      chHeart(ctx, x, y, r, ['#ff9ab4', '#ffd0dc', '#ff7a68'][i % 3], 0.55 * Math.sin(Math.PI * ph)); } ctx.restore();
    const tD = P.l ? M.word(P.l, '美') : 1e9, tb = t - tD; if (tb > 0 && tb < 1.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const a = M.hash(i, 861) * TAU, v = 220 + 420 * M.hash(i, 862), kk = (1 - Math.exp(-2.6 * tb)) / 2.6; chHeart(ctx, (P.x ?? 1300) + Math.cos(a) * v * kk, 650 + Math.sin(a) * v * kk - 60 * tb, 12 + 12 * M.hash(i, 863), ['#ff9ab4', '#ffd0dc', '#ff7a68'][i % 3], M.clamp(1.4 - tb)); } ctx.restore(); }   // 唱到「美梦」一圈小心炸开
    chPetals(ctx, M, t, 20, 0.7, 30);
    WD.post(ctx, { bloom: 0.45, warm: ['rgba(255,214,220,.22)', 'rgba(90,70,160,.14)'] });
  },

  // 回家：土路尽头的房子，窗里亮着灯；光团们沿路走到门口。params: n, ph（大窗里的照片）, md, night, rain, snow, close（离房子近，接着上一镜：窗已经亮着）, burst（这些时刻门里涌出暖光，带一把光屑）, calm（下一镜有烟花：不炸光屑）, stop（这一镜只走到离门口几米、不停，下一镜接着走完）, front（反打：从家门口看两人迎面走来）
  home(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params || {}, E = M.ease, md = P.md || 'dusk', zH = 16, z0 = P.close ? 6.5 : 1.5, cam = P.front ? { x: -0.8, y: 1.45, z: 30, f: 1500, hy: 600 } : { x: 0.2, y: 1.6, z: z0 + 0.7 * lt, f: 1500, hy: 650 };   // front：反打，从家门口往外看，两人迎面走来（房子在镜头背后，不画）
    const T = s.dur + 0.6, zE = P.front ? cam.z + 4.2 : zH - 0.9 - (P.stop || 0), zS = P.front ? zE + 0.78 * (T - 0.7) : Math.max(z0 + 4.5, zE - 0.82 * (T - 0.7)), zO = (tt) => { const l = M.clamp(tt - s.t0, 0, T), a = T - 1.4; return zS + (zE - zS) / (T - 0.7) * (P.stop || l < a ? l : l - (l - a) ** 2 / 2.8); };   // 走到门口：匀速散步（约 0.8 米/秒），最后 1.4 秒慢下来停住；有 stop 就不减速，切走时正好走到离门 stop 米
    land(ctx, cam, md, t, zO(t) - cam.z + 0.4, { stars: P.night ? 0.8 : 0 });
    const see = M.smooth(0.3, T - 0.8, t - s.t0);   // front：两人抬头看见家，脸上慢慢松开
    const b3 = has3d(M) && !window.TRACKING ? 2 : 0, win = P.close ? 1 : M.smooth(0.2, 1.4, lt), door = Math.max(0, ...(P.burst || []).map((at) => M.smooth(0, 0.8, t - M.ref(at))));   // door：门开了多少（burst 的时刻打开，之后一直开着）
    const house = () => { if (P.front) return; chHouse(ctx, M, cam, t, 0, zH, win, P.night ? 1 : 0.15, P.ph, b3);
    for (const at of P.burst || []) { const tb = t - M.ref(at), [dx, dy, ds] = WD.proj(cam, 0, 1.2, zH); if (!P.calm) chBurst(ctx, M, tb, dx, dy, 1000, '#ffd9a0', 320, 970, 2.2 * ds, 30); if (tb <= 0 || tb > 2) continue; const k = Math.exp(-tb * 1.8) * M.smooth(0, 0.4, tb); WD.rays(ctx, dx, dy, t, { a: 0.4 * k, n: 24, len: 1400, c0: '#ffd9a0' }); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * k; const r = (3 + 4 * (1 - k)) * ds; ctx.drawImage(WD.dot('#ffcf8a'), dx - r, dy - r, 2 * r, 2 * r); ctx.restore(); } };   // 门里涌出暖光，带一把光屑
    if (b3 && !P.front) chHouse(ctx, M, cam, t, 0, zH, win, 0, null, 1); else house();   // 没渲过：平面房子垫在人后面；渲过：房子和人同一遍渲，灯晕叠在人物层上面
    const zp = zO(t), umb = [0.03, 1.25, zp + (P.front ? -0.1 : 0.1)];
    people(ctx, M, s, cam, md, { pts: { umb }, ...(P.front ? {} : { house: { x: 0, z: zH, win, door, night: P.night ? 1 : 0.15, ph: P.ph || '' } }), ...duo('walk', zp, Math.abs(zp - zS), { gait: M.clamp(Math.abs(zO(t + 0.05) - zO(t - 0.05)) / 0.09), gap: P.rain ? 0.42 : 0.5, hold: P.rain ? 0 : 1,
      ...(P.front ? { yaw: 180, look: [0, 2.2, cam.z - 2], her: { lookW: see, face: { sad: 0.5 * (1 - see), smile: 0.45 * see } }, him: { handR: ['pt.umb', 1], armR: [50, 55, 100], calmR: 1, lookW: see, face: { smile: 0.35 * see } } }   // 面朝镜头：伞换到他里侧的右手
        : { him: P.rain ? { handL: ['pt.umb', 1], armL: [50, 55, 100], calmL: 1 } : {} }) }) });
    if (b3) house();
    if (P.rain) { const [ux, uy, us] = WD.proj(cam, 0.03, 1.98, zp), [gx, gy] = WD.proj(cam, 0.03, 1.35, zp), rx = 0.66 * us;   // 他撑的伞（从背后看）：手在身前握着，伞柄只画到肩膀上沿，下半截被身体挡住（不画到衣裳上）
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#c9d2ea'; ctx.lineWidth = Math.max(1.5, 0.018 * us); ctx.beginPath(); ctx.moveTo(ux, uy - 0.3 * us); ctx.lineTo(gx, gy); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(ux, uy, rx, 0.36 * us, 0, Math.PI, TAU); ctx.ellipse(ux, uy, rx, 0.08 * us, 0, 0, Math.PI); ctx.closePath(); const ug = ctx.createLinearGradient(ux - rx, 0, ux + rx, 0); ug.addColorStop(0, '#39457e'); ug.addColorStop(0.5, '#222b58'); ug.addColorStop(1, '#151c40'); ctx.fillStyle = ug; ctx.fill();
      ctx.strokeStyle = 'rgba(160,180,240,.35)'; ctx.lineWidth = 1; for (const q of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(ux + q * rx * 0.25, uy - 0.35 * us); ctx.quadraticCurveTo(ux + q * rx * 0.9, uy - 0.2 * us, ux + q * rx, uy + 0.06 * us * Math.sqrt(1 - q * q)); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(200,214,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(ux, uy, rx, 0.36 * us, 0, Math.PI * 1.08, Math.PI * 1.6); ctx.stroke(); ctx.restore(); }
    if (P.front) { const g = ctx.createRadialGradient(1220, M.H, 0, 1220, M.H, 1100), a = 0.3 + 0.3 * see; g.addColorStop(0, `rgba(255,190,120,${a})`); g.addColorStop(1, 'rgba(255,190,120,0)'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H); ctx.restore(); }   // 家里的灯从镜头这边照过来，越走近越暖（慢慢起，不闪）
    WD.grass(ctx, cam, md, t, 0.5, zO(t) - cam.z + 0.4);
    if (P.snow) WD.snowfall(ctx, t, { n: 300, wind: -30, a: 0.9 });
    if (P.rain) chRain(ctx, M, t, { n: 320, a: 0.55 });
    if (md === 'dusk' && !P.night) { const [sx, sy] = WD.plateXY(cam, WD.MOODS.dusk.sun); WD.flare(ctx, sx, sy, 0.5); WD.rays(ctx, sx, sy, t, { a: 0.18, n: 18, len: 1500, a0: Math.PI * 0.75, a1: Math.PI * 1.2 }); }
    WD.post(ctx, { bloom: 0.4, warm: P.night ? ['rgba(120,140,255,.16)', 'rgba(20,30,100,.24)'] : ['rgba(255,200,150,.2)', 'rgba(90,70,160,.14)'] });
  },

  // 照片墙：照片一张张贴出来，分一排或两排。params: ph, place, md, red（红底金粉）, fw（小节头一齐炸三朵烟花，之后每拍再炸，镜头不动）
  wall(ctx, s, M) {
    const t = s.t, P = s.params, E = M.ease, cl = M.clamp, md = P.md || 'dawn';
    if (P.red) { const g = ctx.createRadialGradient(1100, 560, 80, 1000, 540, 1300); g.addColorStop(0, '#7a1c26'); g.addColorStop(0.55, '#40121e'); g.addColorStop(1, '#16060e'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 110; i++) { const dep = [0.6, 1.2, 2.4][i % 3], x = chMod(M.hash(i, 781) * 2000 + 50 * t * dep, 2000) - 40, y = chMod(M.hash(i, 782) * 1300 - t * 60 * dep, 1300) - 110, r = (10 + 26 * M.hash(i, 783)) * dep; ctx.globalAlpha = (0.08 + 0.14 * M.hash(i, 784)) * (0.6 + 0.4 * Math.sin(t + i)) / Math.sqrt(dep); ctx.drawImage(WD.dot(['#ffcf7a', '#ff8a6a', '#ffe7b0'][i % 3]), x - r, y - r, 2 * r, 2 * r); } ctx.restore(); }
    else { chBack(ctx, M, s, md, 4, { place: P.place, hy: 520, tree: { fol: [{ kind: 'blos', f: () => 1 }] } }); ctx.fillStyle = P.fw ? 'rgba(22,12,58,.5)' : 'rgba(30,20,60,.18)'; ctx.fillRect(0, 0, M.W, M.H); }   // 有烟花的这一屏天压暗，烟花才显色
    if (P.fw) [[0, 480, 330, 400, 0], [0, 1260, 250, 460, 1], [0, 1700, 400, 340, 2], [0.5, 900, 180, 300, 2], [1, 300, 260, 340, 1], [1, 1500, 200, 380, 0], [2, 760, 300, 420, 2], [2, 1780, 260, 300, 0], [3, 1120, 220, 440, 1], [3, 420, 200, 320, 2]].forEach(([b, x, y, R, c], i) => chFirework(ctx, M, t - s.t0 - b * M.song.beat, x, y, R, [['#ffc94a', '#ff9a3a'], ['#ff5f9a', '#ffa0c4'], ['#7fe9ff', '#c8f6ff']][c], 930 + 7 * i));   // [第几拍, x, y, 半径, 颜色]，画在照片后面
    const N = P.ph.length, rows = N > 4 ? 2 : 1, per = Math.ceil(N / rows), X0 = 110, X1 = 1810, Y0 = 372, Y1 = 938, gap = 46;   // 左上角留给日期卡和告白
    for (let r = 0; r < rows; r++) { const ks = P.ph.slice(r * per, (r + 1) * per), pics = ks.map((q) => chPic(M, q)), asp = pics.map((q) => q[3] / q[4]), sum = asp.reduce((a, b) => a + b, 0), h = Math.min((Y1 - Y0) / rows - 62, (X1 - X0 - gap * (ks.length - 1)) / sum);
      let x = (X0 + X1) / 2 - (h * sum + gap * (ks.length - 1)) / 2; const y = Y0 + (Y1 - Y0) * (r + 0.5) / rows - 8;
      ks.forEach((q, j) => { const i = r * per + j, w = h * asp[j], t0 = s.t0 + 0.1 + i * Math.min(0.28, (s.dur - 1.5) / N), on = E.outBack(cl((t - t0) / 0.55), 1.3); if (on > 0) card(ctx, pics[j], x + w / 2, y + 70 * (1 - on) + 5 * Math.sin(t * 0.9 + i), w * (0.9 + 0.1 * on), 0.07 * (M.hash(i, 915) - 0.5) + 0.01 * Math.sin(t * 0.7 + i), cl(on * 1.5)); x += w + gap; }); }
    chPetals(ctx, M, t, 34, 0.85);
    WD.post(ctx, { bloom: 0.36, warm: P.red ? ['rgba(255,190,140,.16)', 'rgba(60,10,30,.2)'] : ['rgba(255,214,200,.2)', 'rgba(90,70,160,.12)'] });
  },

  // 20XX.XX.XX 领证：红本本转着落进来，bar22 打开：里面是两个人的合照和「XX & XX」，最后压上钢印
  cert(ctx, s, M) {
    const t = s.t, lt = s.lt, E = M.ease, cl = M.clamp, tO = s.t0 + 1.0, tS = s.t0 + 2.3, op = E.inOut3(cl((t - tO) / 1.0)), drop = E.outBack(cl(lt / 1.0), 1.1);
    const g = ctx.createRadialGradient(1250, 560, 80, 1100, 540, 1300); g.addColorStop(0, '#6a1a24'); g.addColorStop(0.55, '#36101c'); g.addColorStop(1, '#14060e'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 120; i++) { const dep = [0.6, 1.2, 2.4][i % 3], x = M.hash(i, 781) * 2000 - 40 + 70 * t * dep, y = chMod(M.hash(i, 782) * 1300 - t * 60 * dep, 1300) - 110, r = (10 + 26 * M.hash(i, 783)) * dep; ctx.globalAlpha = (0.08 + 0.14 * M.hash(i, 784)) * (0.6 + 0.4 * Math.sin(t + i)) / Math.sqrt(dep); ctx.drawImage(WD.dot(['#ffcf7a', '#ff8a6a', '#ffe7b0'][i % 3]), chMod(x, 2000) - r, y - r, 2 * r, 2 * r); } ctx.restore();
    WD.rays(ctx, M.lerp(1300, 1280, op), 620, t * 3, { a: 0.22 + 0.25 * op, n: 22, len: 1300, c0: '#ffd9a0' });   // 书后面慢慢转的光
    const pw = 380, ph = 520, S = M.lerp(1110, 1280, op) + 30 * Math.sin(t * 0.9), cy = 640 - 90 * (1 - drop) + 26 * Math.sin(t * 1.3), sc = 0.9 + 0.1 * drop + 0.16 * E.inOut2(s.p), rot = (1 - drop) * 0.5 + (1 - op) * 0.03 + 0.025 * Math.sin(t * 0.8);
    ctx.save(); ctx.translate(S, cy); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = cl(lt / 0.3);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
    const page = (x0) => { ctx.fillStyle = '#fbf1e6'; ctx.fillRect(x0, -ph / 2, pw, ph); };
    if (op > 0) { page(0); ctx.shadowColor = 'transparent';   // 右页：合照 + 钢印
      ctx.fillStyle = '#d42a2a'; ctx.fillRect(70, -ph / 2 + 50, pw - 140, 190); const pic = sq(M, 'wed22'); ctx.save(); ctx.beginPath(); ctx.rect(70, -ph / 2 + 50, pw - 140, 190); ctx.clip(); ctx.drawImage(pic[0], 0, 30, 400, 317, 70, -ph / 2 + 50, pw - 140, 190); ctx.restore();
      ctx.strokeStyle = 'rgba(150,40,40,.35)'; ctx.lineWidth = 1; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(40, -10 + k * 30); ctx.lineTo(pw - 40, -10 + k * 30); ctx.stroke(); }
      M.text(ctx, '持证人', 60, 10, { font: 'LXGWWenKai', size: 22, fill: '#7a2a2a', stroke: null, align: 'left' }); for (const [nm, x] of [['XX', 60], ['XX', 170]]) M.text(ctx, nm, x, 54, { font: 'LXGWWenKai', size: 36, fill: '#2a1a1a', stroke: null, align: 'left' });
      M.text(ctx, '登记日期', 60, 110, { font: 'LXGWWenKai', size: 22, fill: '#7a2a2a', stroke: null, align: 'left' }); M.text(ctx, '20XX年XX月XX日', 60, 150, { font: 'LXGWWenKai', size: 30, fill: '#2a1a1a', stroke: null, align: 'left' });
      const se = E.out3(cl((t - tS) / 0.25)); if (t > tS) { const r0 = 74 * (1.6 - 0.6 * se); ctx.save(); ctx.globalAlpha = se; ctx.translate(pw - 90, -ph / 2 + 230); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, r0, 0, TAU); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r0 * 0.8, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(120,60,60,.3)'; ctx.beginPath(); ctx.arc(2, 2, r0, 0, TAU); ctx.stroke(); chHeart(ctx, 0, 4, r0 * 0.36, 'rgba(255,255,255,.7)', 1); ctx.restore(); }
      ctx.shadowColor = 'rgba(0,0,0,.55)'; }
    // 封面 / 左页：绕书脊翻开，cos < 0 时看到的是左页里面
    const fx = Math.cos(Math.PI * op); ctx.save(); ctx.scale(fx, 1);
    if (fx >= 0) { ctx.fillStyle = '#b3201e'; ctx.fillRect(0, -ph / 2, pw, ph); ctx.shadowColor = 'transparent'; const cg = ctx.createLinearGradient(0, -ph / 2, pw, ph / 2); cg.addColorStop(0, 'rgba(255,255,255,.12)'); cg.addColorStop(1, 'rgba(0,0,0,.18)'); ctx.fillStyle = cg; ctx.fillRect(0, -ph / 2, pw, ph);
      ctx.strokeStyle = '#e8c06a'; ctx.lineWidth = 3; ctx.strokeRect(22, -ph / 2 + 22, pw - 44, ph - 44); ctx.beginPath(); ctx.arc(pw / 2, -60, 70, 0, TAU); ctx.stroke();
      M.text(ctx, '囍', pw / 2, -58, { font: 'LXGWWenKai', size: 96, fill: '#f2cf7a', stroke: null }); M.text(ctx, '结婚证', pw / 2, 120, { font: 'LXGWWenKai', size: 66, fill: '#f2cf7a', stroke: null }); }
    else { ctx.scale(-1, 1); ctx.translate(-pw, 0); page(0); ctx.shadowColor = 'transparent'; ctx.fillStyle = 'rgba(214,42,42,.07)'; M.text(ctx, '囍', pw / 2, -20, { font: 'LXGWWenKai', size: 300, fill: 'rgba(214,42,42,.08)', stroke: null });
      M.text(ctx, '结婚证', pw / 2, -ph / 2 + 80, { font: 'LXGWWenKai', size: 40, fill: '#a32020', stroke: null }); M.text(ctx, 'XX & XX', pw / 2, 30, { font: 'LXGWWenKai', size: 48, fill: '#2a1a1a', stroke: null }); M.text(ctx, '20XX.XX.XX', pw / 2, 100, { font: 'LXGWWenKai', size: 30, fill: '#7a2a2a', stroke: null }); }
    ctx.restore(); ctx.restore();
    const tb = t - tS; if (tb > 0 && tb < 1.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const a = M.hash(i, 791) * TAU, v = 200 + 700 * M.hash(i, 792) ** 2, kk = (1 - Math.exp(-2.5 * tb)) / 2.5, r = 4 + 8 * M.hash(i, 793); ctx.globalAlpha = cl(1.2 - tb); ctx.drawImage(WD.dot('#ffe3a0'), S + 190 + Math.cos(a) * v * kk - r, cy - 30 + Math.sin(a) * v * kk + 40 * tb * tb - r, 2 * r, 2 * r); } ctx.restore(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 50; i++) { const x = 760 + 1000 * M.hash(i, 795) + 30 * Math.sin(t * 1.4 + i), y = chMod(M.hash(i, 796) * 1200 - t * (60 + 80 * M.hash(i, 797)), 1200) - 60, r = 3 + 6 * M.hash(i, 798); ctx.globalAlpha = 0.6 * Math.max(0, Math.sin(t * 2 + i)) ** 2; ctx.drawImage(WD.dot('#ffe3a0'), x - r, y - r, 2 * r, 2 * r); } ctx.restore();   // 往上飘的金粉
    WD.post(ctx, { bloom: 0.4, warm: ['rgba(255,190,140,.16)', 'rgba(60,10,30,.2)'] });
  },

  // 20XX.XX.XX 结婚：花开满树，两团光在树下绕着转，越转越近，合成两枚扣在一起的金戒指
  rings(ctx, s, M) {
    const t = s.t, lt = s.lt, E = M.ease, cl = M.clamp, cam = { x: WD.TREE_X - 2.6, y: 1.5, z: -13 + 0.6 * E.inOut2(s.p), f: 1500, hy: 760 };
    WD.ROAD = false; soft(ctx, M, 'far', 3, (c) => { WD.backdrop(c, 'dawn', cam); WD.ground(c, cam, 'dawn', false); WD.grass(c, cam, 'dawn', t, 13.4, 150); WD.tree(c, cam, t, 'dawn', { wind: 0.5, fol: [{ kind: 'blos', f: () => 1, size: 1.15 }] }); WD.grass(c, cam, 'dawn', t, 0.5, 13.4); });
    const [sx, sy] = WD.plateXY(cam, WD.MOODS.dawn.sun); WD.rays(ctx, sx, sy - 46, t, { a: 0.35, n: 26, len: 1700, a0: -Math.PI * 0.98, a1: -Math.PI * 0.02 });
    const tm = s.t0 + 2.2, mk = E.inOut3(cl((t - s.t0 - 0.6) / 1.6)), cx = 1250, cy = 500;
    const fz = -4, appr = E.inOut2(cl(lt / 2.0)), g2 = 1.5 - 0.98 * appr, arm = [82 - 30 * appr, 3 + 38 * appr, 14 + 30 * appr];   // 树下两人面对面走近，牵起双手；戒指浮在他们头顶
    people(ctx, M, s, cam, 'dawn', {
      her: { x: 2.4 - g2 / 2, z: fz, yaw: 90, walk: 0.49 * appr / 1.3, gait: Math.sin(Math.PI * appr), look: 'him', armL: arm, armR: arm, face: { happy: 0.45 + 0.5 * mk } },
      him: { x: 2.4 + g2 / 2, z: fz, yaw: 270, walk: 0.49 * appr / 1.45, gait: Math.sin(Math.PI * appr), look: 'her', armL: arm, armR: arm, handL: ['her.tipR', appr * appr], handR: ['her.tipL', appr * appr], turnL: 70 * appr, turnR: 70 * appr, gripL: 0.3 * appr, gripR: 0.3 * appr, face: { smile: 0.7, happy: 0.3 * mk } } });
    WD.grass(ctx, cam, 'dawn', t, 0.5, fz - cam.z + 0.3);
    const rk = E.outBack(cl((t - tm) / 0.7), 1.6); if (rk > 0) {
      const ring = (x, y, r, tilt, rot, part) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#fff6cc'); g.addColorStop(0.35, '#f0c45a'); g.addColorStop(0.7, '#a8701c'); g.addColorStop(1, '#ffe39a'); ctx.strokeStyle = g; ctx.lineWidth = r * 0.17; ctx.beginPath(); if (part === 'all') ctx.ellipse(0, 0, r, r * tilt, 0, 0, TAU); else ctx.ellipse(0, 0, r, r * tilt, 0, part === 'front' ? 0 : Math.PI, part === 'front' ? Math.PI : TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,240,.7)'; ctx.lineWidth = r * 0.03; ctx.stroke(); ctx.restore(); };
      const r = 150 * rk * (1 + 0.35 * E.inOut2(cl((t - tm) / 4))), sp = t * 1.3, ta = 0.42 + 0.22 * Math.sin(sp), tb2 = 0.5 + 0.22 * Math.cos(sp * 1.1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * cl(rk); ctx.drawImage(WD.dot('#ffe7a8'), cx - 3 * r, cy - 3 * r, 6 * r, 6 * r); ctx.restore();
      ring(cx - 0.42 * r, cy, r, ta, -0.3, 'back'); ring(cx + 0.42 * r, cy, r, tb2, 0.35, 'all'); ring(cx - 0.42 * r, cy, r, ta, -0.3, 'front');
      const gl = 0.5 + 0.5 * Math.sin(t * 4); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx - 0.42 * r + Math.cos(-0.3 - Math.PI / 2) * 0, cy - r * ta - 6); ctx.globalAlpha = 0.9 * cl(rk); ctx.drawImage(WD.dot('#ffffff'), -22, -22, 44, 44); ctx.strokeStyle = `rgba(255,255,255,${0.8 * gl})`; ctx.lineWidth = 2; for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) { const l = a % (Math.PI / 2) ? 26 : 54; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * l, -Math.sin(a) * l); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); } ctx.restore(); }
    const tb = t - tm; if (tb > 0 && tb < 1.8) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,236,190,${0.7 * cl(1 - tb / 1.2)})`; ctx.lineWidth = 2 + 8 * cl(1 - tb); ctx.beginPath(); ctx.arc(cx, cy, 60 + 900 * E.out3(cl(tb / 1.2)), 0, TAU); ctx.stroke(); ctx.restore(); }
    chPetals(ctx, M, t, 80 + 60 * cl(tb), 0.95, 90);
    WD.post(ctx, { bloom: 0.42, warm: ['rgba(255,214,190,.24)', 'rgba(90,80,160,.12)'] });
  },

  // 「续写未来的魔法 / 把所有未来都写在我笔下」：雪夜里狗尾草又亮了，在夜空里一笔一笔写出「未来」。params: l1, l2
  pen(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, E = M.ease, cl = M.clamp, cam = { x: -0.4, y: 1.3 + 0.4 * s.p, z: -12 + 0.4 * lt, f: 1500, hy: 780 };
    land(ctx, cam, 'snowNight', t, 4, { place: 'meadow', keepTree: 1, stars: 1, tree: { snow: 1 } });
    WD.snowfall(ctx, t, { n: 200, wind: -20, a: 0.7 });
    const tM = M.word(P.l1, '魔'), w0 = M.word(P.l2, '未'), w1 = M.word(P.l2, '下') + 0.25, q = E.inOut2(cl((t - w0) / (w1 - w0))), TX = 1240, TY = 600, size = 300, tw = M.measure('未来', { font: CAP.font, size });
    // 笔尖：写之前画一圈圈魔法光带，写的时候跟着字走
    const tip = (tt) => { const qq = E.inOut2(cl((tt - w0) / (w1 - w0))); if (tt < w0) { const a = (tt - s.t0) * 2.2; return [TX + 260 * Math.cos(a) * (0.6 + 0.4 * Math.sin(a * 0.7)), TY - 120 + 150 * Math.sin(a * 1.3)]; } return [TX - tw / 2 + tw * qq, TY - 40 + 90 * Math.sin(qq * 26)]; };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let k = 40; k > 0; k--) { const [x, y] = tip(t - k * 0.03); ctx.globalAlpha = 0.5 * (1 - k / 40); const r = 10 * (1 - k / 44); ctx.drawImage(WD.dot('#ffe9a0'), x - r, y - r, 2 * r, 2 * r); } ctx.restore();
    if (q > 0) { ctx.save(); ctx.beginPath(); ctx.rect(TX - tw / 2 - 20, TY - size, tw * q + 20, size * 2); ctx.clip(); M.text(ctx, '未来', TX, TY, { font: CAP.font, size, fill: '#fff4d0', stroke: '#c98a2a', strokeW: 0.02, glow: 'rgba(255,190,90,.9)' }); ctx.restore(); }
    const [px, py] = tip(t); foxtail(ctx, px - 0.1 * 170, py + 0.88 * 170, 170, 0.1, 0.7 + 0.25 * Math.sin(t * 7) + (t > tM && t < tM + 1 ? 0.8 * (1 - (t - tM)) : 0));
    const tb = t - tM; if (tb > 0 && tb < 1.8) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 120; i++) { const a = M.hash(i, 801) * TAU, v = 150 + 700 * M.hash(i, 802) ** 2, kk = (1 - Math.exp(-2.4 * tb)) / 2.4, r = 3 + 7 * M.hash(i, 803); ctx.globalAlpha = cl(1.3 - tb); ctx.drawImage(WD.dot('#fff3b8'), px + Math.cos(a) * v * kk - r, py + Math.sin(a) * v * kk + 50 * tb * tb - r, 2 * r, 2 * r); } ctx.restore(); }
    WD.post(ctx, { bloom: 0.45, warm: ['rgba(255,200,140,.12)', 'rgba(30,40,120,.24)'] });
  },

  // 20XX.XX.XX XX:XX 第一个孩子（孩子不画）：雪夜树下两人并肩，「回答」时两人中间亮起暖光，宝宝的照片像灯笼一样一张张升上去。params: at, ph
  lantern(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, E = M.ease, cl = M.clamp, tB = M.ref(P.at), cam = { x: -0.5, y: 1.15 + 0.25 * E.inOut2(s.p), z: -10.5 + 0.3 * lt, f: 1500, hy: 700 + 20 * E.inOut2(s.p) }, zP = -4.2;
    land(ctx, cam, P.md || 'snowNight', t, zP - cam.z + 0.3, { place: 'meadow', keepTree: 1, stars: 1, tree: { snow: P.md ? 0 : 1, fol: P.md ? LEAF : [] } });
    const cup = M.smooth(tB - 1.6, tB - 0.4, t), upk = M.smooth(tB + 0.9, tB + 3.5, t), glow = [0, 0.98, zP - 0.17], down = M.smooth(tB - 2.2, tB - 0.5, t), look = (p0, d) => p0.map((v, i) => M.lerp(M.lerp(v, glow[i], down), [2.0, 4.2, zP - 1.0][i], M.smooth(tB + 0.9 + d, tB + 3.3 + d, t))), wow = M.smooth(tB - 0.1, tB + 0.2, t) * (1 - M.smooth(tB + 0.6, tB + 1.4, t));   // 两人面朝镜头，里侧的手一起捧着那团光，再抬头看灯笼
    people(ctx, M, s, cam, P.md || 'snowNight', { pts: { glow },
      her: { x: -0.34, z: zP, yaw: 160, look: look([0.3, 1.45, zP - 0.5], 0), handL: ['pt.glow', cup], armL: [82 - 30 * cup, 3 + 40 * cup, 14 + 60 * cup], wristL: 20 * cup, face: { surprised: 0.7 * wow, happy: 0.35 + 0.55 * upk } },
      him: { x: 0.34, z: zP, yaw: 200, look: look([-0.3, 1.4, zP - 0.5], 0.4), handR: ['pt.glow', cup], armR: [82 - 30 * cup, 3 + 40 * cup, 14 + 60 * cup], wristR: 20 * cup, face: { surprised: 0.6 * wow, smile: 0.5, happy: 0.4 * upk } } });
    WD.grass(ctx, cam, P.md || 'snowNight', t, 0.5, zP - cam.z + 0.3);
    const [kx, ky, ks] = WD.proj(cam, ...glow), tb = t - tB;   // 两人捧着的手里
    if (tb > 0) { const r = (0.3 + 0.04 * Math.sin(t * 5)) * ks * Math.min(1, tb * 3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(WD.dot('#ffd890'), kx - r, ky - r, 2 * r, 2 * r); ctx.restore(); }
    if (tb > 0 && tb < 2.2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,230,170,${0.8 * cl(1 - tb / 1.2)})`; ctx.lineWidth = 2 + 8 * cl(1 - tb); ctx.beginPath(); ctx.arc(kx, ky, 30 + 800 * E.out3(cl(tb / 1.2)), 0, TAU); ctx.stroke(); ctx.restore(); WD.rays(ctx, kx, ky, t, { a: 0.4 * cl(1 - tb / 2.2), n: 22, len: 1300, c0: '#ffe4a0' }); }
    chBurst(ctx, M, tb, kx, ky, 1100, '#ffb84a', 210, 960, 0.5 * ks, 30);   // 「回答」那一下：光屑从两人手里朝四面炸开
    // 宝宝的照片：像灯笼一张张升上去，后面带着暖光（靠右一列，不挡两人的脸）
    const iv = Math.min(0.55, (s.t1 - tB - 1.6) / P.ph.length); P.ph.forEach((k, i) => { const t0 = tB + 0.9 + i * iv, tau = t - t0; if (tau <= 0) return; const pic = chPic(M, k), hh = 210 + 50 * M.hash(i, 811), w = hh * pic[3] / pic[4], x = 1470 + 270 * M.hash(i, 812) + 40 * Math.sin(tau * 1.2 + i), y = ky - 120 - 190 * tau - 20 * tau * tau, a = cl(tau / 0.4) * cl((y + 200) / 300);
      if (y < -300) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * a; ctx.drawImage(WD.dot('#ffc870'), x - hh, y - hh, 2 * hh, 2 * hh); ctx.restore(); card(ctx, pic, x, y, w, 0.12 * Math.sin(tau * 1.5 + i), a); });
    if (!P.md) WD.snowfall(ctx, t, { n: 240, wind: -20, a: 0.8 });
    WD.post(ctx, { bloom: 0.42, warm: ['rgba(255,200,140,.14)', 'rgba(30,40,120,.22)'] });
  },

  // 「外面世界 到底有多大」：从高处看这条路，一路铺着这些年的照片，一直铺到天边；两人走在最前面
  path(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, E = M.ease, cam = { x: 0.6 * Math.sin(lt * 0.8), y: 5.2 - 1.2 * E.inOut2(s.p), z: -16 + 2.3 * lt, f: 1500, hy: 380 };
    WD.backdrop(ctx, 'dawn', cam); WD.ground(ctx, cam, 'dawn'); WD.poles(ctx, cam, 'dawn'); WD.grass(ctx, cam, 'dawn', t, 3, 150);
    const N = P.ph.length; for (let i = N - 1; i >= 0; i--) { const z = -11 + i * 1.0, d = z - cam.z; if (d < 1.2 || d > 120) continue; const side = i % 2 ? 1 : -1, x = side * (1.5 + 1.1 * M.hash(i, 821)), [sx, sy, sc] = WD.proj(cam, x, 0.03, z), ky = Math.min(1, 1.6 * cam.y / d), pic = sq(M, P.ph[i]), w = 1.5 * sc;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1, ky); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * M.clamp((d - 1.2) / 2); const gr = w * 1.1; ctx.drawImage(WD.dot('#ffe2b0'), -gr, -gr, 2 * gr, 2 * gr); ctx.restore();
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1, ky); card(ctx, pic, 0, 0, w, 0.5 * (M.hash(i, 822) - 0.5), M.clamp((d - 1.2) / 2)); ctx.restore(); }
    people(ctx, M, s, cam, 'dawn', duo('walk', -7 + 2.3 * (t - s.t0), 1.6 * (t - s.t0), { gait: 1.12, her: { bend: 6 }, him: { bend: 6 } }));   // 牵着手小跑（2.3 米/秒）
    const [sx, sy] = WD.plateXY(cam, WD.MOODS.dawn.sun); WD.flare(ctx, sx, sy - 46, 0.7); WD.rays(ctx, sx, sy - 46, t, { a: 0.3, n: 26, len: 1700, a0: -Math.PI * 0.98, a1: -Math.PI * 0.02 });
    chPetals(ctx, M, t, 50, 0.9);
    WD.post(ctx, { bloom: 0.4, warm: ['rgba(255,214,190,.22)', 'rgba(90,80,160,.12)'] });
  },

  // 「守着深夜里的星星」：满天的星里，照片一颗颗亮起来，连成一颗心
  starmap(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, E = M.ease, cl = M.clamp, cam = { x: 0.4 * Math.sin(lt * 0.5), y: 1.0, z: -10 + 0.6 * lt, f: 1500, hy: 900 + 90 * M.ease.inOut2(s.p) };
    land(ctx, cam, 'starNight', t, 0.5, { place: 'lake', stars: 1 });
    people(ctx, M, s, cam, 'starNight', duo('sit', -4, 0, { lean: 1, look: [1.6, 7, 10], her: { y: 0.35 }, him: { y: 0.35 } }), { shadow: 0 });   // 画面最下面两个人的背影
    const N = P.ph.length, pts = P.ph.map((_, i) => chHeartPt(i / N, 1200, 560, 15)), T = P.ph.map((_, i) => s.t0 + 0.2 + i * (s.dur - 1.0) / N);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(190,214,255,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach(([x, y], i) => { if (t < T[i]) return; i && t >= T[i - 1] ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (t > T[N - 1] + 0.3) ctx.lineTo(...pts[0]); ctx.stroke(); const hb = t - T[N - 1] - 0.3; if (hb > 0) { ctx.globalAlpha = 0.5 * M.smooth(0, 0.4, hb) * Math.exp(-hb * 2);   // 心连成那一下的粉光缓起（0.4 秒），不一帧亮起来
      ctx.drawImage(WD.dot('#ffd6e4'), 1200 - 420, 560 - 400, 840, 840); } ctx.restore();
    pts.forEach(([x, y], i) => { const tau = t - T[i]; if (tau <= 0) return; const g = E.outBack(cl(tau / 0.35), 2.2), r = 40 * g;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const d of [0, 0.2]) { const p = (tau - d) / 1.2; if (p > 0 && p < 1) { ctx.strokeStyle = `rgba(190,214,255,${0.7 * (1 - p)})`; ctx.lineWidth = 1.5 + 4 * (1 - p); ctx.beginPath(); ctx.ellipse(x, y, 20 + 140 * E.out3(p), (20 + 140 * E.out3(p)) * 0.45, 0, 0, TAU); ctx.stroke(); } } ctx.drawImage(WD.dot('#fff0b0'), x - r * 1.5, y - r * 1.5, 3 * r, 3 * r); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.save(); ctx.clip(); ctx.drawImage(sq(M, P.ph[i])[0], x - r, y - r, 2 * r, 2 * r); ctx.restore(); ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); });
    WD.post(ctx, { bloom: 0.42, warm: ['rgba(120,140,255,.14)', 'rgba(20,30,100,.2)'] });
  },

  // 「相信美梦和你」：20XX 年那张老照片和今天的全家福并排，一根光线把它们连起来
  thennow(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, cl = M.clamp;
    chBack(ctx, M, s, 'dawn', 12, { place: 'meadow', tree: { fol: [{ kind: 'blos', f: () => 1 }] } });
    const a = chHero(ctx, M, s, ALLPH[0], { x: 1000, y: 650, h: 500, rot: -0.06, push: 0.04 }), b = chHero(ctx, M, s, P.ph, { x: 1500, y: 640, h: 500, rot: 0.04, d0: 0.35, push: 0.04, ph: 2 });
    if (a && b) { const q = cl((t - M.word(41, '美') + 0.1) / 0.7), x0 = a[0] + a[2] / 2 + 30, x1 = b[0] - b[2] / 2 - 30, y0 = a[1] - 80; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,230,180,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - 120, M.lerp(x0, x1, q), y0 + (b[1] - 80 - y0) * q - 120 * 4 * q * (1 - q) * 0); ctx.stroke(); const hx = M.lerp(x0, x1, q); chHeart(ctx, hx, y0 - 60 * Math.sin(Math.PI * q), 16, '#ff9ab4', q > 0 ? 0.9 : 0); ctx.restore(); }
    if (a) M.text(ctx, '20XX', a[0], a[1] + a[3] / 2 + 90, { ...CAP, size: 48, alpha: cl(lt / 0.6) }); if (b) M.text(ctx, '今天', b[0], b[1] + b[3] / 2 + 90, { ...CAP, size: 48, alpha: cl((lt - 0.35) / 0.6) });
    chPetals(ctx, M, t, 30, 0.8);
    WD.post(ctx, { bloom: 0.42, warm: ['rgba(255,214,200,.22)', 'rgba(90,70,160,.14)'] });
  },

  // 「总有一天 会预先到达」：所有照片从四面八方飞来，拼成一颗大心；心中间是他们两个
  heart(ctx, s, M) {
    const t = s.t, lt = s.lt, P = s.params, E = M.ease, cl = M.clamp, H = M.hash, cx = 1150, cy = 610, k = 21;
    chBack(ctx, M, s, 'dawn', 10, { place: 'sea', tree: { fol: [{ kind: 'blos', f: () => 1 }] } });
    const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, 900); g.addColorStop(0, 'rgba(255,236,220,.35)'); g.addColorStop(1, 'rgba(80,60,140,.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H);
    const N = P.ph.length, RING = [[0.46, 1], [0.34, 0.72], [0.2, 0.45]], slots = [], ringOf = [];   // 三圈心：外圈最多
    RING.forEach(([f, sc], r) => { const n = r < 2 ? Math.round(N * f) : N - slots.length; for (let j = 0; j < n; j++) { slots.push(chHeartPt((j + 0.5 * r) / n, cx, cy + 22 * r, k * sc)); ringOf.push(r); } });
    const beat = 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 * cl((lt - 1.5) / 1); ctx.drawImage(WD.dot('#ffd6e4'), cx - 600, cy - 560, 1200, 1200); ctx.restore();
    const tA = M.word(P.l || 42, '到'), span = Math.max(0.3, tA - s.t0 - 1.55);   // 照片在唱到「到达」之前全部落位，画面先静一下
    P.ph.forEach((key, i) => { const t0 = 0.1 + span * (i / N) + 0.2 * H(i, 831), q = E.out3(cl((lt - t0) / 0.9)); if (q <= 0) return; const a0 = H(i, 832) * TAU, fx = cx + Math.cos(a0) * 1500, fy = cy + Math.sin(a0) * 1000, [x1, y1] = slots[i];
      const x = M.lerp(fx, cx + (x1 - cx) * beat, q), y = M.lerp(fy, cy + (y1 - cy) * beat, q), w = [70, 62, 56][ringOf[i]] * (1 + 0.6 * (1 - q)); card(ctx, sq(M, key), x, y, w, (1 - q) * 2 * (H(i, 833) - 0.5) + 0.2 * (H(i, 834) - 0.5)); });
    const oc = E.out3(cl((t - tA) / 0.6));   // 唱到「到达」他们两个的光出现在心中间
    if (oc > 0) people(ctx, M, s, { x: -1.38, y: 0.8, z: -10.9 + 0.5 * (1 - oc), f: 1500, hy: 668 }, 'dawn', {   // 人物层自己一台相机：两个人小小地站在心中间，面朝镜头牵着手
      her: { x: -0.2, z: 0, yaw: 172, armL: [68, 3, 14], wristL: -25, turnL: 80, gripL: 0.45, side: 9, head: [0, 0, 9], face: { happy: 0.9 } }, him: { x: 0.2, z: 0, yaw: 188, handR: ['her.holdL', 1], wristR: 25, turnR: -80, gripR: 0.5, calmR: 1, face: { happy: 0.5, smile: 0.5 } } }, { shadow: 0, alpha: oc });
    const tb = t - tA; if (tb > 0 && tb < 1.8) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,236,210,${0.8 * cl(1 - tb / 1.3)})`; ctx.lineWidth = 2 + 8 * cl(1 - tb); ctx.beginPath(); ctx.arc(cx, cy + 40, 40 + 900 * E.out3(cl(tb / 1.3)), 0, TAU); ctx.stroke(); ctx.restore(); }
    chBurst(ctx, M, tb, cx, cy + 40, 1050, 'heart', 240, 980);   // 「到达」那一下：一大把小心从心中间朝四面冲出去
    chPetals(ctx, M, t, 50, 0.85);
    WD.post(ctx, { bloom: 0.45, warm: ['rgba(255,214,200,.24)', 'rgba(90,70,160,.12)'] });
  },

  // 尾声：天亮的土路和开满花的树，两人的光沿路走回家；片名落下，最后暗下去
  ending(ctx, s, M) {
    const t = s.t, lt = s.lt, E = M.ease, cl = M.clamp, k = E.inOut2(s.p), cam = { x: 0.5, y: 1.5 + 3.5 * k, z: -26 + 0.5 * lt, f: 1500, hy: 740 + 120 * k }, zO = (tt) => -20 + 0.75 * (tt - s.t0);
    land(ctx, cam, 'dawn', t, zO(t) - cam.z + 0.4, { tree: { wind: 0.4, fol: [{ kind: 'blos', f: () => 1, size: 1.1 }] } });
    const [sx, sy] = WD.plateXY(cam, WD.MOODS.dawn.sun); WD.flare(ctx, sx, sy - 46, 0.7);
    people(ctx, M, s, cam, 'dawn', duo('walk', zO(t), 0.75 * (t - s.t0), { gait: 0.8, lean: 0.4 }));
    WD.grass(ctx, cam, 'dawn', t, 0.5, zO(t) - cam.z + 0.4);
    WD.rays(ctx, sx, sy - 46, t, { a: 0.38, n: 30, len: 1700, a0: -Math.PI * 0.98, a1: -Math.PI * 0.02 });
    chPetals(ctx, M, t, 70, 0.9, 40);
    chBurst(ctx, M, t - M.ref('bar53'), 960, 420, 1100, 'petal', 380, 990, 280);   // 片名落下那一下：一大把花瓣从片名后面朝四面冲出去
    WD.post(ctx, { bloom: 0.42, warm: ['rgba(255,214,190,.24)', 'rgba(90,80,160,.12)'] });
    const tT = M.ref('bar53'), a = E.out3(cl((t - tT) / 1.2)), out = cl((s.t1 - 3.6 - t) / 1.6);
    if (a > 0) { M.text(ctx, '我会等', 960, 400 + 30 * (1 - a), { ...CAP, size: 190, alpha: a * out }); M.text(ctx, '写给 XX', 960, 540, { ...CAP, size: 46, alpha: cl((t - tT - 0.8) / 1) * out }); M.text(ctx, 'XX · 20XX—余生', 960, 610, { ...CAP, size: 40, alpha: cl((t - tT - 1.4) / 1) * out }); }
    const blk = cl((t - (s.t1 - 4.6)) / 4.6); if (blk > 0) { ctx.fillStyle = `rgba(0,0,0,${E.inOut2(blk)})`; ctx.fillRect(0, 0, M.W, M.H); }
  },
};

// 片头（cues.json 的 intro，发布用，t < 0 那几秒）：黑底，照 I.keys 的时间一个字一个字打出来，【】里的字用强调色；光标打字时常亮，停下来就闪，换行时沿斜线滑到下一行开头；光标是橙色（intro.caret）。T 是片头里第几秒
// 片头里的表情：打出来那一下从 0 弹到比原来大一点再回来，往上飘几颗小心，之后轻轻左右晃。a 是它打出来多少秒了，返回字宽
const introEmoji = (ctx, M, ch, x, y, st, a) => {
  const cl = M.clamp, w = M.measure(ch, st), cx = x + w / 2, q = cl(a / 0.4) - 1;
  const s = (1 + 3.2 * q * q * q + 2.2 * q * q) * (1 + 0.04 * Math.sin(a * 9));   // 回弹 + 一点呼吸
  ctx.save(); ctx.translate(cx, y); ctx.rotate(0.12 * Math.sin(a * 4.5) * cl(a / 0.4)); ctx.scale(s, s); M.text(ctx, ch, -w / 2, 0, st); ctx.restore();
  for (let i = 0; i < 5; i++) {
    const b = a - 0.08 - 0.06 * i; if (b <= 0 || b >= 1.4) continue;
    const e = M.ease.out3(b / 1.4), ang = -Math.PI / 2 + (i - 2) * 0.45, r = st.size * (0.2 + 0.06 * M.hash(i, 31)), hx = cx + Math.cos(ang) * st.size * 1.6 * e, hy = y + Math.sin(ang) * st.size * 1.6 * e;
    ctx.save(); ctx.globalAlpha *= 1 - (b / 1.4) ** 2; ctx.fillStyle = i % 2 ? '#ff4f8b' : '#ff86b3'; ctx.beginPath(); ctx.moveTo(hx, hy + r);
    ctx.bezierCurveTo(hx - 1.3 * r, hy + 0.1 * r, hx - 0.9 * r, hy - 1.1 * r, hx, hy - 0.35 * r); ctx.bezierCurveTo(hx + 0.9 * r, hy - 1.1 * r, hx + 1.3 * r, hy + 0.1 * r, hx, hy + r); ctx.fill(); ctx.restore();
  }
  return w;
};
const introText = (ctx, M, T, I) => {
  const base = I.size || 84, hi = (M.cues.look || {}).accent || '#ff7a68', EMO = /\p{Extended_Pictographic}/u;
  let pi = 0, li = 0, last = -9, enter = -9; const typed = {}, at = {};   // 打到第几屏、第几行，这一屏每行打了几个字、每个字什么时候打出来，最近一次回车在什么时候
  for (const k of I.keys) { if (k.t > T) break; last = k.t; pi = k.pi; li = k.li; if (k.s === 'enter') enter = k.t; if (k.s === 'del') { for (const q in typed) delete typed[q]; } else if (k.ci >= 0) { typed[k.li] = k.ci + 1; at[k.li + ',' + k.ci] = k.t; } }
  // 每行的字号、样式和字（[字, 用不用强调色]）；空格换成不换行空格，M.text 会吃掉普通空格
  const rows = I.pages[pi].map((L) => { const o = typeof L === 'string' ? { text: L } : L, size = o.size || base;
    return { size, fx: o.fx, st: { font: I.font || 'ZCOOLKuaiLe', size, fill: o.fill || '#ffffff', stroke: null, glow: null, align: 'left' },
      cs: o.text.replace(/ /g, '\u00a0').split(/[【】]/).flatMap((p, j) => [...p].map((c) => [c, j % 2 === 1])) }; });
  const hs = rows.map((r) => r.size * 1.75), tot = hs.reduce((a, b) => a + b, 0), ys = [];
  rows.forEach((r, j) => { ys[j] = j ? ys[j - 1] + (hs[j - 1] + hs[j]) / 2 : (M.H - tot + hs[0]) / 2; });   // 行距跟着各行字号，整屏上下居中
  const x0 = (M.W - Math.max(...rows.map((r) => M.measure(r.cs.map((c) => c[0]).join(''), r.st)))) / 2;   // 整屏左右居中，行左对齐
  let cx = x0; const ends = [];   // 每行打到哪（光标换行从上一行末尾过来）
  rows.forEach((r, j) => {
    let x = x0; const vis = r.cs.slice(0, typed[j] || 0);
    const wave = r.fx === 'wave' && vis.length === r.cs.length ? T - at[j + ',' + (r.cs.length - 1)] : -1;   // fx: "wave"：整行打完，字从左到右轮流轻轻跳一下，一直循环
    if (wave >= 0) vis.forEach(([c, h], i) => { x += M.text(ctx, c, x, ys[j] - r.size * 0.3 * Math.max(0, Math.sin(wave * 5 - i * 0.3)) * M.clamp(wave / 0.3), { ...r.st, ...(h && { fill: hi }) }); });
    else for (let a = 0, b; a < vis.length; a = b) {
      if (EMO.test(vis[a][0])) { x += introEmoji(ctx, M, vis[a][0], x, ys[j], r.st, T - (at[j + ',' + a] ?? -9)); b = a + 1; continue; }
      for (b = a; b < vis.length && vis[b][1] === vis[a][1] && !EMO.test(vis[b][0]); b++);
      x += M.text(ctx, vis.slice(a, b).map((c) => c[0]).join(''), x, ys[j], { ...r.st, ...(vis[a][1] && { fill: hi }) });
    }
    ends[j] = x; if (j === li) cx = x;
  });
  let cy = ys[li], cs = rows[li].size; const p = M.ease.inOut3(M.clamp((T - enter) / 0.22));   // 回车后 0.22 秒：光标沿斜线从上一行末尾滑到这一行开头
  if (p < 1 && li > 0) { cx = ends[li - 1] + (cx - ends[li - 1]) * p; cy = ys[li - 1] + (cy - ys[li - 1]) * p; cs = rows[li - 1].size + (cs - rows[li - 1].size) * p; }
  if (T - last < 0.5 || T % 1.06 < 0.53) { ctx.fillStyle = I.caret || '#ff9a2e'; ctx.fillRect(cx + cs * 0.08, cy - cs * 0.5, Math.max(4, cs * 0.07), cs); }
};

MV.scene({
  bg: '#060b26',
  images: PHS.files,
  async setup(M) { MM = M; WD.init(M); await proxyInit(M); },
  overlay: words,
  intro: introText,
  shots: Object.fromEntries(Object.entries({ ...CH,   // 52 秒以后的镜头在上面的 CH 里
    // 片头：只有一张旧照片，最后镜头冲进照片里
    album(ctx, s, M) {
      const t = s.t, lt = s.lt, E = M.ease, im = chPic(M, ALLPH[0])[0], out = E.in3(M.clamp((lt - (s.dur - 0.8)) / 0.8));
      const g = ctx.createRadialGradient(700, 480, 80, 960, 540, 1300); g.addColorStop(0, '#2c4290'); g.addColorStop(0.5, '#111f54'); g.addColorStop(1, '#050920'); ctx.fillStyle = g; ctx.fillRect(0, 0, M.W, M.H);
      const bokeh = (from, to) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = from; i < to; i++) { const dep = [0.5, 1, 2.2][i % 3], spr = WD.dot(['#ffd9a8', '#ff9f8a', '#9fb8ff'][(i * 7) % 3]), x = M.hash(i, 11) * (M.W + 200) - 100 + 50 * Math.sin(t * 0.6 + i) + 18 * t * dep, y = mod(M.hash(i, 12) * (M.H + 300) - t * 46 * dep, M.H + 300) - 150, r = (12 + 30 * M.hash(i, 13)) * dep;
        ctx.globalAlpha = (0.12 + 0.18 * M.hash(i, 14)) * (0.6 + 0.4 * Math.sin(t * (0.8 + M.hash(i, 15)) + i)) / Math.sqrt(dep); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); };
      bokeh(0, 80);
      const wide = im.width > im.height, h = wide ? 470 : 800, w = h * im.width / im.height, b = 26, on = E.out3(M.clamp(lt / 1.2)), k = (0.9 + 0.13 * s.p) * (1 + 1.7 * out);
      ctx.save(); ctx.translate(M.lerp((wide ? 560 : 680) + 14 * Math.sin(t * 0.8), 960, out), M.lerp(545 + 10 * Math.sin(t * 1.1 + 1), 470, out) + 40 * (1 - on)); ctx.rotate((-0.045 + 0.016 * Math.sin(t * 0.9)) * (1 - out)); ctx.scale(k, k); ctx.globalAlpha = on;
      ctx.shadowColor = 'rgba(0,0,12,.6)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 28; ctx.fillStyle = '#fbf7ee'; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b + 40); ctx.shadowColor = 'transparent';
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
      const wg = ctx.createLinearGradient(0, -h / 2, 0, h / 2); wg.addColorStop(0, 'rgba(255,214,170,.16)'); wg.addColorStop(1, 'rgba(60,40,90,.14)'); ctx.fillStyle = wg; ctx.fillRect(-w / 2, -h / 2, w, h);
      const sx = -w + 2.6 * w * mod((lt - 0.6) / 2.0, 1), sg = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.save(); ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.fillStyle = sg; ctx.fillRect(-w * 2, -h / 2, w * 4, h); ctx.restore();   // 一道慢慢扫过相纸的反光
      ctx.restore();
      bokeh(80, 96);
      WD.post(ctx, { bloom: 0.3, warm: ['rgba(255,210,170,.12)', 'rgba(30,40,120,.2)'] });
    },

    // 20XX.XX.XX 相遇：夏末傍晚的土路，路边停着他那辆旧自行车；两团光一前一后往前飘，最后靛蓝那团停下、往回靠
    meet(ctx, s, M) {
      const t = s.t, lt = s.lt, cam = { x: 0.2, y: 1.5, z: -27 + 0.8 * lt, f: 1500, hy: 690 }, zB = -16;
      land(ctx, cam, 'dusk', t, zB - cam.z + 0.6, { tree: { fol: LEAF } });
      const [sx0, sy0] = WD.plateXY(cam, WD.MOODS.dusk.sun); WD.flare(ctx, sx0, sy0, 0.5);
      WD.shadow(ctx, cam, -0.75, zB + 0.25, 0.9, 0.26, '#203060');
      WD.lit(ctx, 'fig', 'dusk', (c) => { const [bx, by, bs] = WD.proj(cam, -1.36, 0, zB + 0.3); bike(c, bx, by, bs, 0); }, { rim: 1, rimW: 2.5 });
      WD.grass(ctx, cam, 'dusk', t, 0.5, zB - cam.z - 0.3);
      const ramp = (x, a, b) => x < a ? x : x > b ? (a + b) / 2 : x - (x - a) ** 2 / (2 * (b - a)), l = t - s.t0, D = s.dur;   // 走着走着慢下来、停住：ramp 是走过的时间
      const trn = M.smooth(D - 2.1, D - 0.35, l), dh = 0.82 * ramp(l, D - 2.6, D - 1.9), dw = 0.8 * ramp(l, D - 1.4, D - 0.7);   // 他先停下、回头；她跟着停住
      people(ctx, M, s, cam, 'dusk', {
        him: { x: -0.75, z: -17.4 + dh, yaw: 150 * trn, walk: dh / 1.45, gait: M.clamp((D - 1.9 - l) / 0.6), look: 'her', lookW: trn, face: { surprised: 0.5 * Math.sin(Math.PI * trn), smile: 0.7 * trn } },
        her: { x: 0.6, z: -19.8 + dw, yaw: 0, walk: dw / 1.3, gait: M.clamp((D - 0.7 - l) / 0.6), look: 'him', lookW: 0.5 + 0.5 * trn, face: { surprised: 0.7 * trn } } });
      const mote = WD.dot('#fff2b0'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const dep = 0.5 + 1.5 * M.hash(i, 21), x = mod(M.hash(i, 22) * 2100 + 22 * t * dep, 2100) - 90, y = 380 + 640 * M.hash(i, 23) + 24 * Math.sin(t * (0.5 + M.hash(i, 24)) + i), r = (3 + 5 * M.hash(i, 25)) * dep; ctx.globalAlpha = 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3)); ctx.drawImage(mote, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
      WD.rays(ctx, sx0, sy0, t, { a: 0.22, n: 18, len: 1500, a0: Math.PI * 0.75, a1: Math.PI * 1.2 });
      WD.post(ctx, { bloom: 0.36, warm: ['rgba(255,200,150,.2)', 'rgba(90,70,160,.14)'] });
    },

    // 对上眼的那一下：虚着的夏末傍晚前，先是回过头来的他，再是愣住、慢慢脸红低头的她（人物层自己一台长焦相机）
    glance(ctx, s, M) {
      const t = s.t, lt = s.lt, him = s.params.who === 'him', e = M.ease.out3(s.p), sm = M.smooth, cam = { x: him ? -2.2 : 1.6, y: 1.5, z: -15 + 0.25 * e, f: 1500, hy: 630 };
      soft(ctx, M, 'far', 8, (c) => { land(c, cam, 'dusk', t, 2, { tree: { fol: LEAF } }); const [fx0, fy0] = WD.plateXY(cam, WD.MOODS.dusk.sun); WD.flare(c, fx0, fy0, 0.6); });
      const hx = 3, hz = -4, ey = him ? 1.5 : 1.39, pc = { x: hx + (him ? 0.14 : -0.16), y: ey, z: hz - 2.3 + 0.3 * e, f: 4500, hy: 520 }, turn = sm(-0.7, 1.5, lt), shy = sm(1.0, 2.5, lt);
      people(ctx, M, s, pc, 'dusk', him ? { him: { x: hx, z: hz, yaw: 166 + 28 * turn, face: { surprised: 0.45 * (1 - sm(0.4, 1.6, lt)), smile: 0.75 * sm(0.4, 1.6, lt) } } }
        : { her: { x: hx, z: hz, yaw: 198, head: [-9 * shy, 10 * shy, -4 * shy], face: { surprised: 0.6 * (1 - shy), smile: 0.65 * shy } } }, { shadow: 0, rimW: 4 });
      if (!him) { const [bx, by, bs] = WD.proj(pc, hx, ey - 0.03, hz - 0.08), r = 0.11 * bs; ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.75 * sm(0.4, 2.0, lt); ctx.drawImage(WD.dot('#ff5a48'), bx - r, by - r * 0.7, 2 * r, 1.4 * r); ctx.restore(); }   // 脸慢慢红了
      const mote = WD.dot('#fff2b0'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 40; i++) { const dep = 0.6 + 2 * M.hash(i, 21), x = mod(M.hash(i, 22) * 2100 + 30 * t * dep, 2100) - 90, y = 80 + 940 * M.hash(i, 23) + 24 * Math.sin(t * (0.5 + M.hash(i, 24)) + i), r = (4 + 7 * M.hash(i, 25)) * dep; ctx.globalAlpha = 0.45 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.3)); ctx.drawImage(mote, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
      WD.post(ctx, { bloom: 0.36, warm: ['rgba(255,200,150,.22)', 'rgba(90,70,160,.14)'] });
    },

    // 20XX.XX.XX 相恋：夏夜草坡。天黑、星星亮；一根狗尾草的穗子亮起来，「魔法」那一下炸开、狗尾草飞上天，镜头跟着它升进星河（两人留在地上）；心愿一粒粒从草尖种进夜空
    stars(ctx, s, M) {
      const t = s.t, lt = s.lt, E = M.ease, cl = M.clamp, H = M.hash, L1 = M.lineN(1), L2 = M.lineN(2), tMo = M.word(1, '魔');
      const upAt = (tt) => E.inOut3(cl((tt - tMo) / 2.6)), up = upAt(t), upV = (upAt(t + 0.03) - upAt(t - 0.03)) / 0.06;
      const md = { a: 'dusk', b: 'starNight', k: M.smooth(s.t0 - 0.4, s.t0 + 2.4, t) }, cam = { x: -0.25 + 0.085 * lt, y: 0.9 + 6 * up, z: -10.5 + 0.1 * lt, f: 1500, hy: 752 }, zP = -4;
      land(ctx, cam, md, t, zP - cam.z + 0.3, { place: 'meadow', keepTree: 1, stars: md.k, tint: WD.mix('#ffffff', '#3c4f9a', md.k), tree: { fol: LEAF }, sky: (c) => {   // 升空时星尘往下掠过
        const sp = WD.dot('#dfe8ff'); c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 220; i++) { const dep = 0.3 + 1.7 * H(i, 51) ** 2, x = H(i, 52) * M.W, y = mod(H(i, 53) * 900 + up * dep * 760, 900) - 80, r = (1.6 + 3.4 * H(i, 54)) * dep, st = 1 + 9 * upV * dep; c.globalAlpha = md.k * (0.35 + 0.5 * H(i, 55)) * (0.6 + 0.4 * Math.sin(t * (1 + 2 * H(i, 56)) + i)); c.drawImage(sp, x - r, y - r * st, 2 * r, 2 * r * st); } c.restore(); } });
      // 萤火虫：只在地面上
      const ff = WD.dot('#e6ff8a'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 46; i++) { const x = 200 + 1500 * H(i, 61) + 60 * Math.sin(t * (0.4 + 0.5 * H(i, 62)) + i * 3), y = 700 + 330 * H(i, 63) + 40 * Math.sin(t * (0.6 + 0.6 * H(i, 64)) + i) + 900 * up, r = 9 + 12 * H(i, 65); ctx.globalAlpha = md.k * (1 - up) * Math.max(0, Math.sin(t * (1.1 + H(i, 66)) + i * 2)) ** 2 * 0.9; ctx.drawImage(ff, x - r, y - r, 2 * r, 2 * r); } ctx.restore();
      const raise = M.smooth(L1.t0 - 0.3, L1.t0 + 0.7, t), yP = 7.25 * up + 0.12 * up * Math.sin(t * 1.3);   // 狗尾草跟着镜头飘上去
      const lean = M.smooth(s.t0 + 1.2, s.t0 + 2.8, t), fl = M.smooth(tMo, tMo + 0.5, t), hx0 = M.lerp(0.14, 0.0, lean), fox = [hx0 + 0.34, 0.52 + 0.5 * raise + yP, zP - 0.12];   // 两人坐在草坡上慢慢靠近，她举起狗尾草；「魔法」那一下草离开她的手飞上天（fl），两人留在草坡上仰头看（用户定：人不飞）
      people(ctx, M, s, cam, md, { pts: { fox },
        him: { x: M.lerp(-0.75, -0.44, lean), z: zP, yaw: 10, sit: 1, look: [fox[0], fox[1] + 0.5, fox[2]], lookW: raise, face: { surprised: 0.8 * fl * (1 - M.smooth(tMo + 1.5, tMo + 2.6, t)), smile: 0.5 } },
        her: { x: hx0, z: zP, yaw: -8, sit: 1, look: [fox[0], fox[1] + 0.5, fox[2]], lookW: raise, handR: ['pt.fox', (0.3 + 0.7 * raise) * (1 - fl)], armR: [70 - 30 * raise, 30 + 30 * raise, 50 + 40 * raise], gripR: 0.8 * (1 - fl), face: { smile: 0.6, happy: 0.6 * fl } } });
      WD.grass(ctx, cam, md, t, 0.5, zP - cam.z + 0.3);
      // 狗尾草和草尖的光；「魔」那一下炸成一圈星屑
      const [hx, hy, hs] = WD.proj(cam, ...fox), u = hs * 1.6 / 14, len = (3 + 2.2 * raise) * u, glow = M.smooth(L1.t0 + 0.3, tMo, t) * (0.55 + 0.1 * Math.sin(t * 9)) + 0.6 * Math.exp(-Math.max(0, t - tMo) * 2.5) * (t > tMo ? 1 : 0);
      foxtail(ctx, hx, hy, len, 0.12 + 0.05 * Math.sin(t * 2), raise > 0.5 ? glow : 0);
      const tipX = hx + 0.1 * len, tipY = hy - 0.88 * len, tb = t - tMo;
      if (tb > 0 && tb < 2.2) { const sp = WD.dot('#fff3b8'); ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,244,200,${0.8 * cl(1 - tb / 0.9)})`; ctx.lineWidth = 2 + 10 * cl(1 - tb / 0.9); ctx.beginPath(); ctx.arc(tipX, tipY, 40 + 900 * E.out3(cl(tb / 0.9)), 0, TAU); ctx.stroke();
        for (let i = 0; i < 260; i++) { const a = H(i, 71) * TAU, v = 200 + 900 * H(i, 72) ** 2, kk = (1 - Math.exp(-2.4 * tb)) / 2.4, x = tipX + Math.cos(a) * v * kk, y = tipY + Math.sin(a) * v * kk + 60 * tb * tb, r = (4 + 9 * H(i, 73)) * (1 - tb / 2.2); ctx.globalAlpha = cl(1.3 - tb * (0.5 + 0.5 * H(i, 74))); ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); }
      // 心愿种子：从她指尖飞进夜空，落下的那一刻荡开一圈涟漪，亮成一颗星
      const SEED = [['line2', 1420, 250], ['line2@心', 1640, 470], ['line2@愿', 1180, 440], ['line2@在', 1740, 200], ['line2@夜', 1500, 640], ['line2@空', 980, 560], ['line2@种', 1330, 330]], sp = WD.dot('#fff0b0'), sw = WD.dot('#ffffff');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      SEED.forEach(([at, x, y], i) => { const tl = M.ref(at), tau = t - tl, big = i === SEED.length - 1 ? 1.7 : 1;
        if (tau > -0.45 && tau < 0) { const q = E.out2(1 + tau / 0.45), sx = M.lerp(hx, x, q), sy = M.lerp(hy, y, q) - 120 * Math.sin(Math.PI * q); ctx.globalAlpha = 1; ctx.drawImage(sp, sx - 16, sy - 16, 32, 32); for (let k = 1; k < 7; k++) { const q2 = Math.max(0, q - k * 0.035), tx = M.lerp(hx, x, q2), ty = M.lerp(hy, y, q2) - 120 * Math.sin(Math.PI * q2); ctx.globalAlpha = 0.5 - k * 0.07; ctx.drawImage(sp, tx - 9, ty - 9, 18, 18); } }
        if (tau >= 0) { for (const d of [0, 0.22]) { const p = (tau - d) / 1.3; if (p <= 0 || p >= 1) continue; ctx.strokeStyle = `rgba(190,214,255,${0.75 * (1 - p)})`; ctx.lineWidth = 1.5 + 5 * (1 - p); ctx.beginPath(); ctx.ellipse(x, y, (20 + 250 * E.out3(p)) * big, (20 + 250 * E.out3(p)) * 0.42 * big, 0, 0, TAU); ctx.stroke(); }
          const g = E.outBack(cl(tau / 0.35), 2.5) * big * (0.85 + 0.15 * Math.sin(t * 4 + i * 2)), r = 38 * g; ctx.globalAlpha = 1; ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r); ctx.drawImage(sw, x - r * 0.4, y - r * 0.4, r * 0.8, r * 0.8);
          ctx.strokeStyle = 'rgba(255,246,214,.85)'; ctx.lineWidth = 1.6; for (const [dx, dy] of [[1, 0], [0, 1]]) { ctx.beginPath(); ctx.moveTo(x - dx * r * 1.7, y - dy * r * 1.7); ctx.lineTo(x + dx * r * 1.7, y + dy * r * 1.7); ctx.stroke(); } } });
      ctx.restore();
      WD.post(ctx, { bloom: 0.34 + 0.2 * md.k, warm: [`rgba(120,140,255,${0.14 * md.k})`, `rgba(255,190,140,${0.16 * (1 - md.k)})`] });
    },

    // 20XX.XX.XX 牵手：深秋的土路，两人并肩走着慢下来，转身对望（牵手在下一镜 clasp）
    walk2(ctx, s, M) {
      const t = s.t, lt = s.lt, l = t - s.t0, u = M.clamp(l / 2.4), d = 1.1 * M.ease.out2(u), cam = { x: 0.7, y: 1.45, z: -18 + 0.68 * lt, f: 1500, hy: 700 }, zP = -10.6 + d;   // d 走了多远：2.4 秒里慢下来站住
      land(ctx, cam, 'autumn', t, zP - cam.z + 0.3, { place: 'lake', wind: 0.6, tree: { wind: 0.9, fol: [{ kind: 'fall', f: (p) => p.r < 0.8 ? 1 : 0 }] } });
      const [sx0, sy0] = WD.plateXY(cam, WD.MOODS.autumn.sun); WD.flare(ctx, sx0, sy0, 0.4);
      WD.grass(ctx, cam, 'autumn', t, 0.5, zP - cam.z + 0.3, 0.6);
      const near = M.smooth(0.5, 2.4, l), tn = M.smooth(1.6, 3.4, l);   // 并肩走着慢下来，慢慢转身看着对方；这一镜不牵手、不伸手（用户定：下一镜才牵）
      people(ctx, M, s, cam, "autumn", duo("walk", zP, d, { gap: 1.2 - 0.5 * near, hold: 0, gait: 1 - u,
        her: { yaw: 65 * tn, look: "him", lookW: M.smooth(0.8, 2.2, l), face: { smile: 0.5, happy: 0.5 * tn } }, him: { yaw: -65 * tn, look: "her", lookW: M.smooth(1.4, 2.8, l), face: { smile: 0.4 + 0.3 * tn } } }));
      leaves(ctx, M, t, 70, 55 * t);
      // 上一镜的星星落下来，落着落着成了叶子
      const sp = WD.dot('#fff0b0'), fa = M.clamp(1 - lt / 1.5); if (fa > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const dep = 0.45 + 1.7 * M.hash(i, 31) ** 2, x = mod(M.hash(i, 32) * 2300 + 55 * t * dep + 50 * dep * Math.sin(t * (0.7 + M.hash(i, 33)) + i), 2300) - 190, y = mod(M.hash(i, 34) * 1300 + t * (70 + 60 * M.hash(i, 35)) * dep, 1300) - 110, r = 26 * dep; ctx.globalAlpha = fa * 0.8; ctx.drawImage(sp, x - r, y - r, 2 * r, 2 * r); } ctx.restore(); }
      WD.post(ctx, { bloom: 0.34, warm: ['rgba(255,214,160,.2)', 'rgba(150,90,60,.12)'] });
    },

    // 牵上了：两团光的特写，碰两下，第三下合成一团
    clasp(ctx, s, M) {
      const t = s.t, lt = s.lt, E = M.ease, cl = M.clamp, cam = { x: 0.3, y: 0.85, z: -9 + 0.5 * lt, f: 1500, hy: 330 };
      soft(ctx, M, 'far', 12, (c) => { land(c, cam, 'autumn', t, 2, { place: 'lake', wind: 0.6, tree: { fol: [{ kind: 'fall', f: (p) => p.r < 0.8 ? 1 : 0 }] } }); leaves(c, M, t, 30, 55 * t, 0.9); });
      const k = E.inOut3(cl((lt - 2.0) / 0.9)), bump = (tc) => Math.exp(-(((lt - tc) / 0.3) ** 2));
      const zP = -6, reach = Math.min(1, 0.9 * (bump(0.6) + bump(1.4)) + k), pc = { x: -0.03, y: 0.9 + 0.02 * k, z: zP - 1.2 + 0.1 * s.p, f: 1500, hy: 520 };   // 人物层自己一台相机，贴着两只手：碰两下，第三下握住
      people(ctx, M, s, pc, 'autumn', { pts: { a: [-0.045, 0.885, zP + 0.02], b: [-0.012, 0.9, zP + 0.02] },
        her: { x: -0.31, z: zP, yaw: 0, handR: ['pt.a', reach], gripR: 0.45 * k, turnR: 80 * k, wristR: -25 * k }, him: { x: 0.31, z: zP, yaw: 0, handL: k > 0.03 ? ['her.holdR', Math.max(k, reach)] : ['pt.b', reach], gripL: 0.5 * k, turnL: -80 * k, wristL: 25 * k } }, { shadow: 0 });
      const sp = WD.dot('#fff0c8'); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const tc of [0.6, 1.4]) { const a = bump(tc); if (a > 0.02) { ctx.globalAlpha = 0.45 * a; ctx.drawImage(sp, 960 - 50, 520 - 50, 100, 100); } }
      if (k > 0) { ctx.globalAlpha = 0.16 * k; ctx.drawImage(sp, 960 - 330, 540 - 330, 660, 660); for (let i = 0; i < 40; i++) { const tau = lt - 2.3 - 1.2 * M.hash(i, 81); if (tau <= 0) continue; const x = 960 + (M.hash(i, 82) - 0.5) * 420 + 30 * Math.sin(tau * 2 + i), yy = 600 - 190 * tau - 100 * M.hash(i, 83), r = 5 + 10 * M.hash(i, 84); ctx.globalAlpha = cl(tau * 3) * cl(1.6 - tau); ctx.drawImage(sp, x - r, yy - r, 2 * r, 2 * r); } }
      ctx.restore();
      leaves(ctx, M, t, 10, 55 * t + 400);
      WD.post(ctx, { bloom: 0.36, warm: ['rgba(255,214,160,.22)', 'rgba(150,90,60,.12)'] });
    },

    // 20XX.XX.XX：「风」把她推到他身后，她从背后抱住他；「落叶」他红着脸闪开、挠头，她愣一下笑了，又跟上半步。风里一叠她的照片吹过去又吹回来
    hug(ctx, s, M) {
      const t = s.t, tW = M.word(4, '风'), tQu = M.word(4, '去'), g = (x) => x > 0 ? 1 - Math.exp(-1.3 * x) : 0;
      const zP = -6.9, cam = { x: -0.2, y: 1.05, z: -11 + 0.3 * s.p, f: 1500, hy: 610 }, dP = zP - cam.z + 0.3, drift = 40 * t + 900 * g(t - tW) - 1500 * g(t - tQu), fall = { kind: 'fall', f: (p) => p.r < 0.75 - 0.3 * s.p ? 1 : 0 };
      soft(ctx, M, 'far', 5, (c) => { land(c, cam, 'autumn', t, dP, { wind: 0.9, tree: { wind: 1.3, fol: [fall] } }); leaves(c, M, t, 50, drift * 0.6, 0.9); });
      gust(ctx, M, t, tW - 0.15, 1); gust(ctx, M, t, tQu - 0.1, -1, 11);
      const E = M.ease, cl = M.clamp, sm = M.smooth, tGai = M.word(4, '该'), tLuo = M.word(5, '落');
      const run = sm(s.t0 + 0.15, tGai - 0.1, t), hold = sm(tGai - 0.6, tGai + 0.1, t) * (1 - sm(tLuo, tLuo + 0.5, t));   // 她被风推着小跑过去；抱住，他一闪就松开
      const dg = sm(tLuo, tLuo + 1.4, t), turn = sm(tLuo + 0.1, tLuo + 1.6, t), ch = sm(tLuo + 1.1, tLuo + 2.0, t);   // 他闪开、转过身；她又跟上半步
      const trip = sm(tLuo, tLuo + 0.5, t) * (1 - sm(tLuo + 0.6, tLuo + 1.3, t)), laugh = sm(tLuo + 1.0, tLuo + 1.7, t), shy = sm(tLuo + 0.5, tLuo + 1.2, t);
      people(ctx, M, s, cam, 'autumn', { wind: [5 * g(t - tW) * Math.exp(-0.8 * Math.max(0, t - tW)) - 5 * g(t - tQu) * Math.exp(-0.8 * Math.max(0, t - tQu)), 0],
        him: { x: 0.75 + 1.0 * dg, z: zP - 0.1 * dg, yaw: 128 + 107 * turn, walk: 1.0 * dg / 1.4, gait: Math.sin(Math.PI * dg), bend: 5 * hold, look: t > tGai - 0.3 ? 'her' : null, lookW: 0.35 * hold + turn, head: [-12 * (1 - turn), 0, 0],
          armR: [82 - 44 * shy, 3 + 30 * shy, 14 + 100 * shy], handR: ['him.nape', shy], face: { surprised: 0.9 * hold + 0.5 * (1 - shy) * sm(tLuo, tLuo + 0.2, t), fun: 0.8 * shy } },
        her: { x: M.lerp(-1.8, 0.61, run) + 0.3 * ch, z: zP + 0.13 * run - 0.1 * ch, yaw: 90 + 38 * hold + 32 * ch, walk: (2.41 * run + 0.3 * ch) / 1.15, gait: Math.sin(Math.PI * run) + 0.7 * Math.sin(Math.PI * ch), bend: 10 * Math.sin(Math.PI * run) + 7 * hold + 18 * trip + 8 * laugh, look: 'him', lookW: 1 - hold,
          head: [-38 * hold, 8 * hold, -6 * hold], handL: ['him.chestL', hold], handR: laugh > 0 ? ['her.mouth', laugh] : ['him.chestR', hold], wristL: 70 * hold, wristR: 70 * hold,
          armL: [82 - 30 * hold, 3 + 40 * hold + 25 * trip, 14 + 30 * hold], armR: [82 - 30 * hold - 40 * laugh, 3 + 40 * hold + 25 * trip + 50 * laugh, 14 + 30 * hold + 110 * laugh],
          face: { surprised: 0.5 * Math.sin(Math.PI * run) + 0.8 * trip * (1 - laugh), happy: 0.75 * hold + laugh } } });
      WD.grass(ctx, cam, 'autumn', t, 0.5, dP, 0.9);
      leaves(ctx, M, t, 26, drift + 300);
      for (let i = 0; i < 46; i++) { const tau = t - tLuo + 0.2 - 0.6 * M.hash(i, 881); if (tau <= 0 || tau > 2.6) continue; const x = 200 + 1600 * M.hash(i, 882) + 80 * Math.sin(tau * 2 + i), y = -60 + 260 * tau + 70 * tau * tau, r = 14 + 14 * M.hash(i, 883); WD.flake(ctx, 'leaf', i, x, y, r, tau * 3 + i, tau * 5 + i, M.clamp(2.6 - tau)); }   // 「落叶」一阵叶子落下来
      WD.post(ctx, { bloom: 0.34, warm: ['rgba(255,214,160,.2)', 'rgba(150,90,60,.12)'] });
    },

    // line6「学会了眼泪」：深秋路边，粉色那团光暗下去，「眼泪」从光里掉下一滴
    tear(ctx, s, M) {
      const t = s.t, e = M.ease.out3(s.p), cam = { x: 2.2 - 0.5 * e, y: 1.45, z: -8 + 1.4 * e, f: 1500, hy: 610 };
      soft(ctx, M, 'far', 9, (c) => { land(c, cam, 'autumn', t, 2, { wind: 0.5, tree: { fol: [{ kind: 'fall', f: (p) => p.r < 0.25 ? 1 : 0 }] } }); leaves(c, M, t, 40, 30 * t, 0.9); });
      const E = M.ease, cl = M.clamp, sm = M.smooth, ln = (s.params || {}).l || 6, tYan = M.word(ln, '眼'), tCa = M.word(ln, '擦'), sad = sm(s.t0, tYan, t), wipe = sm(tCa - 0.4, tCa, t) * (1 - sm(tCa + 0.3, tCa + 0.8, t)), brave = sm(tCa + 0.35, tCa + 1.0, t);
      const hx = 3, hz = -4, pc = { x: hx - 0.2 + 0.02 * e, y: 1.39, z: hz - 2.2 + 0.25 * e, f: 4500, hy: 520 };   // 她的特写：人物层自己一台长焦相机（背景是虚的，不用对透视）；「擦」手背抹一下，又逞强地笑
      people(ctx, M, s, pc, 'autumn', { her: { x: hx, z: hz, yaw: 204, bend: 4 * sad, head: [8, 10 * sad - 8 * brave, -4], handR: ['her.cheekL', wipe], armR: [82 - 30 * wipe, 3 + 50 * wipe, 14 + 110 * wipe], wristR: 30 * wipe,
        face: { sad: 0.85 * sad * (1 - 0.7 * brave), smile: 0.6 * brave } } }, { shadow: 0, rimW: 4 });
      const tau = t - tYan, gone = sm(tCa - 0.15, tCa + 0.05, t); if (tau > 0 && gone < 1) { const [ex, ey, es] = WD.proj(pc, hx + 0.012, 1.405 - 0.012 * sad, hz - 0.085), run = E.inOut2(cl(tau / 1.3)), drop = Math.max(0, tau - 1.3), x = ex + 0.004 * es * run, y = ey + (0.012 + 0.07 * run) * es + 900 * drop * drop, r = 0.0045 * es;   // 一颗泪从左眼角滚到下巴，再掉下去
        ctx.save(); ctx.globalAlpha = (1 - gone) * cl(tau * 5) * cl(1.6 - drop * 3); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = r * 0.7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex, ey + 0.012 * es); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = 'rgba(214,236,255,.9)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.35, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.35, 0, TAU); ctx.fill(); ctx.restore(); }
      leaves(ctx, M, t, 26, 30 * t + 500);
      WD.post(ctx, { bloom: 0.34, warm: ['rgba(255,214,160,.16)', 'rgba(110,90,150,.2)'] });
    },

    // 20XX.XX.XX 初吻：雪停了，靛蓝那团光从路的尽头飞回粉色那团身边；焦点拉到最前面的枯枝，梢上冒出第一颗芽
    kiss(ctx, s, M) {
      const t = s.t, lt = s.lt, E = M.ease, cl = M.clamp, P = s.params || {}, tWo = M.word(P.l || 7, '我'), rack = M.smooth(tWo - 0.8, tWo - 0.15, t), md = { a: P.md || 'snowNight', b: 'dawn', k: 0.12 * s.p };   // params: l, md（不给 = 雪夜）, kids
      const cam = { x: -0.4, y: 1.25, z: -14.2 + 0.5 * s.p, f: 1500, hy: 700 }, zF = -7.3;
      soft(ctx, M, 'far', 0.01 + 6 * rack, (c) => {
        land(c, cam, md, t, zF - cam.z + 0.5, { stars: 0.8, tree: { snow: P.md ? 0 : 1, wind: 0.4 } });
        const [gx0] = WD.proj(cam, -1.3, 0, 60); WD.flare(c, gx0, cam.hy, 0.3 + 0.25 * rack, '#ffd9c0');
        const l = t - s.t0, u = cl(l / 2.1), arr = 1 - (1 - u) ** 1.5, emb = M.smooth(1.7, 2.7, l), arm = [82 - 38 * emb, 3 + 55 * emb, 14 + 45 * emb];   // 她环住他的腰，他搂住她的背，头靠在一起   // 他从路那头跑回来，两人抱在一起（这时焦点已经拉到前面的枯枝上）
        people(c, M, s, cam, md, {
          her: { x: -1.59, z: zF, yaw: 6, look: 'him', lookW: 1 - emb, armL: arm, armR: arm, handL: ['him.waistR', emb], handR: ['him.waistL', emb], wristL: 30 * emb, wristR: 30 * emb, bend: 5 * emb, head: [-16 * emb, 4 * emb, -8 * emb], face: { happy: 0.5 + 0.4 * emb, blink: 0.9 * emb } },
          him: { x: M.lerp(-1.1, -1.49, arr), z: M.lerp(zF + 3.9, zF + 0.3, arr), yaw: 186, walk: 3.6 * arr / 1.9, gait: 1.15 * Math.sqrt(1 - u), bend: 9 * (1 - u) + 9 * emb, look: 'her', lookW: 1 - emb, armL: arm, armR: arm, handL: ['her.backR', emb], handR: ['her.backL', emb], wristL: 30 * emb, wristR: 30 * emb, head: [-16 * emb, 12 * emb, -8 * emb], face: { happy: 0.6 } } });
        WD.grass(c, cam, md, t, 0.5, zF - cam.z + 0.5);
        if (!P.md) WD.snowfall(c, t, { n: 360, wind: -30, a: 1 - M.smooth(0, 1.4, lt) });
      });
      const bud = E.outBack(cl((t - tWo + 0.1) / 0.5), 2.6), bud2 = E.outBack(cl((t - tWo - 0.3) / 0.4), 2.2);
      soft(ctx, M, 'near', 0.01 + 16 * (1 - rack), (c) => twig(c, bud, bud2));
      if (bud > 0) { const sp = WD.dot('#f6ffd0'); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const tau = t - tWo - 0.5 * M.hash(i, 91); if (tau <= 0 || tau > 1.2) continue; const a = M.hash(i, 92) * TAU, r0 = 30 + 150 * E.out3(tau / 1.2) * (0.4 + M.hash(i, 93)), r = 4 + 8 * M.hash(i, 94); ctx.globalAlpha = 1 - tau / 1.2; ctx.drawImage(sp, 1225 + Math.cos(a) * r0 * 1.4 - r, 360 + Math.sin(a) * r0 * 1.4 - r, 2 * r, 2 * r); } ctx.restore(); }
      WD.post(ctx, { bloom: 0.36 + 0.1 * rack, warm: [`rgba(255,200,170,${0.1 + 0.1 * rack})`, 'rgba(40,60,160,.24)'] });
    },

    // 冬天：雪夜枯树下，粉色那团光独自等着，「偷偷地擦」暗一下；bar12 路的尽头亮起一点靛蓝，她亮起来
    wait(ctx, s, M) {
      const t = s.t, lt = s.lt, e = M.ease.out3(s.p), cam = { x: 2.6 + 0.1 * e, y: 1.45, z: -5.2 + 0.3 * e, f: 1500, hy: 610 };
      soft(ctx, M, 'far', 9, (c) => { WD.backdrop(c, 'snowNight', cam); WD.twinkle(c, cam, t, 0.8, 60); WD.ground(c, cam, 'snowNight'); WD.poles(c, cam, 'snowNight'); WD.grass(c, cam, 'snowNight', t, 0.5, 150); WD.tree(c, cam, t, 'snowNight', { snow: 1 }); });
      const sm = M.smooth, see = sm(M.ref('bar12') + 0.1, M.ref('bar12') + 0.7, t), tCa = M.word(6, '擦'), wipe = sm(M.word(6, '偷') - 0.1, tCa - 0.1, t) * (1 - sm(tCa + 0.25, tCa + 0.7, t));   // 手背把泪抹掉；bar12 看见他回来了（他在镜头这边的路上），笑了
      people(ctx, M, s, { ...cam, hy: 455 }, 'snowNight', { her: { x: 2.8, z: -3.5, yaw: 202 - 14 * see, bend: 3 * (1 - see), head: [6 * (1 - see), 11 * (1 - see), -3 * (1 - see)], look: [cam.x - 2.5, 1.5, cam.z - 6], lookW: see,
        handR: ['her.cheekL', wipe], armR: [82 - 30 * wipe, 3 + 50 * wipe, 14 + 110 * wipe], wristR: 30 * wipe, face: { sad: 0.6 * (1 - see), happy: 0.85 * see } } }, { shadow: 0 });
      { const br = WD.dot('#e8f0ff'), [mx, my, ms] = WD.proj({ ...cam, hy: 455 }, 2.78, 1.36, -3.6); ctx.save(); for (let i = 0; i < 5; i++) { const q = mod(t * 0.42 + i / 5, 1), r = (0.03 + 0.12 * q) * ms; ctx.globalAlpha = 0.22 * Math.sin(Math.PI * q) * (i % 2 ? 0.6 : 1); ctx.drawImage(br, mx - r - 0.1 * q * ms, my - r - 0.05 * q * ms, 2 * r, 2 * r); } ctx.restore(); }   // 呵出的白气
      WD.snowfall(ctx, t, { n: 240, wind: -40, a: 0.85 });
      WD.post(ctx, { bloom: 0.38, warm: ['rgba(120,140,255,.16)', 'rgba(30,40,120,.24)'] });
    },

    // 进副歌：雪夜的枯树 → 天亮、雪震飞 → 发芽 → 开花，满树挂出以后的照片；两团光在树下靠在一起
    bloom(ctx, s, M) {
      const t = s.t, tB = s.t0, E = M.ease, cl = M.clamp, H = M.hash, P = s.params || {}, l = P.l || 7, tSheng = M.word(l, '生'), tYa = M.word(l, '芽'), tKai = M.word(l, '开'), tHua = M.word(l, '花'), tSun = M.word(l + 1, '阳');   // params: l 第几句「枯树生出芽」, ph 树上挂的照片, kids 带大宝, born「花」那一下二宝出现
      const k = 0.4 * E.out3(cl((t - tB) / 0.5)) + 0.6 * M.smooth(tYa, tHua + 0.25, t);   // 天亮了多少
      const md = { a: 'snowNight', b: 'dawn', k }, mg = { a: 'snowNight', b: 'dawn', k: M.smooth(tSheng, tHua - 0.1, t) };   // 天先亮，地上的雪跟着发芽才化
      // 镜头沿着路往前推，唱到「花」之前推完停住：花自己在开，镜头不再动
      const pu = E.out3(cl((t - tB) / (tHua - tB))), cam = { x: 1.3, y: 1.15, z: -23.5 + 4.2 * pu, f: 1500, hy: 748 + 12 * pu };
      WD.backdrop(ctx, md, cam);
      WD.twinkle(ctx, cam, t, (1 - k) * 0.8, 90);
      // 太阳从山后冒头，唱到「阳光」整个出来
      const sunK = M.smooth(tHua - 0.2, tSun + 0.15, t), [sx0, sy0] = WD.plateXY(cam, WD.MOODS.dawn.sun), sunY = sy0 - 46 * sunK;
      WD.flare(ctx, sx0, sunY, 0.5 * k + 0.45 * sunK);
      WD.ground(ctx, cam, mg); WD.poles(ctx, cam, md);
      const dT = -cam.z;                                   // 树离镜头多远
      WD.grass(ctx, cam, mg, t, dT + 0.4, 150);
      WD.shadow(ctx, cam, WD.TREE_X, 0, 7, 0.34 - 0.1 * k);
      // 树：雪在进副歌那一拍被震掉；「生…芽」嫩芽从树干窜到枝梢；「开」起零星开花，「花」整树炸开
      const budT = (p) => tSheng + p.u * (tYa - tSheng), blosT = (p) => p.r2 < 0.12 ? M.lerp(tKai, tHua - 0.12, p.u * 0.75 + p.r * 0.25) : tHua + p.u * 0.13 + p.r * 0.05;
      const pop = 1 + 0.16 * Math.exp(-Math.max(0, t - tHua) * 5) * (t > tHua ? 1 : 0);
      const blosF = (p) => E.outBack(cl((t - blosT(p)) / 0.42), 2.2) * pop;
      const [tx, ty, ts] = WD.tree(ctx, cam, t, md, { snow: 1 - cl((t - tB) / 0.16), wind: 0.4 + 1.2 * Math.exp(-Math.max(0, t - tB) * 2), fol: [
        { kind: 'bud', f: (p) => t < budT(p) ? 0 : E.outBack(cl((t - budT(p)) / 0.22), 3) * (1 - cl((t - blosT(p)) / 0.2)) },
        { kind: 'blos', f: blosF, size: 1.15 }] });
      // 芽冒出来的那一瞬，枝梢一串亮点
      const spr = WD.dot('#f4ffc8'), pts = WD.treePts();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length; i += 4) { const p = pts[i], a = 1 - Math.abs((t - budT(p) - 0.06) / 0.12); if (a <= 0) continue; const r = (0.14 + 0.16 * p.r) * ts * a; ctx.globalAlpha = a * 0.55; ctx.drawImage(spr, tx + p.x * ts - r, ty - p.y * ts - r, 2 * r, 2 * r); }
      ctx.restore();
      // 「花」：满树花里挂出以后的照片——从这一天起，我的未来每一页都有你
      const crown = pts.filter((p) => p.y > 4);
      (P.ph || []).forEach((key, i) => { const p = crown[Math.floor(H(i, 501) * crown.length)], ap = E.outBack(cl((t - tHua - 0.05 - 0.55 * H(i, 502)) / 0.4), 2); if (ap <= 0) return;
        const w = 0.85 * ts * ap, rot = 0.18 * Math.sin(t * 1.8 + i * 1.7); ctx.save(); ctx.translate(tx + p.x * ts, ty - p.y * ts); ctx.rotate(rot); ctx.strokeStyle = 'rgba(255,250,235,.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 0.2 * ts); ctx.stroke(); card(ctx, sq(M, key), 0, 0.2 * ts + w * 0.56, w); ctx.restore(); });
      WD.grass(ctx, cam, mg, t, -7.3 - cam.z + 0.3, dT + 0.4);
      const blast = Math.exp(-Math.max(0, t - tB) * 2.2) * (t > tB ? 1 : 0);
      const zF = -7.3, cls = M.smooth(tHua + 0.25, tHua + 1.0, t), up = [WD.TREE_X, 5.5, 0];   // 两人站在树下仰头看；开花那一下他靠过来牵住她
      people(ctx, M, s, cam, md, {
        her: { x: -1.55, z: zF, yaw: 28, armR: [82 - 14 * cls, 3, 14], wristR: -25 * cls, turnR: 80 * cls, gripR: 0.45 * cls, look: up, head: [0, -4, 0], face: { surprised: 0.8 * M.smooth(tB, tB + 0.3, t) * (1 - cls), happy: 0.9 * cls } },
        him: { x: -0.95 - 0.1 * cls, z: zF + 0.04, yaw: 24, look: up.map((v, i) => M.lerp(v, [-1.55, 1.45, zF][i], M.smooth(tHua + 0.9, tHua + 1.6, t))), handL: ['her.holdR', cls], wristL: 25 * cls, turnL: -80 * cls, gripL: 0.5 * cls, calmL: 1, face: { surprised: 0.6 * M.smooth(tB, tB + 0.3, t) * (1 - cls), smile: 0.7 * cls } } });
      WD.grass(ctx, cam, mg, t, 0.5, zF - cam.z + 0.3);
      // 雪：下着的雪到天亮就停；枝上的雪被一口气震飞
      WD.snowfall(ctx, t, { n: 360, wind: -30 - 260 * blast, a: (1 - M.smooth(tB + 0.3, tYa + 0.4, t)) });
      const sd = WD.dot('#ffffff'), tb = t - tB;
      if (tb > 0 && tb < 2.4) { for (let i = 0; i < pts.length; i += 1) { const p = pts[i], dx = p.x, dy = p.y - 5.5, dl = Math.hypot(dx, dy) || 1, v = 5 + 9 * H(i, 91), kk = (1 - Math.exp(-2.6 * tb)) / 2.6;
          const x = p.x + (dx / dl * v - 3) * kk + 0.3 * Math.sin(tb * 3 + i), y = p.y + (dy / dl * v * 0.7 + 2.5) * kk - 1.9 * tb * tb, a = cl(1.5 - tb * (0.6 + 0.5 * H(i, 92))), r = (0.07 + 0.12 * H(i, 93)) * ts;
          if (a <= 0 || y < 0) continue; ctx.globalAlpha = a * 0.85; ctx.drawImage(sd, tx + x * ts - r, ty - y * ts - r, 2 * r, 2 * r); }
        for (let i = 0; i < 46; i++) { const a0 = H(i, 95) * TAU, rr = (2 + 5.5 * H(i, 96)) * (0.5 + 1.1 * E.out3(cl(tb / 1.2))), r = (1.2 + 1.8 * H(i, 97)) * ts * (0.5 + cl(tb)), a = 0.2 * cl(tb * 8) * cl(1 - tb / 1.5); if (a <= 0) continue; ctx.globalAlpha = a; ctx.drawImage(sd, tx + Math.cos(a0) * rr * ts - r, ty - (5.6 + Math.sin(a0) * rr * 0.7) * ts - r, 2 * r, 2 * r); }
        ctx.globalAlpha = 1; }
      // 花瓣：开花那一下从树冠炸出来，一部分直扑镜头；之后一直飘
      const th = t - tHua;
      for (let i = 0; i < 1000; i++) { const p = pts[(i * 7) % pts.length], early = i < 220, t0 = early ? blosT(p) + 0.2 + H(i, 61) : tHua + p.u * 0.13 + 0.25 * H(i, 62) ** 2, tau = t - t0; if (tau <= 0) continue;
        const dx = p.x * 0.6 + (H(i, 63) - .5) * 6, dy = p.y - 5 + (H(i, 64) - .5) * 4, dl = Math.hypot(dx, dy) || 1, burst = early ? 0.2 : 1, v = (2 + 6 * H(i, 65) ** 2) * burst, kk = (1 - Math.exp(-2 * tau)) / 2;
        const wx = WD.TREE_X + p.x + (dx / dl * v - 2.4) * kk + 0.35 * Math.sin(tau * 2.2 + i) - 1.6 * tau, wy = p.y + (dy / dl * v * 0.5 + 0.8 * burst) * kk - 0.7 * tau * tau - 0.9 * tau + 0.2 * Math.sin(tau * 3.1 + i * 2), wz = p.z - (H(i, 66) ** 3) * 26 * burst * kk;
        if (wy < 0.02 || wz - cam.z < 0.8) continue; const [px, py, ps] = WD.proj(cam, wx, wy, wz); if (px < -60 || px > M.W + 60 || py < -60) continue;
        const r = Math.min(30, (0.06 + 0.06 * H(i, 67)) * ps); WD.flake(ctx, 'petal', i, px, py, r, tau * (1.5 + 3 * H(i, 68)) + i, tau * (3 + 5 * H(i, 69)) + i, 0.95); }
      chBurst(ctx, M, th, tx, ty - 5.5 * ts, 1150, 'petal', 600, 940, 4 * ts);   // 「花」那一下：一大把花瓣从树冠朝四面冲出去
      if (th > 0) { const bk = WD.dot('#ffd3e2'); for (let i = 0; i < 26; i++) { const tau = th - 0.1 - 0.5 * H(i, 71); if (tau <= 0) continue; const x = M.W * (1.15 - (0.5 + 0.9 * H(i, 72)) * tau * 0.9) - 300 * H(i, 73), y = M.H * H(i, 74) + 120 * Math.sin(tau * 2 + i) + 90 * tau, r = 26 + 46 * H(i, 75); ctx.globalAlpha = 0.55 * M.clamp(tau * 4); ctx.drawImage(bk, x - r, y - r * 0.8, 2 * r, 1.6 * r); } ctx.globalAlpha = 1; }
      // 光：太阳出来后，光柱从树冠后面一把把透出来
      if (sunK > 0.02) WD.rays(ctx, sx0, sunY, t, { a: 0.5 * sunK, n: 30, len: 1700, a0: -Math.PI * 0.98, a1: -Math.PI * 0.02 });
      WD.flare(ctx, sx0, sunY, 0.35 * sunK);
      WD.post(ctx, { bloom: 0.28 + 0.22 * k, warm: [`rgba(255,214,190,${0.25 * k})`, `rgba(40,60,160,${0.25 * (1 - k)})`] });
    },
  }).map(([k, f]) => [k, (ctx, sh, M) => { WD.ROAD = true; WD.NOGRASS = false; f(ctx, sh, M); }])),   // 每个镜头开头把换景的开关复位
});
