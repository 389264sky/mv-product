// jz_trees.js —— 春天（bar57 以后）的树换成真的网格（用户 2026-11-18：着色器里一团团的不真实、不清楚，要重画）。
// 桃树：短树干，三四根主枝斜着往外长，侧枝、细枝，枝上一朵朵花（开之前是花苞）；针叶树：一层层往下垂的枝，枝上一排排针叶。
// 摆在湖着色器色块树（jz_land.js 的 fir()）同样的格子、同样的哈希上：在哪、多高、哪棵是桃树都一样。
// 先画进几何缓冲（离镜头多远、法线、哪棵树、什么材质），jz_lake.js 的着色器读它，按原来那套光照、开花时刻、发光、雾着色；倒影里还是色块树。
(() => {
const JZ = window.JZ, T = JZ.trees = { off: new URLSearchParams(location.search).get('trees') === '0' };
let THREE, sc, list, bk, frus, ball, mvp;
const MP = 0, MF = 1, MB = 2, MN = 3, TH = 5, NV = 6, NEAR = 45, FAR = 262;   // 材质：桃树枝干、桃花、针叶树干、针叶；最高的树多高（同 jz_land.js）；每种树几个样子；细的那版画到多远；最远画到多远（同 treeFade）
const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
const add3 = (a, b, k = 1) => a.map((v, i) => v + b[i] * k), nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const h3 = (x, y, z) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; y = (Math.imul(y, 1664525) + 1013904223) >>> 0; z = (Math.imul(z, 1664525) + 1013904223) >>> 0;   // 同 JZ.GLSL 的 h3
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0; x = (x ^ (x >>> 16)) >>> 0; y = (y ^ (y >>> 16)) >>> 0; z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0; return (x ^ y ^ z) >>> 0; };

// ---------- 网格零件 ----------
const Geo = () => ({ p: [], n: [], uv: [], m: [], c: [], ix: [] });   // m：材质、暗（外 0 → 里 1）、种子 / 沿枝几成；c：花卡片多大（正对镜头画，别的是 0）
const tube = (G, pts, r0, r1, sides, mat) => {   // 沿 pts 的圆管，半径 r0 → r1
  const b = G.p.length / 3, n = pts.length;
  for (let i = 0; i < n; i++) {
    const d = nrm(add3(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)], -1)), a = nrm(cross(d, Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])), c = cross(a, d), r = r0 + (r1 - r0) * i / (n - 1);
    for (let j = 0; j <= sides; j++) { const q = j / sides * 6.2832, nn = add3(a.map(v => v * Math.cos(q)), c, Math.sin(q)); G.p.push(...add3(pts[i], nn, r)); G.n.push(...nn); G.uv.push(j / sides, i / (n - 1)); G.m.push(mat, 0, 0); G.c.push(0); }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) { const a = b + i * (sides + 1) + j, c = a + sides + 1; G.ix.push(a, c, a + 1, a + 1, c, c + 1); }
};
const card = (G, c, sz, k, nn, x) => {   // 一张花卡片：中心 c、半边长 sz，顶点着色器里转成正对镜头；uv 从 -k 到 k（k×k 朵花），法线 nn 朝树冠外
  const b = G.p.length / 3;
  for (const [s, t] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { G.p.push(...c); G.n.push(...nn); G.c.push(sz); G.uv.push(s * k, t * k); G.m.push(MF, 0, x + (k > 1 ? 2 : 0)); }   // m.z 大于 1：一张卡片好几朵
  G.ix.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
};
const ribbon = (G, pts, side, nn) => {   // 沿一根枝的针叶带：uv.x 沿枝多少米、uv.y 横着 -1..1；m.z 沿枝走了几成
  const b = G.p.length / 3, n = pts.length; let L = 0;
  for (let i = 0; i < n; i++) {
    if (i) L += Math.hypot(...add3(pts[i], pts[i - 1], -1));
    for (const k of [-1, 1]) { G.p.push(...add3(pts[i], side(i), k)); G.n.push(...nn); G.uv.push(L, k); G.m.push(MN, 0, i / (n - 1)); G.c.push(0); }
  }
  for (let i = 0; i < n - 1; i++) { const a = b + 2 * i; G.ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
};
const bough = (rnd, p0, d0, L, bend, n) => {   // 一根枝：从 p0 朝 d0 长 L，一路往 bend 弯，带一点乱
  const pts = [p0]; let p = p0, d = d0;
  for (let i = 1; i <= n; i++) { d = nrm(add3(add3(d, bend, 1 / n), [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], 0.15)); p = add3(p, d, L / n); pts.push(p); }
  return pts;
};
const along = (pts, s) => { const f = s * (pts.length - 1), i = Math.min(Math.floor(f), pts.length - 2); return add3(pts[i], add3(pts[i + 1], pts[i], -1), f - i); };
const dirAt = (pts, s) => { const i = Math.min(Math.floor(s * (pts.length - 1)), pts.length - 2); return nrm(add3(pts[i + 1], pts[i], -1)); };
const sph = (az, el) => [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
const finish = (G, ao, H) => {   // 每个点里外多暗；整体缩到 1 个单位高；userData.r：树冠横着多宽（单位）
  for (let i = 0; i < G.p.length / 3; i++) { G.m[i * 3 + 1] = ao(G.p.slice(i * 3, i * 3 + 3), G.m[i * 3]); for (let k = 0; k < 3; k++) G.p[i * 3 + k] /= H; G.c[i] /= H; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); g.setAttribute('aM', new THREE.Float32BufferAttribute(G.m, 3)); g.setAttribute('aC', new THREE.Float32BufferAttribute(G.c, 1)); g.setIndex(G.ix);
  let r = 0; for (let i = 0; i < G.p.length; i += 3) r = Math.max(r, Math.hypot(G.p[i], G.p[i + 2])); g.userData.r = r * 0.85; return g;
};

// 桃树（参考高 3.2 米，树冠约 2.8 米宽；lod 1 是远处的简版：枝少、一张卡片 2×2 朵花）
const peachGeo = (rnd, lod) => {
  const G = Geo(), R1 = () => rnd() * 2 - 1, fl = [], H = 3.2;
  const tk = bough(rnd, [0, -0.1, 0], nrm([R1() * 0.12, 1, R1() * 0.12]), 0.75 + 0.3 * rnd(), [0, 0, 0], 3); tube(G, tk, 0.10, 0.075, lod ? 4 : 7, MP);
  const top = tk[tk.length - 1], nL = 3 + (rnd() < 0.45 ? 1 : 0), a0 = rnd() * 6.2832;
  for (let i = 0; i < nL; i++) {
    const az = a0 + i * 6.2832 / nL + R1() * 0.35, el = (24 + 14 * rnd()) * Math.PI / 180, limb = bough(rnd, top, sph(az, el), 1.25 + 0.4 * rnd(), [0, 0.2, 0], 5);   // 开心形：主枝斜着往外伸
    tube(G, limb, 0.065, 0.03, lod ? 3 : 6, MP);
    if (!lod) for (let k = 0; k < 4; k++) { const s = 0.3 + 0.65 * (k + rnd()) / 4, sp = bough(rnd, along(limb, s), nrm(add3(dirAt(limb, s), [R1(), 0.8 + 0.5 * rnd(), R1()])), 0.15 + 0.15 * rnd(), [0, 0.2, 0], 2); tube(G, sp, 0.008, 0.004, 3, MP); for (let u = 0.3; u <= 1.0; u += 0.35) fl.push([along(sp, u), 0.09]); }   // 主枝上的短果枝：树冠里面也有花
    const nS = lod ? 4 : 4 + Math.floor(rnd() * 2);
    for (let j = 0; j < nS; j++) {
      const s = 0.25 + 0.75 * (j + rnd() * 0.6) / nS, sec = bough(rnd, along(limb, s), sph(az + R1() * 1.2, el + (-5 + 35 * rnd()) * Math.PI / 180), 0.5 + 0.45 * rnd(), [0, 0.3, 0], 4);
      tube(G, sec, lod ? 0.03 : 0.024, 0.01, lod ? 3 : 4, MP);
      if (lod) { for (let k = 0.15; k <= 1.0; k += 0.14) fl.push([add3(along(sec, k), [R1(), R1(), R1()], 0.1), 0.2]); continue; }
      const nT = 7 + Math.floor(rnd() * 4);
      for (let k = 0; k < nT; k++) {
        const s2 = 0.15 + 0.85 * (k + rnd()) / nT, tw = bough(rnd, along(sec, s2), nrm(add3(dirAt(sec, s2), [R1() * 0.9, 0.5 + 0.6 * rnd(), R1() * 0.9])), 0.15 + 0.2 * rnd(), [0, 0.2, 0], 2);
        tube(G, tw, 0.007, 0.0035, 3, MP);
        for (let u = 0.2; u <= 1.0; u += 0.3 + 0.15 * rnd()) fl.push([add3(along(tw, u), [R1(), R1(), R1()], 0.02), 0.09]);   // 一张卡片一簇：3×3 朵、半边 9 厘米
      }
      for (let u = 0.3; u <= 1.0; u += 0.14) fl.push([add3(along(sec, u), [R1(), R1(), R1()], 0.04), 0.09]);
    }
  }
  const cc = fl.reduce((a, f) => add3(a, f[0], 1 / fl.length), [0, 0, 0]), cr = Math.max(...fl.map(f => Math.hypot(...add3(f[0], cc, -1))));
  for (const [c, s] of fl) {   // 花朝四面八方，着色用的法线偏向树冠外面（一团树冠有体积）
    const o = nrm(add3(add3(c, cc, -1), [0, 0.25 * cr, 0]));
    card(G, c, s, 3, nrm(add3(o, [R1(), R1(), R1()], 0.4)), rnd());   // 近处 2×2 朵（每朵约 3 厘米），远处 3×3
  }
  return finish(G, (p, m) => Math.min(1, Math.max(0, 1 - Math.hypot(...add3(p, cc, -1)) / cr)) * (m === MF ? 0.9 : 0.6), H);
};
// 针叶树（参考高 4.5 米，底下最宽约 2 米）：一层层枝往外平伸、梢头往下垂，每根枝一平一斜两片针叶带
const firGeo = (rnd, lod) => {
  const G = Geo(), R1 = () => rnd() * 2 - 1, H = 4.5, R0 = 0.95, nw = lod ? 7 : 16, nb = lod ? 5 : 7, n = lod ? 2 : 4;
  tube(G, [[0, -0.1, 0], [0, H * 0.5, 0], [0, H, 0]], 0.09, 0.012, lod ? 4 : 6, MB);
  for (let w = 0; w < nw; w++) {
    const y = H * (0.1 + 0.86 * Math.pow(w / (nw - 1), 0.9)), f = 1 - y / H, a0 = w * 2.4 + rnd();
    for (let b = 0; b < nb; b++) {
      const az = a0 + b * 6.2832 / nb + R1() * 0.25, L = (0.12 + R0 * Math.pow(f, 0.95)) * (0.85 + 0.3 * rnd()) * (lod ? 1.1 : 1), o = [Math.cos(az), 0, Math.sin(az)], sd = [-o[2], 0, o[0]], pts = [];
      for (let i = 0; i <= n; i++) { const s = i / n; pts.push([o[0] * L * s, y + L * (0.08 * s - 0.3 * s * s), o[2] * L * s]); }   // 先平着伸出去，梢头往下垂
      const wd = (i) => 0.4 * L * (1 - 0.55 * i / n) + 0.03, nn = nrm(add3(o, [0, 0.7, 0]));
      ribbon(G, pts, (i) => sd.map(v => v * wd(i)), nn);
      ribbon(G, pts, (i) => nrm(add3(sd, [0, 1, 0], 2.2)).map(v => v * wd(i) * 0.7), nn);
    }
  }
  return finish(G, (p) => Math.min(1, 0.75 * (1 - Math.min(1, Math.hypot(p[0], p[2]) / (0.15 + R0 * Math.max(0, 1 - p[1] / H)))) + 0.3 * (1 - p[1] / H)), H);
};

// ---------- 摆在哪：和色块树一样的两层格子 ----------
const readLand = () => {   // 高度图读回来（1024²，算林带、哪棵是桃树用；树根高度在着色器里照原图取）
  const N = 1024, rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType, depthBuffer: false }), s = new THREE.Scene();
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uLand: { value: JZ.land() } },
    vertexShader: `varying vec2 vU; void main() { vU = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform highp sampler2D uLand; varying vec2 vU; void main() { gl_FragColor = textureLod(uLand, vU, 0.0); }` }));
  q.frustumCulled = false; s.add(q); JZ.R.setRenderTarget(rt); JZ.R.render(s, new THREE.Camera());
  const a = new Float32Array(N * N * 4); JZ.R.readRenderTargetPixels(rt, 0, 0, N, N, a); JZ.R.setRenderTarget(null); rt.dispose();
  return (x, z) => { const u = Math.min(N - 1, Math.max(0, Math.round((x / 800 + 0.5) * N - 0.5))), v = Math.min(N - 1, Math.max(0, Math.round((z / 800 + 0.5) * N - 0.5))), i = (v * N + u) * 4; return [a[i], a[i + 1], a[i + 2], a[i + 3]]; };
};
const enumerate = (peach) => {   // [x, z, 高, 树冠半径, 格子编码, 底高, 转角, 种子, 桃树?]
  const land = readLand(), out = [];
  for (const g of [1, 2]) for (let i = -300; i <= 300; i++) for (let j = -300; j <= 300; j++) {
    const h = h3((i + 8192) >>> 0, (j + 8192) >>> 0, g), r = [(h & 1023) / 1023, ((h >>> 10) & 1023) / 1023, ((h >>> 20) & 1023) / 1023];
    if (r[2] < 0.18) continue;
    const w = [i + 0.5 + (r[0] - 0.5) * 0.34, j + 0.5 + (r[1] - 0.5) * 0.34], u = (w[0] - 7.3) / 0.5, v = (w[1] - 7.3) / 0.5;
    const x = g === 1 ? w[0] / 0.42 : 0.8 * u - 0.6 * v, z = g === 1 ? w[1] / 0.42 : 0.6 * u + 0.8 * v;
    if (Math.max(Math.abs(x), Math.abs(z)) > 396) continue;
    const L = land(x, z), fo = (1 - sm(30, 46, L[0] + 20 * (L[3] - 0.5))) * sm(0.15, 0.8, L[0]) * (1 - sm(0.8, 1.3, Math.hypot(L[1], L[2])));
    if (fo < 0.01) continue;
    const pk = peach * (1 - sm(14, 26, L[0])), isP = pk > 0 && ((r[1] * 7.13 + r[0] * 3.7) % 1) < pk, h2 = h3((i + 8192) >>> 0, (j + 8192) >>> 0, g + 10);
    const Hm = TH * fo * (isP ? 0.42 + 0.3 * r[0] : 0.4 + 0.6 * r[0]), cw = (g === 1 ? 1 : 0.84) * (0.88 + 0.24 * (h2 & 255) / 255);   // 宽：照色块树（第二层格子密一点、树小一点）
    const Wm = (isP ? 1.45 : 0.8) * cw * Math.sqrt(Math.min(1, Hm / (isP ? 2.2 : 3.0)));   // 树冠半径（米）
    out.push([x, z, Hm, Wm, (g - 1) * 1048576 + (i + 512) * 1024 + (j + 512), L[0], ((h2 >>> 8) & 1023) / 1023 * 6.2832, ((h2 >>> 18) & 1023) / 1024, isP ? 1 : 0]);
  }
  return out;
};

const VS = `attribute vec3 aM; attribute float aC; attribute vec4 iA, iB;   // aM：材质、暗、种子 / 沿枝几成；iA：树干 xz、高（米）、宽（米 / 单位）；iB：格子编码、转角、种子
uniform highp sampler2D uLand; uniform float uT, uBV, uBR, uMir; uniform vec4 uBP[24], uRing; uniform vec3 uCamP;
varying vec3 vW, vN; varying vec2 vUv; varying float vX, vAO, vK; flat varying float vMat, vCode;
float bloomT(vec2 c) {   // 同 jz_lake.js
  float tb = 1e5;
  for (int i = 0; i < 24; i++) { vec4 b = uBP[i]; if (b.z > 9e4) break; float d = max(distance(c, b.xy) - b.w, 0.0); if (d < uBR) tb = min(tb, b.z + d / uBV); }
  if (uRing.w > 0.0) tb = min(tb, uRing.z + length(c - uRing.xy) / uRing.w);
  return tb + 0.3 * h01(uvec3(ivec3(ivec2(c * 7.0) + 512, 77)));
}
void main() {
  vec3 b = vec3(iA.x, textureLod(uLand, iA.xy / 800.0 + 0.5, 0.0).r - 0.03, iA.y);
  float fd = 1.0 - smoothstep(140.0, 260.0, distance(b, uCamP)), H = iA.z * fd, W = iA.w * sqrt(fd), c = cos(iB.y), s = sin(iB.y);   // 远了照原来的样子变矮（treeFade）
  vec3 p = position * vec3(W, H, W), n = normal / vec3(W, H, W); p.xz = mat2(c, s, -s, c) * p.xz; n.xz = mat2(c, s, -s, c) * n.xz;
  vec3 c0 = b + p; if (uMir > 0.5) { c0.y = -c0.y; n.y = -n.y; }   // 倒影那遍：整棵树沿水面翻下去
  vW = c0 + (vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]) * sign(uv.x) + vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]) * sign(uv.y)) * aC * H;   // 花卡片正对镜头
  vN = normalize(n); vUv = uv; vX = aM.z; vAO = aM.y; vMat = aM.x; vCode = iB.x;
  vK = aM.x == 1.0 ? smoothstep(0.0, 0.6, uT - bloomT(iA.xy) - 0.35 * aM.z) : 0.0;   // 这朵花开了几成（一棵树上的花前后差一点开）
  gl_Position = H < 0.05 ? vec4(0.0, 0.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`;
const FS = `uniform vec3 uCamP; varying vec3 vW, vN; varying vec2 vUv; varying float vX, vAO, vK; flat varying float vMat, vCode;
float oct(vec3 n) { n /= abs(n.x) + abs(n.y) + abs(n.z); vec2 o = n.y >= 0.0 ? n.xz : (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0); vec2 q = floor((o * 0.5 + 0.5) * 4095.0 + 0.5); return q.x * 4096.0 + q.y; }
void main() {
  float x = 0.0; int m = int(vMat + 0.5);
  if (m == 1) {   // 桃花：五瓣，没开时只是一个小花苞；远处的卡片 2×2 朵，花比一个像素还小时画成一团圆的
    vec2 cl = floor((vUv + 1.0) * 0.5), q = mod(vUv + 1.0, 2.0) - 1.0; float h = h01(uvec3(ivec3(ivec2(cl) + 64, int(fract(vX) * 4096.0)))), rc = length(vUv) / 3.0;
    q += (vec2(h, fract(h * 7.3)) - 0.5) * 0.3;
    float R = mix(0.3, 0.95, vK) * (0.85 + 0.15 * h), r = length(q), th = atan(q.y, q.x) + 6.2832 * h, e = R * (0.62 + 0.38 * pow(abs(cos(2.5 * th)), 0.6)), far = smoothstep(0.25, 0.6, fwidth(r));
    if (h < mix(0.6, 0.22, smoothstep(0.0, 0.3, vK)) || (far < 0.5 ? (r > e || rc > 0.95) : rc > mix(0.2, 0.9, vK) * (0.8 + 0.2 * h))) discard;   // 没开时只剩稀稀的几个小花苞   // 近：一朵朵（一簇里缺几朵）；花比两三个像素还小：整簇画成一团
    x = far < 0.5 ? r / e : 0.6;
  } else if (m == 3) {   // 针叶：中间一根细枝，两边一排排斜着的针；远了针比像素细就画成一整片
    float v = abs(vUv.y), k = fract(vUv.x * 60.0 + v * 1.1), aa = fwidth(vUv.x * 60.0), h = h01(uvec3(uint(floor(vUv.x * 60.0 + v * 1.1) + 4096.0), 3u, uint(vX * 64.0)));
    if (v > (0.98 - 0.25 * vX) * mix(0.6 + 0.4 * h, 0.85, smoothstep(0.4, 0.9, aa)) || (v > 0.06 && k > mix(0.45, 1.0, smoothstep(0.4, 0.9, aa)))) discard;   // 针有长有短，边是毛的
    x = vX;
  }
  gl_FragColor = vec4(distance(vW, uCamP), oct(normalize(vN)), vCode + vMat * 2097152.0, floor(vAO * 255.0) * 256.0 + floor(x * 255.0));
}`;

T.build = (M, lu) => {   // lu：湖着色器的 uniforms（开花时刻那几个共用）
  THREE = JZ.THREE; sc = new THREE.Scene(); frus = new THREE.Frustum(); ball = new THREE.Sphere(); mvp = new THREE.Matrix4();
  list = enumerate(0.55);   // 桃树占几成：jz_spring.js 天光的 peach（整段 0.55）
  T.rt = new THREE.WebGLRenderTarget(JZ.GL.width, JZ.GL.height, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  T.tex = T.rt.texture;
  T.rtM = new THREE.WebGLRenderTarget(JZ.GL.width / 2, JZ.GL.height / 2, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); T.texM = T.rtM.texture;   // 倒影：半分辨率（被浪打糊，够了）
  const mat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: JZ.GLSL + VS, fragmentShader: JZ.GLSL + FS,
    uniforms: { uNoise: { value: JZ.noise }, uLand: { value: JZ.land() }, uCamP: { value: new THREE.Vector3() }, uMir: { value: 0 }, uT: lu.uT, uBV: lu.uBV, uBR: lu.uBR, uBP: lu.uBP, uRing: lu.uRing } });
  T.mat = mat; bk = [];
  for (const sp of [0, 1]) for (const lod of [0, 1]) for (let v = 0; v < NV; v++) {   // 每种树、每个远近、每个样子一组实例
    const rnd = M.rng(7001 + sp * 100 + v), base = sp ? peachGeo(rnd, lod) : firGeo(rnd, lod), cap = list.filter(t => t[8] === sp && Math.floor(t[7] * NV) === v).length || 1;
    const g = new THREE.InstancedBufferGeometry(); for (const k of ['position', 'normal', 'uv', 'aM', 'aC']) g.setAttribute(k, base.getAttribute(k)); g.setIndex(base.getIndex());
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), iB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    iA.setUsage(THREE.DynamicDrawUsage); iB.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iA', iA); g.setAttribute('iB', iB); g.instanceCount = 0;
    const me = new THREE.Mesh(g, mat); me.frustumCulled = false; sc.add(me); bk.push({ sp, lod, v, g, iA, iB, n: 0, r: base.userData.r });
  }
  T.list = list; T.count = list.length; T.tris = bk.map(b => b.g.index.count / 3);
};
// 每帧：挑出镜头看得到、260 米以内的树，近的画细版，画进几何缓冲；再把整片树沿水面翻下去画一遍（倒影，都用简版）
const fill = (cp, mir) => {
  for (const b of bk) b.n = 0;
  for (const t of list) {
    const d = Math.hypot(t[0] - cp.x, t[5] - cp.y, t[1] - cp.z); if (d > FAR) continue;
    ball.center.set(t[0], (t[5] + t[2] * 0.5) * (mir ? -1 : 1), t[1]); ball.radius = t[2] * 0.6 + t[3] + 1; if (!frus.intersectsSphere(ball)) continue;
    const b = bk[(t[8] * 2 + (d < NEAR && !mir ? 0 : 1)) * NV + Math.floor(t[7] * NV)], k = b.n++ * 4;
    b.iA.array[k] = t[0]; b.iA.array[k + 1] = t[1]; b.iA.array[k + 2] = t[2]; b.iA.array[k + 3] = t[3] / b.r;
    b.iB.array[k] = t[4]; b.iB.array[k + 1] = t[6]; b.iB.array[k + 2] = t[7]; b.iB.array[k + 3] = 0;
  }
  for (const b of bk) { b.g.instanceCount = b.n; b.iA.needsUpdate = b.iB.needsUpdate = true; }
};
T.draw = (cam) => {
  const R = JZ.R, cp = cam.position; mvp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); frus.setFromProjectionMatrix(mvp);
  T.mat.uniforms.uCamP.value.copy(cp);
  const cc = R.getClearColor(new THREE.Color()), ca = R.getClearAlpha(), rt0 = R.getRenderTarget(); R.setClearColor(0x000000, 0);
  for (const [rt, mir] of [[T.rt, 0], [T.rtM, 1]]) { fill(cp, mir); T.mat.uniforms.uMir.value = mir; R.setRenderTarget(rt); R.clear(); R.render(sc, cam); }
  R.setRenderTarget(rt0); R.setClearColor(cc, ca);
};
})();
