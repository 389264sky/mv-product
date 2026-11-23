// jz_lake.js —— 第一段的世界（bar1–8，加最后一镜 bar31）：夜里群山围着的湖，湖心悬着一粒火星（一小块炭）。
// 底鼓砸出金涟漪；bar3 火星烧起来（火苗、烟、军鼓溅出的火星屑）；bar5–6 火光一拍照亮一层山；
// bar7 一粒火星屑飞进树林，山火烧起来；bar8 山火的火星屑被吸回火星，「火」字一到火窜上山。
// 时间是歌曲时间（秒）；水面 y = 0。山在 jz_land.js，粒子零件借 jz_tree.js 的 JZ.kit。镜头整段走一条路径（CAM），不按镜头名分。
(() => {
const JZ = window.JZ, W = JZ.lake = {};
let THREE, K, sc, cam, sky, flies, fire, T, TF, RB, kicks, CAM, beat, BB, CW, CL, FB, spkM, snowM;
const E = [0, 0.12, 0];   // 火星浮在水面上，下沿没进水里一点（原来悬在 1.0 高的空中，像挂着）
const VERT = `varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FL0 = 4, FLV = 3.5, LEAP = 45;             // 火线：bar7 开头在水边那排树后面（高 4），一秒往上爬 3.5；「火」字一到再窜 45
const IG = [38.4, -35.0];                        // 山火从这里烧起来（飞过去的那粒火星屑落在这）
const RR = [40, 80, 110, 150, 200, 270, 420];    // 火星的光一拍照亮一层山：照到多远

// ---------- 全屏：夜空、山、山火和烟、火星和它的火苗、湖面 ----------
const FIRE = `
uniform float uFL, uFI, uFJ; uniform vec2 uFd, uWind; uniform vec3 uIg;   // 火线多高、火多旺、「火」字窜了多少、哪一面山在烧、风向、起火点（xy）和烧开了多远（z）
float fireU(vec4 L, float lv) { return L.r + (L.a - 0.5) * 26.0 - lv; }   // 这一点比火线高多少：0 是火头，负的是烧过的
float fireI(vec2 x, vec4 L) {   // 这一段山坡烧得多旺：从起火点往外烧开；火带是一段一段的；有树才烧，水边那一排不烧
  float m = textureLod(uLand, mat2(0.8, -0.6, 0.6, 0.8) * x / 1100.0 + 0.5, 3.0).a;
  return uFI * (1.0 - smoothstep(uIg.z - 12.0, uIg.z, distance(x, uIg.xy))) * smoothstep(0.82, 0.94, dot(normalize(x + 1e-4), uFd) + 0.3 * (m - 0.5)) * smoothstep(0.36, 0.50, m) * smoothstep(1.2, 3.0, L.r) * smoothstep(0.05, 0.4, forest(L));
}
float fireB(float u, float j) { return (1.0 - smoothstep(-0.2, 0.9, u)) * smoothstep(-4.5 - j, -1.2 - j, u); }   // 火带：火头后面这么宽的一条在烧（j：窜上去的那一截也都在烧）
float burnt(float u, float I) { return min(I, 1.0) * (1.0 - smoothstep(-6.0 - uFJ, -2.0 - uFJ, u)); }           // 烧过了几成
`;
const LAKE_F = `
uniform vec3 uCam, uFwd, uRight, uUp, uE, uMoon, uHeroV; uniform vec4 uHero; uniform float uTanH, uAspect, uT, uEI, uReach, uFlame, uSmoke; uniform vec2 uRes;
uniform float uIce, uOpen, uSnow, uMoonI; uniform vec4 uHB;   // 前奏、A2 的冬天：冰盖多少、火种周围融开多大（也是山上雪化开的前沿）、山上的雪、月盘亮度、bar7 那颗气泡（xz、深、半径）
uniform float uRk[32]; uniform vec4 uSc[6]; uniform vec2 uKick[4]; uniform mat3 uRm;
// 春天（整首 bar57 起，jz_spring.js 给；uSpr = 0 时和原来一模一样）：天光、晨雾、雨、桃树开花、新叶发光、夜里的星和银河
uniform vec4 uCD, uCV; uniform float uUnder, uMistH, uWv, uSpr, uRain, uMist, uPeach, uStar, uBV, uBR, uLeafE, uBlosE, uGlowR; uniform vec3 uKey, uAmb, uHaze, uSkyZ, uSkyH, uSkyS, uMistC, uWat; uniform vec4 uBP[24], uRing, uDr[8]; uniform float uDrS; uniform vec4 uShk, uGE[16]; uniform float uGV[16];
vec3 AMB, KEY, HAZE;   // 这一帧的底光、主光、远处的空气色
varying vec2 vP;
uniform sampler2D uFR; uniform mat4 uFRm; uniform float uFRk;   // 仙女的倒影（jz_spring.js 用镜像机位单独渲进 uFR；uFRm：那台机位的投影 × 视图；uFRk 0 = 没有）
uniform float uToon;   // 国风仙侠（后半段画风，plan.md 第 5 节）：0 照原来；1 色板、两阶明暗、金边、利落的云、轮廓线
uniform highp sampler2D uGB, uGBM; uniform float uMeshT, uPQ;   // uGBM：倒影那张几何缓冲；uPQ：步子放粗几倍（预览 1.7，成片 1）
int gM = -1; vec3 gN; vec2 gC; float gAO, gX; bool gNoTree = false;   // 网格树（jz_trees.js 的几何缓冲）：材质（0 桃枝 1 桃花 2 针叶树干 3 针叶）、法线、树干在哪、多暗、花瓣里外 / 沿枝几成；gNoTree：这条视线不画色块树
void meshG(vec4 g) {   // 解几何缓冲的一个像素：x 距离，y 八面体编码的法线，z 材质和格子，w 暗和细节（都是整数，float32 存得下）
  float cd = g.z, m = floor(cd / 2097152.0); cd -= m * 2097152.0; float gr = floor(cd / 1048576.0); cd -= gr * 1048576.0;
  ivec2 ic = ivec2(int(floor(cd / 1024.0)) - 512, int(mod(cd, 1024.0)) - 512); uint h = h3(uvec3(ivec3(ic + 8192, int(gr) + 1)));
  vec2 w = vec2(ic) + 0.5 + (vec2(float(h & 1023u), float((h >> 10) & 1023u)) / 1023.0 - 0.5) * 0.34;
  gC = gr < 0.5 ? w / 0.42 : transpose(mat2(0.8, -0.6, 0.6, 0.8)) * ((w - 7.3) / 0.5);   // 树干 xz：同 treeId()
  vec2 q = vec2(floor(g.y / 4096.0), mod(g.y, 4096.0)) / 4095.0 * 2.0 - 1.0; vec3 n = vec3(q.x, 1.0 - abs(q.x) - abs(q.y), q.y);
  if (n.y < 0.0) n.xz = (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0);
  gN = normalize(n); gM = int(m); gAO = floor(g.w / 256.0) / 255.0; gX = mod(g.w, 256.0) / 255.0;
}
float meshR(vec3 P, vec3 rr, float tw) {   // 倒影里的网格树：反射光线 rr 翻到水面下，就是在翻下去的那片树里沿直线走；投回画面，在倒影几何缓冲里查。返回从水面 P 到树多远（没有 1e9），顺手设好 gM 等
  vec2 sz = vec2(textureSize(uGBM, 0)); vec4 g0 = texelFetch(uGBM, ivec2((vP * 0.5 + 0.5) * sz), 0);
  vec3 Q = P + vec3(rr.x, -rr.y, rr.z) * (g0.x > 0.0 ? max(g0.x - tw, 0.5) : 30.0) - uCam; float z = dot(Q, uFwd);   // 走多远先拿没打歪时那个像素的距离估
  if (z <= 0.0) return 1e9;
  ivec2 ip = ivec2((vec2(dot(Q, uRight) / (uAspect * uTanH), dot(Q, uUp) / uTanH) / z * 0.5 + 0.5) * sz);
  if (any(lessThan(ip, ivec2(0))) || any(greaterThanEqual(ip, ivec2(sz)))) return 1e9;
  vec4 g = texelFetch(uGBM, ip, 0); if (g.x <= 0.0) return 1e9;
  meshG(g); gN.y = -gN.y; return max(g.x - tw, 0.01);
}

float moonAlb(vec2 q) {   // 月面（单位圆里的坐标，往右、往上）：几片连着的月海、几个带亮边的环形山、边上暗一点。天上的月亮和 bar5–7 冰里那颗气泡映的是同一张（用户 2026-11-20：气泡像个白点，看不出为什么对着它）
  float m = fbm(vec3(q * 1.5 + vec2(3.1, 1.7), 5.0), 4), mare = smoothstep(0.46, 0.6, m + 0.14 * (q.y - q.x));   // 月海偏左上
  float a = 0.95 - 0.42 * mare + 0.1 * (fbm(vec3(q * 8.0, 2.0), 3) - 0.5);
  for (int i = 0; i < 7; i++) { vec2 c = vec2(h01(uvec3(uint(i), 7u, 3u)), h01(uvec3(uint(i), 8u, 3u))) * 1.5 - 0.75; float d = length(q - c) / (0.05 + 0.1 * h01(uvec3(uint(i), 9u, 3u)));
    a += 0.22 * exp(-pow((d - 1.0) / 0.16, 2.0)) - 0.12 * (1.0 - smoothstep(0.5, 1.0, d)); }
  return a * (0.78 + 0.22 * sqrt(max(1.0 - dot(q, q), 0.0)));
}
vec3 skyN(vec3 rd) {   // 夜空：天边亮一点（朝月亮那边更亮），云缝里有星，月亮和月晕，薄云透月光，靠火那一面的云底映红
  float y = max(rd.y, 0.0), md = max(dot(rd, uMoon), 0.0), ma = max(dot(normalize(rd.xz + 1e-5), normalize(uMoon.xz)), 0.0);
  vec3 c = mix(vec3(0.018, 0.025, 0.050) + vec3(0.030, 0.036, 0.050) * ma * ma, vec3(0.0025, 0.0035, 0.011), pow(y, 0.4)) + vec3(0.10, 0.12, 0.20) * (0.9 * pow(md, 60.0) + 0.22 * pow(md, 6.0)) * uMoonI;   // 月晕跟月盘一起压（bar7 长焦对着月亮）
  { vec3 mR = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0))), mU = cross(mR, uMoon); float th = sqrt(max(2.0 - 2.0 * dot(rd, uMoon), 0.0)), px = 1.5 * uTanH / uRes.y;   // 月亮盘（半径 0.0105 rad，比真的大一点）：边按像素宽羽化，bar7 长焦下不糊
    if (th < 0.0105 + 2.0 * px) c += vec3(1.0, 0.96, 0.88) * 6.0 * uMoonI * (1.0 - smoothstep(0.0105 - px, 0.0105 + px, th)) * moonAlb(vec2(dot(rd, mR), dot(rd, mU)) / 0.0105); }
  vec3 q = rd * 260.0, ci = floor(q); float h = h01(uvec3(ivec3(ci) + 1024));
  c += vec3(0.9, 0.95, 1.1) * step(0.985, h) * pow((h - 0.985) / 0.015, 2.0) * (1.0 - smoothstep(0.05, 0.35, length(q - ci - 0.5))) * smoothstep(0.02, 0.2, rd.y) * 0.8;
  float n = fbm(vec3(rd.xz / (y + 0.12) * 0.55 + vec2(uT * 0.004, 0.0), 1.7), 5), cov = smoothstep(0.42, 0.68, n);
  vec3 cc = vec3(0.006, 0.008, 0.017) + vec3(0.16, 0.19, 0.28) * pow(md, 4.0) * (1.0 - smoothstep(0.42, 0.95, n)) * uMoonI
    + vec3(0.12, 0.030, 0.006) * uFI * exp(-y * 5.0) * smoothstep(0.3, 0.9, dot(normalize(rd.xz + 1e-5), uFd)) * (0.3 + 0.7 * n);
  return mix(c, cc, cov * smoothstep(0.0, 0.10, rd.y));
}

vec3 skyS(vec3 rd) {   // 春天的天：天边鱼肚白、太阳那边暖，天顶蓝灰；云被太阳照亮，下雨时压低压暗；夜里（uStar）星空和银河
  float y = max(rd.y, 0.0), sd = max(dot(rd, uMoon), 0.0), sa = max(dot(normalize(rd.xz + 1e-5), normalize(uMoon.xz + 1e-5)), 0.0);
  vec3 c = mix(uSkyH, uSkyZ, pow(y, 0.45)) + uSkyS * (0.5 * pow(sd, 10.0) + 0.35 * pow(sa, 3.0) * exp(-y * 4.0));
  c += uSkyS * 3.0 * smoothstep(0.99985, 0.99992, sd) * step(0.0, uMoon.y);   // 日轮（在地平线以上才有）
  if (uStar > 0.0) {   // 星：一格一颗，亮的稀；银河：一条斜过天顶的带子，带暗尘埃带，带心偏暖
    vec3 q = rd * 300.0, ci = floor(q); float h = h01(uvec3(ivec3(ci) + 1024)), st = step(0.965, h) * pow((h - 0.965) / 0.035, 3.0) * (1.0 - smoothstep(0.05, 0.4, length(q - ci - 0.5)));
    vec3 mw = normalize(vec3(-0.389, -0.153, 0.908)); float bd = dot(rd, mw), band = exp(-bd * bd / 0.018), dust = smoothstep(0.42, 0.62, fbm(rd * 11.0, 5)) * exp(-bd * bd / 0.004);   // 银河带：经过方位 36°、仰角 55°（最亮那团），往西南落到山上
    c += uStar * smoothstep(0.0, 0.12, rd.y) * (vec3(0.9, 0.95, 1.1) * st * (0.7 + 2.5 * band) + (vec3(0.16, 0.17, 0.24) * band * (0.5 + 0.9 * fbm(rd * 26.0 + 3.0, 4)) + vec3(0.30, 0.22, 0.14) * exp(-bd * bd / 0.0035)) * 0.12 * (1.0 - 0.85 * dust)
      + vec3(1.0, 0.82, 0.6) * 0.09 * exp(-dot(rd - vec3(0.464, 0.819, 0.337), rd - vec3(0.464, 0.819, 0.337)) / 0.03) * (1.0 - 0.6 * dust));   // 银河最亮的那一团（方位 36°、仰角 55°，#66 E 萤火虫的旋接这里）
  }
  float n = fbm(vec3(rd.xz / (y + 0.12) * 0.55 + vec2(uT * 0.01, 0.0), 1.7), 5), cov = smoothstep(0.50 - 0.22 * uRain, 0.76, n);
  vec3 cc = mix(uSkyH * 0.8, uSkyZ * 0.7, 0.35) * (1.0 - 0.45 * uRain) + uSkyS * 1.2 * pow(sd, 3.0) * (1.0 - smoothstep(0.45, 0.95, n));
  if (uToon > 0.0) {   // 国风：云边利落，朝太阳那面奶白、背面粉紫，靠太阳的云边一道金
    float n2 = fbm(vec3((rd.xz / (y + 0.12) - normalize(uMoon.xz + 1e-5) * 0.05) * 0.55 + vec2(uT * 0.01, 0.0), 1.7), 5), lt = smoothstep(-0.015, 0.02, n - n2), eg = smoothstep(0.56, 0.585, n) * (1.0 - smoothstep(0.585, 0.64, n));
    cov = mix(cov, smoothstep(0.56, 0.585, n), uToon);
    cc = mix(cc, mix(uSkyH * vec3(0.78, 0.66, 0.88), uSkyH * 1.15 + uSkyS * 0.6, lt) * (1.0 - 0.45 * uRain) + vec3(1.0, 0.75, 0.40) * (uSkyS * 2.0 + uSkyH * 0.3) * eg * pow(sd, 2.0), uToon);
  }
  return mix(c, cc, cov * smoothstep(0.0, 0.10, rd.y) * (1.0 - 0.7 * uStar));
}
vec3 sky(vec3 rd) { if (uSpr >= 1.0) return skyS(rd); if (uSpr > 0.0) return mix(skyN(rd), skyS(rd), uSpr); return skyN(rd); }   // 夜空朝正上方（倒影里）会算出 NaN，0 倍也传染：全春天时不算它

vec4 deck(vec3 ro, vec3 rd, float td) {   // 云层（D14）：y = uCD.z 一层，绕 uCD.xy 打旋（从上往下看顺时针），中间风眼（半径 uCV.y），「清」时眼一下张开；uCV.x 转多快
  if (uCD.w <= 0.0 || abs(rd.y) < 1e-4) return vec4(0.0);
  float tc = (uCD.z - ro.y) / rd.y; if (tc <= 0.0 || tc > td) return vec4(0.0);
  vec2 d = ro.xz + rd.xz * tc - uCD.xy; float r = length(d), th = atan(d.y, d.x), ph = th - uCV.x * uT - 1.9 * log(1.0 + r / 45.0);
  vec2 q = vec2(cos(ph), sin(ph)) * r; float n = fbm(vec3(q * 0.011, 1.3), 5), n2 = fbm(vec3(q * 0.045, 4.1), 4), arm = 0.5 + 0.5 * cos(2.0 * ph);
  float a = smoothstep(0.32, 0.6, 0.75 * n + 0.22 * arm + 0.12 * n2) * smoothstep(uCV.y, uCV.y * 1.7 + 10.0, r + 25.0 * (n2 - 0.5));
  vec3 top = vec3(0.92, 0.93, 0.96) * (KEY * (0.55 + 0.6 * n2) + AMB * 2.2), bot = AMB * (0.45 + 0.7 * n) + uSkyS * 0.1;
  return vec4(ro.y > uCD.z ? top : bot, a * uCD.w * smoothstep(0.0, 0.04, abs(rd.y)));
}

// 沿视线走：碰到山或树返回距离（没碰到 -1），路上把山火的火焰和烟攒进 acc、T
float trace(vec3 ro, vec3 rd, float tmax, int N, float jit, inout vec3 acc, inout float T) {
  float t = 0.02 + 0.3 * jit, d = 1e3;
  for (int i = 0; i < 300; i++) {
    if (i >= N || t > tmax) break;
    vec3 p = ro + rd * t; if ((p.y > 240.0 && rd.y > 0.0) || max(abs(p.x), abs(p.z)) > 398.0) { d = 1e3; break; }   // 最高峰 232 米（原来 180，峰顶被削平）
    vec4 L = land(p.xz, t * min(1.0, uTanH * 2.15)); float hg = p.y - L.r, u = fireU(L, uFL), I = -1.0, fo = gNoTree ? 0.0 : forest(L) * treeFade(t), dt; gPk = uPeach * (1.0 - smoothstep(14.0, 26.0, L.r));
    if (hg < 0.0012 * t) return t;
    if (fo > 0.01 && hg < TH * fo + 0.15) {   // 进了树的高度：按离最近那棵树多远来走
      I = fireI(p.xz, L); float k = burnt(u, I); d = min(hg, firs(p.xz, hg, fo * (1.0 - 0.45 * k), 0.75 * k));
      if (d < 0.004 + 0.0006 * t) return t;
      dt = clamp(d * 0.6, 0.012 * uPQ, (0.12 + 0.002 * t) * uPQ);
    } else { d = hg - TH * fo; dt = max(d * 0.45, fo > 0.01 ? 0.10 + 0.004 * t : 0.01 + 0.002 * t); }
    if (hg < 14.0 && u > -4.5 - uFJ && u < 0.9) {   // 火焰：贴着火线往上舔，里白外橙红
      if (I < 0.0) I = fireI(p.xz, L);
      float fu = I * fireB(u, uFJ);
      if (fu > 0.01) {
        dt = min(dt, (0.08 + 0.007 * t) * uPQ);
        vec3 q = vec3(p.x * 1.2, p.y * 0.45 - uT * 2.2, p.z * 1.2);
        float f = clamp((2.6 * (0.55 * vn(q).x + 0.30 * vn(q * 2.3 + 3.7).y + 0.15 * vn(q * 5.1 + 1.3).z) - 0.85 - 1.1 * hg / ((1.5 + 7.0 * fu) * (1.0 + uFJ / 90.0))) * 1.5, 0.0, 1.0) * min(fu * 2.5, 1.0);
        vec3 fc = mix(vec3(0.85, 0.09, 0.008), vec3(1.0, 0.40, 0.06) * 2.2, smoothstep(0.0, 0.45, f)); fc = mix(fc, vec3(1.0, 0.78, 0.42) * 4.0, smoothstep(0.6, 1.0, f));
        float fa = 1.0 - exp(-f * dt * 1.6); acc += T * fc * fa; T *= 1.0 - 0.85 * fa;   // 火焰自己也挡光：看过去再厚也不会白成一片
      }
    }
    if (hg > 1.0 && hg < 90.0 && uFI > 0.0 && dot(p.xz, uFd) > 0.0) {   // 烟：从火带上升起来，顺风斜上去，越高越乱；贴着火的一面被照成橙红
      vec2 xs = p.xz - uWind * hg * 0.9 + (vn(vec3(p.xz * 0.03, p.y * 0.03 - uT * 0.1)).xy - 0.5) * (4.0 + 1.2 * hg); vec4 Ls = land(xs, 1500.0);
      float du = fireU(Ls, uFL) + 2.0, ws = 3.0 + 0.45 * hg; du -= clamp(du, -uFJ, 0.0);
      float b = exp(-du * du / (ws * ws)), Is = b > 0.03 ? fireI(xs, Ls) : 0.0;
      if (Is > 0.01) {
        dt = min(dt, (0.6 + 0.02 * t + 0.03 * hg) * uPQ);
        float rho = Is * b * smoothstep(1.0, 4.0, hg) * exp(-hg / 45.0) * smoothstep(0.30, 0.60, fbm(p * 0.11 + vec3(-uWind.x * 0.5, -1.0, -uWind.y * 0.5) * uT * 0.25, 5)), a = 1.0 - exp(-rho * dt * 0.35);
        acc += T * a * (Is * (vec3(1.0, 0.34, 0.07) * 1.1 * exp(-hg / 6.0) + vec3(0.5, 0.07, 0.02) * 0.35 * exp(-hg / 22.0)) + vec3(0.010, 0.012, 0.022)); T *= 1.0 - a;
      }
    }
    t += dt;
  }
  return t <= tmax && d < 1.0 ? t : -1.0;   // 步数用完了还贴着山，就算碰到
}

float bloomT(vec2 c) {   // 这棵树（树干在 c）几时开花 / 亮：火种从旁边飞过（uBP：路上的点 xz、时刻、贴着就开的半径），再往外一路开过去（uBV 米/秒，最远 uBR）；uRing：一圈从中心推出去
  float tb = 1e5;
  for (int i = 0; i < 24; i++) { vec4 b = uBP[i]; if (b.z > 9e4) break; float d = max(distance(c, b.xy) - b.w, 0.0); if (d < uBR) tb = min(tb, b.z + d / uBV); }
  if (uRing.w > 0.0) tb = min(tb, uRing.z + length(c - uRing.xy) / uRing.w);
  return tb + 0.3 * h01(uvec3(ivec3(ivec2(c * 7.0) + 512, 77)));
}
void glowE(vec2 c, inout float te, out float kx) {   // 尾声：雷、冲击波、扫过的那圈光（uGE：中心 xz、时刻、最远；uGV：米/秒）推到这棵树。te 最早推到的那次（之后一直微亮），kx 每推到一次亮一下
  te = 1e5; kx = 0.0; float j = 0.3 * h01(uvec3(ivec3(ivec2(c * 7.0) + 512, 78)));
  for (int i = 0; i < 16; i++) { vec4 g = uGE[i]; if (g.z > 9e4) break; float d = distance(c, g.xy); if (d > g.w) continue; float u = uT - g.z - d / uGV[i] - j; te = min(te, uT - u); if (u > 0.0) kx = max(kx, smoothstep(0.0, 0.4, u) * exp(-u * 1.2) * (1.0 - smoothstep(0.75 * g.w, g.w, d))); }
}
vec3 shade(vec3 p, float t) {   // 山的颜色：岩石、雪线、林带、一棵棵树；夜空、月光、火星的光、山火的光
  vec4 L = land(p.xz, t * min(1.0, uTanH * 2.15)); gPk = uPeach * (1.0 - smoothstep(14.0, 26.0, L.r)); float hg = p.y - L.r, u = fireU(L, uFL), I = fireI(p.xz, L), k = burnt(u, I), wd = forest(L), fo = wd * treeFade(t), s = fo * (1.0 - 0.45 * k), f = fo > 0.01 ? firs(p.xz, hg, s, 0.75 * k) : 1.0;
  bool mesh = gM >= 0, tree = mesh || (fo > 0.01 && f < 0.03 + 0.002 * t && hg > 0.05);
  vec3 ng = normalize(vec3(-L.g, 1.0, -L.b)), n = ng;
  if (mesh) n = gN; else if (tree) { const vec2 e = vec2(0.02, 0.0); float b = 0.75 * k; n = normalize(vec3(firs(p.xz + e.xy, hg, s, b) - firs(p.xz - e.xy, hg, s, b), firs(p.xz, hg + e.x, s, b) - firs(p.xz, hg - e.x, s, b), firs(p.xz + e.yx, hg, s, b) - firs(p.xz - e.yx, hg, s, b)) + 1e-5); }
  n = normalize(n + (tree ? (vn(p * 6.0).xyz - 0.5 + 0.6 * (vn(p * 14.0).xyz - 0.5)) * (mesh ? 0.12 : 0.4) : (vn(p * 1.7).xyz - 0.5 + 0.5 * (vn(p * 5.3).xyz - 0.5)) * 0.6) * (1.0 - smoothstep(20.0, 160.0, t)));   // 针叶 / 岩石的细起伏
  float snow = smoothstep(38.0, 52.0, L.r + 22.0 * (L.a - 0.5)) * smoothstep(0.35, 0.6, ng.y) * (1.0 - 0.8 * uSpr), ash = min(I, 1.0) * (1.0 - smoothstep(-3.0 - uFJ, -0.5 - uFJ, u)), ub = u < 0.0 ? min(u + uFJ, 0.0) : u;
  snow = max(snow, uSnow * smoothstep(uOpen - 8.0, uOpen + 8.0, length(p.xz)) * (tree ? smoothstep(0.25, 0.6, n.y) : smoothstep(0.55, 0.8, ng.y)) * (0.6 + 0.4 * vn(p * 2.1).x));   // 岩石：只有缓坡积得住   // 冬天：雪一直盖到水边，树冠朝上的那面也是白的；化开的前沿从火种往外推
  vec3 alb = mix(vec3(0.085, 0.080, 0.078) * (0.75 + 0.5 * vn(vec3(p.xz * 0.13, p.y * 0.9 + 3.0 * vn(p * 0.06).y)).x), vec3(0.018, 0.026, 0.015) * (0.5 + vn(vec3(p.xz * 2.5, 0.5)).x) * (0.35 + 0.65 * smoothstep(0.0, 0.5, f)), wd);   // 岩石（带岩层）/ 林地（树根下暗）
  if (tree) alb = vec3(0.012, 0.030, 0.016) * (0.5 + vn(p * 3.0).x) * (0.35 + 0.65 * (mesh ? 1.0 - gAO : clamp(hg / (TH * s), 0.0, 1.0)));
  if (gM == 2) alb = vec3(0.045, 0.032, 0.025) * (0.6 + 0.8 * vn(p * 9.0).x);   // 网格针叶树的树干                                                                                                      // 树：越往下越暗
  vec3 em = vec3(0.0); float tk = 0.0;   // tk：1 桃树，2 针叶树（国风换色用）
  if (uSpr > 0.0) {
    if (!tree) alb = mix(alb, vec3(0.055, 0.10, 0.028) * (0.6 + 0.8 * vn(p * 0.8).x) * (0.8 + 0.4 * vn(p * 7.0).y), uSpr * smoothstep(0.4, 0.75, ng.y) * (1.0 - smoothstep(40.0, 65.0, L.r + 15.0 * (L.a - 0.5))) * smoothstep(0.3, 1.2, L.r));   // 春天：山坡返青（林下也是）
    if (tree) {
      vec4 id = mesh ? vec4(gM <= 1 ? 1.0 : 0.0, gC, 0.0) : treeId(p.xz, hg, s); float tb = bloomT(id.yz), kb = smoothstep(0.0, 0.6, uT - tb), fl = mesh && gM != 3 ? (gM == 1 ? 1.0 : 0.0) : 0.6 * vn(p * 9.0).x + 0.4 * vn(p * 23.0 + 5.0).y;   // 网格树：花卡片整片是花；针叶和色块树一样一片片地抽新叶
      float te = uRing.w > 0.0 ? uRing.z + length(id.yz - uRing.xy) / uRing.w + 0.3 * h01(uvec3(ivec3(ivec2(id.yz * 7.0) + 512, 78))) : tb, kx = -1.0; if (uGE[0].z < 9e4) glowE(id.yz, te, kx); float ke = smoothstep(0.0, 0.4, uT - te);   // 发光按哪个时刻：尾声那一圈推到的时候
      tk = id.x > 0.5 ? 1.0 : 2.0;
      if (id.x > 0.5) {   // 桃树：开之前是光秃的深色枝条，零星几点嫩绿；开了是一簇簇粉白的花，花心那头深一点
        vec3 q = p * 15.0, qc = floor(q); float fd = (1.0 - smoothstep(0.22, 0.42, length(q - qc - 0.5))) * step(h01(uvec3(ivec3(qc) + 7000)), 0.55);   // 一朵朵小花（约 7 厘米一格），远了糊成平均色
        vec3 blo = mix(mix(vec3(0.72, 0.30, 0.44), vec3(0.98, 0.86, 0.89), mix(fd, 0.5, smoothstep(12.0, 35.0, t))), vec3(0.98, 0.86, 0.89), 0.25 * smoothstep(0.5, 0.8, fl));
        float bd = smoothstep(0.68, 0.76, vn(p * 34.0 + 9.0).z) * smoothstep(0.35, 0.55, fl);   // 嫩芽：稀稀的一点点
        if (mesh) { blo = mix(vec3(0.78, 0.26, 0.44), vec3(0.97, 0.68, 0.78), smoothstep(0.1, 0.6, gX)); bd = 0.0; }   // 网格桃花：花心深粉、花瓣浅粉
        alb = mix(mix(vec3(0.05, 0.036, 0.03), vec3(0.20, 0.36, 0.06), 0.8 * bd), blo, kb * smoothstep(0.22, 0.42, fl + 0.15 * kb));
        if (gM == 0) alb *= 0.7 + 0.6 * vn(p * 7.0).x; else if (gM == 1) alb = mix(vec3(0.09, 0.045, 0.035), blo, kb);   // 网格：枝上的皮、没开的花苞（红褐，比皮亮一点）
        em = vec3(0.35, 0.55, 0.12) * KEY * 0.5 * (1.0 - kb) * bd * pow(max(dot(normalize(p - uCam), uMoon), 0.0), 3.0)   // 逆光时嫩芽透出黄绿
          + blo * uBlosE * (kx < 0.0 ? ke * (0.25 + exp(-max(uT - te, 0.0) * 1.2)) : 0.25 * ke + kx) * smoothstep(0.3, 0.5, fl);
      } else {
        alb *= vec3(1.4, 1.7, 1.2);   // 针叶树抽了新梢，绿得亮一点
        if (gM == 3) alb = mix(alb, vec3(0.06, 0.12, 0.03), 0.6 * smoothstep(0.75, 0.95, gX));   // 网格针叶：梢头一截嫩绿
        if (uLeafE > 0.0) { alb = mix(alb, vec3(0.10, 0.20, 0.04) * (0.6 + 0.8 * fl), kb * smoothstep(0.4, 0.6, fl)); em = vec3(0.55, 1.0, 0.25) * uLeafE * (kx < 0.0 ? ke * (0.15 + exp(-max(uT - te, 0.0) * 1.0)) : 0.15 * ke + kx) * smoothstep(0.45, 0.65, fl); }   // 被雷劈中的树亮起来、抽出新叶
      }
    }
  }
  alb = mix(mix(alb, vec3(0.60, 0.66, 0.76), snow), vec3(0.004), ash) * (0.3 + 0.7 * smoothstep(0.0, 1.5, L.r));                                                                                                           // 水边是湿的，暗
  vec3 hd = normalize(vec3(ng.x, 0.0, ng.z) + vec3(1e-4, 0.0, 0.0)), fl = u > 0.0 ? normalize(hd + vec3(0.0, 0.15, 0.0)) : normalize(vec3(0.0, 0.5, 0.0) - hd);   // 火在下坡（没烧到的）或上坡（烧过的）
  vec3 lit = AMB * (0.4 + 0.6 * n.y) + KEY * max(dot(n, uMoon), 0.0)
    + vec3(1.0, 0.55, 0.2) * 0.32 * uEI * (1.0 - smoothstep(uReach - 12.0, uReach + 12.0, length(p.xz))) * max(dot(n, normalize(uE - p)), 0.0)
    + vec3(1.0, 0.42, 0.10) * I * (ub > 0.0 ? 5.0 / (1.0 + ub * ub / 36.0) : 2.0 / (1.0 + ub * ub / 9.0)) * (0.25 + 0.75 * max(dot(n, fl), 0.0))
    + vec3(1.0, 0.40, 0.10) * 0.07 * uFI * max(dot(n, normalize(vec3(uFd.x * 80.0, uFL, uFd.y * 80.0) - p)), 0.0);                                              // 远处的山也沾一点火光
  vec3 xl = lit - AMB * (0.4 + 0.6 * n.y) - KEY * max(dot(n, uMoon), 0.0);   // 火种、山火这些点光（国风里照加）
  if (mesh) lit = lit * (1.0 - 0.65 * gAO) + (gM == 1 || gM == 3 ? KEY * (gM == 1 ? 0.8 : 0.4) * pow(max(dot(normalize(p - uCam), uMoon), 0.0), 3.0) : vec3(0.0));   // 网格树：树冠里面暗；花瓣、针叶逆光透亮
  vec3 col = alb * lit + vec3(1.0, 0.22, 0.03) * ash * 5.0 * pow(vn(p * (tree ? 4.0 : 2.3)).x * vn(p.zxy * 5.7 + 3.0).y * 2.0, 3.0) * exp(min(u + uFJ, 0.0) / 9.0);                              // 烧过的地上、树干上留着余烬
  float fw = smoothstep(30.0, 140.0, t), nm = smoothstep(0.05, 0.45, dot(n, uMoon)), dim = 1.0 - smoothstep(0.35, 0.9, KEY.g);   // 远山画清楚（用户 2026-11-18：不用太真实，要清晰）：暗的时候给远处的亮面补一道月光，明暗分得开
  col += alb * max(KEY, vec3(0.20, 0.23, 0.32)) * 1.4 * fw * nm * dim + max(KEY * 0.25 + HAZE * 1.2, vec3(0.03, 0.035, 0.05)) * fw * pow(1.0 - abs(dot(n, normalize(p - uCam))), 4.0);   // 山脊、侧面一道天光的边，一层层山的轮廓分得清
  vec3 cr = mix(HAZE, col + em, exp(-t * (0.0025 + 0.001 * uMist * uSpr)));
  if (uToon <= 0.0) return cr;
  // 国风仙侠：色板收成石青的山石、石绿的坡、深青松、桃粉花；两阶明暗（亮面暖金、暗面黛蓝），朝光的轮廓一道金边；远处一层层褪成天色
  float gr = smoothstep(0.4, 0.75, ng.y) * (1.0 - smoothstep(40.0, 65.0, L.r + 15.0 * (L.a - 0.5))) * smoothstep(0.3, 1.2, L.r), vv = 0.92 + 0.16 * vn(p * 0.02).x;   // 色块抹开后噪声会成迷彩：起伏小、尺度大
  vec3 ta = tk > 1.5 ? vec3(0.030, 0.15, 0.11) * vv * (gM == 2 ? 0.5 : 1.0) : tk > 0.5 ? pow(alb, vec3(1.4)) * 1.1 : mix(vec3(0.06, 0.15, 0.20), vec3(0.07, 0.29, 0.17), gr) * vv;   // 青绿山水：山石石青、坡上石绿
  if (tk < 0.5) ta = mix(ta, vec3(0.80, 0.86, 0.95), snow) * (0.45 + 0.55 * smoothstep(0.0, 1.5, L.r));
  vec3 nt = tree ? n : normalize(mix(n, ng, 0.7));   // 山坡用大的起伏算明暗（画出来的样子，不要岩石的细碎）
  float nl = dot(nt, uMoon), bd = smoothstep(-0.02, 0.08, nl) * (mesh ? 1.0 - 0.7 * smoothstep(0.35, 0.75, gAO) : 1.0);
  vec3 sh = AMB * vec3(0.80, 0.90, 1.30) * 1.2, li = sh + KEY * vec3(1.10, 1.0, 0.82) * (0.75 + 0.25 * nl);
  vec3 tc = ta * (mix(sh, li, bd) + xl) + em + vec3(1.0, 0.78, 0.42) * (KEY * 0.7 + AMB * 0.4) * pow(1.0 - abs(dot(nt, normalize(p - uCam))), 3.0) * (0.3 + 0.7 * bd) * (tree ? 0.5 : 0.08) * (1.0 - smoothstep(60.0, 250.0, t));   // 金边只描树冠（山坡斜着看全是「轮廓」，加上就发白）
  return mix(cr, mix(HAZE * vec3(0.85, 0.98, 1.15), tc, exp(-t * (0.0022 + 0.0006 * uMist))), uToon);   // 远山要清楚（用户规矩）：空气比写实版还薄，褪成青蓝不褪白                                                                                                  // 远了发蓝发灰（雾比原来薄一半：远山要看得清）
}

float ember(vec3 ro, vec3 rd, float tmax, inout vec3 col) {   // 火种：暂用一个光点（用户 2026-11-18：模型以后给）。白热的芯、贴着芯一圈橙、空气里的晕，没有实体，不挡后面，返回 tmax
  vec3 oc = uE - ro, cx = cross(oc, rd); float tc = dot(oc, rd), d2 = dot(cx, cx); if (tc < 0.0 || tc > tmax) return tmax;   // d2 用叉积算：|oc|² − tc² 在一两百米外两个大数相减会成负数，芯的 exp 爆成无穷
  float hot = smoothstep(0.4, 1.4, uEI), fk = 0.9 + 0.1 * sin(uT * 2.1);   // 弱的时候（冻在冰里）只剩暗红，火一旺芯就白了；慢慢明暗
  col += (mix(vec3(1.0, 0.30, 0.06), vec3(1.0, 0.93, 0.80), hot) * 2.5 * exp(-d2 / 0.0012) + vec3(1.0, 0.45, 0.10) * 0.5 * exp(-d2 / 0.012)) * uEI * fk   // 芯（半径约 3.5 厘米）和那圈橙
    + vec3(1.0, 0.55, 0.16) * uEI * (0.0018 / (d2 + 0.010) + 0.006 / (1.0 + d2 * 1.5));
  return tmax;
}

// 火星上的火苗和烟：沿视线攒。烟的中轴顺风弯过去、带一点晃，越高越粗越淡；下面被火照红，上面被月光照成灰蓝
void plume(vec3 ro, vec3 rd, float tmax, float jit, inout vec3 col) {
  float ta = 0.0, tb = tmax, y0 = 0.0, y1 = uE.y + 11.0;
  if (abs(rd.y) > 1e-4) { float a = (y0 - ro.y) / rd.y, b = (y1 - ro.y) / rd.y; ta = max(ta, min(a, b)); tb = min(tb, max(a, b)); } else if (ro.y < y0 || ro.y > y1) return;
  if (ta >= tb) return;
  float t = ta + 0.01 * jit, T = 1.0, fh = 2.7 * uFlame; vec3 acc = vec3(0.0);
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t; float h = max(p.y - uE.y, 0.0), R = 0.03 + (0.05 + 0.08 * uSmoke) * h, rs = length(p.xz - uE.xz);
    vec2 ax = uE.xz + uWind * (0.10 * h + 0.035 * h * h) + (vn(vec3(h * 0.7 - uT * 1.1, 3.3, uT * 0.07)).xy - 0.5) * 0.9 * h / (1.0 + 0.15 * h) + (vn(vec3(h * 2.3 - uT * 2.0, 7.7, 0.5)).xy - 0.5) * 0.25 * h / (1.0 + 0.3 * h);
    float r = length(p.xz - ax), d = min(r - 2.0 * R - (h < fh + 0.2 ? 0.35 * uFlame : 0.0), p.y < 1.0 ? rs - 1.1 : 1e3);   // 烟柱、火苗，还有水面上那一圈水汽
    if (d > 0.0) { t += max(d * 0.7, 0.02); if (t > tb) break; continue; }   // 还没进烟：按离中轴多远跳着走
    float dt = max(0.25 * R, 0.012);
    if (p.y < 1.0) {   // 水汽：炭块碰到水的地方一直冒白汽，一缕缕往上散，贴着炭的那一层被火从下面照成橙色
      float hw = max(p.y, 0.0), sr = 0.16 + 0.32 * hw, sn = fbm(vec3(p.xz * 5.0 - uWind * hw * 2.0, hw * 3.0 - uT * 1.3), 4);
      float sd = smoothstep(0.42, 0.68, sn) * exp(-rs * rs / (sr * sr)) * (1.0 - smoothstep(0.3, 1.0, hw)) * smoothstep(0.0, 0.05, hw);
      if (sd > 0.001) {
        dt = min(dt, 0.025); float sa = 1.0 - exp(-sd * dt * 7.0);
        acc += T * sa * (mix(vec3(0.045, 0.05, 0.065), AMB, uSpr) + vec3(1.0, 0.40, 0.11) * uEI * 0.7 / (1.0 + 14.0 * (rs * rs + hw * hw))); T *= 1.0 - 0.75 * sa;
      }
    }
    if (h < fh && p.y > uE.y) {   // 火苗：一条条焰舌往上舔，半透明看得到里面；芯白热、外层橙、焰尖暗红，顶上断开飘走
      float hf = h / fh; vec2 c0 = uE.xz + uWind * 0.12 * h * h + (vn(vec3(h * 1.3 - uT * 2.4, 1.7, 0.3)).xy - 0.5) * 0.3 * hf;   // 火苗的中轴也跟着晃
      float rf = length(p.xz - c0) / (0.33 * (1.0 - 0.7 * hf) + 0.03); vec3 q = vec3((p.x - c0.x) * 6.0, p.y * 2.6 - uT * 6.5, (p.z - c0.y) * 6.0);
      float n = 0.55 * vn(q).x + 0.3 * vn(q * 2.3 + 5.0).y + 0.15 * vn(q * 4.9 + 2.0).z;
      float f = clamp((2.2 * n - 0.5 - 1.0 * rf * rf - 1.25 * hf) * 2.2, 0.0, 1.0), fa = 1.0 - exp(-f * dt * 9.0), tmp = f * (1.0 - 0.55 * hf);
      vec3 fc = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.38, 0.05) * 1.6, smoothstep(0.0, 0.35, tmp)); fc = mix(fc, vec3(1.0, 0.78, 0.42) * 2.4, smoothstep(0.45, 0.9, tmp));
      acc += T * fc * fa; T *= 1.0 - 0.5 * fa;
    }
    float g = exp(-r * r / (R * R)), n = fbm(vec3((p.xz - ax) / (0.3 + R) * 1.3, 3.3 * log(1.0 + h) - uT * 0.9), 4);   // 花纹跟着烟柱一起变粗
    float a = 1.0 - exp(-uSmoke * g * smoothstep(0.36 - 0.14 * exp(-h), 0.58, n) * smoothstep(0.0, 0.1, h) / (1.0 + 0.6 * h) * (1.0 - smoothstep(5.0, 11.0, h)) * smoothstep(0.4, 2.2, t) * dt * 14.0);   // 贴着镜头的烟淡掉（镜头穿过烟时不蒙亮一片）
    acc += T * a * (vec3(1.0, 0.42, 0.10) * uEI * (0.2 + 0.9 * uFlame) / (1.0 + 1.6 * h * h) + mix(vec3(0.022, 0.027, 0.042), AMB * 0.6, uSpr)); T *= 1.0 - a;
    t += dt; if (t > tb || T < 0.02) break;
  }
  col = col * T + acc;
}

void hero(vec3 ro, vec3 rd, float tmax, inout vec3 col) {   // 飞向树林的那一粒火星屑：一个亮点拖一小截尾（视线到这一小段线的最近距离）；长尾迹是火星屑
  if (uHero.w <= 0.0) return;
  vec3 w = uHero.xyz - ro, u = -uHeroV * 0.012; float ur = dot(u, rd), wr = dot(w, rd), s = clamp(-(dot(w, u) - wr * ur) / max(dot(u, u) - ur * ur, 1e-6), 0.0, 1.0);
  w += u * s; float tc = dot(w, rd); if (tc < 0.0 || tc > tmax) return;
  col += vec3(1.0, 0.62, 0.22) * uHero.w * (1.0 - 0.85 * s) * 1.35e-5 / (max(dot(w, w) - tc * tc, 0.0) / (tc * tc) + 2.25e-6);
}

float moonVis(vec3 p) {   // 从水面这一点看月亮，有没有被山挡住（粗粗地走 40 步）
  float t = 2.0;
  for (int i = 0; i < 40; i++) { vec3 q = p + uMoon * t; if (q.y > 115.0 || max(abs(q.x), abs(q.z)) > 398.0) return 1.0; if (land(q.xz, t).r > q.y) return 0.0; t *= 1.15; }
  return 1.0;
}

// 风吹的细浪：12 组不同方向、不同波长的正弦波叠起来（深水色散 ω = √(gk)）。比像素还细的那几组不画，坡度方差记下来（远处的碎光、拉成竖条的倒影靠它）
// fd：视线的水平方向；pa：这一点上一个像素横着多宽；sy：视线往下的斜率（顺着视线方向，一个像素在水面上拉长 1/sy 倍）。返回 xy 坡度（法线 ∝ (x, 1, y)），zw 没画出来的坡度方差
vec4 waves(vec2 x, vec2 fd, float pa, float sy) {   // uWv：春天的晨湖压平成镜面（默认 1）
  vec2 g = vec2(0.0), v = vec2(2e-5); float m = mix(0.3, 1.0, smoothstep(3.0, 15.0, length(x))) * (0.6 + 0.8 * vn(vec3(x * 0.04, uT * 0.02)).x);   // 风一阵一阵、一片一片：火星周围水平（涟漪看得清），远处起碎浪
  for (int i = 0; i < 12; i++) {
    float fi = float(i), a = 0.284 + 1.2 * sin(fi * 2.39996), L = 2.4 * pow(0.66, fi), k = 6.2832 / L, s = (0.025 + 0.004 * fi) * m * uWv; vec2 d = vec2(cos(a), sin(a));   // 方向散在风向两边；s：每组的坡度
    float w = smoothstep(1.5, 3.0, L / (pa * length(vec2(dot(d, vec2(-fd.y, fd.x)), dot(d, fd) / sy))));
    g -= d * s * w * cos(k * dot(d, x) - sqrt(9.8 * k) * uT + fi * 10.166); v += d * d * s * s * 0.5 * (1.0 - w);
  }
  return vec4(g, v);
}

vec3 fog(vec3 ro, vec3 rd, float td, vec3 col) {
  float MH = mix(1.2, uMistH, uSpr);   // 雾多厚（春天 D14「浊」时沉进山谷）   // 水汽：贴着水面薄薄一层，月光下发灰蓝，靠火的一边映红（倒影也走一遍，水天线那条亮带才映得进水里）
  float ya = min(ro.y, ro.y + rd.y * min(td, 300.0)), yb = max(ro.y, ro.y + rd.y * min(td, 300.0));
  float mist = 1.0 - exp(-0.012 * (1.0 + 6.0 * uMist * uSpr) * (1.0 - 0.4 * smoothstep(80.0, 300.0, td)) * min(td, 300.0) * (yb - ya > 1e-3 ? MH * (exp(-ya / MH) - exp(-yb / MH)) / (yb - ya) : exp(-ya / MH)) * (0.5 + vn(vec3((ro + rd * min(td, 60.0) * 0.5).xz * 0.05, uT * 0.03)).x));
  vec3 mc = vec3(0.028, 0.036, 0.058) + vec3(0.16, 0.18, 0.24) * pow(max(dot(rd, uMoon), 0.0), 6.0) + vec3(0.25, 0.08, 0.02) * uFI * smoothstep(0.2, 0.9, dot(normalize(rd.xz + 1e-5), uFd));
  if (uSpr > 0.0) mc = mix(mc, uMistC + uSkyS * 0.35 * pow(max(dot(rd, uMoon), 0.0), 4.0), uSpr);   // 春天的晨雾：灰白，朝太阳那边暖
  return mix(col, mc, mist * (1.0 - 0.6 * uToon));   // 国风：晨雾薄一些，画面不发灰
}

// 一组涟漪：一点扰动在深水里推出去的色散波包（柯西–泊松）。t 秒后 r 处的相位 G·t²/(4r)，当地波数 k = G·t²/(4r²)：
// 长波跑得快，所以外圈波长长、内圈短，波峰越走越多；源的大小 a 定下波包里有哪些波长（k·a ≈ 1 最强）；振幅按 1/√r 和时间衰减。
// G 取 9 倍重力（波速 ×3，跟得上拍子）。返回坡度；比像素细的那段不画，方差记进 v（和 waves() 一样）
vec2 ripple(vec2 x, vec2 c, float t, float a, float s0, vec2 fd, float pa, float sy, inout vec2 v) {
  if (t <= 0.0) return vec2(0.0);
  vec2 d = x - c; float r = length(d) + 1e-3, k = 22.05 * t * t / (r * r), ka = k * a + 1e-6, lk = log(ka) / 0.7, A = s0 * exp(-0.5 * lk * lk) * sqrt(0.3 / (r + 0.3)) * exp(-0.2 * t);   // 波长按对数正态散开：一组五到八道波峰
  vec2 er = d / r; float w = smoothstep(1.5, 3.0, 6.2832 / k / (pa * length(vec2(dot(er, vec2(-fd.y, fd.x)), dot(er, fd) / sy))));
  v += er * er * 0.5 * A * A * (1.0 - w);
  return er * A * w * cos(k * r);   // k·r 就是相位 G·t²/(4r)
}

// ---------- 冰（前奏、A2：冬夜湖面冻着）----------
float vor(vec2 x) {   // 冰裂成的一块块：到格子边界多远（格子单位）
  vec2 i = floor(x), f = x - i; float d1 = 9.0, d2 = 9.0;
  for (int k = 0; k < 9; k++) {
    vec2 c = vec2(float(k % 3 - 1), float(k / 3 - 1)); uint h = h3(uvec3(ivec3(ivec2(i + c) + 2048, 11)));
    vec2 o = c + vec2(float(h & 1023u), float((h >> 10) & 1023u)) / 1023.0 - f; float d = dot(o, o);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return 0.5 * (sqrt(d2) - sqrt(d1));
}
vec3 iceCol(vec3 P, vec3 rd, vec3 rc, float pa, float rn) {   // 冰面这一点的颜色。rc：反射（和水面一样走出来的山、天）；pa：一个像素多宽；rn：离火种多远（边上抖过）
  float fine = 1.0 - smoothstep(0.003, 0.03, pa), macro = 1.0 - smoothstep(0.0003, 0.0012, pa);   // 近了才画的细节；贴着冰面才画的（远了糊成一片会闪）
  vec2 g = (vn(vec3(P.xz * 0.9, 2.0)).xy - 0.5) * 0.02 + (vn(vec3(P.xz * 7.0, 4.0)).zw - 0.5) * 0.012 * fine;
  vec3 n = normalize(vec3(g.x, 1.0, g.y)), rt = refract(rd, n, 0.763);   // 冰的折射率 1.31
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0), ml = max(dot(n, uMoon), 0.0);
  vec3 tr = vec3(0.010, 0.013, 0.020) * (0.4 + ml), A = vec3(1.0);   // 冰本身有点乳白（冻进去的细气泡、杂质把月光散开）
  for (int L = 0; L < 5; L++) {   // 冻在冰里的气泡：五层，越深越大越稀；视线斜着穿过去，层和层错开（视差）。扁的、白的；离远了不一颗颗画
    float fl = float(L), d = 0.02 + 0.07 * fl + 0.025 * fl * fl, cz = 0.04 * (1.0 + 0.9 * fl);
    vec3 Q = P + rt * (d / max(-rt.y, 0.08)); vec2 q = Q.xz / cz, ci = floor(q);
    uint h = h3(uvec3(ivec3(ivec2(ci) + 4096, 20 + L))); vec3 r = vec3(float(h & 1023u), float((h >> 10) & 1023u), float((h >> 20) & 1023u)) / 1023.0;
    float an = r.x * 6.2832, ca = cos(an), sa = sin(an); vec2 o = q - ci - 0.25 - 0.5 * r.xy; o = vec2(ca * o.x - sa * o.y, (sa * o.x + ca * o.y) / (0.55 + 0.45 * r.y));
    float br = cz * (0.05 + 0.17 * r.z), dd = length(o) * cz, px = pa * (1.0 + 2.0 * d);
    float on = step(r.z, 0.34 - 0.05 * fl) * macro, disc = on * (1.0 - smoothstep(br - px, br + px, dd)), rim = disc * smoothstep(0.4 * br, br, dd);
    tr += A * vec3(0.62, 0.67, 0.75) * (0.35 * disc + 0.65 * rim) * (0.06 + 0.45 * ml);
    A *= vec3(0.82, 0.87, 0.92);
  }
  { vec3 Q = P + rt * (uHB.z / max(-rt.y, 0.08)); vec2 bq = vec2(Q.x - uHB.x, uHB.y - Q.z) / uHB.w; float dd = length(bq), px = pa * 1.2 / uHB.w;   // bar5–7 镜头对着的那一颗：里面映着月亮（同一张月面、同一个朝向：bar7 俯拍时画面右 = +x、上 = -z），bar7 叠化成天上的月亮
    float disc = 1.0 - smoothstep(1.0 - px, 1.0 + px, dd), rim = disc * smoothstep(0.82, 1.0, dd), hl = exp(-dot(bq - vec2(-0.42, 0.45), bq - vec2(-0.42, 0.45)) / 0.012);   // 薄薄一圈亮边，左上一点高光
    tr += (vec3(1.0, 0.96, 0.88) * moonAlb(bq) * 0.62 * (1.0 - 0.5 * rim) + vec3(0.8, 0.86, 0.96) * (0.5 * rim + 0.9 * hl)) * disc * (0.3 + 0.7 * ml)
      + vec3(0.55, 0.62, 0.8) * 0.05 * exp(-max(dd - 1.0, 0.0) * 2.5) * (1.0 - disc) * (0.3 + 0.7 * ml); }   // 外面一圈淡淡的月晕：一眼看得出是它
  { vec3 Q = P + rt * (0.16 / max(-rt.y, 0.08)); float e = vor(Q.xz / 3.2) * 3.2, w = 0.004 + pa, k = smoothstep(0.38, 0.55, vn(vec3(Q.xz * 0.22, 12.0)).x);   // 大裂纹：冰板的边，只裂开一部分，一条条长的；斜着的一片，从上面看是一道白线带一点羽毛似的晕
    tr += A * vec3(0.5, 0.58, 0.68) * k * ((1.0 - smoothstep(0.0, w, e)) * 0.3 + 0.07 * exp(-e / 0.05) * fine) * (0.05 + 0.4 * ml); }
  { vec3 Q = P + rt * (0.05 / max(-rt.y, 0.08)); float e = vor(Q.xz / 0.6 + 17.0) * 0.6, w = 0.0015 + pa;   // 细裂纹：更稀
    tr += vec3(0.5, 0.58, 0.68) * (1.0 - smoothstep(0.0, w, e)) * 0.15 * smoothstep(0.55, 0.7, vn(vec3(Q.xz * 1.2, 8.0)).y) * (0.05 + 0.4 * ml) * fine; }
  vec3 cu = vec3(0.004, 0.007, 0.012); ember(P, rt, 4.0, cu);   // 冰下的黑水和火种（快熄了：只剩裂缝里一点红）
  tr += vec3(1.0, 0.38, 0.08) * uEI * 0.14 * exp(-max(rn - uOpen, 0.0) / 0.22 - rn * rn / 2.0) * step(0.0, uOpen) * (0.6 + 0.8 * vn(vec3(P.xz * 7.0, 6.0)).x);   // 冰洞边上的冰被水里的火光从里面透亮，往外一点点淡
  tr += A * cu * vec3(0.7, 0.8, 0.9) + vec3(1.0, 0.28, 0.05) * uEI * (0.02 * exp(-rn * rn / 0.5) + 0.25 * exp(-rn * rn / max(0.5, 36.0 * pa * pa)) * smoothstep(0.01, 0.05, pa));   // 红光在冰里散开一小片；离得远时是一个暗红的点
  float fv = 1.0 - abs(2.0 * fbm(vec3(P.xz * 30.0 + 0.4 * vn(vec3(P.xz * 6.0, 2.0)).xy, 1.0), 4) - 1.0);   // 冰面上的霜花：细的冰晶纹，一枝枝像蕨叶（贴近才看得见）
  vec3 c = mix(tr, rc, F) + vec3(0.5, 0.56, 0.66) * (0.01 + 0.08 * ml) * (1.0 - smoothstep(0.0002, 0.0006, pa)) * pow(fv, 30.0) * smoothstep(0.4, 0.6, vn(vec3(P.xz * 3.0, 9.0)).x);
  vec2 wd = normalize(vec2(0.96, 0.28)); float al = dot(P.xz, wd), ac = dot(P.xz, vec2(-wd.y, wd.x));   // 风向：积雪顺着风拉成长条
  vec2 wq = vec2(al * 0.06, ac * 0.3) + 1.6 * (vec2(fbm(vec3(P.xz * 0.07, 1.0), 3), fbm(vec3(P.xz * 0.07, 4.0), 3)) - 0.45);   // 扭一扭，不成一道道等宽的刷痕
  float sn = smoothstep(0.46, 0.7, fbm(vec3(wq, 5.0), 4) + 0.12 * (fbm(vec3(P.xz * 0.6, 6.0), 3) - 0.5)) * smoothstep(uOpen + 0.4, uOpen + 2.5, rn);   // 火种周围暖，化掉了
  vec3 ns = normalize(n + (vn(vec3(P.xz * 1.5, 4.0)).xyz - 0.5) * vec3(0.5, 0.0, 0.5) * fine);   // 雪面的起伏
  vec3 snc = vec3(0.60, 0.66, 0.76) * (vec3(0.03, 0.04, 0.075) + vec3(0.26, 0.31, 0.46) * max(dot(ns, uMoon), 0.0)) + vec3(1.0, 0.45, 0.12) * uEI * 0.012 * exp(-rn * rn / 3.0)
    + vec3(0.8, 0.85, 1.0) * 0.6 * ml * fine * step(0.996, h01(uvec3(ivec3(ivec2(floor(P.xz / 0.004)) + 9000, 31))));   // 雪面上零星的闪点
  float wet = 1.0 - smoothstep(uOpen, uOpen + 0.45, rn), sl = exp(-pow((rn - uOpen - 0.1) / 0.07, 2.0)) * (0.5 + 0.5 * vn(vec3(P.xz * 9.0, 2.0)).x);   // 融开的边：湿、发暗，贴着水一圈灰白的雪泥
  c = mix(c, snc, sn * (1.0 - wet)) * (1.0 - 0.35 * wet);
  return mix(c, vec3(0.30, 0.33, 0.38) * (0.04 + 0.18 * ml), 0.5 * sl) + vec3(0.6, 0.7, 0.8) * 0.03 * smoothstep(0.55, 0.8, vn(vec3(P.xz * 4.0, 5.0)).x) * exp(-pow((rn - uOpen) / max(0.01, 2.0 * pa), 2.0));   // 断口的亮边时有时无
}

vec3 underwater(vec3 ro, vec3 rd, float jit, out float td) {   // 尾声：湖里（湖心只有 3 米深）。头顶是水面背面（斯涅尔窗里是星空和火种），脚下是湖底的泥和一丛丛水草，水把远处吃成墨绿
  vec3 wc = vec3(0.004, 0.017, 0.02) + vec3(0.05, 0.028, 0.01) * uEI * 0.08;
  float ts = rd.y > 1e-4 ? -ro.y / rd.y : 1e5, t = 0.05 + 0.05 * jit, tb = 1e5;
  for (int i = 0; i < 80; i++) { if (t > min(ts, 40.0)) break; vec3 p = ro + rd * t; float h = p.y - land(p.xz, t).r; if (h < 0.0) { tb = t; break; } t += max(0.04, h * 0.6); }
  vec3 col;
  if (tb < ts && tb < 40.0) {
    vec3 p = ro + rd * tb; vec4 L = land(p.xz, tb); vec3 n = normalize(vec3(-L.g, 1.0, -L.b) + (vn(p * 3.0).xyz - 0.5) * 0.6);
    float wd = smoothstep(0.42, 0.7, vn(vec3(p.xz * 2.2, 1.0)).x + 0.3 * vn(vec3(p.xz * 9.0, 2.0)).y);   // 水草（春天新长的，嫩绿）
    vec3 alb = mix(vec3(0.045, 0.036, 0.028), vec3(0.06, 0.16, 0.05), wd);
    float cs = pow(clamp(vn(vec3(p.xz * 2.5, uT * 0.4)).x * vn(vec3(p.xz * 4.1 + 3.0, uT * 0.5)).y * 2.2, 0.0, 1.0), 3.0);   // 水面聚下来的光网（焦散）
    vec3 le = uE - p; float dl = length(le);
    col = alb * (AMB * 2.6 * (0.6 + 0.4 * n.y) * (1.0 + 2.5 * cs) + vec3(1.0, 0.5, 0.15) * uEI * 1.2 * max(dot(n, le / dl), 0.0) / (1.0 + dl * dl * 0.3));
    td = tb;
  } else if (ts < 1e4) {
    vec3 P = ro + rd * ts; vec2 g = (vn(vec3(P.xz * 1.3, uT * 0.4)).xy - 0.5) * 0.08; vec3 n = normalize(vec3(g.x, 1.0, g.y)), rt = refract(rd, -n, 1.333);
    if (dot(rt, rt) < 0.01) col = wc * 2.5 + vec3(0.05, 0.025, 0.008) * uEI * 0.3;   // 窗外是全反射：映着水里
    else { col = skyS(rt); ember(P, rt, 1e3, col); }
    td = ts;
  } else { col = wc; td = 40.0; }
  vec3 oc = uE - ro; float tc = max(dot(oc, rd), 0.0), d2 = max(dot(oc, oc) - tc * tc, 0.0);
  col = mix(wc, col, exp(-td * 0.12)) + vec3(1.0, 0.45, 0.12) * uEI * 0.006 / (d2 + 0.08) * exp(-tc * 0.25);   // 火种在水里的一小团光
  return col;
}

void main() {
  AMB = mix(vec3(0.026, 0.035, 0.068), uAmb, uSpr); KEY = mix(vec3(0.26, 0.31, 0.46), uKey, uSpr); HAZE = mix(vec3(0.020, 0.027, 0.050), uHaze, uSpr);
  vec3 rd = normalize(uFwd + vP.x * uAspect * uTanH * uRight + vP.y * uTanH * uUp), ro = uCam, acc = vec3(0.0), col;
  float T = 1.0, jit = h01(uvec3(gl_FragCoord.xy, 5.0)), hz = dot(rd.xz, rd.xz);
  if (hz > 1e-3) {   // 热浪：火星正上方那一柱空气，把它后面的东西晃一晃
    float ts = dot(uE.xz - ro.xz, rd.xz) / hz; vec3 ps = ro + rd * ts - uE;
    if (ts > 0.0) rd = normalize(rd + (vn(vec3(ps.xy * 7.0 - vec2(0.0, uT * 3.0), uT * 0.7)).xyz - 0.5) * 0.008 * exp(-dot(ps.xz, ps.xz) / 0.06) * smoothstep(0.1, 0.5, ps.y) * exp(-max(ps.y, 0.0) / 1.8));
  }
  float hw = 0.0;
  for (int i = 0; i < 4; i++) {   // 底鼓：一圈热浪从火星推出去（只在水面以上），把它后面的东西扭一下，带一点暖光
    vec3 pv = ro + rd * max(dot(uE - ro, rd), 0.0) - uE; float x = uKick[i].x, dl = length(pv), s = (dl - 0.3 - 2.4 * x) / (0.05 + 0.1 * x);
    float w = uKick[i].y * exp(-s * s - x * 2.5) * smoothstep(-0.05, 0.1, pv.y + uE.y); rd = normalize(rd + pv / max(dl, 1e-3) * 0.014 * w); hw += w;
  }
  if (uUnder > 0.0 && ro.y < 0.0) { float tu; vec3 cu = underwater(ro, rd, jit, tu); gl_FragColor = vec4(cu, 1.0); gl_FragDepth = clamp(1.0000167 - 0.05000083 / (tu * dot(rd, uFwd)), 0.0, 1.0); return; }
  if (ro.y < 0.0 && rd.y < 0.0) ro.y = -ro.y;   // 镜头在水面下（jz_spring.js 倒影翻转的镜像机位）：往上看是没有水的真东西；往下看当作在水面上同样高的地方看，浮出水面那一刻接得上
  gNoTree = uMeshT > 0.0;   // 网格树开着：直接看过去不画色块树（倒影里还画）
  float tw = rd.y < -1e-4 ? -ro.y / rd.y : 1e5, th = trace(ro, rd, tw, 280, jit, acc, T), td = th > 0.0 ? th : tw; gNoTree = false;
  vec4 gb = uMeshT > 0.0 ? texelFetch(uGB, ivec2((vP * 0.5 + 0.5) * vec2(textureSize(uGB, 0))), 0) : vec4(0.0);
  if (gb.x > 0.0 && gb.x < td) { meshG(gb); td = gb.x; col = shade(ro + rd * td, td); gM = -1; }
  else if (th > 0.0) col = shade(ro + rd * th, th);
  else if (tw < 1e5) {
    vec3 P = ro + rd * tw; float rho = length(P.xz); vec2 er = P.xz / max(rho, 1e-3), gRed = vec2(0.0); float gShk = 0.0;
    vec2 fd = normalize(rd.xz + 1e-6); float pa = tw * 2.0 * uTanH / uRes.y, sy = max(-rd.y, 0.004); vec4 wv = waves(P.xz, fd, pa, sy); vec2 v = wv.zw;
    for (int i = 0; i < 32; i++) { float tb = uT - uRk[i]; if (tb < 0.0) break; wv.xy += ripple(P.xz, vec2(0.0), tb, 0.12, 0.45, fd, pa, sy, v); }   // 每个底鼓在火星处起一组涟漪
    for (int j = 0; j < 6; j++) {   // 一簇火星屑落水：落点那一片像下了一阵雨，每粒点出一组小涟漪（短波衰减得快）
      float tj = uT - uSc[j].z; if (tj < 0.0 || tj > 2.5) continue;
      vec2 ci = floor((P.xz - uSc[j].xy) / 0.16);
      for (int c = 0; c < 9; c++) {
        vec2 cc = ci + vec2(float(c % 3 - 1), float(c / 3 - 1));
        float h1 = h01(uvec3(ivec3(ivec2(cc) + 4096, j * 4))), h2 = h01(uvec3(ivec3(ivec2(cc) + 4096, j * 4 + 1))), h3 = h01(uvec3(ivec3(ivec2(cc) + 4096, j * 4 + 2)));
        if (h1 > 0.8 * exp(-dot(cc, cc) * 0.0256 / 0.6)) continue;   // 越往外落得越稀
        float td = tj - 0.25 * h3; wv.xy += ripple(P.xz, uSc[j].xy + (cc + 0.15 + 0.7 * vec2(h2, fract(h2 * 7.3 + h3))) * 0.16, td, 0.015, 0.2 * exp(-1.8 * max(td, 0.0)), fd, pa, sy, v);
      }
    }
    if (uSpr > 0.0) {
      for (int i = 0; i < 8; i++) if (uDr[i].w > 0.0) { float sc = i == 0 ? uDrS : 1.0; vec2 rp = ripple(uDr[i].xy + (P.xz - uDr[i].xy) * sc, uDr[i].xy, uT - uDr[i].z, uDr[i].w, 0.5, fd, pa * sc, sy, v); wv.xy += rp; if (i == 4) gRed = rp; }   // 单独的几滴：露珠、第一滴春雨、红雨滴（第 4 个：映着火光是红的）
      if (uShk.w > 0.0) { float dr = rho - uShk.z; gShk = exp(-dr * dr * 0.5); wv.xy += er * uShk.w * (-1.5 * gShk * dr + 0.3 * cos(dr * 2.2) * exp(dr * 0.15) * step(dr, 0.0)); }   // 尾声的冲击波：一圈浪头从湖心往外推，后面拖着一圈圈小浪
      if (uRain > 0.0) {   // 雨：每 0.5 米一格，每格每 0.8 秒最多落一滴（落点、时刻按格子和第几轮哈希），点出一组小涟漪
        vec2 ci = floor(P.xz / 0.5);
        for (int c = 0; c < 9; c++) { vec2 cc = ci + vec2(float(c % 3 - 1), float(c / 3 - 1)); ivec2 ic = ivec2(cc) + 8192; float ph = 0.8 * h01(uvec3(ivec3(ic, 91)));
          for (int k = 0; k < 2; k++) { float n = floor((uT - ph) / 0.8) - float(k); uint hh = h3(uvec3(ivec3(ic, 100 + (int(n + 4096.0) & 1023))));
            vec3 r = vec3(float(hh & 1023u), float((hh >> 10) & 1023u), float((hh >> 20) & 1023u)) / 1023.0; if (r.z > uRain) continue;
            float age = uT - ph - n * 0.8 - 0.8 * fract(r.x * 13.1 + r.y * 7.7); wv.xy += ripple(P.xz, (cc + 0.1 + 0.8 * r.xy) * 0.5, age, 0.012, 0.18 * exp(-2.0 * max(age, 0.0)), fd, pa, sy, v); }
        }
      }
    }
    vec2 g = wv.xy + (vn(vec3(P.xz * 0.8 + vec2(uT * 0.12, 0.0), uT * 0.15)).xy - 0.5) * 0.012;   // 细浪加一层慢慢起伏的大波
    g += er * 0.03 * sin(rho * 55.0 - uT * 14.0) * exp(-rho * 5.0) * smoothstep(-0.3, 0.1, uE.y);   // 炭块边上的水一直在嘶嘶地颤
    vec2 g0 = g; float fr = floor(uT * 240.0 + 1e5); g += (vec2(h01(uvec3(gl_FragCoord.xy, fr)), h01(uvec3(gl_FragCoord.yx + 4096.0, fr))) - 0.5) * 3.46 * sqrt(v);   // 没画出来的细浪：每个像素随机歪一点，超采样、子帧平均下来就是拉长、糊开的倒影
    vec3 n = normalize(vec3(g.x, 1.0, g.y)), rr = reflect(rd, n), a2 = vec3(0.0); rr.y = abs(rr.y) + 1e-3;
    gNoTree = uMeshT > 0.0; float T2 = 1.0, t2 = trace(P, rr, 1e5, 110, jit, a2, T2), tr = t2 > 0.0 ? t2 : 1e4; gNoTree = false;   // 倒影：山、火、烟、天、火星再走一遍（网格树开着时，树从倒影几何缓冲取）
    float tR = uMeshT > 0.0 ? meshR(P, rr, tw) : 1e9;
    if (tR < tr) { tr = tR; col = fog(P, rr, tr, a2 + T2 * shade(P + rr * tr, tr)); gM = -1; }
    else col = fog(P, rr, tr, a2 + T2 * (t2 > 0.0 ? shade(P + rr * t2, t2) : sky(rr))); plume(P, rr, ember(P, rr, tr, col), jit, col); hero(P, rr, tr, col);
    if (uFRk > 0.0) { vec4 q = uFRm * vec4(P.x, 0.0, P.z, 1.0); vec4 fr = texture2D(uFR, q.xy / q.w * 0.5 + 0.5 + g0 * 0.25); col = mix(col, fr.rgb, fr.a * uFRk); }   // 她的倒影：跟着浪晃
    vec3 rc = col;
    col = mix(mix(vec3(0.004, 0.007, 0.009), uWat, uSpr), col * vec3(0.85, 0.9, 1.0), 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0));   // 菲涅尔：远处斜着看多反天光，近处往下看透出深色的水
    vec3 hm = normalize(uMoon - rd); vec2 dm = hm.xz / max(hm.y, 1e-3) - g0, sv = v + 1.5e-4;                                       // 月光碎银：哪些小水面正好把月亮反进镜头（没画出来的细浪越多，这条光带越宽越糊）
    float pm = exp(-0.5 * (dm.x * dm.x / sv.x + dm.y * dm.y / sv.y)) / (6.2832 * sqrt(sv.x * sv.y) * 4.0 * max(-rd.y, 0.02) * pow(max(hm.y, 1e-3), 4.0));   // 太阳在地平线下（春天的黎明）时 hm.y 会是负的
    if (pm > 20.0) col += mix(vec3(0.8, 0.86, 1.0) * 0.025, uKey * 0.012, uSpr) * pm * (0.02 + 0.98 * pow(1.0 - max(dot(-rd, hm), 0.0), 5.0)) * moonVis(P);
    vec3 lf = uE + vec3(0.0, 0.1 + 0.9 * uFlame, 0.0) - P, hf = normalize(normalize(lf) - rd); float df = max(length(lf), 0.3); vec2 dq = hf.xz / hf.y - g0, sf = sv + 0.25 * pow((0.12 + 0.5 * uFlame) / df, 2.0);   // 火光碎金：火星（烧起来是火苗）这个有大小的光源在波面上的反光
    col += vec3(1.0, 0.5, 0.15) * uEI * smoothstep(-0.3, 0.1, uE.y) * (0.3 + 2.0 * uFlame) * 0.15 / (df * df) * exp(-0.5 * (dq.x * dq.x / sf.x + dq.y * dq.y / sf.y)) / (6.2832 * sqrt(sf.x * sf.y) * 4.0 * max(-rd.y, 0.02) * pow(hf.y, 4.0)) * (0.02 + 0.98 * pow(1.0 - max(dot(-rd, hf), 0.0), 5.0));
    col += (vec3(1.0, 0.55, 0.16) * uEI * 0.012 / (1.0 + rho * rho * 0.35) + vec3(1.0, 0.32, 0.06) * uEI * 0.08 * exp(-rho * rho * 18.0)) * smoothstep(-0.3, 0.1, uE.y);   // 火星照在水面上的一小片；碰到炭的那一圈更亮
    if (uE.y < 0.1) {   // 火种还在水下（冰洞里往上浮）：透过水面看见它，越深越暗越蓝
      vec3 rtw = refract(rd, n, 0.752), cu = vec3(0.0); ember(P, rtw, 8.0, cu);
      col += cu * vec3(0.55, 0.8, 0.95) * exp(max(uE.y, -3.0) * 0.8) * (0.98 - 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0));
    }
    if (uIce > 0.0 && uE.y < 0.13) {   // 冰洞里的水被火种从里面照亮（用户 2026-11-20：这里的光不好看）：点光源沿折射进水的视线积起来的散射，一道道光柱从它往外放；近处暖，远处被水吃成墨绿
      vec3 rtw = refract(rd, n, 0.752), Ew = vec3(uE.x, min(uE.y, -0.03), uE.z), cp = P + rtw * max(dot(Ew - P, rtw), 0.0) - Ew; float s0 = max(dot(Ew - P, rtw), 0.0), hh = max(length(cp), 0.015);
      float sc = (atan((2.5 - s0) / hh) + atan(s0 / hh)) / hh, ray = 0.4 + 1.2 * pow(vn(cp / hh * 4.0 + vec3(0.0, -uT * 0.25, uT * 0.15)).x, 2.0);
      col += mix(vec3(1.0, 0.42, 0.1), vec3(0.18, 0.42, 0.36), smoothstep(0.05, 0.9, hh)) * uEI * 0.09 * (1.0 - smoothstep(0.0, 0.12, uE.y)) * sc * ray * exp(-0.45 * s0 - 0.55 * hh) * (0.98 - 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0));
    }
    if (uSpr > 0.0) col += vec3(1.0, 0.28, 0.05) * uEI * 1.6 * min(length(gRed), 0.12) * exp(-max(uT - uDr[4].z, 0.0) * 1.5) / (1.0 + 0.3 * dot(P.xz - uDr[4].xy, P.xz - uDr[4].xy));   // 红雨滴落水的那一圈：火种照着，波面上是红的
    col += vec3(0.7, 0.82, 1.0) * uShk.w * gShk * 0.35;   // 冲击波的浪头：白沫，带一点雷光
    float rn = rho + 0.12 * (vn(vec3(P.xz * 2.5, 3.0)).x - 0.5), ic = uIce * smoothstep(uOpen - 0.01, uOpen + 0.01, rn);   // 冰盖：火种周围融开 uOpen 那么大一圈，边是不齐的
    if (ic > 0.0) col = mix(col, iceCol(P, rd, rc, pa, rn), ic);
  } else col = sky(rd);
  col = acc + T * col;
  col = fog(ro, rd, td, col);
  float inkE = uToon * smoothstep(0.04, 0.14, fwidth(log(td))) * (1.0 - smoothstep(250.0, 900.0, td));   // 国风：前后断开的地方（山脊、树冠、近山压远山、岸线）——写进透明通道，后期 JZ.ink 按它描粗线（雨、光屑叠上来会把它填满，不会被描）
  if (uCD.w > 0.0) { vec4 dk = deck(ro, rd, td); col = mix(col, dk.rgb, dk.a); }
  plume(ro, rd, ember(ro, rd, td, col), jit, col); hero(ro, rd, td, col); col += vec3(1.0, 0.45, 0.12) * 0.05 * hw;
  gl_FragColor = vec4(col, 1.0 - 0.5 * inkE);
  gl_FragDepth = td > 9e4 ? 1.0 : clamp(1.0000167 - 0.05000083 / (td * dot(rd, uFwd)), 0.0, 1.0);          // 写深度（近 0.05、远 3000，和 cam 一致），粒子才会被山挡住
}`;

// 飞的东西共用一个壳：at(u) 给出出生 u 秒后的位置。别的世界也借它（JZ.kit.fly）
const fly = (K, at, col) => ({ v: K.RIBBON + `
attribute vec3 iP0, iV; attribute vec4 iA; uniform float uDim, uLoop, uWs, uFloor; uniform vec3 uE; uniform vec4 uTm;   // uFloor：低于它的不画（默认 0 = 水面）
varying float vS, vE, vG, vK;
${at}
void main() {
  float u = uLoop > 0.5 ? mod(uT - iA.x, iA.y) : uT - iA.x, thin; vS = position.x; vE = position.y; vK = u / iA.y; vG = 0.0;
  if (u < 0.0 || u > iA.y) { ${K.HIDE} return; }
  vec3 b = at(u), a = at(max(u - 0.04, 0.0));
  if (b.y < uFloor) { ${K.HIDE} return; }
  float w = iA.w * (uWs > 0.5 ? mix(0.05, 1.0, clamp(length(b - uE) / 50.0, 0.0, 1.0)) : 1.0);
  gl_Position = position.y > 0.5 ? ribbon(b, a, position.x, 1.0, w, 2.5, thin) : ribbon(a, b, position.x, 0.0, w, 2.5, thin);
  vG = smoothstep(0.0, 0.05, u) * pow(max(1.0 - vK, 0.0), 1.2) * (0.7 + 0.3 * sin(u * 31.0 + iA.z * 50.0)) * mix(0.5, 1.0, thin) * uDim * smoothstep(0.15, 1.2, gl_Position.w);
#ifdef OCC
  vG *= occ(b, a);   // at 里定义了 OCC：被什么挡住、拖尾太长要减亮（见 jz_cosmos.js 的星系）
#endif
}`, f: `
varying float vS, vE, vG, vK;
void main() { ${col} gl_FragColor = vec4(c * exp(-vS * vS * 5.0) * vG * smoothstep(0.0, 0.7, vE) * (1.0 - smoothstep(0.92, 1.0, vE)), 1.0); }` });

JZ.kit.fly = fly;

// ---------- 建一次 ----------
W.build = (M) => {
  THREE = JZ.THREE; K = JZ.kit; beat = M.song.beat;
  const rnd = M.rng(9173), R1 = () => rnd() * 2 - 1;
  T = [0]; for (let n = 1; n <= 9; n++) T[n] = M.ref('bar' + n);   // T[1]：片内 bar1（整首里不是 0 秒）
  const F = M.full || M; BB = []; for (let n = 1; n <= 17; n++) BB[n] = F.ref('bar' + n);   // 整首的小节头：前奏、A2（bar1–16）用；BB[17] = T[1]
  kicks = M.song.kicks.filter(k => k.t < T[9] - 0.05); TF = M.word(6, '火');
  const U = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
  const BA = (a, k) => new THREE.BufferAttribute(a, k), IA = (a, k) => new THREE.InstancedBufferAttribute(a, k);
  const add = { blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide };
  const ribQuad = () => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', BA(new Float32Array([1, 0, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]); return g; };
  const k4 = () => [0, 1, 2, 3].map(() => new THREE.Vector2(99, 0)), com = () => ({ uT: 0, uPx: JZ.px, uRes: JZ.res });
  sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 3000);
  const mirror = new THREE.Group(); mirror.scale.y = -1; sc.add(mirror);   // 粒子的倒影：同一批粒子沿水面翻过去再画一遍

  // 涟漪：每个底鼓在火星处起一组；二、四拍火星溅出一簇火星屑，飞两拍落水，落点再起小的一组
  const rk = new Array(32).fill(1e5); kicks.slice(0, 32).forEach((k, i) => { rk[i] = k.t; });
  const FLY = 2 * beat, spl = []; kicks.forEach((k, i) => { if (i % 2 === 1 && k.t >= T[3] - 0.05) { const a = rnd() * M.TAU, r = 1.6 + 5 * rnd(); spl.push({ t: k.t, p: [Math.cos(a) * r, 0.02, Math.sin(a) * r] }); } });
  RB = [T[5], T[5] + beat, T[5] + 2 * beat, T[5] + 3 * beat, T[6], T[6] + 2 * beat];
  fire = U({ uFL: 0, uFI: 0, uFJ: 0, uFd: new THREE.Vector2(0.738, -0.674), uWind: new THREE.Vector2(0.96, 0.28), uIg: new THREE.Vector3(IG[0], IG[1], 0) });
  sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthFunc: THREE.AlwaysDepth, vertexShader: VERT, fragmentShader: JZ.GLSL + JZ.LAND + FIRE + LAKE_F, uniforms: { ...fire, ...U({ uNoise: JZ.noise, uLand: JZ.land(),
    uCam: new THREE.Vector3(), uFwd: new THREE.Vector3(), uRight: new THREE.Vector3(), uUp: new THREE.Vector3(), uE: new THREE.Vector3(...E), uMoon: new THREE.Vector3(0.2617, 0.4462, -0.8559).normalize() /* 方位 287°、仰角 26.5°：山口，各机位看都高过山脊 */,
    uHero: new THREE.Vector4(), uHeroV: new THREE.Vector3(), uTanH: 1, uAspect: 16 / 9, uT: 0, uEI: 1, uReach: 0, uFlame: 0, uSmoke: 0, uRes: JZ.res, uIce: 0, uOpen: -1, uSnow: 0, uMoonI: 1, uHB: new THREE.Vector4(0.18, -0.05, 0.06, 0.012), uRk: rk, uKick: k4(), uRm: new THREE.Matrix3(),
    uCD: new THREE.Vector4(), uCV: new THREE.Vector4(), uUnder: 0, uMistH: 1.2, uWv: 1, uSpr: 0, uToon: 0, uFRk: 0, uFRm: new THREE.Matrix4(), uFR: null, uRain: 0, uMist: 0, uPeach: 0, uStar: 0, uBV: 30, uBR: 0, uLeafE: 0, uBlosE: 0, uGlowR: 0, uKey: new THREE.Vector3(), uAmb: new THREE.Vector3(), uHaze: new THREE.Vector3(), uSkyZ: new THREE.Vector3(), uSkyH: new THREE.Vector3(), uSkyS: new THREE.Vector3(), uMistC: new THREE.Vector3(), uWat: new THREE.Vector3(),
    uBP: [...Array(24)].map(() => new THREE.Vector4(0, 0, 1e5, 0)), uRing: new THREE.Vector4(), uDr: [...Array(8)].map(() => new THREE.Vector4()), uDrS: 1, uShk: new THREE.Vector4(), uGE: [...Array(16)].map(() => new THREE.Vector4(0, 0, 1e5, 0)), uGV: new Array(16).fill(1), uGB: null, uGBM: null, uMeshT: 0, uPQ: new URLSearchParams(location.search).has('render') ? 1 : 1.7,
    uSc: [0, 1, 2, 3, 4, 5].map(j => spl[j] ? new THREE.Vector4(spl[j].p[0], spl[j].p[2], spl[j].t + FLY, 0) : new THREE.Vector4(0, 0, 1e5, 0)) }) } }));
  sky.frustumCulled = false; sky.renderOrder = -1; sc.add(sky);

  // 火星溅出来的火星屑（带倒影）
  flies = [];
  const mk = (list, sh, uni) => {
    const n = list.length, p0 = new Float32Array(n * 3), v = new Float32Array(n * 3), a = new Float32Array(n * 4); list.forEach((q, i) => { p0.set(q[0], i * 3); v.set(q[1], i * 3); a.set(q[2], i * 4); });
    const g = ribQuad(); g.setAttribute('iP0', IA(p0, 3)); g.setAttribute('iV', IA(v, 3)); g.setAttribute('iA', IA(a, 4)); g.instanceCount = n;
    const un = U({ ...com(), uDim: 1, uLoop: 0, uWs: 0, uE: new THREE.Vector3(...E), uTm: new THREE.Vector4(), ...uni });
    for (const [par, dim] of [[sc, un.uDim], [mirror, { value: 0.45 }]]) { const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ ...add, uniforms: { ...un, uDim: dim }, vertexShader: sh.v, fragmentShader: sh.f })); m.frustumCulled = false; m.renderOrder = 2; par.add(m); flies.push(m); }
  };
  const spit = [];   // 军鼓那一簇：朝落点抛出去，两拍后落水
  for (const s of spl) for (let i = 0; i < 220; i++) { const j = 1 + 0.18 * R1(); spit.push([E, [s.p[0] / FLY * j + R1() * 0.5, (4.5 * FLY * FLY - E[1]) / FLY * (1 + 0.15 * R1()), s.p[2] / FLY * j + R1() * 0.5], [s.t + rnd() * 0.2, FLY * 1.7, rnd(), 0.006 + 0.008 * rnd()]]); }
  mk(spit, fly(K, `vec3 at(float u) {   // 落到水面（uL 秒）就停住，贴着水面嘶嘶地颤，转暗红、熄掉（停住不动的带子画不出来，颤也是为了画得出）
  float uL = (iV.y + sqrt(iV.y * iV.y + 18.0 * iP0.y)) / 9.0, w = max(u - uL, 0.0); u = min(u, uL);
  float a = -2.4 * (1.0 - min(u * 1.4 / iA.y, 1.0)), c = cos(a), s = sin(a); vec3 d = iV * u, p = iP0 + vec3(c * d.x - s * d.z, d.y - 4.5 * u * u, s * d.x + c * d.z);
  return w > 0.0 ? vec3(p.x, 0.004, p.z) + vec3(sin(w * 41.0 + iA.z * 60.0), 0.0, cos(w * 37.0 + iA.z * 50.0)) * 0.012 : p; }
#define OCC
vec2 sl(vec3 b) { vec4 c = projectionMatrix * viewMatrix * modelMatrix * vec4(b, 1.0); return c.xy / max(c.w, 0.2) * uRes * 0.5; }
float occ(vec3 b, vec3 pa) { return smoothstep(0.0, 0.25, uT - iA.x) * smoothstep(1.5, 5.5, length((modelMatrix * vec4(b, 1.0)).xyz - cameraPosition)) * clamp(10.0 * uPx / max(length(sl(b) - sl(pa)), 1e-3), 0.12, 1.0); }   // 审片：47.5 秒落点离镜头只几米，近处的火星拖成很长的白线，整屏一亮——拖尾越长越暗、贴着镜头的淡掉`, `vec3 c = mix(vec3(1.0, 0.8, 0.45), vec3(0.95, 0.25, 0.05), smoothstep(0.1, 0.9, vK)) * 1.6;`), {});   // 水平方向按签名螺旋的方向绕过去，落点不变
  // 签名螺旋：火星屑从炭块两侧冒出来（出口跟着炭块自转），绕着它打旋往上走一圈多（从上往下看顺时针，别的世界的旋照这个方向），越高圈越大、顺风歪，走到头熄成灰
  // 火星屑落水冒的白汽：一团团朝着镜头的软雾片，往上飘、变大、淡掉，被旁边的火照得发暖（带倒影）
  const nst = spl.length * 140, sA = new Float32Array(nst * 4), sB = new Float32Array(nst * 4); let ns = 0;
  for (const s of spl) for (let i = 0; i < 140; i++, ns++) { const r = 0.7 * Math.sqrt(rnd()), a = rnd() * M.TAU; sA.set([s.p[0] + Math.cos(a) * r, 0.03, s.p[2] + Math.sin(a) * r, s.t + FLY + 0.35 * rnd()], ns * 4); sB.set([0.24 + R1() * 0.08, 0.3 + 0.25 * rnd(), 0.07 + R1() * 0.08, 1.0 + 0.9 * rnd()], ns * 4); }
  const stg = ribQuad(); stg.setAttribute('iA', IA(sA, 4)); stg.setAttribute('iB', IA(sB, 4)); stg.instanceCount = nst;
  const stv = `attribute vec4 iA, iB; uniform float uT; varying vec2 vC; varying vec3 vW; varying float vA;   // iA：出生位置、出生时刻；iB：速度、活多久
void main() {
  float u = uT - iA.w, k = u / iB.w; vC = vec2(position.x, position.y * 2.0 - 1.0); vA = 0.0;
  if (k < 0.0 || k > 1.0) { ${K.HIDE} return; }
  vW = iA.xyz + iB.xyz * (u - 0.25 * u * u) + vec3(vC, 0.0) * 0.3; vec4 mv = modelViewMatrix * vec4(iA.xyz + iB.xyz * (u - 0.25 * u * u), 1.0); mv.xy += vC * (0.16 + 0.10 * fract(iA.w * 91.7)) * (0.6 + 1.6 * k);
  gl_Position = projectionMatrix * mv; vA = smoothstep(0.0, 0.2, k) * (1.0 - k) * (1.0 - k) * smoothstep(0.3, 1.5, -mv.z);   // 贴着镜头的淡掉
}`, stf = JZ.GLSL + `uniform float uDim, uT; varying vec2 vC; varying vec3 vW; varying float vA;
void main() { float n = 0.6 * vn(vW * 7.0 - vec3(0.0, uT * 1.5, 0.0)).x + 0.4 * vn(vW * 17.0 - vec3(0.0, uT * 3.0, 0.0)).y; gl_FragColor = vec4(vec3(0.55, 0.45, 0.38) * 0.05 * uDim * vA * exp(-dot(vC, vC) * 2.5) * smoothstep(0.35, 0.75, n), 1.0); }`;   // 噪声把每片雾的边破开，成一缕缕的
  for (const [par, dim] of [[sc, 1], [mirror, 0.45]]) { const m = new THREE.Mesh(stg, new THREE.ShaderMaterial({ ...add, uniforms: U({ uT: 0, uDim: dim, uNoise: JZ.noise }), vertexShader: stv, fragmentShader: stf })); m.frustumCulled = false; m.renderOrder = 2; par.add(m); flies.push(m); }
  // A2 bar12→13 F：冰洞里冒起一团白汽，横着从镜头前飘过（镜头在 +x 那边朝火种看）；后面火种已经浮上水面
  const nsb = 260, bA = new Float32Array(nsb * 4), bB2 = new Float32Array(nsb * 4);
  for (let i = 0; i < nsb; i++) { bA.set([1.0 + 0.6 * R1(), 0.15 + 0.7 * rnd(), -2.3 + 0.5 * R1(), BB[13] - 1.3 + 0.5 * rnd()], i * 4); bB2.set([0.05 * R1(), 0.2 + 0.15 * rnd(), 1.3 + 0.3 * rnd(), 2.2 + 0.6 * rnd()], i * 4); }
  { const c = Math.cos(77 * Math.PI / 180), sn = Math.sin(77 * Math.PI / 180); for (const a of [bA, bB2]) for (let i = 0; i < nsb * 4; i += 4) { const x = a[i], z = a[i + 2]; a[i] = x * c - z * sn; a[i + 2] = x * sn + z * c; } }   // 第六次：镜头不绕到 -z 那边了（方位 59° 推近），白汽绕 y 转 77° 跟过去，照样从镜头前横着飘过
  const sbg = ribQuad(); sbg.setAttribute('iA', IA(bA, 4)); sbg.setAttribute('iB', IA(bB2, 4)); sbg.instanceCount = nsb;
  for (const [par, dim] of [[sc, 2.5], [mirror, 1.0]]) { const m = new THREE.Mesh(sbg, new THREE.ShaderMaterial({ ...add, uniforms: U({ uT: 0, uDim: dim, uNoise: JZ.noise }), vertexShader: stv, fragmentShader: stf })); m.frustumCulled = false; m.renderOrder = 2; par.add(m); flies.push(m); }

  const spk = []; for (let i = 0; i < 360; i++) spk.push([[(i % 2) * Math.PI + 0.35 * R1(), 0.18 + 0.06 * rnd(), 0.04 + 0.12 * rnd()], [0.32 + 0.12 * rnd(), 0.07 + 0.04 * rnd(), 1.2 + 0.3 * rnd()], [rnd() * 5, 3 + 1.5 * rnd(), rnd(), 0.0015 + 0.002 * rnd()]]);
  mk(spk, fly(K, `vec3 at(float u) {   // iP0：出口角度、出口半径、出口高度；iV：上升速度、半径每秒涨多少、一生转几圈
  float a = iP0.x + 0.12 * (uT - u) + 6.2832 * iV.z * u / iA.y, r = iP0.y + iV.y * u, h = iP0.z + iV.x * u + 0.03 * u * u, w = 0.10 * h + 0.035 * h * h;
  return uE + vec3(cos(a) * r + 0.96 * w, h, sin(a) * r + 0.28 * w); }`,
    `vec3 c = mix(mix(vec3(1.0, 0.7, 0.35), vec3(0.9, 0.2, 0.04), smoothstep(0.05, 0.6, vK)), vec3(0.16, 0.15, 0.15), smoothstep(0.6, 0.95, vK)) * 1.1;`), { uLoop: 1 });
  spkM = flies.slice(-2).map(m => [m.material.uniforms.uDim, m.material.uniforms.uDim.value]);   // 冬天火种在冰下，签名螺旋要关掉
  // 飞向树林那一粒的尾迹：一路掉下火星屑，变暗、熄成灰飘落（越快越长）
  const hs = (s) => [IG[0] * s, 1 + 2 * s + 48 * s * (1 - s), IG[1] * s], trl = [];
  for (let i = 0; i < 900; i++) { const s = rnd(); trl.push([hs(s).map(v => v + R1() * 0.15), [R1() * 0.6, 0.3 + 0.5 * rnd(), R1() * 0.6], [T[7] - 2 * beat * (1 - s), 0.8 + 0.8 * rnd(), rnd(), 0.02 + 0.02 * rnd()]]); }
  mk(trl, fly(K, `vec3 at(float u) { return iP0 + iV * u + vec3(0.0, -0.8, 0.0) * u * u; }`,
    `vec3 c = mix(mix(vec3(1.0, 0.75, 0.4), vec3(0.9, 0.2, 0.04), smoothstep(0.0, 0.5, vK)), vec3(0.16, 0.15, 0.15), smoothstep(0.5, 0.95, vK)) * 1.4;`), {});

  // 前奏、A2 下雪：镜头周围 30 米的盒子里循环飘落（盒子跟着镜头走，贴着镜头的淡掉）；bar11–13 停
  const snw = []; for (let i = 0; i < 9000; i++) snw.push([[R1() * 15, R1() * 15, R1() * 15], [0.3 + 0.3 * R1(), -0.9 - 0.4 * rnd(), 0.1 + 0.2 * R1()], [rnd() * 40, 40, rnd(), 0.006 + 0.008 * rnd()]]);
  mk(snw, fly(K, `vec3 at(float u) {   // 折回盒子的偏移按这一刻算，一条轨迹的两头用同一个（不然在盒子边上拉出一道 30 米的线）
    vec3 p = iP0 + iV * u + 0.25 * vec3(sin(u * 1.3 + iA.z * 20.0), 0.0, cos(u * 1.1 + iA.z * 30.0)), pn = iP0 + iV * mod(uT - iA.x, iA.y);
    return p - 30.0 * floor((pn - cameraPosition + 15.0) / 30.0); }`,
    `vec3 c = vec3(0.45, 0.5, 0.6) * 0.5;`), { uLoop: 1, uFloor: -0.01 });
  snowM = flies.slice(-2).map(m => [m.material.uniforms.uDim, m.material.uniforms.uDim.value]);
  // A2 bar8→9 G：冰洞周围的雪被火种的热气卷起来，沿签名螺旋旋上去（从上往下看顺时针），再散开落回冰上
  const swl = []; for (let i = 0; i < 1200; i++) swl.push([[rnd() * M.TAU, 0.9 + 1.4 * Math.sqrt(rnd()), 0.02], [1.2 + 0.8 * rnd(), 0.1 + 0.1 * rnd(), 0.7 + 0.3 * rnd()], [BB[9] - 0.9 + 0.6 * rnd(), 2.6 + 0.8 * rnd(), rnd(), 0.004 + 0.004 * rnd()]]);   // 热气往上托：旋成冰洞上方往上走的一股
  mk(swl, fly(K, `vec3 at(float u) {   // iP0：起点角度、半径、高；iV：上升速度、半径每秒涨多少、一生转几圈
    float a = iP0.x + 6.2832 * iV.z * u / iA.y, r = iP0.y + iV.y * u, h = iP0.z + iV.x * u - 0.15 * u * u;
    return vec3(cos(a) * r, max(h, 0.0), sin(a) * r); }`, `vec3 c = vec3(0.55, 0.6, 0.7) * 0.35;`), {});

  // 片内 bar5 第 4 拍：风从火种那边卷来一阵火星屑，从镜头四周越过去，小节头冲向山（镜头不减速）
  const gst = []; while (gst.length < 420) {   // 镜头前后 1.4 以内的不要（贴着镜头的会糊成方块）：按飞到镜头那段湖面（z −5.5 到 −11）时的位置挑
    const sp = 11 + 5 * rnd(), a = 0.25 * R1(), p0 = [E[0] + R1() * 0.4, E[1] + 0.3 + 0.5 * rnd(), E[2] + R1() * 0.4], v = [Math.sin(a) * sp + 0.8, 0.5 + 1.2 * rnd(), -Math.cos(a) * sp], A = [T[5] + 0.05 + 0.55 * rnd(), 2.6 + 0.6 * rnd(), rnd(), 0.012 + 0.016 * rnd()];   // bar5 镜头转身俯冲、火种到了身后才出生（看着火种冒出来会算闪）；T[6] − 0.72 前后正好铺在镜头四周
    const near = [5.5, 8, 11].some(z => { const u = z / -v[2]; return Math.hypot(p0[0] + v[0] * u - (0.5 - 0.27 * (5.5 - z)), p0[1] + v[1] * u - 1.75) < 1.4; });
    if (!near) gst.push([p0, v, A]); }
  mk(gst, fly(K, `vec3 at(float u) { float a = 4.0 * u + iA.z * 6.2832, r = 0.25 + 0.15 * u; return iP0 + iV * u + vec3(cos(a) * r, 0.1 * u * u, sin(a) * r); }`,   // 小旋照签名螺旋的方向
    `vec3 c = mix(mix(vec3(1.0, 0.75, 0.4), vec3(0.9, 0.2, 0.04), smoothstep(0.0, 0.5, vK)), vec3(0.16, 0.15, 0.15), smoothstep(0.5, 0.95, vK)) * 1.4 * smoothstep(0.0, 0.25, vK);`), {});   // 慢慢亮起来：一齐从火种身上冒出来会算闪

  // 山火的火星屑：撒在烧的那一面山坡上，火带烧到脚下才飞起来；被热气托上去，顺风斜出去，带一点打旋。bar8 被吸回火星
  const nsp = 90000, sa = new Float32Array(nsp * 4);
  for (let i = 0; i < nsp; i++) { const a = -0.74 + R1() * 0.65, r = Math.sqrt(46 ** 2 + (220 ** 2 - 46 ** 2) * rnd()); sa.set([Math.cos(a) * r, Math.sin(a) * r, rnd(), 0.02 + 0.03 * rnd()], i * 4); }
  const sg = ribQuad(); sg.setAttribute('iA', IA(sa, 4)); sg.instanceCount = nsp;
  const sv = JZ.GLSL + JZ.LAND + FIRE + K.RIBBON + `
attribute vec4 iA; uniform float uDim, uFa, uFv, uKt[8]; uniform vec3 uE; uniform vec4 uTm; varying float vS, vE, vG, vK;   // iA：xy 在山上的位置，z 种子，w 粗细；uFa + uFv·t：t 时刻火线多高；uTm：开始被吸、全吸到、「火」字、窜多高
vec3 at(vec3 p0, float u, float sd, float tn) {   // 出生 u 秒后在哪；tn：那一刻的歌曲时间
  float e = 1.0 - exp(-u * 0.8), w = 1.2 * u + 0.9 * u * u, k = clamp((tn - uTm.x) / (uTm.y - uTm.x), 0.0, 1.0); k = k * k * k;
  vec3 p = p0 + vec3(uWind.x * w, (6.0 + 6.0 * fract(sd * 7.1)) * e, uWind.y * w) + vec3(sin(u * 3.1 + sd * 40.0), 0.3 * sin(u * 4.3 + sd * 17.0), cos(u * 2.7 + sd * 31.0)) * 0.35 * u;
  vec3 d = mix(p, uE, k) - uE; float an = (1.5 + 5.0 * fract(sd * 3.7)) * k * (1.0 - k), c = cos(an), s = sin(an);   // 被吸向火星：越近越快，带一点旋
  return uE + vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
}
void main() {
  float life = 1.2 + 2.2 * fract(iA.z * 13.7), k = floor((uT - iA.z * 37.0) / life), u = uT - iA.z * 37.0 - k * life, tb = uT - u, thin;
  vS = position.x; vE = position.y; vK = u / life; vG = 0.0;
  vec4 L = land(iA.xy, 0.0); float j = uTm.w * smoothstep(uTm.z, uTm.z + 0.35, tb), lv = uFa + uFv * tb + j; for (int i = 0; i < 8; i++) lv += 1.2 * (1.0 - exp(-max(tb - uKt[i], 0.0) * 6.0));
  float ub = fireU(L, lv);   // 出生那一刻脚下在不在烧
  if (ub < -3.0 - j || ub > 0.6 || h01(uvec3(ivec3(int(k) + 64, int(iA.z * 65536.0), 3))) > fireI(iA.xy, L)) { ${K.HIDE} return; }
  vec3 p0 = vec3(iA.x, L.r + 0.6, iA.y), b = at(p0, u, iA.z, uT), a = at(p0, max(u - 0.09, 0.0), iA.z, uT - min(u, 0.09));
  float nr = clamp(length(b - uE) / 40.0, 0.0, 1.0), w = iA.w * mix(0.15, 1.0, nr);   // 挤到火星跟前的收细、压暗，不然白成一片
  gl_Position = position.y > 0.5 ? ribbon(b, a, position.x, 1.0, w, 2.5, thin) : ribbon(a, b, position.x, 0.0, w, 2.5, thin);
  vG = smoothstep(0.0, 0.08, u) * pow(1.0 - vK, 1.5) * mix(0.5, 1.0, thin) * uDim * smoothstep(2.0, 8.0, gl_Position.w) * mix(0.25, 1.0, nr) * (1.0 - 0.85 * smoothstep(uTm.x, uTm.y, uT));   // 贴到镜头跟前的不画
}`, sf = `varying float vS, vE, vG, vK;
void main() { gl_FragColor = vec4(mix(vec3(1.0, 0.78, 0.42), vec3(0.95, 0.16, 0.03), smoothstep(0.05, 0.85, vK)) * 1.8 * exp(-vS * vS * 5.0) * vG * smoothstep(0.0, 0.7, vE) * (1.0 - smoothstep(0.92, 1.0, vE)), 1.0); }`;
  const sm = new THREE.Mesh(sg, new THREE.ShaderMaterial({ ...add, depthTest: true, vertexShader: sv, fragmentShader: sf, uniforms: { ...fire, ...U({ ...com(), uNoise: JZ.noise, uLand: JZ.land(), uDim: 1, uFa: FL0 - FLV * T[7], uFv: FLV, uKt: [0, 1, 2, 3, 4, 5, 6, 7].map(i => (kicks.filter(k => k.t > T[7] - 0.05)[i] || { t: 1e5 }).t), uE: new THREE.Vector3(...E), uTm: new THREE.Vector4(T[8], T[9], TF, LEAP) }) } }));
  sm.frustumCulled = false; sm.renderOrder = 2; sc.add(sm); flies.push(sm);   // 不画倒影：倒影没法被山和树挡住

  // 镜头：整段一条路径，过小节头加速一下，不切
  const U0 = [0, 1, 0];

  // 前奏（bar1–8）：冬夜结冰的湖。第一帧正上方很高，冰面上一个暗红的点；落下来，雪迎面落过；推进冰里，火种封在冰下快熄了；对准冰里一颗圆气泡
  const Yd = [0, 0, -1];
  CW = JZ.path([
    { t: 0, p: [0, 170, 0.5], l: [0, 0, 0], up: Yd, fov: 40 },
    { t: BB[2], p: [0, 140, 3], l: [0, 0, 0], up: Yd, fov: 42 },
    { t: BB[3], p: [8, 72, 46], l: [0, 0, -4], up: U0, fov: 44 },                      // bar2→3 A：一路降下来，斜过去，看得出湖多大、山多高
    { t: BB[4], p: [5, 22, 26], l: [0, 0, 0], up: U0, fov: 46 },
    { t: BB[4] + 1.2, p: [1.6, 5, 7.5], l: [0, -0.3, 0], up: U0, fov: 44 },
    { t: BB[5], p: [0.35, 0.7, 1.1], l: [0, -0.45, 0], up: U0, fov: 42 },               // bar4→5 D：推向冰下那个红点，冰里的气泡、裂纹越放越大
    { t: BB[5] + 0.8, p: [0.12, 0.3, 0.42], l: [0.05, -0.45, 0], up: U0, fov: 40 },                  // 贴着冰面：冻住的气泡一层层，底下是快熄的火种
    { t: BB[6], p: [0.2, 0.16, 0.12], l: [0.2, -0.4, -0.1], up: U0, fov: 40 },
    { t: BB[7] - 0.6, p: [0.19, 0.11, 0.0], l: [0.18, -0.2, -0.06], up: [0, 0.4, -0.9], fov: 40 },
    { t: BB[7] + 0.05, p: [0.18, 0.08, -0.05], l: [0.18, -0.06, -0.0501], up: Yd, fov: 40 },         // 正对着那颗圆气泡（uHB），bar7 接月亮
    { t: BB[7] + 0.3, p: [0.18, 0.07, -0.05], l: [0.18, -0.06, -0.0501], up: Yd, fov: 40 },          // 叠化还没完：接着往下推（不停住）
  ]);
  // bar7 起：月亮 → 拉开、低头看湖，火种周围融开一圈（前奏最后一小节）；A2：雪被热气卷起来，冰洞里火种往上浮，冒出水面重新烧起来，冰一路化开
  const PM = [2, 25, 12], hbR = (t) => Math.tan(0.012 / (CW(t).p[1] + 0.06 / 1.31)) / Math.tan(20 * Math.PI / 180);   // 冰里那颗气泡（半径 1.2 厘米、深 6 厘米）俯拍时占半高的几成（近轴折射，冰 1.31）
  FB = (t) => 2 * Math.atan(Math.tan(0.0105) / hbR(t)) * 180 / Math.PI;   // 月盘（半径 0.0105 rad）和它一样大要的视角：叠化里每一帧都按它算
  const MD = sky.material.uniforms.uMoon.value.toArray();
  const K16 = [   // bar15 冲出去以后 → bar17 微距 → bar18（CL 全用；CAM 从后三个接着走，过 T[1] 位置、速度都接得上）
    { t: BB[15] + 1.0, p: [-1.5, 9, 16], l: [0, 0, -14], up: U0, fov: 56, v: [-5, 0, 0] },             // 升到顶：横着扫过去，看化冰的前沿推过湖面、推上山
    { t: BB[16] + 0.5, p: [-5.2, 3.6, 8.5], l: [0, 0.3, 0], up: U0, fov: 50 },                         // bar16：一路落回火种
    { t: BB[16] + 1.2, p: [-2.1, 1.0, 4.3], l: [0, 0.5, 0], up: U0, fov: 46 },
    { t: T[1], p: [-0.884, 0.42, 2.867], l: [0, 0.85, 0], up: U0, fov: 44 },                           // bar16→17：落到微距的机位（不叠化、不切）；bar1–2 微距：绕着火星慢慢转、慢慢推近；朝着月亮，火星背后是月光那条碎银
    { t: T[2], p: [0.434, 0.42, 2.462], l: [0, 0.7, 0], up: U0, fov: 42 }];   // 绕过去约 27°，一路推近（落下来的速度接着用，不像停住）
  CL = JZ.path([
    { t: BB[7] - 0.15, p: PM, l: PM.map((v, i) => v + MD[i] * 100), up: U0, fov: FB(BB[7] - 0.15) },   // 叠化（bar7 前 0.15 到后 0.25 秒）里月亮跟气泡一样大、一样在变大（W.draw 里每帧按 FB 算）
    { t: BB[7] + 0.25, p: PM, l: PM.map((v, i) => v + MD[i] * 100), up: U0, fov: FB(BB[7] + 0.25) },
    { t: BB[7] + 0.5, p: PM, l: PM.map((v, i) => v + MD[i] * 100), up: U0, fov: FB(BB[7] + 0.25) * 0.97 },   // 接着推一点、慢慢停住，再拉开（不原路猛退）
    { t: BB[7] + 1.1, p: [2.2, 22, 12.2], l: [2.2 + MD[0] * 100, 22 + MD[1] * 100, 12.2 + MD[2] * 100], up: U0, fov: 12 },   // 长焦只拍月亮和天（机位高，山脊压在画面外；地形贴图不够细，长焦下山会糊）
    { t: BB[8], p: [3, 4, 13], l: [-4.8, 1.1, -86.6], up: U0, fov: 44 },                     // 低头低到一半（看远处）：从月亮到湖心的转动摊到 2.6 秒（第六次：原来 0.7 秒转 33°）
    { t: BB[8] + 1.2, p: [2.3, 2.7, 7.2], l: [-26.6, -31.2, -83.1], up: U0, fov: 46, v: [0.15, -0.15, -1.0] },   // 看着湖心（注视点放远在同一条线上）；v：接着往冰洞那边飘，不在 bar9 前停住（用户 2026-11-20：17 秒镜头甩了一下）
    { t: BB[9], p: [2.4, 2.6, 6.5], l: [0, 0.5, 0], up: U0, fov: 48 },                   // bar8→9 G：冰洞边上的雪被热气卷起来
    { t: BB[10], p: [2.0, 1.5, 4.3], l: [0, -0.2, 0], up: U0, fov: 48 },
    { t: F.word(2, '俯'), p: [1.5, 0.8, 3.0], l: [0, -0.4, 0], up: U0, fov: 48 },                  // 唱到「俯」：压低，贴近冰洞
    { t: BB[11], p: [1.35, 0.85, 2.55], l: [0, -0.3, 0], up: U0, fov: 48 },              // bar10→11 A：不绕（第六次），一直朝冰洞慢慢推；新看到的是火种的红光从黑水里往上浮
    { t: BB[12], p: [1.2, 0.85, 2.1], l: [0, -0.2, 0], up: U0, fov: 46 },
    { t: BB[13], p: [1.1, 0.8, 1.85], l: [0, 0.1, 0], up: U0, fov: 46 },                // bar12→13 F：一团白汽从镜头前飘过，后面火种已经浮上水面
    { t: BB[14], p: [2.0, 0.7, 1.8], l: [0, 0.2, 0], up: U0, fov: 46 },
    { t: BB[15], p: [3.2, 1.6, 4.4], l: [0, 0.2, -4], up: U0, fov: 50 },                // bar14→15 L：小节头冲出去（不悬停），化冰的前沿从火种往外推
    ...K16]);   // bar15–17 一镜到底：升高、横着扫过湖看化冰，再一路落回火种跟前，就是 bar17 微距的机位（和 CAM 共用这几个机位，速度接得上）
  { const CL0 = CL, ta = BB[8] + 1.26, tb = BB[9] + 0.14, dir = (C) => { const d = C.l.map((v, i) => v - C.p[i]), n = Math.hypot(...d); return d.map(v => v / n); }, da = dir(CL0(ta)), db = dir(CL0(tb));
    // bar9 前注视点从 90 米外换到冰洞：远近两点插值，前面几乎不转、最后 0.1 秒猛拐（用户 2026-11-20：17 秒镜头甩了一下）。这一段改按方向匀匀地转过去，两头的转速和前后接上
    CL = (t) => { const C = CL0(t); if (t <= ta || t >= tb) return C; const x = (t - ta) / (tb - ta), u = 0.5 * x + 0.5 * x * x * (3 - 2 * x), d = da.map((v, i) => v + (db[i] - v) * u), n = Math.hypot(...d); return { ...C, l: C.p.map((v, i) => v + d[i] / n * 10) }; }; }
  W.parts = { sc, cam, sky, mirror, fire, flies, rk, spkM, moon: sky.material.uniforms.uMoon.value.clone() };   // jz_spring.js 借用
  const CAM0 = [
    { t: T[3], p: [1.85, 0.4, 1.55], l: [-4.3, 0.7, -3.6], up: U0, fov: 38 },                     // bar3 向后拉远、放低，到下风那一侧
    { t: T[3] + 0.8, p: [2.6, 2.0, 1.6], l: [-0.6, 1.9, -8.1], up: U0, fov: 46 },               // 离火苗 2.5 米以上（贴着过去火光铺满画面算闪）
    { t: T[4], p: [1.8, 5.0, 0.4], l: [0.9, 3.8, -17.6], up: U0, fov: 54 },                    // bar18→19 L、bar19→20 F（第六次）：从微距冲出去，擦着烧起来的火种往上、往前，穿过被风吹歪的烟，烟从镜头前扫过，后面是月光下整个湖和远山（新东西）；不再升到正上方
    { t: T[5], p: [0.4, 1.8, -5.8], l: [0, 3.2, -40], up: U0, fov: 60 },                     // bar20→21 A：从烟里出来往下落，贴着水飞向山
    { t: T[6], p: [2, 1.8, -11], l: [10, 7, -60], up: U0, fov: 62 },                          // 一边飞一边慢慢转向火星屑要去的那面山
    { t: T[7] - 0.5, p: [2.2, 1.9, -17], l: [37.6, 12, -59], up: U0, fov: 61 },                  // bar22→23 A（第六次，原 J 甩镜）：火星屑从头顶飞过去，镜头顺着它们抬头、往前推
    { t: T[7], p: [0.46, 2.4, -22], l: [51, 12, -54], up: U0, fov: 60 },                       // 落地起火：镜头已经对着那面山，不甩
    { t: T[8], p: [-6.06, 1.8, -21.1], l: [51, 12, -54], up: U0, fov: 60 },                    // 贴着湖岸往左横移，看山火
    { t: T[8] + 0.55, p: [-10, 2.0, -12], l: [51, 12, -54], up: U0, fov: 58 },                 // bar23→24 G：火星屑被吸回火种，从镜头边飞过；镜头一直对着那面山，往左后方横着带开（不绕、不回头）
    { t: T[8] + 1.05, p: [-8.5, 1.7, -2], l: [51, 12, -54], up: U0, fov: 54 },
    { t: TF, p: [-4.6, 1.3, 4.2], l: [39.8, -2.3, -36], up: U0, fov: 50 },   // 带到火种背后：火种在前，山火在它背后窜上山（火种和那面山几乎在一条线上，注视点从远换近不急转）                          // 「火」：火星在前，山火在它背后窜上山
    { t: T[9], p: [-2.2, 0.12, 2.0], l: [37.4, -27.5, -34], up: U0, fov: 50 },   // 压低一点看倒影，火苗靠到画面上边（离火太近整面亮起来算闪）                                  // 扎向火星在水里的倒影
  ];
  CAM = JZ.path([...K16.slice(2), ...CAM0]);
};

// ---------- 每帧 ----------
// 摆好这一刻的世界，返回 { sc, cam }。C、ei：最后一小节自己给机位和火星亮度
W.tc = (t) => [t, t < BB[7] ? CW(t) : t < T[1] ? CL(t) : CAM(t)];   // 世界时间和这一刻的机位（blender/track.py 也读它）
W.cams = () => ({ CW, CL, CAM, BB, T, beat });
W.pose = (t, M, C, ei) => {
  let C0; [t, C0] = W.tc(t); C ??= C0;
  cam.fov = C.fov; cam.position.set(...C.p); cam.up.set(...C.up); cam.lookAt(...C.l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements, u = sky.material.uniforms;
  u.uCD.value.w = 0; u.uUnder.value = 0; u.uMistH.value = 1.2; u.uWv.value = 1; u.uSpr.value = u.uRain.value = u.uMist.value = u.uPeach.value = u.uStar.value = u.uLeafE.value = u.uBlosE.value = 0; u.uRing.value.w = 0; u.uShk.value.w = 0; u.uGE.value.forEach(v => { v.z = 1e5; }); u.uDr.value.forEach(v => { v.w = 0; }); u.uMeshT.value = 0; u.uToon.value = 0; u.uFRk.value = 0; sc.userData.toon = 0;   // 春天的开关每帧先关上（jz_spring.js 摆完再打开）
  u.uMoon.value.copy(W.parts.moon); u.uRk.value = W.parts.rk; fire.uWind.value.set(0.96, 0.28); if (W.sprG) W.sprG.visible = false;
  u.uCam.value.copy(cam.position); u.uRight.value.set(e[0], e[1], e[2]); u.uUp.value.set(e[4], e[5], e[6]); u.uFwd.value.set(-e[8], -e[9], -e[10]); u.uTanH.value = Math.tan(C.fov * Math.PI / 360); u.uT.value = t;
  const past = kicks.filter(k => k.t <= t), ks = past.slice(-4).reverse(), fl = M.smooth(T[3], T[3] + 0.5, t), lp = M.smooth(TF, TF + 0.6, t);
  u.uKick.value.forEach((v, i) => ks[i] ? v.set(t - ks[i].t, ks[i].s) : v.set(99, 0));
  u.uFlame.value = fl * Math.min(1.0, 0.8 + 0.015 * past.filter(k => k.t >= T[3]).length);                                                // bar3 烧起来；之后每个底鼓火苗高一点，留住
  u.uSmoke.value = 0.35 + 0.65 * M.smooth(T[3], T[3] + 1, t);                                                                             // 之前只有一缕细烟
  const L = M.line(t), br = L ? Math.sin(Math.PI * (t - L.t0) / (L.t1 - L.t0)) ** 2 : 0;                                                  // 呼吸：一句一次，句中最亮，句间最暗
  u.uEI.value = (ei ?? (1 + 0.012 * past.length + 0.8 * fl) * (1 + 0.25 * Math.exp(-(ks[0] ? t - ks[0].t : 9) * 3))) * (0.8 + 0.4 * br);   // 底鼓：火星亮一下，慢慢暗回，之后比原来亮一点点
  u.uRm.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0.15, 1, 0.1).normalize(), 0.12 * (t - T[1])));   // 从片内 bar1 起转：炭块朝向和 61 秒版一样               // 浮在水上慢慢自转
  u.uReach.value = t > RB[0] ? RB.reduce((r, tb, i) => r + (t > tb ? (RR[i + 1] - RR[i]) * (1 - Math.exp(-(t - tb) * 3.2)) : 0), RR[0]) : 0;
  const s = (t - T[7]) / (2 * beat) + 1;                                                                                                  // 飞向树林的那一粒：bar6 第三拍溅出来，bar7 小节头落地
  if (s > 0 && s < 1) { u.uHero.value.set(IG[0] * s, 1 + 2 * s + 48 * s * (1 - s), IG[1] * s, M.smooth(0, 0.08, s)); u.uHeroV.value.set(IG[0], 2 + 48 * (1 - 2 * s), IG[1]).divideScalar(2 * beat); } else u.uHero.value.w = 0;
  const kf = past.reduce((a, k) => a + (k.t > T[7] - 0.05 ? 1 - Math.exp(-(t - k.t) * 6) : 0), 0);                                        // bar7 起每个底鼓：火线往上窜一截、往两边多烧开一截，留住
  fire.uFL.value = FL0 + FLV * (t - T[7]) + 1.2 * kf + LEAP * lp; fire.uFJ.value = LEAP * lp;                                                        // 山火：火线往上爬；「火」字一到窜上去
  fire.uFI.value = M.smooth(T[7] - 0.05, T[7] + 0.5, t); fire.uIg.value.z = t < T[7] ? 0 : 10 + 40 * (t - T[7]) + 12 * kf;                          // 从落点往两边烧开
  // 前奏、A2（整首 bar1–16）是冬天：湖冻着、山上全是雪，火种封在冰下快熄了。bar8 融开一圈，bar10–13 浮上来，bar13 重新烧起来，bar15 起化冰的前沿推出去
  const kin = M.smooth(BB[13] - 0.3, BB[14], t), win = t < T[1];
  u.uIce.value = win ? 1 : 0; u.uSnow.value = win ? 1 : 0;
  u.uOpen.value = t < BB[8] ? -1 : t < BB[15] ? 0.9 * M.smooth(BB[8], BB[9] + 0.4, t) : 0.9 + 600 * Math.min(1, (t - BB[15]) / (T[1] - 0.4 - BB[15])) ** 3;   // 推到 600：bar17 关掉冬天时远山上已经没有雪，不跳
  u.uE.value.set(E[0], win ? -0.45 + 0.45 * M.smooth(BB[10], BB[13] - 0.25, t) + E[1] * M.smooth(BB[13] - 0.1, BB[13] + 1.0, t) : E[1], E[2]);   // 先浮到水线（半截泡着，水里的光和它在一处），bar13 白汽飘过时慢慢浮起来、水里的光跟着淡掉
  if (win) { u.uEI.value *= 0.22 + 0.78 * kin; u.uSmoke.value *= kin; }
  for (const [d, v] of spkM) d.value = v * (win ? kin : 1);
  for (const [d, v] of snowM) d.value = v * (win ? 1 - M.smooth(BB[11], BB[13], t) : 0);
  u.uMoonI.value = 1 - 0.9 * M.smooth(BB[7] - 0.6, BB[7] - 0.15, t) + 0.9 * M.smooth(BB[7] + 0.3, BB[7] + 1.6, t);   // bar7 长焦对着月亮：月盘先压暗（叠化前就压好），拉开、变小再亮回来（不然算闪）
  for (const m of flies) m.material.uniforms.uT.value = t;
  return { sc, cam };
};
W.draw = (ctx, s, M) => {
  const t = s.t;
  if (t > BB[7] - 0.15 && t < BB[7] + 0.25) return JZ.blend(ctx, M, () => W.pose(t, M, CW(t)), () => W.pose(t, M, { ...CL(t), fov: FB(t) }), { k: M.smooth(BB[7] - 0.15, BB[7] + 0.25, t) });   // bar6→7 转场 E：冰里映着月亮的那颗气泡 → 月亮（同一个位置、一样大、同一张月面，0.4 秒叠化，两边都在往里推）
  const a = W.pose(t, M); JZ.present(ctx, M, a.sc, a.cam);
};
// 最后一小节：那一粒光就是火星。从很远推回第一帧的机位；时间停在第一个底鼓之前（没有涟漪、火苗），最后一帧和第一帧接上
W.drawEnd = (ctx, s, M) => {
  const z = 1 + 13 * (1 - M.ease.out3(s.p)), end = M.song.dur, k = M.song.kicks.filter(x => x.t <= s.t).pop();
  const a = W.pose(T[1] + Math.min(s.t - end, 0), M, { p: [-0.884 * z, 0.42 + 0.6 * (z - 1), 2.867 * z], l: [0, 0.85, 0], up: [0, 1, 0], fov: 44 },
    1.012 * (1 + 0.7 * Math.exp(-(end - s.t) * 5)) + 0.5 * Math.exp(-(k ? s.t - k.t : 9) * 4) * (1 - M.smooth(end - 0.6, end, s.t)));
  JZ.present(ctx, M, a.sc, a.cam);
};
})();
