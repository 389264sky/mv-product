// stage.js —— 演员表、舞台复位、机位路径、常用动作
XJ.build.push((X, THREE, M) => {
  const V = X.V3, { lerp, clamp } = M, sm = M.smooth;
  X.Still = X.world(4000); X.Still.sc.environment = X.env('snown');
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1).rotateX(-Math.PI / 2), X.stoneM); g.position.y = -1.9; g.receiveShadow = true; X.Still.sc.add(g); X.Still.hills = X.hills(X.Still.sc, [[120, 44, 41.3, -8], [260, 130, 6.4, -14], [560, 300, 19.9, -24]]); X.Still.floor = g;
    const p = X.Still.pav = X.pavilion(6, 16, false); p.position.y = -2.6; p.scale.set(1, 1.6, 1); X.Still.sc.add(p); p.visible = false;
    X.Still.ice = X.ledge(6, 2.2, 3); X.Still.ice.visible = false; }
  X.C = [0, 1, 2, 3].map(() => new X.Crane()); X.fl = [X.flock(120), X.flock(44)];
  X.poemM = X.poem(); X.bf = X.butterflies(1800); X.plums = [X.plum(5), X.plum(19, [.95, .74, .78])]; X.pet = X.petals(1200); X.pet2 = X.petals(1200, 'vec3(.95,.72,.30)'); X.snow = X.snowP(11000); X.dst = X.dust(1600); X.bigPot = X.pot(); X.cup3 = X.cup();
  X.hold = new THREE.Group(); X.hold.add(X.T.pot); X.holdB = new THREE.Group(); X.holdB.add(X.bigPot);
  const T = X.T; X.actors = [...X.C.map(c => c.root), ...X.fl, X.poemM, X.bf, ...X.plums, X.pet, X.pet2, X.snow, X.dst, X.hold, X.holdB, T.desk, T.cup, T.cup2, X.cup3, T.stove, T.steam, T.embers, X.Sea.boat, X.Sea.kun, X.Sea.spray, X.Sea.rain, X.Sea.wake];
  const ST = {}; X.streams = ST;
  X.strm = (key, w, pts, r0, r1, seg) => { const s = ST[key] || (ST[key] = X.stream(pts, r0, r1, seg), X.actors.push(ST[key]), ST[key]); X.put(s, w); return s; };
  X.stage = (w) => { X.actors.forEach(a => { a.visible = false; }); X.C.forEach(c => { c.root.rotation.set(0, 0, 0); c.root.scale.setScalar(1); c.root.position.set(0, 0, 0); }); T.pot.rotation.set(0, 0, 0); X.hold.rotation.set(0, 0, 0); X.hold.scale.setScalar(1); X.holdB.rotation.set(0, 0, 0); X.bigPot.rotation.set(0, 0, 0); T.pot.lid.visible = X.bigPot.lid.visible = true; w.cam.up.set(0, 1, 0); w.cam.near = .1; X.Still.pav.visible = false; X.uLamp.value = 1; X.uFire.value = 1; X.L.pavs.forEach(p => p.visible = true); X.Sea.hills.forEach(h => h.visible = true); X.Meadow.u.uG.value = 1; X.Meadow.u.uGR.value = 999; X.City.u.uRise.value = 0; X.City.u.uFade.value = 1; X.Sea.u.uWine.value = 0; X.Lake.u.uWine.value = 0; X.Lake.u.uRough.value = 1; X.Lake.rip([]); X.L.trees.visible = true; return w; };
  X.cam = (w, p, l, fov = 45, roll = 0) => { w.cam.position.set(...p); w.cam.lookAt(...l); if (roll) w.cam.rotateZ(roll); w.cam.fov = fov; };
  X.path = (k, u) => { const n = k.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)), q = f - i, a = k[Math.max(0, i - 1)], b = k[i], c = k[i + 1], d = k[Math.min(n, i + 2)]; return b.map((_, j) => .5 * (2 * b[j] + (c[j] - a[j]) * q + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * q * q + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * q * q * q)); };
  X.at = (n, w) => M.word(n, w);                                   // 第 n 句唱到某词的秒
  X.since = (t0, d = 1) => clamp((M.t - t0) / d);                  // 从 t0 起 d 秒内 0→1
  X.barT = () => M.bar().t0;
  // 灯火随拍子亮：往前 0.13 秒取平均，起势是缓的；M.pulse 直接用会一帧点亮，看着在闪
  X.soft = (k, o) => { let v = 0; for (let j = 0; j < 8; j++) v += M.pulse(k, { ...o, t: M.t - j * .018 }); return v / 8; };
  // 涟漪：从小节网格起、每 step 秒一圈，pos(u) 给出生那一刻（镜头内秒）的位置，出生后不再挪；最老一圈退场前先淡掉。换拍只增减一圈，不会整组跳着闪
  X.rings = (s, pos, w, step = 120 / 110) => { const T0 = .064, k = Math.floor((M.t - T0) / step + 1e-6); return [0, 1, 2, 3, 4, 5].map((i) => { const b = T0 + (k - i) * step, u = b - s.t0; return [...pos(u), 20 + u, w * (1 - M.smooth(4.5 * step, 6 * step, M.t - b))]; }); };
  X.wind = { x: 0 };
  // 鹤：放到世界、摆姿势、朝向（yaw 朝 +z 为 0）、俯仰、滚转
  X.crane = (i, w, pos, pose, yaw = 0, pitch = 0, roll = 0, sc = 1) => { const c = X.C[i]; X.put(c.root, w, ...pos); c.root.rotation.order = 'YXZ'; c.root.rotation.set(-pitch, yaw, roll); c.root.scale.setScalar(sc); c.root.updateMatrixWorld(true); c.pose(pose); return c; };
  X.petOn = (w, m, o, box, sz = .16, k = {}) => { X.put(m, w); const u = m.material.uniforms; u.uO.value.set(...o); u.uBox.value.set(...box); u.uSz.value = sz; u.uSwirl.value = k.swirl ?? 0; u.uRise.value = k.rise ?? 0; u.uN.value = k.n ?? 1; u.uDT.value = k.dt ?? 0; };
  X.ptOn = (w, m, o, box, k = 1) => { X.put(m, w); const u = m.material.uniforms; u.uO.value.set(...o); u.uBox.value.set(...box); u.uK.value = k; };
  // 一套静物：炉在右，壶在炉上或手里，杯在左
  X.table = (w, o = {}) => { const y = o.y ?? 0, x = o.x ?? 0, z = o.z ?? 0; X.put(T.desk, w, x, y, z); if (o.stove !== false) { X.put(T.stove, w, x + 1.2, y, z - .2); X.put(T.embers, w, x + 1.2, y + 1.6, z - .2); } if (o.pot !== false) { X.put(X.hold, w, x + (o.px ?? 1.2), y + (o.py ?? 1.80), z + (o.pz ?? -.2)); X.hold.rotation.z = o.tilt ?? 0; T.pot.rotation.y = o.pr ?? Math.PI; } X.put(T.cup, w, x - 1.2, y, z + .5); X.put(T.cup2, w, x - 2.3, y, z - .3); for (const c of [T.cup, T.cup2]) { c.wine.material.uniforms.uC.value.set(c.position.x, 0, c.position.z); c.wine.material.uniforms.uIn.value = 0; c.wine.material.uniforms.uDrop.value = -1; c.wine.material.uniforms.uDropN.value = 1; } if (o.steam !== false) { X.put(T.steam, w, x + (o.px ?? 1.2), y + (o.py ?? 1.80) + 2.4, z - .2); T.steam.mat.uniforms.uK.value = o.steamK ?? 1; } };
  X.flockOn = (k, w, n, f) => { const m = X.fl[k]; X.put(m, w); m.count = n; X.setFlock(m, 0, f); };
  X.day = (seq, u) => { const n = seq.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f)); return X.pal(seq[i], seq[i + 1], sm(0, 1, f - i)); };
});
