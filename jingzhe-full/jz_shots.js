// jz_shots.js —— 2.5D 剪纸版的场景、机位、她的摆法。每套场景 = 一组剪纸层 + 镜头路线 + 她这一刻怎么摆。先搭四套定妆（冰下沉睡、山火前、春晨手特写、尾声引雷）。
(() => {
const JZ = window.JZ, S = JZ.shots = {}, P = JZ.paper, F = JZ.fairy;
const C = (h, k = 1) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.pow(v / 255, 2.2) * k); };   // sRGB → 线性
const QS = new URLSearchParams(location.search);
let sets, M;

const mkSet = (lo, hi, build) => { const T = JZ.THREE, sc = new T.Scene(), st = { lo, hi, sc, cam: new T.PerspectiveCamera(22, 16 / 9, 0.005, 6000) }; build(st, sc); st.uT = []; sc.traverse(o => o.material?.uniforms?.uT && st.uT.push(o.material.uniforms.uT)); return st; };

S.build = (m) => {
  M = m; const B = (n) => M.ref('bar' + n), rr = M.rng(19112026);
  sets = [
    // 冬：冰下沉睡（前奏、A2）。靛青 / 月白，没有暖色：她蜷着浮在冰下的黑水里，只剩一条暗蓝轮廓
    mkSet(1, 22, (st, sc) => {
      const R = P.ref({ y: 0.03, z: 0.6, fov: 22 });
      P.sky(sc, R, { top: C('#070b22'), hor: C('#26315a'), disc: C('#e8eef8', 1.6), dx: 0.72, dy: 0.93, dr: 0.035, halo: 0.35, horS: 0.8 });
      P.layer(sc, R, { D: 120, top: 0.86, amp: 0.08, wav: 2.2, col: C('#4a5c8e'), fog: C('#1c2650'), rim: C('#dfe8ff', 0.7), fogH: 0.06, seed: 3 });
      P.layer(sc, R, { D: 30, top: 0.84, amp: 0.05, wav: 3, deco: 'pine', sp: 0.016, th: 2.0, col: C('#2a3766'), fog: C('#141c40'), rim: C('#b8c8f0', 0.6), fogH: 0.05, seed: 5 });
      P.layer(sc, R, { D: 1.0, yTop: 0.07, amp: 0, col: C('#13204a'), fog: C('#03050e'), fogH: 0.75, shadow: 0, seed: 9 });   // 冰下的黑水，越往下越黑
      P.layer(sc, R, { D: 0.85, yTop: -0.075, amp: 0.04, wav: 2, deco: 'grass', sp: 0.05, th: 2.6, den: 0.7, col: C('#070b1e'), fog: C('#020309'), rim: C('#3a5aa0', 0.5), fogH: 0.2, seed: 11 });   // 水草
      P.ice(sc, { c: [0, 0.08, 0.1], wh: [1.4, 0.022], cell: 0.006, col: C('#5a78b8', 0.6), line: C('#d8e6ff', 0.8), a: 0.6 });
      sc.add(JZ.fx.motes({ n: 1200, box: [-1.5, 0.09, -6, 1.5, 1.5, 0.3], v: [0.03, -0.09, 0], sway: 0.02, size: 0.0016, col: C('#cfdcff', 0.7), tw: 0.2 }, rr));   // 冰上的雪
      sc.add(JZ.fx.motes({ n: 500, box: [-0.4, -0.12, -0.6, 0.4, 0.068, 0.3], v: [0, 0.006, 0], sway: 0.004, size: 0.0006, col: C('#8fb0f0', 0.5), tw: 0.3 }, rr));   // 冰下的小气泡
      st.camAt = JZ.path([{ t: B(1), p: [-0.03, 0.03, 0.62], l: [0, 0.02, 0], fov: 22 }, { t: B(17), p: [0.03, 0.03, 0.58], l: [0, 0.02, 0], fov: 22 }]);
      st.fairy = (t) => ({ p: [0, 0.0, 0], rot: [-90, 0, -55], pose: 'sleep', shade: 'flat', flat: C('#060a1c'), hull: C('#3050a0', 0.4), hullW: 0.01, glow: 0 });
    }),
    // 山火前：逆光剪影。墨黑 / 朱红 / 金
    mkSet(23, 28, (st, sc) => {
      const R = P.ref({ y: 0.06, z: 0.7, fov: 22 });
      P.sky(sc, R, { top: C('#060304'), hor: C('#7a1c08'), horS: 0.35 });
      P.layer(sc, R, { D: 120, top: 0.5, amp: 0.16, wav: 2.4, deco: 'pine', sp: 0.012, th: 2.2, col: C('#1a0907'), fog: C('#8a2a0a'), rim: C('#ff8a30', 1.6), fogH: 0.12, seed: 21 });
      P.layer(sc, R, { D: 35, top: 0.42, amp: 0.12, wav: 3, deco: 'pine', sp: 0.022, th: 2.6, col: C('#0c0505'), fog: C('#5a1406'), rim: C('#ffb048', 1.8), fogH: 0.12, seed: 23 });
      P.layer(sc, R, { D: 9, top: 0.3, amp: 0.1, wav: 3.5, deco: 'pine', sp: 0.04, th: 2.8, cut: 0.02, col: C('#060303'), fog: C('#2a0804'), rim: C('#ffc060', 1.4), fogH: 0.1, seed: 25 });
      P.layer(sc, R, { D: 1.3, top: 0.06, amp: 0.05, deco: 'grass', sp: 0.05, th: 4.5, col: C('#020101'), fog: C('#000000'), rim: C('#ff7a30', 0.8), seed: 27 });
      sc.add(JZ.fx.motes({ n: 2500, box: [-4, -0.5, -14, 4, 4, 0.2], v: [0.12, 0.4, 0], sway: 0.15, size: 0.004, col: C('#ff8a30', 2.2), tw: 0.5 }, rr));
      st.camAt = JZ.path([{ t: B(23), p: [-0.03, 0.05, 0.72], l: [0, 0.08, 0], fov: 22 }, { t: B(29), p: [0.05, 0.06, 0.66], l: [0, 0.08, 0], fov: 22 }]);
      st.fairy = (t) => ({ p: [0.02, 0.07, 0], rot: [200, -5, 0], pose: 'watch', shade: 'flat', flat: C('#050202'), hull: C('#ffb050', 1.6), hullW: 0.014, glow: 1, wind: [-1, 0.35, 0.3], ribL: 0.32 });
    }),
    // 春晨：手特写，指尖碰芽，一滴露挂在芽尖。青绿 / 桃粉 / 金
    mkSet(57, 64, (st, sc) => {
      const T = JZ.THREE; F.set(B(58), { p: [0, 0, 0], rot: [-50, 0, 0], pose: 'reach', glow: 0 }); const hd = F.vrm.humanoid.getNormalizedBoneNode('rightIndexDistal').getWorldPosition(new T.Vector3()).toArray();
      const dw = [hd[0] - 0.004, hd[1] - 0.0035, hd[2]], cz = hd[2] + 0.2, R = P.ref({ y: hd[1], z: cz, fov: 22 });
      P.sky(sc, R, { top: C('#86b8cc'), hor: C('#f6e8da'), disc: C('#fff2dc', 0.5), dx: 0.3, dy: 0.66, dr: 0.05, halo: 1.2, horS: 0.4 });
      P.layer(sc, R, { D: 80, top: 0.58, amp: 0.12, wav: 2.4, col: C('#a6c8bc'), fog: C('#ece6dc'), rim: C('#fffaf0', 0.6), fogH: 0.14, seed: 31 });
      P.layer(sc, R, { D: 20, top: 0.48, amp: 0.08, wav: 3, deco: 'bloom', sp: 0.05, th: 1.8, col: C('#7ab49c'), fog: C('#e4eadf'), acc: C('#f3b2c4'), rim: C('#fffaf0', 0.5), fogH: 0.12, seed: 33 });
      P.layer(sc, R, { D: 4, top: 0.34, amp: 0.07, wav: 3, deco: 'bloom', sp: 0.12, th: 2.0, col: C('#4e9a7c'), fog: C('#d4e4d8'), acc: C('#f6a2ba'), rim: C('#fff6e8', 0.6), fogH: 0.12, cut: 0.03, seed: 35 });
      P.layer(sc, R, { D: 0.45, top: -0.02, amp: 0.06, wav: 1.5, deco: 'grass', sp: 0.09, th: 3.6, den: 0.6, col: C('#3e8a52'), fog: C('#2a6040'), rim: C('#fff0c0', 0.7), fogH: 0.2, seed: 37 });   // 草尖
      // 芽：一根弯茎从画面底下长上来，顶上两片子叶张开，左边那片的叶尖挂着露珠，她指尖碰着露珠
      const z = hd[2] - 0.004, x0 = dw[0] + 0.003, y0 = dw[1] + 0.001, stem = new T.Shape();
      stem.moveTo(x0 + 0.004, hd[1] - 0.06); stem.bezierCurveTo(x0 + 0.007, hd[1] - 0.035, x0 + 0.0, y0 - 0.016, x0 + 0.0006, y0 - 0.002); stem.lineTo(x0 - 0.0006, y0 - 0.002);
      stem.bezierCurveTo(x0 - 0.0016, y0 - 0.016, x0 + 0.0052, hd[1] - 0.035, x0 + 0.0024, hd[1] - 0.06); stem.lineTo(x0 + 0.004, hd[1] - 0.06);
      const leaf = (dir) => { const s = new T.Shape(), L = 0.0075, W = 0.0032, tx = x0 + dir * L, ty = y0 + 0.0012 - (dir < 0 ? 0.0012 : -0.0012);
        s.moveTo(x0, y0 - 0.001); s.bezierCurveTo(x0 + dir * L * 0.3, y0 + W, x0 + dir * L * 0.8, ty + W * 0.6, tx, ty); s.bezierCurveTo(x0 + dir * L * 0.75, ty - W * 0.7, x0 + dir * L * 0.25, y0 - W * 0.6, x0, y0 - 0.001); return s; };
      P.shape(sc, [stem, leaf(-1), leaf(1)], { z, col: C('#6fbf5a'), rim: C('#fff6c8', 1.4), rimW: 0.05 });
      const dew = new T.Mesh(new T.SphereGeometry(0.0011, 24, 16), new T.MeshBasicMaterial({ color: new T.Color(...C('#fff6e0', 1.6)) })); dew.position.set(x0 + 0.0075, y0 + 0.0008, z + 0.0005); sc.add(dew);
      sc.add(JZ.fx.motes({ n: 800, box: [hd[0] - 0.3, hd[1] - 0.1, hd[2] - 1.5, hd[0] + 0.3, hd[1] + 0.2, hd[2] + 0.1], v: [0.01, 0.006, 0], sway: 0.01, size: 0.0006, col: C('#ffe6a0', 1.2), tw: 0.6 }, rr));
      const lk = [hd[0] - 0.01, hd[1] - 0.004, hd[2]];
      st.camAt = JZ.path([{ t: B(57), p: [lk[0] - 0.015, lk[1] + 0.004, cz], l: lk, fov: 22 }, { t: B(65), p: [lk[0] + 0.015, lk[1] + 0.002, cz - 0.03], l: lk, fov: 22 }]);
      st.fairy = (t) => ({ p: [0, 0, 0], rot: [-50, 0, 0], pose: 'reach', shade: QS.get('shade') || 'soft', hull: C('#ffcc70', 0.5), hullW: 0.01, glow: 0.35, ribL: 0.25, wind: [1, 0.1, -0.8], key: 1.0, amb: 0.45 });
    }),
    // 尾声：引雷。深蓝紫 / 雷白 / 金
    mkSet(89, 123, (st, sc) => {
      const R = P.ref({ y: 0.04, z: 0.9, fov: 24 }), fp = [0, 0.13, -0.4];
      P.sky(sc, R, { top: C('#07041a'), hor: C('#3a2c70'), horS: 0.3 });
      P.layer(sc, R, { D: 600, top: 0.93, amp: 0.05, deco: 'cloud', sp: 0.07, band: 0.07, wav: 1.5, col: C('#2a2258'), fog: C('#1c163e'), rim: C('#b0a0ff', 0.7), fogH: 0.2, seed: 41 });
      P.layer(sc, R, { D: 200, top: 0.42, amp: 0.26, wav: 2.4, deco: 'pine', sp: 0.012, th: 2.0, col: C('#211c4c'), fog: C('#3a3270'), rim: C('#a898ff', 0.8), fogH: 0.08, seed: 43 });
      P.layer(sc, R, { D: 60, top: 0.36, amp: 0.12, wav: 3, deco: 'bloom', sp: 0.03, th: 1.8, col: C('#151236'), fog: C('#28225a'), acc: C('#c87aa8', 0.8), rim: C('#d0c4ff', 0.7), fogH: 0.06, cut: 0.012, seed: 45 });
      P.water(sc, R, { y: 0, z0: 0.9, z1: -400, w: 600, near: C('#0a0820'), far: C('#2e2860'), line: C('#8a80d0', 0.35), lines: 30, ringC: C('#ffe6b0', 3) }).material.uniforms.uRing.value.set(fp[0], fp[2], B(97) + 0.05, 0.9);
      F.set(B(97), { p: fp, rot: [-20, 0, 0], pose: 'raise', glow: 0 }); const hd = F.vrm.humanoid.getNormalizedBoneNode('rightHand').getWorldPosition(new JZ.THREE.Vector3()).toArray();
      sc.add(JZ.fx.bolt([{ t: B(97), top: [hd[0] + 0.5, 4, hd[2] - 3], p: hd, w: 0.0025, br: 0.2 }, { t: B(97) + 0.03, top: hd, p: [fp[0] + 0.01, 0, fp[2]], w: 0.0018, br: 0.1 }], M.rng(6203)));
      sc.add(JZ.fx.motes({ n: 1800, box: [-2, 0, -8, 2, 2.5, 0.5], v: [0, 0.12, 0], sway: 0.05, size: 0.002, col: C('#ffd890', 1.6), tw: 0.6 }, rr));
      st.camAt = JZ.path([{ t: B(89), p: [0.05, 0.035, 0.92], l: [0, 0.16, -0.4], fov: 24 }, { t: B(123), p: [-0.05, 0.04, 0.85], l: [0, 0.16, -0.4], fov: 24 }]);
      st.fairy = (t) => ({ p: fp, rot: [-20, 0, 0], pose: 'raise', shade: QS.get('shade') || 'soft', hull: C('#ffc060', 1.3), hullW: 0.012, glow: 1, wind: [-0.6, -0.4, -0.6], ribL: 0.4, cam: st.camAt(t).p });
    }),
  ];
};

const pick = (t) => { const b = M.bar(t).n; return sets.find(s => b >= s.lo && b <= s.hi) || (b < 57 ? sets[1] : sets[3]); };   // 还没搭的段先借邻近的场景
S.draw = (ctx, s, m) => {
  const t = s.t, st = pick(t), k = st.camAt(t), cam = st.cam;
  cam.position.set(...k.p); cam.lookAt(...k.l); cam.fov = k.fov; cam.updateProjectionMatrix();
  const fo = st.fairy(t); F.set(t, { cam: k.p, ...fo }); st.sc.add(F.root, F.ribs);
  for (const u of st.uT) u.value = t;
  JZ.present(ctx, M, st.sc, cam);
};
})();
