// land.js —— 青绿群峰：高度场峰林 + 松 + 亭 + 河，云海由 core 的体积云画
XJ.build.push((X, THREE, M) => {
  const w = X.world(5000), { sc } = w, U = (v) => ({ value: v }), L = X.L = { w };
  const N = 1200, S = 2200, st = S / N, cor = (z) => 70 * Math.sin(z * .0031) + 40 * Math.sin(z * .0071 + 1.3);
  L.cor = cor;
  const CELL = 104, towers = new Map();
  for (let i = -15; i <= 15; i++) for (let j = -15; j <= 15; j++) {
    const a = M.hash(i * 37 + 5, j * 91 + 7), b = M.hash(i * 53 + 11, j * 29 + 3), c = M.hash(i * 17 + 23, j * 71 + 19), d = M.hash(i * 97 + 1, j * 13 + 31);
    const x = (i + .5 + (a - .5) * .75) * CELL, z = (j + .5 + (b - .5) * .75) * CELL, off = Math.abs(x - cor(z)), side = M.smooth(52, 260, off);
    if (off < 52 || (d < .16 && off > 120)) continue;
    const r = 26 + 26 * c + side * 14, h = (60 + 95 * Math.pow(c, 1.5) + side * 130 * (.45 + d)) * (.8 + .4 * a);
    towers.set(i * 100 + j, { x, z, r: Math.min(r, off - 24), h });
  }
  const H = L.H = (x, z) => {
    const n1 = X.fbm(x * .012 + 40, z * .012 + 11, 4) - .5, n2 = X.fbm(x * .045 + 7, z * .045 + 90, 3) - .5; let h = 6 * n1 + M.smooth(18, 80, Math.abs(x - cor(z))) * (9 + 30 * Math.max(0, n1));
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL); let best = 0, sec = 0;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      const t = towers.get(i * 100 + j); if (!t) continue; const dx = x - t.x, dz = z - t.z, ang = Math.atan2(dz, dx), ca = Math.cos(ang), sa = Math.sin(ang), gul = Math.abs(X.n2(ca * 2.4 + t.x, sa * 2.4 + t.z) * 2 - 1) * .34 + Math.abs(X.n2(ca * 5.6 + t.z, sa * 5.6 + t.x) * 2 - 1) * .16, d = Math.hypot(dx, dz) * (1 + n1 * .8 + n2 * .55 + gul - .18) / t.r; if (d > 1.15) continue;
      let p = Math.pow(1 - M.smooth(.10, 1.08, d), .66); const q = p * 7 + n1 * 3 + t.x; p += Math.sin(q * 6.283) * .016 * Math.min(1, t.h / 120); const v = t.h * p; if (v > best) { sec = best; best = v; } else if (v > sec) sec = v;
    }
    const ridge = 1 - Math.abs(X.n2(x * .06 + 3, z * .06 + 9) * 2 - 1);
    return h + best + sec * .12 + (best > 8 ? ridge * ridge * 9 * Math.min(1, best / 60) + n2 * 8 : 0);
  };
  const pos = new Float32Array((N + 1) * (N + 1) * 3), hs = L.hs = new Float32Array((N + 1) * (N + 1)), idx = new Uint32Array(N * N * 6);
  for (let j = 0, k = 0; j <= N; j++) for (let i = 0; i <= N; i++, k++) { const x = (i / N - .5) * S, z = (j / N - .5) * S, h = H(x, z); hs[k] = h; pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; }
  for (let j = 0, q = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((N + 1) * (N + 1) * 2), 2));
  L.rockColor = `vec3 Ng = normalize(vNw); float sl = Ng.y; float n = fbm(vWP.xz*.05), n2_ = vn(vWP.xz*.6), hy = vWP.y + (n-.5)*70.;
    vec3 zhe = mix(vec3(.34,.185,.075), vec3(.50,.33,.15), n), lv = mix(vec3(.012,.25,.15), vec3(.06,.52,.32), n2_*.6+n*.4), qing = mix(vec3(.004,.085,.36), vec3(.02,.25,.62), n2_);
    vec3 top = mix(zhe, lv, smoothstep(6.,52.,hy)); top = mix(top, qing, smoothstep(84.,190.,hy));
    float hx = vWP.x*.62+vWP.z*.78, hz = vWP.z*.62-vWP.x*.78; float st1 = fbm(vec2(hx*.22, vWP.y*.022+n*1.5)), st2 = fbm(vec2(hz*.22+9., vWP.y*.022)); float stv = mix(st1, st2, abs(Ng.x*.62+Ng.z*.78)); float fine = vn(vec2(mix(hx,hz,abs(Ng.x*.62+Ng.z*.78))*1.4, vWP.y*.10));
    vec3 cliff = mix(vec3(.030,.060,.062), mix(vec3(.46,.34,.19), lv*1.15+vec3(.04,.05,.02), smoothstep(20.,150.,hy)), smoothstep(.30,.66,stv)); float bk = fbm(vec2(mix(hx,hz,abs(Ng.x*.62+Ng.z*.78))*.55+st1*2., vWP.y*.16)); float ck = smoothstep(.030,.0,abs(bk-.5))*.8+smoothstep(.022,.0,abs(vn(vec2(hx*.5+bk*3.,vWP.y*.30))-.5))*.45; cliff *= .55+.50*fine+.35*smoothstep(.3,.7,bk); cliff = mix(cliff, vec3(.012,.030,.034), clamp(ck,0.,1.)*.62); cliff = mix(cliff, qing*1.1, smoothstep(120.,230.,hy)*.5);
    dc = mix(cliff, top, smoothstep(.42,.74,sl+(n2_-.5)*.16)); float blr = smoothstep(uBlm, uBlm-70., length(vWP.xz-uPC.xz))*step(1.,uBlm); float blp = smoothstep(.46,.60,fbm(vWP.xz*.11+3.)+(vn(vWP.xz*.9)-.5)*.35)*smoothstep(.22,.62,sl+.18*smoothstep(40.,130.,vWP.y)); dc = mix(dc, mix(vec3(.80,.20,.30),vec3(.96,.62,.66),vn(vWP.xz*1.7)), blr*blp*.85*step(8.,vWP.y)); dc = mix(dc, vec3(.82,.87,.93), uSnow*smoothstep(.30,.62,sl+(n-.5)*.3)); `;
  const mat = X.mat({ rough: .92, vary: 'varying vec3 vNw;', vert: 'vNw = normalize(mat3(modelMatrix)*normal);', color: L.rockColor,
    late: `float gldE = smoothstep(.70,.93,fr)*smoothstep(700.,60.,length(vWP-cameraPosition))*(.35+.9*vn(vWP.xz*.4+vWP.y*.3)); outgoingLight = mix(outgoingLight, vec3(1.15,.74,.25)*(.35+uSunCol*.45), gldE*.62*uGold);`, rim: .6, key: 'rock' });
  L.mesh = new THREE.Mesh(g, mat); L.mesh.castShadow = L.mesh.receiveShadow = true; sc.add(L.mesh);

  // 松：干 + 层云状叶片
  const tree = (() => { const gs = [], col = []; const push = (geo, c) => { const q = geo.index ? geo.toNonIndexed() : geo; gs.push(q); for (let i = 0; i < q.attributes.position.count; i++) { const y = q.attributes.position.getY(i), v = M.hash(i, 77); col.push(c[0] * (.8 + .4 * v), c[1] * (.8 + .4 * v), c[2] * (.8 + .4 * v)); } };
    const tr = new THREE.CylinderGeometry(.05, .16, 2.4, 5); tr.translate(0, 1.1, 0); push(tr, [.16, .09, .045]);
    [[0, 1.5, 0, 1.25], [.35, 2.05, .2, 1.0], [-.3, 2.5, -.1, .85], [.05, 2.95, 0, .6]].forEach(([x, y, z, r], k) => { const b = new THREE.IcosahedronGeometry(r, 1); const p = b.attributes.position; for (let i = 0; i < p.count; i++) { const a = .8 + .4 * M.hash(Math.round(p.getX(i) * 90) + k * 7, Math.round(p.getZ(i) * 90)); p.setXYZ(i, p.getX(i) * a, p.getY(i) * .34 * a, p.getZ(i) * a); } b.translate(x, y, z); push(b, [.035, .13 + .03 * k, .075 + .01 * k]); });
    let n = 0; gs.forEach(q => n += q.attributes.position.count); const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), UV = new Float32Array(n * 2); let o = 0; gs.forEach(q => { q.computeVertexNormals(); P.set(q.attributes.position.array, o * 3); Nn.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; });
    const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); r.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); r.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3)); return r; })();
  const nT = 30000, tm = X.mat({ vc: true, rough: .9, color: 'float bl_ = smoothstep(uBlm, uBlm-60., length(vTc.xz-uPC.xz))*step(1.,uBlm)*step(.10,dc.g); dc = mix(dc, mix(vec3(.85,.16,.26),vec3(.95,.52,.55),h2(vTc.xz*9.)), bl_*step(.28,h2(vTc.xz*3.+7.))); dc = mix(dc, vec3(.8,.85,.92), uSnow*smoothstep(.2,.7,normalize(vNw).y)*.9);', vary: 'varying vec3 vNw; varying vec3 vTc;', vert: 'vTc = instanceMatrix[3].xyz; vNw = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); transformed.x += sin(uT*1.6*uWind+instanceMatrix[3].x*.4)*.05*position.y*uWind;', rim: .8, key: 'tree' });
  const trees = new THREE.InstancedMesh(tree, tm, nT), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = X.V3(), s3 = X.V3(); let k = 0, seed = 0; const rr = M.rng(4242);
  while (k < nT && seed++ < nT * 24) { const x = (rr() - .5) * S * .94, z = (rr() - .5) * S * .94, h = H(x, z); if (h < 14) continue; const hx = H(x + 2, z) - h, hz = H(x, z + 2) - h, sl = 1 / Math.sqrt(1 + (hx * hx + hz * hz) / 4); if (sl < .26 + .34 * rr()) continue; if (X.fbm(x * .02, z * .02, 3) < .40) continue;
    const s = (.75 + 1.25 * rr()) * (sl < .6 ? .75 : 1); e3.set((rr() - .5) * .2, rr() * 6.28, (rr() - .5) * .25); q4.setFromEuler(e3); m4.compose(v3.set(x, h - .4, z), q4, s3.set(s, s * (.85 + .5 * rr()), s)); trees.setMatrixAt(k++, m4); }
  trees.count = k; trees.frustumCulled = false; trees.receiveShadow = true; sc.add(trees); L.trees = trees;

  // 亭：台基、柱、栏、攒尖顶（举折曲线、翘角、瓦垄）
  const roof = (n, R0, hgt, flare) => { const rows = 14, seg = n * 10, P = [], I = [], Uv = []; for (let i = 0; i <= rows; i++) { const t = i / rows, rad = R0 * (1 - t) * (1 + .0 * t) + .12, y = hgt * Math.pow(t, 1.75); for (let j = 0; j <= seg; j++) { const a = j / seg * X.TAU, f = (j / seg * n) % 1, c = Math.abs(f - .5) * 2, ap = Math.cos(Math.PI / n) / Math.cos((f - .5) * X.TAU / n), corner = Math.pow(c, 5); P.push(Math.cos(a) * rad * ap * (1 + corner * .07 * (1 - t)), y + corner * flare * Math.pow(1 - t, 2.2), Math.sin(a) * rad * ap * (1 + corner * .07 * (1 - t))); Uv.push(j / seg * n * 9, t * 6); } }
    for (let i = 0; i < rows; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j; I.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
  X.roof = roof;
  const tileM = X.tileM = X.mat({ rough: .6, side: THREE.DoubleSide, color: 'float tl = abs(fract(vUvX.x)-.5)*2.; float rw = smoothstep(.86,1.,fract(vUvX.y)); dc = mix(vec3(.018,.075,.10), vec3(.06,.22,.24), smoothstep(.1,.8,tl)) * (.75+.4*vn(vUvX*vec2(3.,9.))) ; dc = mix(dc, vec3(.01,.03,.04), rw*.7); dc = mix(dc, vec3(.8,.85,.92), uSnow*smoothstep(.2,.5,normalize(vNw).y));', vary: 'varying vec3 vNw;', vert: 'vNw = normalize(mat3(modelMatrix)*normal);', key: 'tile' });
  const redM = X.redM = X.mat({ rough: .55, color: 'dc = mix(vec3(.28,.035,.018), vec3(.46,.075,.035), vn(vWP.xy*vec2(9.,1.2)+vWP.z*9.));', key: 'red' });
  const stoneM = X.stoneM = X.mat({ rough: .9, color: 'float n=fbm(vWP.xz*1.7+vWP.y*1.3); dc = mix(vec3(.16,.155,.14), vec3(.42,.40,.35), n); dc = mix(dc, vec3(.05,.14,.08), smoothstep(.55,.75,fbm(vWP.xz*.9+4.))*.6); dc = mix(dc, vec3(.8,.85,.92), uSnow*smoothstep(.5,.8,normalize(vNw).y));', vary: 'varying vec3 vNw;', vert: 'vNw = normalize(mat3(modelMatrix)*normal);', key: 'stone' });
  const goldM = X.goldM = X.mat({ rough: .28, metal: .9, c: 0xd8a24a, key: 'gold', emis: 'em = vec3(.16,.09,.02);' });
  const glowM = X.glowM = X.mat({ c: 0x331a08, emis: 'em = vec3(2.6,1.25,.36)*uLampG;', decl: 'uniform float uLampG;', u: { uLampG: X.uLamp = U(1) }, key: 'glow', fog: 1 });
  X.pavilion = (n = 6, R0 = 3.2, two = false) => { const gr = new THREE.Group(), add = (g, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(g, m); k.position.set(x, y, z); k.castShadow = k.receiveShadow = true; gr.add(k); return k; };
    add(new THREE.CylinderGeometry(R0 * 1.0, R0 * 1.08, .5, n * 4), stoneM, 0, .25); add(new THREE.CylinderGeometry(R0 * .9, R0 * .94, .22, n * 4), stoneM, 0, .6);
    for (let i = 0; i < n; i++) { const a = i / n * X.TAU, c = Math.cos(a) * R0 * .72, s = Math.sin(a) * R0 * .72; add(new THREE.CylinderGeometry(.11, .13, 2.7, 12), redM, c, 2.0, s); add(new THREE.CylinderGeometry(.2, .22, .16, 12), stoneM, c, .76, s);
      const a2 = (i + .5) / n * X.TAU, rl = R0 * .72 * Math.cos(Math.PI / n), len = 2 * R0 * .72 * Math.sin(Math.PI / n); for (const [yy, hh] of [[3.2, .22], [2.92, .10], [1.25, .07], [.98, .05]]) { if (yy < 2 && i === 0) continue; const b = add(new THREE.BoxGeometry(len, hh, .09), redM, Math.cos(a2) * rl, yy, Math.sin(a2) * rl); b.rotation.y = -a2 + Math.PI / 2; } }
    add(roof(n, R0 * 1.12, 1.9, .55), tileM, 0, 3.25); add(new THREE.ConeGeometry(R0 * 1.05, .35, n * 4, 1, true).rotateX(Math.PI), redM, 0, 3.28);
    if (two) { add(new THREE.CylinderGeometry(R0 * .46, R0 * .5, .9, n * 4), redM, 0, 4.6); add(roof(n, R0 * .74, 1.7, .42), tileM, 0, 5.0); }
    const ty = two ? 6.6 : 5.1; add(new THREE.LatheGeometry([[0, 0], [.16, 0], [.10, .12], [.2, .26], [.22, .36], [.1, .5], [.05, .62], [0, .85]].map(p => new THREE.Vector2(...p)), 16), goldM, 0, ty);
    for (let i = 0; i < n; i++) { const a = i / n * X.TAU; add(new THREE.SphereGeometry(.14, 12, 10).scale(1, 1.2, 1), glowM, Math.cos(a) * R0 * 1.02, 3.0, Math.sin(a) * R0 * 1.02); }
    return gr; };
  L.pavs = [];
  for (const [key, t] of [...towers].filter(([k, t]) => M.hash(k, 5) > .80 && Math.abs(t.x - cor(t.z)) < 330 && Math.abs(t.z) < S * .46 && t.h > 70).slice(0, 14)) { const p = X.pavilion(6, 3.2, M.hash(key, 9) > .5); let bx = t.x, bz = t.z, bh = -1; for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const h = H(t.x + i * 4, t.z + j * 4); if (h > bh) { bh = h; bx = t.x + i * 4; bz = t.z + j * 4; } } p.position.set(bx, bh - .8, bz); p.scale.setScalar(2.1); p.rotation.y = M.hash(key, 3) * 6; sc.add(p); L.pavs.push(p); }
  // 河
  const water = new THREE.Mesh(new THREE.PlaneGeometry(S * 1.4, S * 1.4).rotateX(-Math.PI / 2), X.smat({ fs: `uniform float uWineR; varying vec2 vUv; varying vec3 vWP; void main(){ vec3 V = normalize(vWP-cameraPosition); vec2 p = vWP.xz; float a = fbm(p*.09+vec2(uT*.12,-uT*.07)), b = fbm(p*.31-vec2(uT*.2,uT*.12)); vec3 n = normalize(vec3((a-.5)*.16+(b-.5)*.1,1.,(b-.5)*.16)); vec3 r = reflect(V,n); r.y=abs(r.y); vec3 c = mix(vec3(.012,.10,.11), skyBase(r), .12+.75*pow(1.-max(dot(-V,n),0.),4.)); c += uSunCol*pow(max(dot(r,uSunDir),0.),180.)*3.; float wl = abs(fract(a*7.+b*1.5)-.5); c += vec3(.9,.62,.24)*smoothstep(.045,.0,wl)*.22*uGold*(.3+uSunCol.r*.4)*smoothstep(500.,40.,length(vWP-cameraPosition)); c = mix(c, vec3(.95,.40,.07)*(.45+.75*a)+vec3(1.6,.95,.3)*pow(1.-abs(2.*vn(p*.16+vec2(a,b)*2.5-vec2(0.,uT*.9))-1.),5.)*.8+skyBase(r)*.12, uWineR); c += ringGold(vWP); gl_FragColor = vec4(aerial(c,vWP),1.); }` }));
  water.position.y = 1.2; sc.add(water); L.water = water;
});
