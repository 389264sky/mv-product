// crane.js —— 丹顶鹤：身体放样管（颈、头、喙、腿逐帧按姿势算）+ 逐根飞羽 / 覆羽（实例化）；另有远景鹤群（顶点着色器扇翅）
XJ.build.push((X, THREE, M) => {
  const V = X.V3, { lerp, clamp } = M, sm = M.smooth, TAU = M.TAU;
  // ---- 羽：一片带弧度的羽形，uv.x 横向 0..1，uv.y 羽根→羽尖
  const featherGeo = (seg = 9) => { const P = [], UV = [], I = []; for (let i = 0; i <= seg; i++) { const t = i / seg, wd = Math.pow(Math.sin(Math.PI * Math.min(1, t * .52 + .22)), .8) * (t > .8 ? Math.sqrt(Math.max(0, 1 - ((t - .8) / .2) ** 2)) : 1) * .5 * (.55 + .45 * Math.min(1, t * 4)); for (const s of [-1, -.35, 0, .35, 1]) { P.push(s * wd * (s > 0 ? .82 : 1), -Math.abs(s) * .06 - t * t * .05 + Math.sin(t * 3.1) * .02, t); UV.push(s * .5 + .5, t); } }
    for (let i = 0; i < seg; i++) for (let j = 0; j < 4; j++) { const a = i * 5 + j; I.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
  const FG = featherGeo();
  const featherMat = () => X.mat({ rough: .62, side: THREE.DoubleSide, vary: 'varying vec3 vCol; varying float vBk;', vdecl: 'attribute vec4 aC;', vert: 'vCol = aC.rgb; vBk = aC.a; transformed.y += sin(uT*7.+instanceMatrix[3].x*9.+instanceMatrix[3].z*5.)*.012*position.z*position.z*uWind;',
    color: `float sx = vUvX.x-.5; float barb = sin((abs(sx)*1.15+vUvX.y*1.0)*170.); float rach = smoothstep(.030,.008,abs(sx)); vec3 bc = vCol; bc *= .90+.10*barb; bc = mix(bc, bc*.80+vec3(.06,.055,.045), rach); bc *= mix(.74,1.06,smoothstep(0.,.35,vUvX.y)); bc = mix(bc, bc*vec3(.93,.97,1.03), smoothstep(.2,.5,abs(sx))); dc = bc;`,
    late: `outgoingLight += vCol*uSunCol*.30*pow(max(0.,dot(-Nw,uSunDir)),1.)*step(.3,vCol.r); outgoingLight += vec3(.95,.66,.26)*(.25+.4*uSunCol.r)*smoothstep(.47,.5,abs(vUvX.x-.5))*.18*uGold;`, rim: 1.5, amb: '1.35', key: 'feather' });
  // ---- 身体：沿脊线放样。分段 t 0 尾 → 1 喙尖
  const SEG = 92, RAD = 20;
  const bodyMat = X.mat({ rough: .66, vc: true, vary: 'varying vec2 vB;', vert: 'vB = uv;', color: 'float fr_ = fbm(vB*vec2(46.,90.)); float sc = sin(vB.x*150.+sin(vB.y*260.)*1.6)*sin(vB.y*260.); dc *= .90+.14*fr_+.035*sc;', rim: 1.5, amb: '1.35', key: 'cbody' });
  const legMat = X.mat({ rough: .5, c: 0x1c1b1a, color: 'dc *= .7+.6*step(.5,fract(vUvX.y*26.));', key: 'leg' }), eyeM = X.mat({ rough: .08, c: 0x140a05, key: 'eye', emis: 'em=vec3(.02,.008,.0);' }), ringM = X.mat({ rough: .3, c: 0xb8641c, key: 'eyer' });
  const COL = { WHITE: [.86, .85, .82], BLACK: [.018, .019, .024], RED: [.62, .022, .012], BEAK: [.36, .34, .20] };
  const catmull = (p, t) => { const n = p.length - 1, f = clamp(t) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i, a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(n, i + 2)], q = (k) => .5 * (2 * b[k] + (c[k] - a[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u * u + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * u * u * u); return [q(0), q(1), q(2)]; };
  // 羽表：每侧 初级 11 / 次级 16 / 三级 7，覆羽三排
  const LAY = []; 
  for (let i = 0; i < 11; i++) LAY.push({ k: 'p', u: i / 10, len: lerp(1.02, .86, Math.abs(i - 7) / 7) * (i > 8 ? .92 : 1), w: .115, row: 0 });
  for (let i = 0; i < 17; i++) LAY.push({ k: 's', u: i / 16, len: lerp(.74, .66, i / 16), w: .125, row: 0 });
  for (let i = 0; i < 9; i++) LAY.push({ k: 't', u: i / 8, len: lerp(.66, .80, i / 8), w: .14, row: 0 });
  for (let r = 1; r <= 4; r++) for (let i = 0; i < 34; i++) LAY.push({ k: 'c', u: i / 33, len: [0, .50, .36, .26, .18][r], w: [0, .105, .098, .09, .08][r], row: r });
  const NF = LAY.length * 2 + 26;
  class Crane {
    constructor(opt = {}) {
      const { WHITE, BLACK, RED, BEAK } = this.col = { ...COL, ...(opt.col || {}) };
      const g = this.g = new THREE.BufferGeometry(); this.P = new Float32Array((SEG + 1) * (RAD + 1) * 3); const C = new Float32Array(this.P.length), UV = new Float32Array((SEG + 1) * (RAD + 1) * 2), I = [];
      for (let i = 0; i <= SEG; i++) for (let j = 0; j <= RAD; j++) { const k = i * (RAD + 1) + j, t = i / SEG, a = j / RAD; UV[k * 2] = a; UV[k * 2 + 1] = t; const top = Math.cos(a * TAU); let c = WHITE;
        if (t > .887) c = BEAK; else if (t > .848) c = top > .22 ? RED : BLACK; else if (t > .805) c = top > .55 && t > .826 ? RED : top > -.12 ? WHITE : BLACK; else if (t > .69) c = top > .62 - (t - .69) * 6 ? WHITE : BLACK; else if (t > .54 + .03 * top) c = BLACK;
        const nz = .9 + .16 * M.hash(i * 31 + j, 3); C.set([c[0] * nz, c[1] * nz, c[2] * nz], k * 3); }
      for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j; I.push(a, a + RAD + 1, a + 1, a + 1, a + RAD + 1, a + RAD + 2); }
      g.setAttribute('position', new THREE.BufferAttribute(this.P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setIndex(I);
      this.root = new THREE.Group(); this.body = new THREE.Mesh(g, opt.bodyMat || bodyMat); this.body.castShadow = this.body.receiveShadow = true; this.body.frustumCulled = false; this.root.add(this.body);
      const fg = FG.clone(); this.aC = new THREE.InstancedBufferAttribute(new Float32Array(NF * 4), 4); fg.setAttribute('aC', this.aC); this.f = new THREE.InstancedMesh(fg, opt.fm || Crane.fm || (Crane.fm = featherMat()), NF); this.f.frustumCulled = false; this.f.castShadow = this.f.receiveShadow = true; this.root.add(this.f);
      const cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 8); cyl.translate(0, .5, 0); this.legs = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(cyl, legMat); m.castShadow = true; this.root.add(m); this.legs.push(m); }
      this.thigh = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), X.mat({ rough: .7, c: 0xd8d6d0, color: 'dc *= .86+.2*fbm(vOP.xy*9.);', key: 'thigh', rim: 1.2 })); m.castShadow = true; this.root.add(m); return m; });
      const armG = new THREE.CapsuleGeometry(.5, 1, 8, 14); armG.translate(0, .5, 0); { const p = armG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y < 0 ? y * .25 : y > 1 ? 1 + (y - 1) * .25 : y); } } this.arm = [0, 1, 2, 3, 4, 5].map(() => { const m = new THREE.Mesh(armG, X.mat({ rough: .7, c: 0xdedcd6, color: 'float sc_ = sin(vUvX.x*60.+sin(vUvX.y*80.)*1.5)*sin(vUvX.y*80.); dc *= .92+.08*sc_;', key: 'arm', rim: 1.3 })); if (opt.bodyMat) m.visible = false; m.material = opt.bodyMat ? opt.armMat || m.material : m.material; m.castShadow = true; m.frustumCulled = false; this.root.add(m); return m; }); this.noArm = !!opt.bodyMat;
      this.eyes = [0, 1].map(() => { const e = new THREE.Group(), r = new THREE.Mesh(new THREE.SphereGeometry(.0165, 16, 12), ringM), b = new THREE.Mesh(new THREE.SphereGeometry(.0140, 16, 12), eyeM); b.position.set(0, 0, .0060); e.add(r, b); this.root.add(e); return e; });
      this.N = new Float32Array(this.P.length); g.setAttribute('normal', new THREE.BufferAttribute(this.N, 3));
    }
    // pose: { flap 翼拍相位, amp 幅, fold 0 展 1 收, spread, neck 0 伸直 1 S 形, neckUp 颈抬角, look 左右, beak 张, legs 0 后伸 1 站立, walk 相位, lift 单腿抬, bend 腿弯, twist }
    pose(p) {
      const { WHITE, BLACK } = this.col;
      const o = { flap: 0, amp: .6, fold: 0, neck: 0, neckUp: 0, look: 0, legs: 0, walk: null, lift: 0, pitch: 0, dihedral: .12, sweep: 0, spread: 1, tailUp: 0, breath: 0, dip: 0, ...p }, root = this.root;
      // 脊线控制点：+z 朝前。飞：颈平伸；站：颈 S 形竖起
      const s = o.legs, nu = o.neckUp, N = o.neck, dp = o.dip, look = o.look;
      const bodyTilt = s * .52 + o.pitch, ct = Math.cos(bodyTilt), st = Math.sin(bodyTilt), bt = (x, y, z) => [x, y * ct + z * st, z * ct - y * st];
      const A = bt(0, .02 + o.tailUp * .1, -.74), B = bt(0, .03, -.42), Cc = bt(0, 0, -.08), D = bt(0, .0, .22), E = bt(0, .05, .44);
      const fly = [[0, .11, .70], [0, .15, .98], [0, .18, 1.24], [0, .20, 1.46]], std = [[0, E[1] + .18, E[2] + .10], [0, E[1] + .52, E[2] + .02], [0, E[1] + .82, E[2] + .08], [0, E[1] + .96, E[2] + .26]], S2 = [[0, E[1] + .04, E[2] + .22], [0, E[1] + .34, E[2] + .30], [0, E[1] + .56, E[2] + .08], [0, E[1] + .74, E[2] + .24]], dip = [[0, E[1] + .02, E[2] + .22], [0, E[1] - .22, E[2] + .46], [0, E[1] - .52, E[2] + .60], [0, E[1] - .74, E[2] + .72]];
      const nk = [0, 1, 2, 3].map(i => [0, 1, 2].map(k => { let a = lerp(fly[i][k], std[i][k], s); a = lerp(a, S2[i][k], N * s); a = lerp(a, dip[i][k], dp); if (k === 1) a += nu * (i + 1) * .14; if (k === 0) a += Math.sin(look) * (i + 1) ** 1.5 * .055; return a; }));
      const hd = nk[3], dir = V(Math.sin(look) * .9, lerp(lerp(-.02, -.16, s), -.8, dp) + nu * .5, 1).normalize();
      const head1 = [hd[0] + dir.x * .11, hd[1] + dir.y * .11 + .012, hd[2] + dir.z * .11], bk0 = [hd[0] + dir.x * .17, hd[1] + dir.y * .17, hd[2] + dir.z * .17], bk1 = [hd[0] + dir.x * .46, hd[1] + dir.y * .46 - .012, hd[2] + dir.z * .46];
      const ctl = [A, B, Cc, D, E, ...nk, head1, bk0, bk1], T = [0, .12, .27, .40, .50, .58, .67, .76, .835, .872, .895, 1];
      const at = (t) => { let i = 0; while (i < T.length - 2 && t > T[i + 1]) i++; const u = (t - T[i]) / (T[i + 1] - T[i]); return catmull(ctl, (i + u) / (ctl.length - 1)); };
      const Rk = [[0, .03, .02], [.06, .085, .06], [.15, .175, .155], [.27, .245, .235], [.38, .235, .235], [.47, .15, .165], [.52, .095, .11], [.60, .062, .070], [.72, .050, .055], [.80, .050, .056], [.835, .062, .068], [.862, .066, .072], [.876, .046, .050], [.892, .027, .030], [.92, .019, .021], [.97, .011, .012], [1, .002, .002]];
      const rad = (t) => { let i = 0; while (i < Rk.length - 2 && t > Rk[i + 1][0]) i++; const u = sm(0, 1, (t - Rk[i][0]) / (Rk[i + 1][0] - Rk[i][0])); return [lerp(Rk[i][1], Rk[i + 1][1], u), lerp(Rk[i][2], Rk[i + 1][2], u)]; };
      const P = this.P; let up = V(0, 1, 0);
      for (let i = 0; i <= SEG; i++) { const t = i / SEG, c = at(t), c2 = at(Math.min(1, t + .004)), c1 = at(Math.max(0, t - .004)), tan = V(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]).normalize(), rt = V(1, 0, 0).addScaledVector(tan, -tan.x).normalize(), un = V().crossVectors(tan, rt).normalize(), [rx, ry0] = rad(t), ry = ry0 * (1 + (t < .45 ? o.breath * .02 : 0));
        for (let j = 0; j <= RAD; j++) { const a = j / RAD * TAU, ca = Math.cos(a), sa = Math.sin(a), k = (i * (RAD + 1) + j) * 3; const y = ca * ry * (ca < 0 && t < .5 ? 1.12 : 1), x = sa * rx; P[k] = c[0] + un.x * y + rt.x * x; P[k + 1] = c[1] + un.y * y + rt.y * x; P[k + 2] = c[2] + un.z * y + rt.z * x; } }
      this.g.attributes.position.needsUpdate = true; this.g.computeVertexNormals(); const nn = this.g.attributes.normal; for (let i = 0; i <= SEG; i++) { const a = i * (RAD + 1), b = a + RAD, x = nn.getX(a) + nn.getX(b), y = nn.getY(a) + nn.getY(b), z = nn.getZ(a) + nn.getZ(b), l = Math.hypot(x, y, z) || 1; nn.setXYZ(a, x / l, y / l, z / l); nn.setXYZ(b, x / l, y / l, z / l); } nn.needsUpdate = true;
      [-1, 1].forEach((sg, i) => { const e = this.eyes[i], rgt = V().crossVectors(V(0, 1, 0), dir).normalize(); e.position.set(hd[0] + dir.x * .085, hd[1] + dir.y * .085 + .022, hd[2] + dir.z * .085).addScaledVector(rgt, sg * .0555); e.lookAt(root.localToWorld(e.position.clone().addScaledVector(rgt, sg))); });
      // 翼
      this.arm.forEach(m => { m.visible = !this.noArm; });
      const fl = Math.sin(o.flap), fl2 = Math.sin(o.flap - .85), fl3 = Math.sin(o.flap - 1.5), F = o.fold, amp = o.amp;
      let q = 0; const m4 = new THREE.Matrix4(), Xx = V(), Yy = V(), Zz = V();
      for (const sg of [-1, 1]) {
        const sh = V(...bt(sg * .17, .12, .20));
        const aU = o.dihedral + fl * amp * .75, aF = o.dihedral * .4 + fl2 * amp * .95 - amp * .06, aH = fl3 * amp * .95 - amp * .14;
        const dU = V(sg * Math.cos(aU), Math.sin(aU), .18 - o.sweep * .4), dF = V(sg * Math.cos(aF), Math.sin(aF), -.04 - o.sweep * .7), dH = V(sg * Math.cos(aH), Math.sin(aH), -.34 - o.sweep);
        const fU = V(sg * .16, .16, -.97), fF = V(sg * .02, -.20, .96), fH = V(sg * .02, -.02, -1);
        const bx = (v) => { const a = bt(v.x, v.y, v.z); return V(...a); };
        const d1 = bx(dU.lerp(fU, F).normalize()), d2 = bx(dF.lerp(fF, F).normalize()), d3 = bx(dH.lerp(fH, F).normalize());
        const el = sh.clone().addScaledVector(d1, lerp(.52, .36, F)), wr = el.clone().addScaledVector(d2, lerp(.66, .42, F)), tip = wr.clone().addScaledVector(d3, lerp(.44, .30, F));
        const A_ = this.arm, ai = sg < 0 ? 0 : 3; [[sh, el, .050, .075], [el, wr, .042, .062], [wr, tip, .030, .03]].forEach(([a, b, r0], k) => { const m = A_[ai + k], dd = b.clone().sub(a), l = dd.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(V(0, 1, 0), dd.normalize()); m.scale.set(r0 * (1 - .25 * F), l, r0); });
        const upv = bx(V(sg * -Math.sin(aF) * .6 * (1 - F), 1, 0).normalize());
        const back = bx(V(sg * .03 * F, -.04 - .16 * F, -1).normalize());
        for (const f of LAY) {
          let base, dirF, col = WHITE, len = f.len, wd = f.w, lift = 0, upF = upv.clone();
          if (f.k === 'p') { base = wr.clone().lerp(tip, f.u); const fan = lerp(.12, 1.22, Math.pow(f.u, 1.15)) * (1 - F) * o.spread; dirF = back.clone().multiplyScalar(Math.cos(fan)).addScaledVector(d3, Math.sin(fan)); dirF.y += fl3 * -.14 * amp * f.u + .05 * f.u; col = WHITE; upF = bx(V(sg * -Math.sin(aH) * .7 * (1 - F), 1, 0)).normalize(); }
          else if (f.k === 's') { base = el.clone().lerp(wr, f.u); dirF = back.clone().addScaledVector(d2, .10 * (1 - F)); dirF.y -= .06 + fl2 * .10 * amp; col = BLACK; }
          else if (f.k === 't') { base = sh.clone().lerp(el, f.u); dirF = back.clone(); dirF.y -= .05 + F * .34 * (1 - f.u); dirF.x += sg * -.10 * F; col = BLACK; len *= lerp(1, 1.18, F); lift = .02; }
          else { const u = f.u; base = u < .33 ? sh.clone().lerp(el, u / .33) : u < .72 ? el.clone().lerp(wr, (u - .33) / .39) : wr.clone().lerp(tip, (u - .72) / .28); const fan = u > .72 ? (u - .72) / .28 * .95 * (1 - F) * o.spread : 0; dirF = back.clone().multiplyScalar(Math.cos(fan)).addScaledVector(d3, Math.sin(fan)); dirF.y -= .04; lift = .014 * f.row + .006; base.addScaledVector(back, -.035 * (f.row - 1) - .0); len *= u > .9 ? .85 : 1; }
          base.addScaledVector(upF, lift + (f.k === 'p' ? .004 * (10 - f.u * 10) : .002 * (f.u * 16)));
          Zz.copy(dirF).normalize(); Xx.crossVectors(upF, Zz).normalize().multiplyScalar(sg); Yy.crossVectors(Zz, Xx).normalize(); if (Yy.dot(upF) < 0) { Yy.negate(); Xx.negate(); }
          const j = M.hash(q, 17); m4.makeBasis(Xx.clone().multiplyScalar(wd * (f.k === 'c' ? 1.7 : 1.3) * (1 + .1 * j)), Yy.clone().multiplyScalar(f.k === 'c' ? .12 : Math.max(.3, len * .7)), Zz.clone().multiplyScalar(len * (.96 + .08 * j))); m4.setPosition(base);
          this.f.setMatrixAt(q, m4); const b = .92 + .12 * j; this.aC.setXYZW(q, col[0] * b, col[1] * b, col[2] * b, sg); q++;
        }
      }
      // 尾羽 + 收翅时垂下的黑色三级飞羽（蓬尾）
      for (let i = 0; i < 26; i++) { const u = i / 25 - .5, inner = i % 2, base = V(...bt(u * .20, .07 - Math.abs(u) * .04 + inner * .02, -.52 - inner * .05)), d = V(...bt(u * .75, -.10 - F * .30 - Math.abs(u) * .05 + o.tailUp * .4, -1)).normalize(), upv = V(...bt(u * .4, 1, 0)); Zz.copy(d); Xx.crossVectors(upv, Zz).normalize(); Yy.crossVectors(Zz, Xx); const len = lerp(.40, .46 + .12 * F, inner), blk = inner && F > .5; m4.makeBasis(Xx.clone().multiplyScalar(.11), Yy.clone().multiplyScalar(.5), Zz.clone().multiplyScalar(len)); m4.setPosition(base); this.f.setMatrixAt(q, m4); const c = blk ? BLACK : WHITE; this.aC.setXYZW(q, ...c, 1); q++; }
      this.f.instanceMatrix.needsUpdate = true; this.aC.needsUpdate = true;
      // 腿
      let L = 0; const seg = (a, b, r0, r1) => { const m = this.legs[L++]; m.visible = true; const d = b.clone().sub(a), l = d.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.scale.set(r0, l, r0); };
      for (const [i, sg] of [[0, -1], [1, 1]]) {
        const hip = V(...bt(sg * .09, -.20, -.12)); let kn, an, toeD = V(0, 0, 1), th = hip.clone();
        const ph = o.walk == null ? null : o.walk + i * Math.PI, sw = ph == null ? 0 : Math.sin(ph), up = ph == null ? (i ? o.lift : 0) : Math.max(0, Math.cos(ph)) * .9;
        const stand = [hip.clone().add(V(0, -.36 + up * .12, -.12 + sw * .16 + up * .24)), hip.clone().add(V(0, -.98 + up * .46, .02 + sw * .34 + up * .02))];
        const back = [V(sg * .05, -.12, -.62), V(sg * .04, -.10, -1.28)];
        kn = back[0].clone().lerp(stand[0], s); an = back[1].clone().lerp(stand[1], s); toeD.set(0, lerp(.0, -up * .9, s), lerp(-1, 1 - up * .6, s)).normalize();
        this.thigh[i].position.copy(hip.clone().lerp(kn, .12)); this.thigh[i].scale.set(.088, .25, .115); this.thigh[i].quaternion.setFromUnitVectors(V(0, 1, 0), kn.clone().sub(hip).normalize());
        seg(th.lerp(kn, .5), kn, .020, .016); seg(kn, an, .0145, .0125); const tl = .15; seg(an, an.clone().addScaledVector(toeD, tl), .010, .006); seg(an, an.clone().addScaledVector(toeD, tl * .86).add(V(.062, 0, 0)), .009, .006); seg(an, an.clone().addScaledVector(toeD, tl * .86).add(V(-.062, 0, 0)), .009, .006); seg(an, an.clone().addScaledVector(toeD, -tl * .4), .008, .006);
      }
      while (L < this.legs.length) this.legs[L++].visible = false;
      this.beakTip = V(...bk1); this.headAt = V(...hd); this.footY = -1.18; return this;
    }
  }
  X.Crane = Crane;
  // 飞行常用姿势
  X.fly = (t, o = {}) => { const sp = o.sp ?? 2.1, glide = o.glide ?? .5, c = .5 + .5 * Math.sin(t * .55 + (o.ph || 0)); const g = M.smooth(.55 - glide * .5, .95 - glide * .3, c); return { flap: t * sp * 1.6 + (o.ph || 0), amp: (o.amp ?? .72) * lerp(.16, 1, g), dihedral: .14, neck: 0, legs: 0, neckUp: .06 * Math.sin(t * .7), look: .10 * Math.sin(t * .4 + 1), spread: 1, ...o.p }; };
  X.stand = (t, o = {}) => ({ fold: 1, legs: 1, neck: .5 + .18 * Math.sin(t * .6 + (o.ph || 0)), look: .35 * Math.sin(t * .42 + (o.ph || 0) * 2), breath: Math.sin(t * 1.5), amp: 0, dihedral: .1, ...o.p });
  // ---- 远景鹤群：一只 = 身 + 双翼各 3 段 + 指状羽
  const fk = (() => { const P = [], F = [], C = []; const tri = (a, b, c, f, col) => { [a, b, c].forEach((v, i) => { P.push(...v); F.push(f[i] ?? f[0]); C.push(...col); }); }; const quad = (a, b, c, d, f, col) => { tri(a, b, c, [f[0], f[1], f[2]], col); tri(a, c, d, [f[0], f[2], f[3]], col); };
    for (const s of [-1, 1]) { const w = [[.10, .30], [.62, .36], [1.25, .18], [1.62, -.04]]; for (let i = 0; i < 3; i++) { const [x0, z0] = w[i], [x1, z1] = w[i + 1], c0 = [.62, .60, .40, .2][i], c1 = [.62, .60, .40, .2][i + 1]; quad([s * x0, 0, z0], [s * x1, 0, z1], [s * x1, 0, z1 - c1 * .55], [s * x0, 0, z0 - c0 * .55], [x0, x1, x1, x0], [.9, .9, .88]); quad([s * x0, 0, z0 - c0 * .55], [s * x1, 0, z1 - c1 * .55], [s * x1, 0, z1 - c1], [s * x0, 0, z0 - c0], [x0, x1, x1, x0], i < 2 ? [.03, .03, .04] : [.85, .85, .84]); }
      for (let k = 0; k < 6; k++) { const u = k / 5, bx = lerp(1.25, 1.62, u), bz = lerp(.05, -.06, u), a = lerp(.1, 1.1, u), l = .62; tri([s * (bx - .05), 0, bz], [s * (bx + .05), 0, bz], [s * (bx + Math.sin(a) * l), .02, bz - Math.cos(a) * l], [bx, bx, bx + .5], [.86, .86, .85]); } }
    const ring = [[-.72, .02, .0], [-.4, .11, 0], [0, .20, 0], [.3, .15, .02], [.6, .06, .05], [1.1, .05, .12], [1.4, .06, .15], [1.5, .05, .15], [1.85, .005, .13]]; for (let i = 0; i < ring.length - 1; i++) for (let j = 0; j < 8; j++) { const p = (k, jj) => { const [z, r, y] = ring[k], a = jj / 8 * TAU; return [Math.cos(a) * r, y + Math.sin(a) * r, z]; }; const col = i >= 4 && i < 6 ? [.04, .04, .05] : i === 6 ? [.6, .03, .02] : i > 6 ? [.35, .33, .2] : [.9, .9, .88]; quad(p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j), [0, 0, 0, 0], col); }
    for (const s of [-1, 1]) tri([s * .06, -.1, -.4], [s * .09, -.1, -.4], [s * .05, -.1, -1.35], [0, 0, 0], [.05, .05, .05]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aF', new THREE.Float32BufferAttribute(F, 1)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(F.length * 2), 2)); g.computeVertexNormals(); return g; })();
  X.flock = (n, path) => { const m = new THREE.InstancedMesh(fk, X.mat({ vc: true, rough: .7, side: THREE.DoubleSide, vdecl: 'attribute float aF;', vert: 'float ph_ = uT*5.2 + instanceMatrix[3].x*.7+instanceMatrix[3].z*.9+float(gl_InstanceID)*1.7; float am_ = .30+.25*sin(uT*.5+float(gl_InstanceID)*2.1); transformed.y += sin(ph_-aF*1.5)*am_*aF*.75 + aF*.12; transformed.x *= 1.-.10*abs(sin(ph_))*step(.01,aF);', rim: 1.4, key: 'flock' }), n); m.frustumCulled = false; m.path = path; return m; };
  // 排人字：i 号在队里的位置
  X.vee = (i, sp) => { const r = Math.ceil(i / 2), s = i % 2 ? 1 : -1; return [s * r * sp * .9 * (i ? 1 : 0), (M.hash(i, 5) - .5) * sp * .3, -r * sp * .8]; };
  X.setFlock = (m, t, f) => { const o = new THREE.Object3D(); for (let i = 0; i < m.count; i++) { f(o, i, t); o.updateMatrix(); m.setMatrixAt(i, o.matrix); } m.instanceMatrix.needsUpdate = true; };
});
