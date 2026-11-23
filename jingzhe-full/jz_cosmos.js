// jz_cosmos.js —— 第四段「万物生」的世界（bar25–30）：那个点炸开，一层层激波面扫过镜头，镜头进到星云里；暗的尘埃带让开，露出远处的旋涡星系，
// 沿旋臂扎进星系核，核里是一颗恒星（日珥、日冕）；一颗行星滑过来挡成日全食，只剩一圈光环，叠化成宇宙网里一个空洞的泡壁；推进网里，再一路后退，整张网缩成一粒光（bar31 那粒火星）。
// 时间是歌曲时间（秒）。色彩只用全片的：黑的太空、金和白热、靛紫、少量朱红；一片区域一种色相。
// 镜头三条路径：CA（炸开 → 星云 → 星系，世界坐标，那个点在原点）、CH（恒星，在原点）、CW（宇宙网，空洞的中心在原点）。两处跨路径的转场在 W.draw 里。
(() => {
const JZ = window.JZ, W = JZ.cosmos = {};
const SCL = 0.4, RSTAR = 2.6;   // RSTAR 和着色器里的 RS 一样   // 星系缩到 0.4 倍放近一点，镜头冲向核的速度能平滑地加上去
let THREE, K, sc, cam, sky, burst, galG, gal, webG, webM, tmat, stree, tstar, emb, trail, EM, CE, T, END, kicks, CA, CH, CW, G, RC = 6;
const VERT = `varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COS_F = `
uniform vec3 uCam, uFwd, uRight, uUp, uGc, uDp, uDa; uniform mat3 uGm; uniform float uTanH, uAspect, uT, uMode, uSpaceI, uNeb, uCore, uMote, uShell, uGal, uDust, uHaze, uSun; uniform vec4 uPl; uniform vec2 uRes;
uniform vec2 uKick[4]; uniform float uSh[8];   // uSh：每层激波面的出生时刻（底鼓）
varying vec2 vP;
const vec3 GOLD = vec3(0.95, 0.62, 0.20), GW = vec3(1.0, 0.86, 0.62), WH = vec3(1.0, 0.93, 0.80), RED = vec3(0.85, 0.20, 0.06), VIO = vec3(0.40, 0.31, 1.0);

vec3 space(vec3 rd) {   // 远处的星；靛紫和金的淡星云各占一片，不混色
  vec3 g = rd * 210.0, i = floor(g), f = g - i - 0.5; float h = h01(uvec3(ivec3(i) + 2048));
  vec3 c = h > 0.9 ? mix(vec3(0.75, 0.8, 1.0), GW, fract(h * 37.0)) * exp(-dot(f, f) * 30.0) * (0.65 + 0.35 * sin(uT * (2.0 + h * 9.0) + h * 400.0)) * (h - 0.9) * 12.0 : vec3(0.0);
  return c + VIO * 0.035 * smoothstep(0.45, 0.75, fbm(rd * 2.2 + 4.0, 5)) + GOLD * 0.025 * smoothstep(0.62, 0.8, fbm(rd * 1.7 - 9.0, 4)) + vec3(0.003, 0.004, 0.010);
}

// 激波面：每个底鼓推出一层球壳，有厚度，表面是皱的；视线在壳里走得越长越亮（边缘最亮），壳上有亮丝和结块。每层一种颜色、厚薄不同
vec3 shells(vec3 ro, vec3 rd) {
  vec3 oc = -ro, col = vec3(0.0); float tc = dot(oc, rd), b2 = dot(oc, oc) - tc * tc;
  for (int k = 0; k < 8; k++) {
    float tau = uT - uSh[k]; if (tau < 0.0) continue;
    float hk = fract(float(k) * 0.618 + 0.3), R = 34.0 * pow(tau + 0.02, 0.6) * (1.0 + 0.12 * float(k)) + 1.0, w = R * (0.04 + 0.14 * hk);
    if (b2 > R * R * 1.2) continue;
    float s = sqrt(max(R * R - b2, 0.0)), th = tc - s; if (th < 0.0) th = tc + s; if (th < 0.0) continue;   // 镜头在壳里面就看远的那一面
    vec3 n = (ro + rd * th) / R;
    float Re = R * (1.0 + 0.12 * (fbm(n * 2.2 + float(k) * 1.7, 4) - 0.5)), Ri = Re - w; if (b2 > Re * Re) continue;
    float lim = min((sqrt(Re * Re - b2) - sqrt(max(Ri * Ri - b2, 0.0))) / w, 4.0), cr = length(ro), inS = 1.0 - 0.85 * exp(-pow((cr - Re + 0.5 * w) / (1.5 * w), 2.0));   // 镜头正在壳的厚度里：这一层压暗，不糊满画面
    float fil = pow(1.0 - abs(2.0 * fbm(n * (5.0 + 4.0 * hk) - float(k), 4) - 1.0), 6.0), knot = smoothstep(0.6, 0.85, fbm(n * 12.0 + float(k) * 4.0, 3));
    vec3 c = k == 5 ? RED * 1.3 : k % 3 == 0 ? WH : k % 3 == 1 ? GOLD * 1.2 : VIO * 1.4;
    float rim = smoothstep(1.1, 3.2, lim);   // 越靠边越亮：正对着的那一面通透，读成一圈激波，不是一个球
    col += c * (0.04 * lim * (0.3 + 1.2 * fbm(n * 3.0 + float(k), 3)) + 0.45 * fil * (0.06 + 0.9 * rim) + 0.6 * knot * fil * rim) * (0.15 + 1.2 * exp(-tau * 1.2)) / (1.0 + R / 180.0) * inS;
  }
  return col * uShell + GW * uCore * (0.6 / (b2 * 0.08 + 0.6) + 6.0 / (b2 * 4.0 + 1.0)) * step(0.0, tc);   // 中心那个点
}

// 星云：炸开照亮的一团气，镜头从里面穿过去。色相按区域分（靛紫 / 金，少量朱红），交界是一道暗缝；丝的芯发白热；暗的尘埃吸光不发光
// 还有一条单独的暗尘埃带（uDp 过、沿 uDa），bar27 前从镜头前让开
vec4 nebula(vec3 ro, vec3 rd, vec2 fc) {
  const float NR = 330.0; float tc = dot(-ro, rd), b2 = dot(ro, ro) - tc * tc; if (b2 > NR * NR) return vec4(0.0, 0.0, 0.0, 1.0);
  float hh = sqrt(NR * NR - b2), t = max(tc - hh, 0.0), t1 = tc + hh; if (t1 <= t) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 acc = vec3(0.0); float Tr = 1.0; t += (1.0 + 2.0 * h01(uvec3(uvec2(fc), 11u)));
  for (int i = 0; i < 56; i++) {
    vec3 p = ro + rd * t; float dt = 2.0 + t * 0.05, rr = length(p);
    float lane = uDust * (1.0 - smoothstep(6.0, 10.0, length(cross(p - uDp, uDa)) + 4.0 * (fbm(p * 0.09, 3) - 0.5))) * (1.0 - smoothstep(30.0, 60.0, abs(dot(p - uDp, uDa))));
    if (lane > 0.01) dt = min(dt, 1.2);
    float dust = smoothstep(0.56, 0.7, fbm(p * 0.016 + 20.0, 4)) + lane * 6.0;
    float f = pow(1.0 - min(abs(fbm(p * 0.03 - 7.0, 3) - 0.44) * 5.0, 1.0), 2.0), d = smoothstep(0.52, 0.66, fbm(p * 0.012 + 3.0, 5)) * (0.15 + 0.85 * f) * (1.0 - smoothstep(NR * 0.75, NR, rr));
    if (d > 0.01) {
      float cn = fbm(normalize(p) * 1.6 + 11.0, 3), wv = 1.0 - smoothstep(0.48, 0.52, cn), wg = smoothstep(0.6, 0.64, cn),   // 色相按离炸点的方向分区：从中心看出去一束一个颜色，视线不会穿过两种颜色叠出粉色
          wr = smoothstep(0.78, 0.86, fbm(p * 0.01 - 5.0, 3)), wave = 0.0;
      for (int k = 0; k < 4; k++) { float x = (rr - uKick[k].x * 60.0) / 18.0; wave += uKick[k].y * exp(-x * x) * exp(-uKick[k].x); }   // 底鼓：一圈光从中心往外扫过气
      vec3 em = mix(VIO * 1.2 * wv + GOLD * wg, RED * 1.3, wr * max(wv, wg));
      em = mix(em, WH * 1.6, smoothstep(0.8, 1.0, f) * 0.6 * max(wv, wg)) * (0.12 + 2.0 * f * f) * (1.0 + 1.5 * wave) / (1.0 + 4.0 * dust);
      float al = 1.0 - exp(-d * dt * 0.05);
      acc += Tr * al * em * 0.32; Tr *= 1.0 - al * 0.85;
    }
    Tr *= exp(-dust * dt * 0.045);
    t += dt; if (Tr < 0.02 || t > t1) break;
  }
  return vec4(acc * uNeb, mix(1.0, Tr, uNeb));
}

// 旋涡星系（在自己的坐标里：uGc 是核，uGm 转进去）：两条旋臂一条金白（清）一条靛紫（浊），旋臂内侧是暗的尘埃带，中间是白热的核
vec3 galaxy(vec3 ro, vec3 rd) {
  vec3 o = uGm * (ro - uGc), d = uGm * rd; if (abs(d.y) < 1e-4) return vec3(0.0); float tp = -o.y / d.y; if (tp < 0.0) return vec3(0.0);
  vec3 P = o + d * tp; float r = length(P.xz), ph = atan(P.z, P.x) - 2.4 * log(1.0 + r / 20.0) - uT * 0.25;
  float lanes = 0.35 + 1.3 * fbm(vec3(P.xz * 0.035, 2.0), 5), aA = pow(max(cos(ph), 0.0), 5.0), aB = pow(max(-cos(ph), 0.0), 5.0);
  float dk = smoothstep(0.45, 0.7, fbm(vec3(P.xz * 0.05, 7.0), 4)) * (pow(max(cos(ph + 0.45), 0.0), 10.0) + pow(max(-cos(ph + 0.45), 0.0), 10.0)) * smoothstep(12.0, 40.0, r);
  vec3 c = mix((vec3(1.0, 0.8, 0.5) + VIO * 1.3) * 0.11, vec3(1.0, 0.8, 0.5) * aA + VIO * 1.3 * aB, smoothstep(3.0, 18.0, r)) * lanes * exp(-r / 110.0) * 0.5 + WH * (0.8 * exp(-r / 7.0) + 0.1 * exp(-r / 40.0));   // 核附近两条旋臂化成一团（原来在正中收成一个尖点，推近时像个十字）
  return c * (1.0 - 0.85 * dk) / max(abs(d.y) * 2.2, 0.35) * (1.0 - smoothstep(260.0, 340.0, r));
}

// 一颗恒星（半径 RS，在原点）：表面是一格格翻滚的米粒组织和几块黑子，边缘变暗变红；贴着边缘一圈色球层，日珥像火焰一样从边上拱出去；外面是带放射条纹的日冕。
// bar29 前一颗行星（uPl：位置、半径）从旁边滑到正前方把它挡住（日全食）：只剩日冕那一圈，叠化成宇宙网空洞的泡壁
const float RS = 2.6;
float cell(vec3 p) {   // 米粒：离最近的格心多远（Worley），格心亮、格子之间是暗缝
  vec3 i = floor(p), f = p - i; float d = 1.5;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)); uint h = h3(uvec3(ivec3(i + g) + 4096));
    d = min(d, length(g + vec3(float(h & 255u), float((h >> 8) & 255u), float((h >> 16) & 255u)) / 255.0 - f));
  }
  return d;
}
vec3 star(vec3 ro, vec3 rd) {
  vec3 oc = -ro, col = space(rd) * uSpaceI; float tc = dot(oc, rd), b = sqrt(max(dot(oc, oc) - tc * tc, 0.0));
  if (tc > 0.0) {
    vec3 pc = ro + rd * tc, v = pc / max(length(pc), 1e-4), ca = vec3(cos(atan(dot(v, uUp), dot(v, uRight))), sin(atan(dot(v, uUp), dot(v, uRight))), 0.0); float x = max(b - RS, 0.0) / RS;
    float str = 0.55 + 0.45 * fbm(ca * 3.0 + vec3(0.0, 0.0, x * 0.6 - uT * 0.02), 4) + 0.35 * pow(fbm(ca * 9.0 + 4.0, 3), 3.0);   // 日冕的放射条纹
    float pr = smoothstep(0.55, 0.8, fbm(vec3(ca.xy * 16.0, x * 3.0 - uT * 0.3), 5)) * smoothstep(0.5, 0.75, fbm(vec3(ca.xy * 4.0 + 9.0, 1.0), 3)) * exp(-x / 0.1);   // 日珥：从边上往外舔的火舌，一处一簇                                  // 日珥
    if (b >= RS) col += (mix(WH, vec3(0.85, 0.82, 1.0), smoothstep(0.0, 1.0, x)) * (0.8 * exp(-x / 0.08) + 0.3 * exp(-x / 0.45)) * str + vec3(1.0, 0.28, 0.05) * 4.0 * pr + vec3(1.0, 0.4, 0.1) * 3.0 * exp(-x * x / 0.00015)) * uSun;   // 日冕、日珥、色球层
    else {
      float th = tc - sqrt(RS * RS - b * b), cr = cos(uT * 0.03), sr = sin(uT * 0.03); vec3 n = (ro + rd * th) / RS, m = vec3(cr * n.x - sr * n.z, n.y, sr * n.x + cr * n.z);
      float mu = max(dot(n, -rd), 0.0), I = 1.0 - 0.55 * (1.0 - mu) - 0.25 * (1.0 - mu) * (1.0 - mu);                                                     // 边缘变暗
      float c1 = cell(m * 24.0 + vec3(0.0, uT * 0.25, 0.0)), c2 = cell(m * 55.0 - vec3(uT * 0.2, 0.0, 0.0)), gran = 0.5 + 0.7 * (1.0 - smoothstep(0.2, 0.9, c1)) - 0.12 * smoothstep(0.5, 0.9, c2);   // 米粒组织
      float f = fbm(m * 2.6 + 7.0, 4), sp = smoothstep(0.66, 0.74, f), um = smoothstep(0.72, 0.77, f);                                                    // 黑子：半影、本影
      col = mix(vec3(1.0, 0.36, 0.07), vec3(1.0, 0.78, 0.45), I) * 1.3 * I * gran * (1.0 - 0.5 * sp - 0.45 * um) * uSun;
    }
  }
  vec3 op = uPl.xyz - ro; float tp = dot(op, rd), bp = sqrt(max(dot(op, op) - tp * tp, 0.0));
  if (tp > 0.0) col = mix(col, vec3(0.002, 0.002, 0.003), smoothstep(uPl.w * 1.004, uPl.w * 0.996, bp)) + vec3(1.0, 0.62, 0.36) * 0.9 * exp(-pow((bp - uPl.w) / (uPl.w * 0.006), 2.0)) * smoothstep(RS * 1.5, RS * 0.9, b) * uSun;   // 行星背着光：黑的圆，边上一圈透过来的光
  return col + WH * uHaze * 0.6 / (1.0 + b * b * 0.05);   // 刚从星系核钻进来：核的光还没散
}

void main() {
  vec3 rd = normalize(uFwd + vP.x * uAspect * uTanH * uRight + vP.y * uTanH * uUp), ro = uCam, col;
  int mode = int(uMode + 0.5);
  if (mode == 3) col = star(ro, rd);
  else {
    col = space(rd) * uSpaceI;
    if (mode == 0) {
      if (uGal > 0.001) col += galaxy(ro, rd) * uGal;
      if (uNeb > 0.001) { vec4 nb = nebula(ro, rd, gl_FragCoord.xy); col = col * nb.a + nb.rgb; }
      if (uShell > 0.001 || uCore > 0.001) col += shells(ro, rd);
    }
    vec2 q = vP * vec2(uAspect, 1.0); col += GW * uMote * 0.0005 / (dot(q, q) + 0.0003);   // 缩成的那一粒光
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// 宇宙网的星系和气：一个个朝着镜头的小圆点。iA = (-, 亮度, 色相, 半径)
const STAR_V = `
attribute vec3 iP; attribute vec4 iA; uniform float uPx, uGain, uFar, uReveal, uWall, uHole; uniform vec2 uRes; varying vec2 vU; varying vec3 vC; varying vec4 vG;
void main() {
  vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(iP, 1.0); vU = position.xy; vC = vec3(0.0);
  if (c.w < 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float px = iA.w * projectionMatrix[1][1] * uRes.y * 0.5 / c.w, r = clamp(px, 1.3 * uPx, 46.0 * uPx), h = iA.z, sd = fract(dot(iP, vec3(0.37, 0.13, 0.71)));
  vG = vec4(cos(sd * 6.283), sin(sd * 6.283), 0.25 + 0.75 * fract(sd * 7.3), iA.x > 1.5 ? 0.0 : smoothstep(6.0, 16.0, px / uPx));   // 盘面的朝向、扁的程度；够大才画成星系
  c.xy += position.xy * r / (uRes * 0.5) * c.w; gl_Position = c;
  vec3 col = h < 0.55 ? vec3(1.0, 0.86, 0.62) : h < 0.9 ? vec3(0.55, 0.48, 1.0) : vec3(1.0, 0.42, 0.14);   // 金白、靛紫、少量朱红
  vC = col * iA.y * min(1.0, (px / r) * (px / r) * 3.0 + 0.2) / (1.0 + 2.0 * vG.w) * uGain * (iA.x < 0.5 ? uWall : uReveal) * (1.0 - smoothstep(uFar * 0.4, uFar, c.w)) * smoothstep(3.0, 30.0, c.w);   // 贴着镜头飞过的星系淡掉，不一下亮一片
  if (uHole > 0.0 && iA.x < 0.5) { vec3 w = (modelMatrix * vec4(iP, 1.0)).xyz; float rho = acos(clamp(dot(normalize(w - cameraPosition), normalize(-cameraPosition)), -1.0, 1.0)) / asin(min(260.0 / length(cameraPosition), 1.0));
    vC *= smoothstep(uHole - 0.12, uHole, rho); }   // 接日全食：泡壁先只亮边上那一圈（离画面上空洞中心的角度 / 泡壁的视半径 = rho），uHole 从 1 降到 0，从边往里一点点铺满（uHole 默认 0 = 不管）
}`;
const STAR_F = `varying vec2 vU; varying vec3 vC; varying vec4 vG;
void main() {
  float r2 = dot(vU, vU); if (r2 > 1.0) discard;
  vec2 q = mat2(vG.x, -vG.y, vG.y, vG.x) * vU; q.y /= vG.z; float g2 = dot(q, q), an = g2 > 1e-10 ? atan(q.y, q.x) : 0.0;   // 像素正落在中心时 atan(0, 0) 是 NaN，乘 0 也还是 NaN，光晕一糊就是黑方块   // 近的画成一个小星系：亮的核、扁的盘、两条淡淡的旋臂
  float gal = (exp(-g2 * 60.0) * 3.0 + exp(-g2 * 6.0) * 0.5 * (0.6 + 0.4 * cos(2.0 * an - 9.0 * sqrt(g2)))) * (1.0 - smoothstep(0.6, 1.0, g2));
  gl_FragColor = vec4(vC * mix(exp(-r2 * 7.0) + 0.12 * exp(-r2 * 1.8), gal, vG.w) * (1.0 - smoothstep(0.7, 1.0, r2)), 1.0);
}`;

const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add3 = (...vs) => [0, 1, 2].map(k => vs.reduce((s, v) => s + v[k], 0)), mul = (v, s) => v.map(x => x * s);

W.build = (M) => {
  THREE = JZ.THREE; K = JZ.kit;
  const rnd = M.rng(77003), R1 = () => rnd() * 2 - 1, gs = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  T = []; for (let n = 24; n <= 41; n++) T[n] = M.ref('bar' + n); END = M.song.dur;   // 整首 bar40–57（E8 也在这个世界里）
  kicks = M.song.kicks.filter(k => k.t > T[25] - 0.05);
  const U = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
  const BA = (a, k) => new THREE.BufferAttribute(a, k), IA = (a, k) => new THREE.InstancedBufferAttribute(a, k);
  const add = { blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide };
  const k4 = () => [0, 1, 2, 3].map(() => new THREE.Vector2(99, 0)), com = () => ({ uT: 0, uPx: JZ.px, uRes: JZ.res });
  sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 1e6);
  const sh8 = new Array(8).fill(1e5); kicks.slice(0, 8).forEach((k, i) => { sh8[i] = k.t; });

  // ---- 镜头 A：炸开 → 迎着激波面推 → 激波面扫过镜头，进星云 → 尘埃带让开 → 扎向星系核（世界坐标，那个点在原点）
  const Y = [0, 1, 0], pA = (t, p, l, fov, o = {}) => ({ t, p, l, up: Y, fov, ...o });
  const Hg = nrm([380, -150, -800]), S27 = nrm(cross(Hg, Y)), P27 = add3([72, -10, -88], mul(S27, 14)); G = add3(P27, mul(Hg, 360));   // bar27 镜头往旁边让开 14，尘埃带就从视线里滑出去
  const gy = nrm(add3(mul(Hg, -0.6), [0, 0.8, 0])), gx = nrm(cross(gy, [0, 0, 1])), gz = cross(gx, gy);   // 星系的盘面：法线一半朝着来的方向，斜着看得到旋臂
  const gl = (r, h, t) => { const th = 2.4 * Math.log(1 + 150 / 20) - 1.1 * Math.log((1 + 150 / 20) / (1 + r / 20)) + 0.25 * t + 0.35;return add3(G, mul(gx, Math.cos(th) * r * SCL), mul(gy, h * SCL), mul(gz, Math.sin(th) * r * SCL)); };   // 旋臂（清那条）上离核 r、高 h 的一点   // 松松地跟着旋臂往里：比旋臂少绕一半，画面不猛转
  const Dp = add3([46, -4, -44], mul(Hg, 40)), Lp = (d) => add3(G, mul(Hg, -d));   // Lp：从 bar27 的机位直着往核去，离核 d   // 暗尘埃带：bar27 前正挡在视线中间（竖着），镜头往旁边让开
  CA = JZ.path([
    pA(T[25] - 0.1, [0, 6, 64], [0, 0, 0], 62), pA(T[25], [0, 6, 64], [0, 0, 0], 62),                        // bar25 那个点炸开：镜头不动
    pA(T[25] + 1.0, [6, 9, 58], [0, 0, 0], 62),                                                                // 迎着激波面慢慢推
    pA(T[26], [10, 10, 50], [10, 0, 0], 62),                                                    // bar26 激波面一层层从镜头上扫过去
    pA(T[26] + 0.6, [18, 7, 22], [44, -6, -50], 64),                                                          // 进到星云里，拐弯
    pA(T[27] - 0.6, [46, -4, -44], add3([46, -4, -44], mul(Hg, 100)), 64),                                     // 前面是暗尘埃带
    pA(T[27], P27, add3(P27, mul(Hg, 100)), 62),                                               // bar27 尘埃带让开，远处是星系
    pA(T[27] + 0.7, Lp(179), G, 60),                                                                          // 第六次：直着推向核（原来沿着旋臂走，绕着核转了约 180°，239°/s）；新看到的：旋臂一圈圈从画面边上滑出去，核越来越亮
    pA(T[27] + 1.2, Lp(70), G, 60),                                                                           // 离核的距离每段大致乘一个比例：看起来是匀速放大
    pA(T[28] - 0.45, Lp(20.5), G, 60),
    pA(T[28], Lp(4.1), G, 60), pA(T[28] + 0.15, Lp(1.5), G, 60)]);
  W.dust = { Dp, Da: nrm([0.15, 1, 0.1]) }; W.gm = [gx, gy, gz];

  // ---- 镜头 H：恒星（在原点，半径 RSTAR）。绕着旋近；离它 8.6 时日冕那一圈和宇宙网开头的空洞泡壁一样大
  const ph = (t, d, a) => ({ t, p: [Math.sin(a) * d * 0.94, d * 0.34, Math.cos(a) * d * 0.94], l: [0, 0, 0], up: Y, fov: 60 });
  CH = JZ.path([ph(T[28] - 0.5, 160, 0.45), ph(T[28] - 0.2, 70, 0.45), ph(T[28], 40, 0.45), ph(T[28] + 1.0, 17, 0.5), ph(T[29], 8.6, 0.55), ph(T[29] + 0.1, 8.0, 0.56)]);   // 第六次：直着推近（原来绕着转 90°）

  // ---- 镜头 W：宇宙网（空洞的中心在原点，泡壁半径 RV）。开头离 DV，泡壁在画面上和日全食的光环一样大；推进去、转弯，再一路后退
  const RV = 260, DV = RV / Math.sin(Math.asin(RSTAR / 8.6)), v = nrm([1, 0.4, 0.9]);
  // 星星雷树（#37）：借雷树的几何（只要树干、大枝、根，不要云底的天根和往天上的通道）放大 STS 倍，根在 STB；树干上部的结点 NODE 最亮，#38 推进去
  const STB = [0, -450, 0], STS = 10, TC = add3(STB, [0, 30 * STS, 0]), NODE = add3(STB, [0, 48 * STS, 0]), ND = nrm([0.55, 0.12, 1]);
  CW = JZ.path([
    { t: T[29], p: [0, 0, DV], l: [0, 0, 0], up: Y, fov: 60 },   // bar29 前的叠化里机位按镜头 H 换算（W.pose），泡壁一直和日冕那一圈一样大
    { t: T[29] + 0.9, p: [20, 25, 330], l: [-65, 2, 11], up: Y, fov: 64 },                                       // 推进去：环张开出了画面
    { t: T[30] - 0.45, p: [110, 50, 150], l: [4, 0, -20], up: Y, fov: 66 },                                    // 减速，往旁边拐
    { t: T[30], p: [230, 80, 120], l: [53, 18, -57], up: Y, fov: 64 },                             // bar30 横着带过去、一路往后退（视线一直往一个方向转，不来回摆）；退出来时网已经在散成火星屑
    { t: T[30] + 0.5, p: mul(v, 650), l: [0, 0, 0], up: Y, fov: 60 }, { t: T[30] + 1.2, p: mul(v, 1500), l: [0, 0, 0], up: Y, fov: 56 },   // 退到看得见整张网
    { t: T[31], p: [1450, 120, 1000], l: [0, -100, 0], up: Y, fov: 56 },                                      // #37 bar46→47 G：网散成火星屑，绕着落成一棵星星雷树，镜头慢慢转到树的正面
    { t: T[32] - 0.45, p: add3(NODE, mul(ND, 260)), l: NODE, up: Y, fov: 50 },                                 // #38 bar47→48 H：冲进树上最亮的那个结点
    { t: T[32] - 0.25, p: add3(NODE, mul(ND, 55)), l: NODE, up: Y, fov: 49 }, { t: T[32], p: add3(NODE, mul(ND, 14)), l: NODE, up: Y, fov: 48 }]);   // 最后一段放慢：亮得太快算闪

  sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader: JZ.GLSL + COS_F,
    uniforms: U({ uNoise: JZ.noise, uCam: new THREE.Vector3(), uFwd: new THREE.Vector3(), uRight: new THREE.Vector3(), uUp: new THREE.Vector3(), uTanH: 1, uAspect: 16 / 9, uT: 0, uRes: JZ.res,
      uMode: 0, uSpaceI: 1, uNeb: 0, uCore: 0, uMote: 0, uShell: 1, uGal: 0, uDust: 0, uHaze: 0, uSun: 1, uPl: new THREE.Vector4(0, 0, 1e5, 1), uKick: k4(), uSh: sh8,
      uGc: new THREE.Vector3(...G), uGm: new THREE.Matrix3().set(...gx, ...gy, ...gz).multiplyScalar(1 / SCL), uDp: new THREE.Vector3(...Dp), uDa: new THREE.Vector3(...W.dust.Da) }) }));
  sky.frustumCulled = false; sky.renderOrder = -1; sc.add(sky);

  // 飞的星：JZ.kit.fly 那个壳（不动是一个点，动起来按速度拖尾巴）
  const mk = (list, at, col, tm, parent) => {
    const n = list.length, p0 = new Float32Array(n * 3), vv = new Float32Array(n * 3), a = new Float32Array(n * 4); list.forEach((q, i) => { p0.set(q[0], i * 3); vv.set(q[1], i * 3); a.set(q[2], i * 4); });
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', BA(new Float32Array([1, 0, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
    g.setAttribute('iP0', IA(p0, 3)); g.setAttribute('iV', IA(vv, 3)); g.setAttribute('iA', IA(a, 4)); g.instanceCount = n;
    const s = K.fly(K, at, col), m = new THREE.Mesh(g, new THREE.ShaderMaterial({ ...add, uniforms: U({ ...com(), uDim: 1, uLoop: 0, uWs: 0, uFloor: -1e9, uE: new THREE.Vector3(), uTm: tm }), vertexShader: s.v, fragmentShader: s.f }));
    m.frustumCulled = false; m.renderOrder = 2; (parent || sc).add(m); return m;
  };
  const ball = () => { let x, y, z, l; do { x = R1(); y = R1(); z = R1(); l = x * x + y * y + z * z; } while (l > 1 || l < 0.01); l = Math.sqrt(l); return [x / l, y / l, z / l]; };
  // 炸出来的碎片：从那个点往四面飞，越飞越慢
  const bl = []; for (let i = 0; i < 26000; i++) { const d = ball(), sp = 14 + 250 * rnd() ** 2.2; bl.push([[0, 0, 0], d.map(x => x * sp), [T[25] + 0.03 * rnd(), 1e6, rnd(), 0.05 + 0.1 * rnd() ** 2]]); }
  burst = mk(bl, `vec3 at(float u) { return iV * (1.0 - exp(-u * 0.7)) / 0.7; }`, `float h = fract(vG * 91.7); vec3 c = (h < 0.55 ? vec3(1.0, 0.82, 0.55) : h < 0.9 ? vec3(0.55, 0.5, 1.0) : vec3(1.0, 0.32, 0.1)) * 0.7;`, new THREE.Vector4());
  // 星系里的星：在星系自己的坐标里（galG 摆到 G、转到盘面），两条旋臂各一批，核一批，盘一批，整体慢慢转
  galG = new THREE.Group(); galG.matrixAutoUpdate = false; galG.matrix.makeBasis(new THREE.Vector3(...gx), new THREE.Vector3(...gy), new THREE.Vector3(...gz)).scale(new THREE.Vector3(SCL, SCL, SCL)).setPosition(...G); sc.add(galG);
  const rot = `vec3 at(float u) { float a = uTm.x * (u - 1000.0), c = cos(a), s = sin(a); return vec3(c * iP0.x - s * iP0.z, iP0.y, s * iP0.x + c * iP0.z); }`;
  const arm = (base, n) => { const l = []; for (let i = 0; i < n; i++) { const r = 14 + 290 * rnd() ** 1.4, th = base + 2.4 * Math.log(1 + r / 20) + gs() * 0.5; l.push([[Math.cos(th) * r, gs() * (3 + r * 0.02), Math.sin(th) * r], [0, 0, 0], [-1000, 1e6, rnd(), 0.2 + 0.5 * rnd() ** 3]]); } return l; };
  const core = []; for (let i = 0; i < 9000; i++) { const d = ball(), r = 34 * rnd() ** 2; core.push([[d[0] * r, d[1] * r * 0.45, d[2] * r], [0, 0, 0], [-1000, 1e6, rnd(), 0.2 + 0.4 * rnd() ** 3]]); }
  const disk = []; for (let i = 0; i < 20000; i++) { const r = 300 * rnd() ** 0.8, th = rnd() * M.TAU; disk.push([[Math.cos(th) * r, gs() * (3 + r * 0.02), Math.sin(th) * r], [0, 0, 0], [-1000, 1e6, rnd(), 0.2 + 0.4 * rnd() ** 3]]); }
  const tm = new THREE.Vector4(0.25, 0, 0, 0);
  // 暗尘埃带挡住它后面的星（用户 2026-11-20：星云到星系转场不平滑——星是叠加的粒子，着色器里的尘埃挡不住，原来只好藏到 bar27 前 0.2 秒才一下亮出来）：
  // 镜头到这颗星的线段离尘埃带的轴（过 uDp、沿 uDa）多近，和 nebula() 里那条带一样粗；星系就能早早淡进来，尘埃带让开时一片片露出来
  const occ = rot + `
#define OCC
uniform vec3 uDp, uDa;
vec2 sl(vec3 b) { vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(b, 1.0); return c.xy / max(c.w, 0.2) * uRes * 0.5; }   // 画面上的像素位置
float occ(vec3 b, vec3 pa) {
  vec3 w0 = cameraPosition - uDp, d1 = (modelMatrix * vec4(b, 1.0)).xyz - cameraPosition; float a = dot(d1, d1), bb = dot(d1, uDa), d = dot(d1, w0), e = dot(uDa, w0);
  float s = clamp((bb * e - d) / max(a - bb * bb, 1e-6), 0.0, 1.0), t = bb * s + e, dist = length(w0 + s * d1 - t * uDa);
  return (1.0 - (1.0 - smoothstep(5.0, 11.0, dist)) * (1.0 - smoothstep(30.0, 60.0, abs(t)))) * smoothstep(1.5, 5.0, sqrt(a))   // 擦着镜头过去的星淡掉
    * clamp(10.0 * uPx / max(length(sl(b) - sl(pa)), 1e-3), 0.12, 1.0);   // 拖尾越长越暗（运动模糊光的总量不变）：用户 2026-11-20「推向核时中间一个十字在闪」——推进时星的拖尾都朝正中汇过去，最亮的几条交叉成十字
}`;
  gal = [mk(arm(0.35, 24000), occ, `vec3 c = vec3(1.0, 0.82, 0.5) * 0.9;`, tm, galG), mk(arm(0.35 + Math.PI, 24000), occ, `vec3 c = vec3(0.46, 0.38, 1.0) * 1.1;`, tm, galG),
    mk(core, occ, `vec3 c = vec3(1.0, 0.88, 0.66) * 0.8;`, tm, galG), mk(disk, occ, `vec3 c = vec3(0.75, 0.8, 1.0) * 0.3;`, tm, galG)];
  gal.forEach(m => Object.assign(m.material.uniforms, { uDp: { value: new THREE.Vector3(...W.dust.Dp) }, uDa: { value: new THREE.Vector3(...W.dust.Da) } }));

  // ---- 宇宙网：中间一个空洞，泡壁上密密的一层星系（远看边缘最密，是一个环）；结点是星系团，结点之间连着细丝：一串小星系加淡淡的气
  const pts = [], put = (p, b, h, r, c = 1) => pts.push(...p, c, b, h, r);   // c：0 泡壁、1 星系、2 气
  for (let i = 0; i < 26000; i++) { const d = ball(); put(mul(d, RV + gs() * 7), 1.4 + 1.0 * rnd(), rnd(), 0.8 + 1.8 * rnd() ** 2, 0); }
  const nodes = [];
  for (let i = 0; i < 18; i++) nodes.push(mul(ball(), RV));
  for (let i = 0; i < 44; i++) { const d = ball(); nodes.push(mul(d, RV + 90 + 650 * rnd())); }
  for (const n of nodes) for (let i = 0; i < 600; i++) { const r = 20 * rnd() ** 2; put(add3(n, mul(ball(), r)), 0.6 + 1.4 * (1 - r / 20), rnd() * 0.8, 0.8 + 2.2 * rnd() ** 3); }   // 星系团：越往里越密越亮
  const seen = new Set();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])]).filter(x => x[0] !== i).sort((x, y) => x[1] - y[1]).slice(0, 3).forEach(([j, L]) => {
      const key = Math.min(i, j) + '-' + Math.max(i, j); if (seen.has(key) || L > 700) return; seen.add(key);
      const b = nodes[j], m = add3(mul(add3(a, b), 0.5), mul(ball(), L * 0.15)), n = Math.min(900, Math.max(80, Math.round(L * 2.2)));
      for (let k = 0; k < n; k++) { const u = rnd(), w = 1 - Math.abs(2 * u - 1), p = add3(mul(a, (1 - u) ** 2), mul(m, 2 * u * (1 - u)), mul(b, u * u));
        put(add3(p, mul(ball(), (2 + 7 * w) * rnd())), 0.35 + 0.5 * rnd(), rnd(), 0.5 + 1.5 * rnd() ** 3);
        if (k % 3 === 0) put(add3(p, mul(ball(), 6 * rnd())), 0.012, 0.6 + 0.29 * rnd(), 10 + 18 * rnd(), 2); }   // 气：大而淡，靛紫
    });
  });
  const np = pts.length / 7, wp = new Float32Array(np * 3), wa = new Float32Array(np * 4);   // 每个点 7 个数：位置 3 个、iA 4 个
  for (let i = 0; i < np; i++) { wp.set(pts.slice(i * 7, i * 7 + 3), i * 3); wa.set(pts.slice(i * 7 + 3, i * 7 + 7), i * 4); }
  const wg = new THREE.InstancedBufferGeometry(); wg.setAttribute('position', BA(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3)); wg.setIndex([0, 1, 2, 2, 1, 3]);
  wg.setAttribute('iP', IA(wp, 3)); wg.setAttribute('iA', IA(wa, 4)); wg.instanceCount = np;
  webG = new THREE.Group(); sc.add(webG);
  webM = new THREE.Mesh(wg, new THREE.ShaderMaterial({ ...add, uniforms: U({ uPx: JZ.px, uRes: JZ.res, uGain: 1, uFar: 1e5, uReveal: 1, uWall: 1, uHole: 0 }), vertexShader: STAR_V, fragmentShader: STAR_F })); webM.frustumCulled = false; webM.renderOrder = 2; webG.add(webM);
  // 一根像雷树的主丝：泡底立着一棵雷树（借 JZ.tree.geo.tree，只留主干和大枝）
  const V = THREE.Color; tmat = new THREE.ShaderMaterial({ ...add, uniforms: U({ ...com(), uT: 99, uKick: k4(), uCore: new V(1.0, 0.95, 0.84), uTint: new V(0.95, 0.52, 0.09), uTint2: new V(0.25, 0.88, 0.63), uGain: 1.2, uSpring: 0, uClip: 90, uLv: 2.2 }), vertexShader: K.TREE_V, fragmentShader: K.TREE_F });
  const tr = new THREE.Mesh(JZ.tree.geo.tree, tmat); tr.frustumCulled = false; tr.renderOrder = 2; tr.position.set(-30, -RV, -40); tr.scale.setScalar(3.2); webG.add(tr);
  // ---- #37 bar46→47 G：网上的星系散成火星屑，沿签名螺旋（从上往下看顺时针，绕树轴转半圈到一圈半）落到星星雷树上，落住了就是树上的星
  const tga = JZ.tree.geo.tree.attributes, tp = tga.position.array, tq = tga.aQ.array, tw = tga.aI2.array, segs = [], cum = []; let tot = 0;   // 每段 4 个顶点，第 1 个的 position 是起点、aQ 是终点、aI2.x 是半宽
  for (let k = 0; k < tp.length / 12; k++) { const a = [tp[k * 12], tp[k * 12 + 1], tp[k * 12 + 2]], b = [tq[k * 12], tq[k * 12 + 1], tq[k * 12 + 2]]; if (a[1] > 50 || b[1] > 50) continue; segs.push([a, b]);
    cum.push(tot += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * Math.max(tw[k * 16], 0.01) ** 1.5); }   // 按粗细加权：星多半落在主干、大枝上，看得出是一棵树，不是一团星云
  const onTree = () => { const x = rnd() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } const [a, b] = segs[lo], u = rnd(); return add3(STB, mul(add3(mul(a, 1 - u), mul(b, u)), STS)); };
  const gals = []; for (let i = 0; i < np; i++) if (pts[i * 7 + 3] === 1) gals.push(i);
  const fl = (b0, b1, w0, w1) => [T[31] + b0 + (b1 - b0) * rnd(), 0.9 + 0.3 * rnd(), rnd(), w0 + (w1 - w0) * rnd() ** 3];   // 出发时刻、飞多久（落地就没了，交给落住的星）、随机、宽
  const sl = []; for (let i = 0; i < 16000; i++) { const g = gals[Math.floor(rnd() * gals.length)]; sl.push([pts.slice(g * 7, g * 7 + 3), onTree(), fl(-0.9, -0.3, 1.2, 4.2)]); }
  for (let i = 0; i < 400; i++) { const g = gals[Math.floor(rnd() * gals.length)]; sl.push([pts.slice(g * 7, g * 7 + 3), add3(NODE, mul(ball(), 6 * rnd() ** 2)), fl(-0.8, -0.3, 1.5, 4.0)]); }   // 最亮的那个结点：收紧的一团，镜头停在 14 外，不穿进去
  stree = mk(sl, `vec3 at(float u) {   // iP0：出发的星系；iV：树上的落点；uTm.xyz：树根（树轴竖直穿过它）
  float d = iA.y, k = clamp(u / d, 0.0, 1.0), e = k * k * (3.0 - 2.0 * k);
  vec3 a = iP0 - uTm.xyz, b = iV - uTm.xyz; float t0 = length(a.xz) > 1e-3 ? atan(a.z, a.x) : 0.0, t1 = length(b.xz) > 1e-3 ? atan(b.z, b.x) : t0;   // 落在树干中轴上的点 atan(0, 0) 是 NaN
  float dt = mod(t1 - t0, 6.2832) + 3.1416, th = t0 + dt * e;
  float r = mix(length(a.xz), length(b.xz), e) * (1.0 + 0.25 * sin(3.1416 * e));
  vec3 tw = vec3(sin(u * 2.1 + iA.z * 60.0), sin(u * 1.7 + iA.z * 31.0), cos(u * 1.9 + iA.z * 47.0)) * 1.2 * e;   // 落住了也轻轻晃：带子两头重合就画不出来
  return uTm.xyz + vec3(cos(th) * r, mix(a.y, b.y, e), sin(th) * r) + tw; }
#define OCC
vec2 sl(vec3 b) { vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(b, 1.0); return c.xy / max(c.w, 0.2) * uRes * 0.5; }
float occ(vec3 b, vec3 pa) { return smoothstep(0.0, 0.45, uT - iA.x) * clamp(14.0 * uPx / max(length(sl(b) - sl(pa)), 1e-3), 0.25, 1.0); }   // 出发后慢慢亮、拖尾越长越暗（审片：90.9 秒一万六千粒火星 0.05 秒就亮满，整屏一亮）`, `vec3 c = vec3(1.0, 0.74, 0.42) * 1.1;`, new THREE.Vector4(...STB, 0));
  stree.material.uniforms.uWs.value = 1;   // 离镜头近的画细（uE 每帧给镜头位置）
  // 落住的星：飞星壳画不出不动的点（带子两头重合），换宇宙网的光点着色器，多一个出现时刻 iT，快落地时一颗颗亮起来
  // 另加 iL：火种从旁边飞过的时刻（E8），过了就亮成青绿的萤火；uG、uEm：#42 满宇宙的光沿签名螺旋卷回火种那一点
  const TV = STAR_V.replace('attribute vec4 iA;', `attribute vec4 iA; attribute float iT, iL; uniform float uT, uG; uniform vec3 uEm;
float gOf(vec3 p) { float g = clamp(uG * 1.6 - 0.6 * fract(dot(p, vec3(0.071, 0.113, 0.037))), 0.0, 1.0); return g * g * (3.0 - 2.0 * g); }   // 这颗星卷回了几成（各颗前后错开）
vec3 gather(vec3 p) { float g = gOf(p);
  vec3 d = p - uEm; float a = 7.85 * g, cs = cos(a), sn = sin(a); d.xz = mat2(cs, sn, -sn, cs) * d.xz; return uEm + d * (1.0 - g); }`)
    .replace('vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(iP, 1.0);', 'vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(gather(iP), 1.0);')
    .replace('vec3 col = h < 0.55', 'float lit = smoothstep(iL, iL + 0.15, uT); vec3 col = h < 0.55')
    .replace('vC = col * iA.y', 'col = mix(col, vec3(0.3, 1.0, 0.62), lit) * (1.0 + 0.6 * lit + 1.0 * lit * exp(-3.0 * max(uT - iL, 0.0))) * (1.0 - 0.5 * smoothstep(0.05, 1.0, uG)) * (1.0 - smoothstep(0.55, 0.95, gOf(iP))); vC = smoothstep(iT, iT + 0.12, uT) * col * iA.y');   // 每颗星快卷到那一点时自己淡掉（一万多颗挤在一点会爆成方块），还在外圈旋的照亮；切进古镇那一刻外圈还在旋（审片：原来最后 2 秒只剩一个点，算不动；聚亮再暗算闪）
  const n2 = sl.length, tp2 = new Float32Array(n2 * 3), ta2 = new Float32Array(n2 * 4), tt2 = new Float32Array(n2);
  sl.forEach((q, i) => { tp2.set(q[1], i * 3); ta2.set([1, 0.5 + 0.8 * rnd(), rnd() < 0.8 ? 0.5 * rnd() : 0.6 + 0.3 * rnd(), 1.0 + 2.0 * rnd() ** 2], i * 4); tt2[i] = q[2][0] + 0.85 * q[2][1]; });   // 八成金白、两成靛紫
  const tg2 = new THREE.InstancedBufferGeometry(); tg2.setAttribute('position', BA(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3)); tg2.setIndex([0, 1, 2, 2, 1, 3]);
  // ---- E8（bar48–56）：火种从那个结点飞出去，在星星雷树（宇宙网）里穿行。路径写在以 NODE 为原点的坐标里：ef 往前（离开镜头）、es 往右、eu 往上
  const ef = mul(ND, -1), es = nrm(cross(ef, Y)), eu = cross(es, ef), EP = (a, b, c) => add3(NODE, mul(ef, a), mul(es, b), mul(eu, c));
  EM = JZ.path([   // 世界坐标；星星雷树大约在 x −385～416、y −526～49、z −504～374，路线一直在树冠里穿，背景总有星
    { t: T[32], p: NODE }, { t: T[32] + 0.6, p: [-12, 10, -35] },   // 出结点慢一点（镜头离它只有 14，冲得太快视线跟着急转）
   
    { t: T[33], p: [-60, -150, -250] },                                     // 冲出去，往下扎进树冠
    ...[0.2, 0.4, 0.6, 0.8].map(k => { const th = (168 + 277.7 * k) * Math.PI / 180; return { t: T[33] + (T[36] - T[33]) * k, p: [200.1 + 266 * Math.cos(th), -150 - 90 * Math.sin(Math.PI * k) + 20 * k, -305.3 + 266 * Math.sin(th)] }; }),   // 第六次：bar49–52 走一段大弧线（圆心 (200, −305)、半径 266，兜 278°，过 bar50 不再往上一窜、来回折），原来的 #39 J 改 A：镜头在后面跟着转过去
    { t: T[36], p: [220, -130, -40] },                                        // #40 bar51→52 B：穿过空洞的泡壁（离中心 RV），钻进空洞
    { t: T[36] + 0.5, p: [110, -70, -70] }, { t: T[37], p: [-20, -90, -120] },
    { t: T[38], p: [-150, -200, -150] },                                      // #41 bar53→54 A：慢下来，镜头绕着它转，飞过的星亮成萤火
    { t: T[39], p: [-200, -260, -100] }, { t: T[40], p: [-210, -270, -90] }, { t: T[41], p: [-211, -271, -90] }]);   // #42 bar55→56 G：满宇宙的光卷回它这一点
  const Ep = (t) => EM(t).p, Ev = (t) => nrm(add3(Ep(t + 0.02), mul(Ep(t - 0.02), -1)));
  // 第六次：镜头一直在火种后面跟（不甩、不绕），跟的是火种前后 ±0.5 秒的平均位置、±0.7 秒的平均方向：它急转弯时镜头走大弧线慢慢跟过去（原来 461°/s、222°/s）
  const EpS = (t, w) => { let a = [0, 0, 0]; for (let k = -6; k <= 6; k++) a = add3(a, Ep(t + k * w / 6)); return mul(a, 1 / 13); }, EvS = (t) => nrm(add3(EpS(t + 0.7, 0.7), mul(EpS(t - 0.7, 0.7), -1)));
  const behind = (t, d, up = 15) => add3(EpS(t, 0.5), mul(EvS(t), -d), mul(Y, up));
  W.EpS = EpS; W.EvS = EvS; W.NODE0 = add3(NODE, mul(ND, -60));   // NODE0：结点后面远处同一条视线上（E8 开头视线从它过渡到火种，镜头贴着结点时不急转）
  CE = JZ.path([
    { t: T[32], p: add3(NODE, mul(ND, 14)), fov: 48, up: Y }, { t: T[32] + 0.8, p: behind(T[32] + 0.8, 90, 5), fov: 52, up: Y },   // 推进结点以后接着往前跟着火种走（第六次：原来先退出来再穿回去追，来回两次）
    ...(() => {   // bar49–54：每 0.25 秒一个机位，都在它后面（距离、高度按下表线性变）；关键帧稀了镜头会走弦、视线甩
      const D = [[T[33], 90, 25], [T[34] - 0.5, 90, 20], [T[34], 85, 15], [T[34] + 0.5, 70, 15], [T[35], 90, 20], [T[36] - 0.4, 80, 15], [T[36], 50, 8], [T[36] + 0.5, 60, 15], [T[37], 70, 15], [T[38], 65, 15]];
      const at = (t) => { let i = 0; while (i < D.length - 2 && t > D[i + 1][0]) i++; const k = Math.min(1, Math.max(0, (t - D[i][0]) / (D[i + 1][0] - D[i][0]))); return [1, 2].map(j => D[i][j] + (D[i + 1][j] - D[i][j]) * k); };
      const out = []; for (let t = T[33]; t < T[38] - 0.1; t += 0.25) { const [d, u] = at(t); out.push({ t, p: behind(t, d, u), fov: 55, up: Y }); }
      return out; })(),   // #39 bar49→50 A（原 J）：火种兜大弧线，镜头在后面跟着转过去；#40 B 贴着它穿过泡壁；#41 bar53→54 A：在它后面跟（不绕），变的是它飞过的结点一个个亮成萤火
    { t: T[38] + 1.0, p: add3(EpS(T[38] + 1.0, 0.5), [63, 50, 90]), fov: 54, up: Y },   // 它慢下来，镜头不停也不往回走：接着往前、往 +z 那边拐，再退到它正面（视线一直往一个方向转）
    { t: T[39], p: add3(Ep(T[39]), mul(ND, 300), [0, 100, 0]), fov: 55, up: Y },
    { t: T[40], p: add3(Ep(T[40]), mul(ND, 520), [0, 160, 0]), fov: 56, up: Y },                                       // 退远看满宇宙的光卷回来
    { t: T[41], p: add3(Ep(T[41]), mul(ND, 260), [0, 80, 0]), fov: 54, up: Y }]);
  W.ember = { Ep, Ev, NODE, EP };
  // 星：火种从旁边 55 以内飞过的，记下那一刻（iL）
  const tl2 = new Float32Array(n2).fill(1e9), smp = []; for (let t = T[32]; t <= T[40]; t += 0.02) smp.push([t, Ep(t)]);
  for (let i = 0; i < n2; i++) { let bd = 55 * 55, bt = 1e9; const x = tp2[i * 3], y = tp2[i * 3 + 1], z = tp2[i * 3 + 2];
    if (Math.hypot(x - NODE[0], y - NODE[1], z - NODE[2]) < 40) continue;   // 出发的那个结不点（不然一大团绿在画面里停好几秒）
    for (const [t, q] of smp) { const d = (x - q[0]) ** 2 + (y - q[1]) ** 2 + (z - q[2]) ** 2; if (d < bd) { bd = d; bt = t; } } tl2[i] = bt; }
  tg2.setAttribute('iP', IA(tp2, 3)); tg2.setAttribute('iA', IA(ta2, 4)); tg2.setAttribute('iT', IA(tt2, 1)); tg2.setAttribute('iL', IA(tl2, 1)); tg2.instanceCount = n2;
  tstar = new THREE.Mesh(tg2, new THREE.ShaderMaterial({ ...add, uniforms: U({ uPx: JZ.px, uRes: JZ.res, uGain: 1, uFar: 1e5, uReveal: 1, uWall: 1, uT: 0, uG: 0, uEm: new THREE.Vector3() }), vertexShader: TV, fragmentShader: STAR_F }));
  tstar.frustumCulled = false; tstar.renderOrder = 2; sc.add(tstar);
  W.ember.stars = tp2;   // 调路线时量火种周围有多少星用
  // 火种：白热的芯、一圈像火苗一样起伏慢转的金橙光冠、一道细光环、慢慢转的四长四短星芒、六粒绕着转的小光点（用户 2026-11-20：光团不够美，要画美）
  // 世界里半径 uR，芯和光冠在画面上 6–110 像素（擦着镜头过去时不能一下撑满画面，算闪）；星芒、光点伸到 2.6 倍，往外淡到 0，看不出方片的边
  emb = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...add, uniforms: U({ uEm: new THREE.Vector3(), uR: 7, uI: 0, uT: 0, uPx: JZ.px, uRes: JZ.res }),
    vertexShader: `uniform vec3 uEm; uniform float uR, uPx; uniform vec2 uRes; varying vec2 vU;
void main() { vec4 c = projectionMatrix * viewMatrix * vec4(uEm, 1.0); vU = position.xy * 2.6; if (c.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float px = clamp(uR * projectionMatrix[1][1] * uRes.y * 0.5 / c.w, 6.0 * uPx, 110.0 * uPx); c.xy += vU * px / (uRes * 0.5) * c.w; gl_Position = c; }`,
    fragmentShader: `uniform float uI, uT; varying vec2 vU;
void main() { float r2 = dot(vU, vU), r = sqrt(r2), a = atan(vU.y, vU.x);
  vec3 c = vec3(1.0, 0.96, 0.88) * exp(-r2 * 40.0) * 5.0;
  float w = 1.0 + 0.16 * sin(5.0 * a + uT * 1.7) + 0.1 * sin(8.0 * a - uT * 2.6) + 0.06 * sin(13.0 * a + uT * 3.9), rr = r / w;
  c += vec3(1.0, 0.5, 0.14) * exp(-rr * rr * 6.0) + vec3(0.9, 0.22, 0.05) * exp(-rr * rr * 1.8) * 0.32;
  c += vec3(1.0, 0.74, 0.42) * exp(-pow((r - 1.1) / 0.1, 2.0)) * 0.09;
  float an = uT * 0.25; vec2 p = mat2(cos(an), sin(an), -sin(an), cos(an)) * vU, d = mat2(0.7071, 0.7071, -0.7071, 0.7071) * p;
  float sp = exp(-abs(p.y) * 50.0 - abs(p.x) * 1.3) + exp(-abs(p.x) * 50.0 - abs(p.y) * 1.3) + 0.5 * (exp(-abs(d.y) * 70.0 - abs(d.x) * 2.6) + exp(-abs(d.x) * 70.0 - abs(d.y) * 2.6));
  c += vec3(1.0, 0.86, 0.62) * sp * 0.5 * (0.85 + 0.15 * sin(uT * 5.0));
  for (int i = 0; i < 6; i++) { float fi = float(i), ph = fi * 1.047 + uT * (0.6 + 0.15 * fi); vec2 e = vU - vec2(cos(ph), 0.6 * sin(ph)) * (1.3 + 0.35 * sin(fi * 2.3 + uT * 0.7)); c += vec3(1.0, 0.8, 0.5) * exp(-dot(e, e) * 300.0) * 0.8; }
  gl_FragColor = vec4(c * uI * (1.0 - smoothstep(1.8, 2.6, r)), 1.0); }` }));
  emb.frustumCulled = false; emb.renderOrder = 3; sc.add(emb);
  // 火种的尾巴：一路往后喷的火星屑（出生在火种当时的位置，往后、往四周散，越飞越慢，金黄 → 橙红 → 熄成灰）
  const tr2 = []; for (let i = 0; i < 12000; i++) { const tb = T[32] + 0.2 + (T[40] - T[32] - 0.2) * rnd(), v = Ev(tb), sp = 3 + 20 * rnd();
    tr2.push([add3(Ep(tb), mul(ball(), 2.5)), add3(mul(v, -sp), mul(ball(), 14 * rnd())), [tb, 0.5 + 1.1 * rnd(), rnd(), 0.12 + 0.3 * rnd() ** 2]]); }
  trail = mk(tr2, `vec3 at(float u) { return iP0 + iV * (1.0 - exp(-u * 1.5)) / 1.5; }`,
    `vec3 c = mix(mix(vec3(1.0, 0.75, 0.4), vec3(0.9, 0.22, 0.05), smoothstep(0.05, 0.6, vK)), vec3(0.16, 0.15, 0.15), smoothstep(0.6, 0.95, vK)) * 1.2;`, new THREE.Vector4());
  trail.material.uniforms.uWs.value = 1;
  W.stats = { web: np, stree: sl.length };
};

const pose = (C) => {
  cam.fov = C.fov; cam.position.set(...C.p); cam.up.set(...C.up); cam.lookAt(...C.l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements, u = sky.material.uniforms;
  u.uCam.value.copy(cam.position); u.uRight.value.set(e[0], e[1], e[2]); u.uUp.value.set(e[4], e[5], e[6]); u.uFwd.value.set(-e[8], -e[9], -e[10]); u.uTanH.value = Math.tan(C.fov * Math.PI / 360);
};
const Ep = (t) => EM(t).p, Ev = (t) => nrm(add3(Ep(t + 0.02), mul(Ep(t - 0.02), -1)));   // E8 火种的位置、方向
W.pose = (t, M, view) => {   // 摆好这一刻的世界，返回 { sc, cam }。view：A 炸开到星系、H 恒星、W 宇宙网（不给就按时间）
  view = view || (t < T[28] ? 'A' : t < T[29] ? 'H' : 'W');
  const E8 = view === 'W' && t >= T[32];
  if (E8) { const C = CE(t), lead = M.smooth(T[34] - 0.1, T[34] + 0.3, t) * (1 - M.smooth(T[37], T[37] + 0.6, t)); const k0 = M.smooth(T[32], T[32] + 1.6, t); pose({ ...C, l: add3(mul(W.NODE0, 1 - k0), mul(add3(W.EpS(t, 0.25), mul(W.EvS(t), 30 * lead)), k0)) }); }   // 看着火种（前后 ±0.25 秒的平均，转得不急）；追的时候看它前面一点
  else pose(view === 'W' && t < T[29] ? { ...CW(T[29]), p: [0, 0, 100 * Math.hypot(...CH(t).p)] } : (view === 'A' ? CA : view === 'H' ? CH : CW)(t));   // 叠化里（bar29 前）：离空洞中心的距离 = 离恒星的距离 × RV / RSTAR，环一样大、一样在变大
  const u = sky.material.uniforms, tau = t - T[25], A = view === 'A';
  u.uT.value = t; u.uMode.value = view === 'H' ? 3 : view === 'W' ? 4 : 0;
  const ks = kicks.filter(k => k.t <= t).slice(-4).reverse();
  for (const arr of [u.uKick.value, tmat.uniforms.uKick.value]) arr.forEach((v, i) => ks[i] ? v.set(t - ks[i].t, ks[i].s) : v.set(99, 0));
  u.uCore.value = A ? 0.05 + 0.5 * M.smooth(-0.05, 0.2, tau) * Math.exp(-Math.max(tau - 0.2, 0) * 1.5) * (1 - M.smooth(T[26] + 0.3, T[27], t)) : 0;
  u.uShell.value = A ? 1 - M.smooth(T[26] + 0.15, T[26] + 0.75, t) : 0;   // 扫过镜头以后就淡掉，不和星云叠色
  u.uNeb.value = A ? M.smooth(T[25] + 0.05, T[26] + 0.2, t) * (1 - M.smooth(T[27] - 0.45, T[27] + 0.45, t)) : 0;   // 冲出星云：气越往外越稀   // 炸开的光慢慢把周围的气照亮
  u.uGal.value = A ? M.smooth(T[26] + 0.6, T[27] - 0.3, t) * (1 - 0.85 * M.smooth(T[28] - 1.0, T[28] - 0.3, t)) : 0; u.uDust.value = A ? 1 : 0;   // 扎近核时盘面压暗，不洗白
  if (view === 'H') {   // bar29 前一颗行星从旁边滑到镜头和恒星正中间，正好把它挡住，只剩日冕那一圈
    const C = CH(t), d = Math.hypot(...C.p), to = mul(C.p, -1 / d), sd = nrm(cross(to, [0, 1, 0])), off = 4.5 * (1 - M.smooth(T[29] - 1.0, T[29] - 0.05, t)), a = RSTAR / d;
    u.uPl.value.set(...add3(C.p, mul(to, 4.0), mul(sd, off)), 4.0 * a / Math.sqrt(1 - a * a) * 1.03);
  }
  u.uHaze.value = view === 'H' ? 0.6 * (1 - M.smooth(T[28] - 0.45, T[28] - 0.05, t)) : 0;
  u.uSpaceI.value = view === 'W' ? 1.2 * (1 - 0.6 * M.smooth(T[30] + 0.6, T[31], t)) : A ? 0.2 + 1.0 * M.smooth(T[25], T[25] + 1.6, t) : 1.0;   // 炸开以后星空亮起来；最后缩成一粒光时才暗下去
  u.uMote.value = view === 'W' ? 0.6 * M.smooth(T[30] + 0.8, T[31], t) * (1 - M.smooth(T[32] - 0.2, T[32] + 0.3, t)) : 0;   // 火种从那一粒光里亮起来时它就淡掉（原来一直留在画面正中，火种旁边多一粒白点）
  burst.visible = A && t < T[27] + 0.3; galG.visible = A && t > T[27] - 1.1; webG.visible = view === 'W' && (t < T[31] + 0.3 || t > T[35]);
  for (const m of [burst, ...gal]) m.material.uniforms.uT.value = t;
  burst.material.uniforms.uDim.value = (0.25 + 0.75 * M.smooth(T[25] + 0.1, T[25] + 0.7, t)) * (1 - M.smooth(T[26] + 0.8, T[27] - 0.1, t));   // 碎片：炸开时慢慢亮，出星云前慢慢淡掉（不能一下关掉）
  const gd = M.smooth(T[27] - 1.1, T[27] - 0.2, t); gal.forEach((m, i) => { m.material.uniforms.uDim.value = gd * (1 - (i === 2 ? 1.0 : 0.92) * M.smooth(T[28] - 2.1, T[28] - 0.45, t)); });   // 审片：84.7 秒推近时星越来越大、越来越亮，接着切进恒星一下暗下去，算闪——提早压暗   // 扎近核时星压暗；尘埃带挡着时就淡进来（挡住的那片看不见），让开时一片片露出来
  if (galG.visible) { const e = cam.position.clone().applyMatrix4(galG.matrix.clone().invert()); gal.forEach(m => { m.material.uniforms.uWs.value = 1; m.material.uniforms.uE.value.copy(e); }); }   // 离镜头近的星画细，不糊成大亮斑
  const wa = Math.asin(Math.min(1, 260 / cam.position.length())), wk = view === 'W' && t < T[30] ? Math.min(1, Math.pow(Math.asin(RSTAR / 8.6) / wa, 4.5)) + (1 - Math.min(1, Math.pow(Math.asin(RSTAR / 8.6) / wa, 4.5))) * M.smooth(T[29] + 0.9, T[30] - 0.1, t) : 1;   // bar30 前慢慢回到 1（不在 bar30 一下跳亮）   // 泡壁在画面上越大每颗星越暗，整屏总亮度不变（审片：88.2 秒推近泡壁时整屏一亮）
  webM.material.uniforms.uReveal.value = M.smooth(T[29], T[29] + 0.7, t) * (1 - M.smooth(T[31], T[31] + 0.3, t)) * (0.25 + 0.75 * wk);   // 结点、细丝也跟着泡壁迎面推近时压一点
  webM.material.uniforms.uWall.value = (1 - 0.7 * M.smooth(T[29] + 0.25, T[29] + 1.2, t)) * wk; webM.material.uniforms.uHole.value = t < T[29] + 0.55 ? 1.1 * (1 - M.smooth(T[29] - 0.2, T[29] + 0.55, t)) : 0;   // 泡壁在镜头推近之前就铺满、接着慢慢暗下去（审片：原来铺满时已经占满整屏，88.2 秒一亮）   // 泡壁只在接日全食那个环时特别亮
  const far = M.smooth(T[31] - 0.7, T[31] + 0.1, t);   // #37：网散成火星屑飞走，网自己淡掉
  stree.visible = view === 'W' && t < T[32] + 0.3; const su = stree.material.uniforms; su.uT.value = t; su.uE.value.copy(cam.position);
  su.uDim.value = 0.3; tstar.visible = view === 'W'; const tu = tstar.material.uniforms; tu.uT.value = t;
  const em = Ep(Math.min(Math.max(t, T[32]), T[41])); tu.uEm.value.set(...em); tu.uG.value = M.smooth(T[39] - 0.2, T[41] + 0.9, t);   // 一直卷到切进古镇那一刻（审片：原来 bar56 刚过就卷完，最后 2 秒只剩黑底上一个光点，算不动）
  emb.visible = view === 'W' && t > T[32] - 0.3; emb.material.uniforms.uEm.value.set(...em); emb.material.uniforms.uT.value = t; const kk = kicks.filter(k => k.t <= t).pop();   // 底鼓：火种亮一下，很快回落
  emb.material.uniforms.uI.value = M.smooth(T[32] - 0.7, T[32] + 0.25, t) * (1 + 0.8 * M.smooth(T[39], T[40] + 0.5, t)) * (1 + (E8 && kk ? 0.35 * Math.exp(-(t - kk.t) * 8) : 0));
  trail.visible = E8; trail.material.uniforms.uT.value = t; trail.material.uniforms.uE.value.copy(cam.position);
  const wallI = M.smooth(T[35] + 0.6, T[36] - 0.3, t) * (1 - M.smooth(T[36] + 0.3, T[37] - 0.3, t)) * (1 - 0.65 * M.smooth(T[36] - 0.5, T[36] - 0.15, t) * (1 - M.smooth(T[36] + 0.05, T[36] + 0.4, t)));   // #40：空洞的泡壁只在穿过去的前后亮；贴着穿过去那一下压暗（整壳铺满画面，算闪）
  webM.material.uniforms.uGain.value = (1 - 0.45 * M.smooth(T[30] - 0.05, T[30] + 0.3, t)) * Math.max(1 - far, 0.8 * wallI); tmat.uniforms.uGain.value = 2.6 * (1 - M.smooth(0, 0.6, far));   // 退出泡壁时进画面的结点越来越多，整张网同步压暗
  return { sc, cam };
};
W.circle = (t) => { const C = CA(t), d = Math.hypot(C.p[0] - G[0], C.p[1] - G[1], C.p[2] - G[2]), r = 0.5 * (RC * SCL / d) / Math.tan(C.fov * Math.PI / 360); return r + (1.3 - r) * Math.max(0, Math.min(1, (t - T[28] + 0.25) / 0.28)) ** 2; };
W.draw = (ctx, s, M) => {
  const t = s.t;
  if (t > T[28] - 0.45 && t < T[28] + 0.05) {   // bar27→28：星系的核越放越大，圆里已经是那颗恒星
    const r = W.circle(t); return JZ.blend(ctx, M, () => W.pose(t, M, 'A'), () => W.pose(t, M, 'H'), { c: [0.5, 0.5], r, soft: 0.02 + 0.12 * r });
  }
  if (t > T[29] - 0.2 && t < T[29] + 0.15) return JZ.blend(ctx, M, () => W.pose(t, M, 'H'), () => W.pose(t, M, 'W'), { k: M.smooth(T[29] - 0.2, T[29] + 0.15, t) });   // bar28→29：日全食的光环叠化成空洞的泡壁（用户 2026-11-20：原来 6 帧，黑圈一下变光球；现在 0.35 秒，泡壁先只亮边上那一圈，再往里慢慢铺满，见 uHole）
  const a = W.pose(t, M); JZ.present(ctx, M, a.sc, a.cam);
};
})();
