// jz_paper.js —— 剪纸层：每层一张竖着的面片，着色器里按世界坐标剪出剪影（山脊、松、桃树、草、祥云），镂空花窗、背光亮边、纸纹、层底的雾、身后一道柔影。
// 层的参数按「参考镜头」的画面比例给（D 米外、画面高度的几成），换算成世界坐标，大小场景一套写法。画面只由时间决定。
(() => {
const JZ = window.JZ, P = JZ.paper = {};
const V3 = (a) => new JZ.THREE.Vector3(...a);
// 3D 版的地形（从 jz_spring.js 搬来）：landH(x, z) 米。尾声航线的山脊剖面从这里取（out/tmp/landh.cjs 也读这一段）
// --- landH 开始
const h3 = (x, y, z) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; y = (Math.imul(y, 1664525) + 1013904223) >>> 0; z = (Math.imul(z, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0; x = (x ^ (x >>> 16)) >>> 0; y = (y ^ (y >>> 16)) >>> 0; z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0; y = (y + Math.imul(z, x)) >>> 0; z = (z + Math.imul(x, y)) >>> 0; return (x ^ y ^ z) >>> 0; };
const hh = (ix, iy) => (h3((ix + 32768) >>> 0, (iy + 32768) >>> 0, 7) >>> 8) / 16777216;
const landH = (x, z) => {
  let px = x / 95 + 3.1, py = z / 95 + 7.7, dx = 0, dz = 0, a = 0, b = 1;
  for (let i = 0; i < 11; i++) {
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy, ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10), dux = 30 * fx * fx * (fx * (fx - 2) + 1), duy = 30 * fy * fy * (fy * (fy - 2) + 1);
    const A = hh(ix, iy), Bv = hh(ix + 1, iy), C = hh(ix, iy + 1), D = hh(ix + 1, iy + 1);
    dx += dux * ((Bv - A) + (A - Bv - C + D) * uy); dz += duy * ((C - A) + (A - Bv - C + D) * ux); a += b * (A + (Bv - A) * ux + (C - A) * uy + (A - Bv - C + D) * ux * uy) / (1 + dx * dx + dz * dz); b *= 0.5;
    const nx = (0.8 * px + 0.6 * py) * 2, ny = (-0.6 * px + 0.8 * py) * 2; px = nx; py = ny;
  }
  const r = Math.hypot(x, z), s = Math.min(1, Math.max(0, (r - 28) / 142)), sm = s * s * (3 - 2 * s);
  return -3 + sm * 110 * Math.pow(a, 1.3);
};
// --- landH 结束
P.landH = landH;

const COMMON = `
varying vec3 vW;
uniform float uT, uSeed;
float hs(float c, uint k) { return h01(uvec3(uint(int(c) + 1000000), uint(uSeed * 977.0), k)); }
`;
const VS = `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

// 一层剪影。uP = (山脊基线 y, 起伏, 频率（1/米）, 镂空格子大小)；uD = (装饰种类, 间距, 高（倍间距）, 密度)
// 装饰：0 无，1 松，2 开花的树，3 草、芽，4 祥云带（uBand：带子多厚）
const LAYER_F = JZ.GLSL + COMMON + `
uniform vec3 uCol, uFog, uRim, uAcc, uAcc2; uniform vec4 uP, uD; uniform float uFogH, uSh, uLit, uBand, uSoft, uBloom; uniform vec2 uShO;
float ridgeH(float x) {
  float f = uP.z, n = fbm(vec3(x * f, uSeed * 7.1, 0.5), 5), r = 1.0 - abs(2.0 * fbm(vec3(x * f * 0.6 + 3.1, uSeed * 3.3, 1.5), 4) - 1.0);
  return uP.x + uP.y * ((n - 0.2) * 1.3 + 0.45 * r) + uP.y * 0.012 * abs(fract(x * f * 41.0) - 0.5);   // 末一项：剪刀剪出的小锯齿
}
vec3 deco = vec3(0.0);   // 装饰自己的颜色（花），x 是多少
float trees(vec2 p) {
  float s = uD.y, i = floor(p.x / s), d = -1e3;
  for (int k = -2; k <= 2; k++) {
    float c = i + float(k); if (hs(c, 5u) > uD.w) continue;
    float tx = (c + 0.15 + 0.7 * hs(c, 1u)) * s, by = ridgeH(tx) - 0.2 * s, h = s * uD.z * (0.6 + 0.8 * hs(c, 2u)), r = (p.y - by) / h;
    if (uD.x < 1.5) {   // 松：一层层的伞
      if (r < 0.0 || r > 1.0) continue;
      float tier = fract(r * 4.5 + hs(c, 3u)); d = max(d, s * (0.36 * (1.0 - r) * (0.55 + 0.45 * (1.0 - tier)) + 0.012) - abs(p.x - tx));
    } else if (uD.x < 2.5) {   // 开花的树：歪一点的干，几团圆冠，冠上一朵朵五瓣花
      float lean = (hs(c, 4u) - 0.5) * 0.5;
      if (r > -0.05 && r < 0.62) d = max(d, s * 0.035 * (1.0 - 0.5 * r) - abs(p.x - tx - lean * r * h));
      for (int j = 0; j < 4; j++) { float a = 6.283 * hs(c, uint(10 + j)), rr = s * (0.26 + 0.14 * hs(c, uint(20 + j)));
        vec2 cc = vec2(tx + lean * 0.62 * h + cos(a) * s * 0.22, by + h * 0.68 + sin(a) * s * 0.14); d = max(d, rr - length(p - cc)); }
    } else {   // 草、芽：弯的叶片
      for (int j = 0; j < 3; j++) { float bx = tx + (float(j) - 1.0) * s * 0.18, hh = h * (0.5 + 0.6 * hs(c, uint(30 + j))), rj = (p.y - by) / hh, bend = (hs(c, uint(40 + j)) - 0.5) * 0.8;
        if (rj < 0.0 || rj > 1.0) continue; d = max(d, s * 0.06 * (1.0 - rj) * (0.4 + rj) * 2.0 - abs(p.x - bx - bend * hh * rj * rj)); }
    }
  }
  return d;
}
float flowers(vec2 p) {   // 冠里的花：一格一朵，五瓣
  float q = uD.y * 0.085; vec2 g = floor(p / q), l = p / q - g - 0.5; float h = h01(uvec3(uvec2(ivec2(g) + 100000), 9u));
  if (h > 0.62) return 0.0; l -= (vec2(h01(uvec3(uvec2(ivec2(g) + 100000), 11u)), h) - 0.5) * 0.3;
  float a = atan(l.y, l.x), r = length(l), fr = 0.42 * (0.72 + 0.28 * cos(5.0 * a + h * 6.0)) * (0.7 + 0.4 * h);
  return r < 0.08 ? 2.0 : (r < fr ? 1.0 : 0.0);
}
float body(vec2 p, out float below) {
  float h = ridgeH(p.x); below = h - p.y;
  if (uD.x > 3.5) {   // 祥云带：上沿一串圆鼓包，下沿浅一点的鼓包
    float s = uD.y, u = 2.0 * fract(p.x / s) - 1.0, top = h + (0.3 + 0.4 * hs(floor(p.x / s), 6u)) * s * sqrt(max(1.0 - u * u, 0.0)), u2 = 2.0 * fract(p.x / s * 1.7 + 0.5) - 1.0, bot = h - uBand - 0.2 * s * sqrt(max(1.0 - u2 * u2, 0.0));
    below = top - p.y; return min(top - p.y, p.y - bot);
  }
  float d = below; if (uD.x > 0.5) d = max(d, trees(p));
  if (uP.w > 0.0 && below > 0.6 * uP.w) {   // 镂空：山脊下面一排花窗（四瓣花孔），再下面一排小圆孔
    float c = uP.w, cx = (floor(p.x / c) + 0.5) * c, cy = ridgeH(cx) - 1.8 * c; vec2 l = (p - vec2(cx, cy)) / c;
    float a = atan(l.y, l.x), hole = 0.3 * (0.75 + 0.25 * cos(4.0 * a)) - length(l);
    vec2 l2 = (p - vec2(cx + 0.5 * c, ridgeH(cx + 0.5 * c) - 3.0 * c)) / c; hole = max(hole, 0.1 - length(l2));
    d = min(d, -hole * c);
  }
  return d;
}
void main() {
  vec2 p = vW.xy + uShO * uSh; float below, d = body(p, below), px = length(fwidth(vW.xy));
  if (uSh > 0.5) { float a = smoothstep(-uSoft, uSoft * 0.5, d) * 0.5; if (a < 0.004) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); return; }
  if (d < 0.0) discard;
  vec3 c = mix(uCol, uFog, smoothstep(0.0, uFogH, below));
  if (uD.x > 1.5 && uD.x < 2.5 && below < 0.0) { float f = flowers(p); if (f > 1.5) c = uAcc2; else if (f > 0.5) c = uAcc * (1.0 + uBloom); }
  float fib = fbm(vec3(vW.xy / max(px, 1e-5) * 0.02, uSeed), 3), str = vn(vec3(vW.x / max(px, 1e-5) * 0.004, vW.y / max(px, 1e-5) * 0.08, uSeed + 5.0)).x;
  c *= 0.9 + 0.16 * fib + 0.05 * str;                                      // 纸纹、纤维（按像素算，远近一样细）
  c += uRim * uLit * (1.0 - smoothstep(0.0, 2.2 * px, d));                  // 背光亮边
  gl_FragColor = vec4(c, 1.0);
}`;

// 天：上下渐变，一轮月（或日）带晕
const SKY_F = JZ.GLSL + COMMON + `
uniform vec3 uTop, uHor, uDisc; uniform vec4 uY, uDc;   // uY = (下沿 y, 上沿 y)；uDc = (x, y, 半径, 晕)
void main() {
  float k = clamp((vW.y - uY.x) / (uY.y - uY.x), 0.0, 1.0); vec3 c = mix(uHor, uTop, sqrt(k));
  float r = length(vW.xy - uDc.xy), px = length(fwidth(vW.xy));
  c += uDisc * (smoothstep(uDc.z + px, uDc.z - px, r) * (0.92 + 0.08 * fbm(vec3(vW.xy / uDc.z * 3.0, 2.0), 3)) + uDc.w * exp(-max(r - uDc.z, 0.0) / (uDc.z * 1.6)));
  c *= 0.96 + 0.06 * fbm(vec3(vW.xy / max(px, 1e-5) * 0.015, 7.0), 3);
  gl_FragColor = vec4(c, 1.0);
}`;

// 水面（平放）：远近渐变，一道道剪纸波纹线，冲击波（uRing = 中心 x、z、时刻、速度）
const WATER_F = JZ.GLSL + COMMON + `
uniform vec3 uNear, uFar, uLine, uRingC; uniform vec4 uRing; uniform vec2 uZ; uniform float uLines;
void main() {
  vec2 p = vW.xz; float k = clamp((uZ.x - p.y) / (uZ.x - uZ.y), 0.0, 1.0), px = length(fwidth(p));
  vec3 c = mix(uNear, uFar, sqrt(k));
  float w = p.y * uLines + 0.35 * sin(p.x * uLines * 0.21 + uSeed) + 0.2 * sin(p.x * uLines * 0.53 + uT * 0.6), f = abs(fract(w) - 0.5), lw = fwidth(w);
  float dash = step(0.35, vn(vec3(p.x * uLines * 0.08, floor(w), uSeed)).x);
  c += uLine * dash * (1.0 - smoothstep(0.0, 1.5 * lw, 0.5 - f)) * (1.0 - 0.6 * k);
  float u = uT - uRing.z; if (u > 0.0) { float r = length(p - uRing.xy), rr = u * uRing.w, wd = 0.03 * uRing.w + 0.15 * u * uRing.w * 0.1;
    c += uRingC * exp(-pow((r - rr) / wd, 2.0)) * exp(-u * 1.2) + uRingC * 0.4 * exp(-pow((r - rr * 0.7) / (wd * 0.6), 2.0)) * exp(-u * 2.0); }
  gl_FragColor = vec4(c, 1.0);
}`;

// 冰（竖着、半透明）：一格格的裂纹、冻住的气泡、霜
const ICE_F = JZ.GLSL + COMMON + `
uniform vec3 uCol, uLine; uniform float uA, uCell, uMelt;
void main() {
  vec2 p = vW.xy / uCell, g = floor(p); float d1 = 9.0, d2 = 9.0; vec2 bc = vec2(0.0); float bh = 1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 c = g + vec2(i, j); uvec3 h = uvec3(uvec2(ivec2(c) + 100000), 1u);
    vec2 o = c + vec2(h01(h), h01(h + uvec3(0, 0, 1))); float d = length(p - o); if (d < d1) { d2 = d1; d1 = d; bc = o; bh = h01(h + uvec3(0, 0, 2)); } else if (d < d2) d2 = d; }
  float px = length(fwidth(p)), crack = 1.0 - smoothstep(0.0, 1.6 * px, d2 - d1 - 0.02 * fbm(vec3(p * 4.0, 1.0), 3));
  float br = 0.12 + 0.18 * bh, bub = bh > 0.55 ? exp(-pow((length(p - bc) - br) / (1.5 * px + 0.012), 2.0)) * 0.9 + smoothstep(br, 0.0, length(p - bc - vec2(-0.3, 0.35) * br)) * 0.25 : 0.0;
  float fr = fbm(vec3(vW.xy / uCell * 6.0, 3.0), 4);
  vec3 c = uCol * (0.7 + 0.5 * fr) + uLine * (crack * 0.8 + bub);
  gl_FragColor = vec4(c, uA * (0.55 + 0.45 * fr) * (1.0 - uMelt) + (crack + bub) * 0.3 * (1.0 - uMelt));
}`;

const mat = (fs, u, o = {}) => new JZ.THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: JZ.fx.U({ uT: 0, uSeed: 1, uNoise: JZ.noise, ...u }), ...o });

// 参考镜头：ref = { y, z, fov }，看 −z。sy(D, s)：D 米外、画面高度 s（0 底 1 顶）的世界 y；H(D)：D 米外画面多高
P.ref = (ref) => { const t = Math.tan(ref.fov * Math.PI / 360); return { ...ref, H: (D) => 2 * D * t, sy: (D, s) => ref.y + (2 * s - 1) * D * t, z: (D) => ref.z - D }; };

// 一层山（或林、草、云）。o：D 距离；top 山脊基线（画面比例）；amp 起伏（画面比例）；wav 一屏几个起伏；deco 'pine'|'bloom'|'grass'|'cloud'；sp 间距（画面比例）；th 高（倍间距）；den 密度；cut 镂空格（画面比例，0 不镂）；
// col 颜色、fog 层底雾色、fogH 雾多高（画面比例）、rim 亮边、acc 花色、wide 宽（倍画面宽）、shadow 柔影（0 不要）、lit 亮边多亮
const DK = { pine: 1, bloom: 2, grass: 3, cloud: 4 };
P.layer = (sc, R, o) => {
  const T = JZ.THREE, H = R.H(o.D), W = H * 16 / 9 * (o.wide || 3), z = R.z(o.D), y0 = R.sy(o.D, -0.6), y1 = R.sy(o.D, 1.6), g = new T.Group();
  const u = { uCol: V3(o.col), uFog: V3(o.fog || o.col), uRim: V3(o.rim || [0, 0, 0]), uAcc: V3(o.acc || [1, 0.6, 0.7]), uAcc2: V3(o.acc2 || [1, 0.85, 0.4]), uBloom: 0, uLit: o.lit ?? 1,
    uP: new T.Vector4(o.yTop ?? R.sy(o.D, o.top), H * (o.amp || 0), (o.wav || 3) / (H * 16 / 9), H * (o.cut || 0)), uD: new T.Vector4(DK[o.deco] || 0, H * (o.sp || 0.05), o.th || 2, o.den ?? 0.8),
    uFogH: H * (o.fogH || 0.25), uSh: 0, uShO: new T.Vector2(-H * 0.006, H * 0.01), uSoft: H * 0.012, uBand: H * (o.band || 0.08), uSeed: o.seed || 1 };
  const geo = new T.PlaneGeometry(W, y1 - y0), m = new T.Mesh(geo, mat(LAYER_F, u)); m.position.set(o.x || 0, (y0 + y1) / 2, z); g.add(m);
  if (o.shadow !== 0) {   // 柔影放在本层后面 D·1%：再近会和本层抢深度（z-fighting），出三角块
    const s = new T.Mesh(geo, mat(LAYER_F, { ...u, uSh: 1 }, { transparent: true, depthWrite: false }));
    s.material.uniforms = { ...m.material.uniforms, uSh: { value: 1 } }; s.position.set(o.x || 0, (y0 + y1) / 2, z - o.D * 0.01); g.add(s); }
  g.userData.u = m.material.uniforms; sc.add(g); return g;
};
P.sky = (sc, R, o) => {
  const T = JZ.THREE, D = o.D || 3000, H = R.H(D), y0 = R.sy(D, -0.5), y1 = R.sy(D, 1.5);
  const m = new T.Mesh(new T.PlaneGeometry(H * 16 / 9 * 4, y1 - y0), mat(SKY_F, { uTop: V3(o.top), uHor: V3(o.hor), uDisc: V3(o.disc || [0, 0, 0]), uY: new T.Vector4(R.sy(D, o.horS ?? 0.3), R.sy(D, 1), 0, 0),
    uDc: new T.Vector4(H * 16 / 9 * ((o.dx ?? 0.7) - 0.5), R.sy(D, o.dy ?? 0.75), H * (o.dr || 0.05), o.halo ?? 0.4) }));
  m.position.set(0, (y0 + y1) / 2, R.z(D)); sc.add(m); return m;
};
P.water = (sc, R, o) => {   // o：y 水面高；z0 近、z1 远（世界 z）；宽 w
  const T = JZ.THREE, m = new T.Mesh(new T.PlaneGeometry(o.w, o.z0 - o.z1), mat(WATER_F, { uNear: V3(o.near), uFar: V3(o.far), uLine: V3(o.line), uRingC: V3(o.ringC || [1, 0.9, 0.6]),
    uRing: new T.Vector4(0, 0, 1e5, 1), uZ: new T.Vector2(o.z0, o.z1), uLines: o.lines || 4 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, o.y, (o.z0 + o.z1) / 2); sc.add(m); return m;
};
P.shape = (sc, shapes, o) => {   // shapes：THREE.Shape 数组（世界坐标，xy 平面）；o = { z, col, rim, rimW }
  const T = JZ.THREE, g = new T.Group(), geo = new T.ShapeGeometry(shapes, 24);
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(...o.col), side: T.DoubleSide })); m.position.z = o.z; g.add(m);
  if (o.rim) { geo.computeBoundingBox(); const c = geo.boundingBox.getCenter(new T.Vector3()), r = new T.Mesh(geo, new T.MeshBasicMaterial({ color: new T.Color(...o.rim), side: T.DoubleSide }));
    r.position.set(c.x * -(o.rimW || 0.04), c.y * -(o.rimW || 0.04), o.z - 1e-4); r.scale.setScalar(1 + (o.rimW || 0.04)); g.add(r); }
  sc.add(g); return g;
};
P.ice = (sc, o) => {   // o：中心 c、宽高 wh、格子 cell、颜色
  const T = JZ.THREE, m = new T.Mesh(new T.PlaneGeometry(o.wh[0], o.wh[1]), mat(ICE_F, { uCol: V3(o.col), uLine: V3(o.line), uA: o.a ?? 0.5, uCell: o.cell, uMelt: 0 }, { transparent: true, depthWrite: false }));
  m.position.set(...o.c); m.renderOrder = 5; sc.add(m); return m;
};
})();
