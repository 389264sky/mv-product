// jz_tree.js —— 第三段「惊蛰」的世界：风暴眼云层、雷树、镜面水、铁花、光芽，远处是和第一段同一圈山。
// 时间一律是「bar17 之后几秒」（T0 从 song.json 来）；水面 y = 0，树根在原点。
(() => {
const JZ = window.JZ, W = JZ.tree = {};
let CAM, THREE, sc, cam, root, sky, tree, sparks, buds, blooms, swarm, RT, T0, TJZ, kicks, snares, T21, TB, T23, T24, T25, TQ, TZ;

const HIDE = 'gl_Position = vec4(2.0, 2.0, 2.0, 1.0);';

// ---------- 全屏：云、雾光、水面 ----------
const SKY_F = `
uniform sampler2D uRefl; uniform vec3 uCam, uFwd, uRight, uUp; uniform float uTanH, uAspect, uHorizon;
uniform vec2 uRes; uniform float uT, uMirror, uSpin, uEyeR, uTreeI, uCrawl; uniform vec3 uTreeCol;
uniform float uAbove, uDisc, uFog; uniform vec3 uTop; uniform vec4 uSw; uniform vec2 uQZ;
uniform vec4 uFlashP[3]; uniform vec3 uFlashC[3]; uniform vec2 uKick[4];
varying vec2 vP;
const float BASE = 58.0, TOP = 135.0;

// 云：大形（旋臂、漏斗形的风暴眼）被细碎的噪声啃边，啃出一团一团的云头；oct < 4 是给阴影用的粗算
float dens(vec3 p, int oct) {
  float r = length(p.xz), th = uSpin + 2.6 / (1.0 + r / 38.0);                      // 整层慢转；越靠里拧得越多，拧出旋臂
  float c = cos(th), s = sin(th); vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  float h = (p.y - BASE) / (TOP - BASE);
  float n = fbm(q * 0.017 + vec3(0.0, uT * 0.010, 0.0), min(oct, 4));
  float arms = 0.5 + 0.5 * sin(3.0 * atan(q.z, q.x) + 5.0 * log(r + 6.0));
  float e = n - mix(0.45, 0.28, arms);
  e -= oct > 3 ? 0.26 * fbm(q * 0.083 - vec3(0.0, uT * 0.03, 0.0), 4) : 0.115;
  float d = smoothstep(0.0, 0.07, e);
  float hb = h + 0.22 * exp(-pow((r - uEyeR) / (0.3 * uEyeR), 2.0));                       // 眼外面垂下来一圈云墙，从侧面也看得出是个眼
  d *= smoothstep(0.0, 0.14, hb + (n - 0.5) * 0.4) * (1.0 - smoothstep(0.55, 0.85, h + (n - 0.5) * 0.9));     // 云底不平，云顶渐隐
  float er = uEyeR * (0.8 + 1.3 * clamp(h, 0.0, 1.0));                                   // 风暴眼：下窄上宽的漏斗
  d *= smoothstep(er * 0.6, er * 1.0, r + (n - 0.5) * 12.0);
  d *= 1.0 - smoothstep(uDisc * 0.6, uDisc, r + (n - 0.5) * uDisc * 0.6);                                         // 太极那一镜：云海是有边的一团，能塌下去
  return d;
}

// 空气里的光：离树干、树冠越近越亮；fan：从风暴眼泻下来的一把放射光（绕「镜头→风暴眼」这根轴按角度取噪声）
vec3 haze(vec3 ro, vec3 rd, float tmax, float fan) {
  vec2 o = ro.xz, d = rd.xz; float dd = dot(d, d), ts = dd > 1e-6 ? clamp(-dot(o, d) / dd, 0.0, tmax) : 0.0;
  vec3 q = ro + rd * ts; float rm = length(q.xz);
  float trunk = smoothstep(-2.0, 2.0, q.y) * (1.0 - smoothstep(45.0, 90.0, q.y)) / (1.0 + rm * rm / 9.0);
  vec3 pc = vec3(0.0, 40.0, 0.0); float tc = clamp(dot(pc - ro, rd), 0.0, tmax), dc = length(ro + rd * tc - pc);
  vec3 dE = normalize(vec3(0.0, BASE + 4.0, 0.0) - ro); float ca = dot(rd, dE); vec3 pr = rd - dE * ca; float rho = length(pr);
  vec3 bx = normalize(cross(vec3(0.0, 1.0, 0.0), dE) + vec3(1e-4, 0.0, 0.0)), by = cross(dE, bx);
  float sn = dot(pr, by) / max(rho, 1e-4), cs = dot(pr, bx) / max(rho, 1e-4);
  float shaft = fan * smoothstep(0.30, 0.62, fbm(vec3(cs, sn, uT * 0.02) * 4.5 + 3.0, 3)) * smoothstep(0.15, -0.35, sn) * exp(-rho * 2.6) * smoothstep(0.02, 0.12, rho) * step(0.0, ca);
  return uTreeCol * uTreeI * (trunk * 0.012 + 0.006 / (1.0 + dc * dc / 500.0) + shaft * 0.08);
}

// 远山：和第一段同一圈山（jz_land.js 的高度图），这一段的湖大，整圈放大 SL 倍。山腰往上没进云里；面朝树的坡被树的金光照亮，云里的雷光一下一下照亮一片
const float SL = 2.2;
float hill(vec3 ro, vec3 rd, float t0, float tmax) {   // 世界单位；没碰到返回 -1
  vec3 o = ro / SL; float t = max(t0 / SL, 0.05), tm = tmax / SL, d = 1e3;
  for (int i = 0; i < 220; i++) {
    vec3 p = o + rd * t; if (t > tm || (p.y > 60.0 && rd.y > 0.0) || max(abs(p.x), abs(p.z)) > 398.0) return -1.0;
    vec4 L = land(p.xz, t); float hg = p.y - L.r, fo = forest(L) * treeFade(t), dt;
    if (hg < 0.0012 * t) return t * SL;
    if (fo > 0.01 && hg < TH * fo + 0.15) { d = min(hg, firs(p.xz, hg, fo, 0.0)); if (d < 0.004 + 0.0006 * t) return t * SL; dt = clamp(d * 0.6, 0.012, 0.12 + 0.002 * t); }
    else { d = hg - TH * fo; dt = max(d * 0.45, fo > 0.01 ? 0.10 + 0.004 * t : 0.01 + 0.002 * t); }
    t += dt;
  }
  return d < 1.0 ? t * SL : -1.0;   // 步数用完了还贴着山，就算碰到
}
vec3 hillCol(vec3 P, float tw) {   // 山的颜色：岩石（带岩层）、林地、一棵棵针叶树；云底的天光、树的金光、云里的雷光
  vec3 p = P / SL; float t = tw / SL;
  vec4 L = land(p.xz, t); float hg = p.y - L.r, wd = forest(L), fo = wd * treeFade(t), f = fo > 0.01 ? firs(p.xz, hg, fo, 0.0) : 1.0;
  bool tr = fo > 0.01 && f < 0.03 + 0.002 * t && hg > 0.05;
  vec3 n = normalize(vec3(-L.g, 1.0, -L.b));
  if (tr) { const vec2 e = vec2(0.02, 0.0); n = normalize(vec3(firs(p.xz + e.xy, hg, fo, 0.0) - firs(p.xz - e.xy, hg, fo, 0.0), firs(p.xz, hg + e.x, fo, 0.0) - firs(p.xz, hg - e.x, fo, 0.0), firs(p.xz + e.yx, hg, fo, 0.0) - firs(p.xz - e.yx, hg, fo, 0.0)) + 1e-5); }
  n = normalize(n + (tr ? (vn(p * 6.0).xyz - 0.5 + 0.6 * (vn(p * 14.0).xyz - 0.5)) * 0.4 : (vn(p * 1.7).xyz - 0.5 + 0.5 * (vn(p * 5.3).xyz - 0.5)) * 0.6) * (1.0 - smoothstep(20.0, 160.0, t)));
  vec3 alb = mix(vec3(0.085, 0.080, 0.078) * (0.75 + 0.5 * vn(vec3(p.xz * 0.13, p.y * 0.9 + 3.0 * vn(p * 0.06).y)).x), vec3(0.018, 0.026, 0.015) * (0.5 + vn(vec3(p.xz * 2.5, 0.5)).x) * (0.35 + 0.65 * smoothstep(0.0, 0.5, f)), wd);
  if (tr) alb = vec3(0.012, 0.030, 0.016) * (0.5 + vn(p * 3.0).x) * (0.35 + 0.65 * clamp(hg / (TH * fo), 0.0, 1.0));   // 树：越往下越暗
  alb *= 0.3 + 0.7 * smoothstep(0.0, 1.5, L.r);                                                                         // 水边是湿的，暗
  vec3 lv = vec3(0.0, 30.0, 0.0) - P; float ld = length(lv); lv /= ld;
  vec3 lit = vec3(0.016, 0.020, 0.045) * (0.35 + 0.65 * n.y) + vec3(0.12, 0.14, 0.22) * smoothstep(0.05, 0.45, dot(n, normalize(vec3(0.26, 0.45, -0.86)))) * smoothstep(30.0, 140.0, t) + uTreeCol * uTreeI * (0.15 + 2.2 * max(dot(n, lv), 0.0)) * 2e4 / (2e4 + ld * ld);
  for (int k = 0; k < 3; k++) { vec3 v = uFlashP[k].xyz - P; lit += uFlashC[k] * (0.3 + 0.7 * max(dot(n, normalize(v)), 0.0)) * 0.5 / (1.0 + dot(v, v) / 40000.0); }
  return mix(vec3(0.010, 0.014, 0.032) + uTreeCol * uTreeI * 0.006, alb * lit + vec3(0.03, 0.035, 0.06) * smoothstep(30.0, 140.0, t) * pow(1.0 - abs(dot(n, normalize(P - uCam))), 4.0), exp(-tw * uFog * 0.8));   // 远了进雾（雾薄一些、远处亮面补月光、山脊一道边：远山看得清）
}

vec3 stars(vec3 rd) {   // 云缝里的星
  vec3 g = rd * 190.0, i = floor(g), f = g - i - 0.5; float h = h01(uvec3(ivec3(i) + 2048));
  if (h < 0.93) return vec3(0.0);
  return mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.6), fract(h * 37.0)) * exp(-dot(f, f) * 30.0) * (0.65 + 0.35 * sin(uT * (2.0 + h * 9.0) + h * 400.0)) * (h - 0.93) * 9.0;
}

vec3 sky(vec3 ro, vec3 rd, float tmin, vec2 fc) {
  vec3 col = vec3(0.0); float T = 1.0;
  float tr = rd.y < 0.3 && uAbove < 0.5 ? hill(ro, rd, tmin, 1500.0) : -1.0;
  float ta = (BASE - 30.0 - ro.y) / rd.y, tb = (TOP - ro.y) / rd.y;                                   // 云层是一块板：从下面、里面、上面看都走这一段
  float t0 = max(tmin, min(ta, tb)), t1 = min(max(ta, tb), tr > 0.0 ? tr : mix(1500.0, 9000.0, uAbove));
  if (abs(rd.y) > 0.0005 && t1 > t0) {
    float t = t0, jit = h01(uvec3(uvec2(fc), 7u));
    for (int i = 0; i < 72; i++) {
      float dt = max(1.6, t * 0.026); vec3 p = ro + rd * (t + dt * jit);
      float d = dens(p, 5);
      if (d > 0.003) {
        float h = (p.y - BASE) / (TOP - BASE), re = length(p.xz);
        vec3 L = mix(vec3(0.006, 0.009, 0.026), vec3(0.016, 0.022, 0.060), h);                 // 环境：靛青
        vec3 lv = vec3(0.0, 40.0, 0.0) - p; float ld = length(lv); lv /= ld;
        float sh = dens(p + lv * 5.0, 4) + 0.7 * dens(p + lv * 18.0, 2);                        // 朝树冠走两步，看被挡了多少
        L += uTreeCol * uTreeI * (0.03 + 0.97 * exp(-sh * 5.0)) * 0.26 / (1.0 + ld * ld / 1100.0);   // 树从下面照上来：云底金、云心墨
        vec2 ax = -p.xz / max(re, 1e-3);
        L += uTreeCol * uTreeI * 0.5 * exp(-dens(p + vec3(ax.x, 0.0, ax.y) * 9.0, 3) * 3.0) / (1.0 + re * re / (uEyeR * uEyeR * 1.2));   // 通道照亮眼壁，眼壁自己挡出一道道纹
        L += uTreeCol * uTreeI * 0.06 * (1.0 - smoothstep(uCrawl * 0.45, uCrawl, re)) * exp(-max(h, 0.0) * 7.0);                          // 贴着云底爬的雷把云底照亮
        if (uAbove > 0.001) {
          vec3 Ld = vec3(-0.52, 0.42, -0.74);                                                                                             // 从上面看：月亮压得很低，斜着照，云头一面亮一面暗
          L += uAbove * uTop * exp(-(dens(p + Ld * 9.0, 3) + 0.7 * dens(p + Ld * 26.0, 2)) * 3.2) * smoothstep(0.1, 0.7, h);
          float w = 0.5 + 0.5 * cos(atan(p.z, p.x) - 2.4 * log(1.0 + re / 45.0) - uSw.w);                                                 // 虫群的光落在云顶；太极时分成清（金）浊（靛紫）两半
          L += mix(vec3(0.75, 0.62, 0.40), mix(vec3(0.30, 0.22, 0.85) * uQZ.y, vec3(1.0, 0.66, 0.24) * uQZ.x, smoothstep(0.35, 0.65, w)), uSw.z) * uSw.y * uAbove * smoothstep(0.3, 1.0, h) / (1.0 + re * re / (uSw.x * uSw.x));
        }
        for (int k = 0; k < 3; k++) { vec3 v = uFlashP[k].xyz - p; L += uFlashC[k] / (1.0 + dot(v, v) / (uFlashP[k].w * uFlashP[k].w)); }   // 云里的雷光
        L *= mix(1.7, 0.4, d) * exp(-t * uFog);                                              // 薄的地方透光多；远处进雾
        float a = 1.0 - exp(-d * dt * 0.2);
        col += T * a * L; T *= 1.0 - a;
        if (T < 0.015) break;
      }
      t += dt; if (t > t1) break;
    }
  }
  col += T * (tr > 0.0 ? hillCol(ro + rd * tr, tr) : rd.y < 0.0 ? vec3(0.0012, 0.0016, 0.0035) + vec3(0.014, 0.020, 0.050) * exp(rd.y * 60.0) * uAbove : vec3(0.004, 0.005, 0.013) + vec3(0.014, 0.020, 0.050) * exp(-max(rd.y, 0.0) * 10.0) + stars(rd));   // 云后面：山，或者夜空、天边的微光、星
  return col + haze(ro, rd, 2000.0, 1.0 - uAbove) * mix(1.0, T, uAbove);
}

void main() {
  vec3 rd = normalize(uFwd + vP.x * uAspect * uTanH * uRight + vP.y * uTanH * uUp), ro = uCam, col;
  float tw = rd.y < -1e-4 ? -ro.y / rd.y : -1.0, tl = uMirror < 0.5 && uAbove < 0.5 && tw > 100.0 ? hill(ro, rd, 100.0, tw) : -1.0;   // 远处的水面可能先被岸挡住
  if (uMirror > 0.5) {                               // 倒影那一遍：只算落在水面上的像素，射线沿水面翻上去
    col = tw > 0.0 ? sky(vec3(ro.x, -ro.y, ro.z), vec3(rd.x, -rd.y, rd.z), tw, gl_FragCoord.xy) : vec3(0.0);
  } else if (tl > 0.0) {
    col = hillCol(ro + rd * tl, tl) + haze(ro, rd, tl, 0.0);
  } else if (tw > 0.0 && uAbove < 0.5) {                             // 水面：黑镜子，涟漪把倒影扯成竖条
    vec3 P = ro + rd * tw; float r = length(P.xz), ring = 0.0; vec2 er = P.xz / max(r, 1e-3);
    vec2 g = (vn(vec3(P.xz * 0.35 + vec2(uT * 0.25, 0.0), uT * 0.2)).xy - 0.5) + 0.5 * (vn(vec3(P.xz * 1.1 - vec2(0.0, uT * 0.4), uT * 0.3 + 9.0)).zw - 0.5);
    for (int i = 0; i < 4; i++) { float x = r - uKick[i].x * 26.0, a = uKick[i].y * exp(-uKick[i].x * 0.8); g += er * a * 1.6 * sin(x * 1.6) * exp(-x * x * 0.03); ring += a * exp(-x * x * 0.4); }   // 底鼓从树根砸出去的同心圈，圈顶一道金
    float fres = 0.03 + 0.97 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 4.0);
    vec2 uv = gl_FragCoord.xy / uRes + g * vec2(0.010, 0.060) / (1.0 + tw * 0.012);
    uv.y = min(uv.y, uHorizon - 0.002);
    col = texture2D(uRefl, uv).rgb * fres * vec3(0.80, 0.86, 1.0) + haze(ro, rd, tw, 0.0);
    float gl = vn(vec3(P.xz * 1.7 + vec2(uT * 0.31, 0.0), uT * 0.45)).x * vn(vec3(P.xz * 3.9 - vec2(0.0, uT * 0.27), uT * 0.6 + 5.0)).y;   // 碎金：两层错开的噪声相乘，只剩零星的亮点
    col += uTreeCol * uTreeI * (pow(gl, 5.0) * 5.0 * exp(-tw / 90.0) + ring * 0.05) / (1.0 + r * r / 3000.0);
  } else col = sky(ro, rd, 0.0, gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- 光带：一段线画成朝着镜头的带子（芯 + 晕），雷树和铁花共用 ----------
const RIBBON = `
uniform float uT, uPx; uniform vec2 uRes;
// own / oth：这一端和另一端的世界坐标；flip：这一端是不是 B；返回裁剪坐标，hwOut：带子半宽（内部像素），thin：细到不足一像素的按比例减亮
vec4 ribbon(vec3 own, vec3 oth, float side, float flip, float halfW, float wide, out float thin) {
  mat4 vp = projectionMatrix * viewMatrix * modelMatrix;
  vec4 cp = vp * vec4(own, 1.0), cq = vp * vec4(oth, 1.0); thin = 0.0;
  if (cp.w < 0.2 && cq.w < 0.2) return vec4(2.0, 2.0, 2.0, 1.0);
  if (cp.w < 0.2) cp = mix(cp, cq, (0.2 - cp.w) / (cq.w - cp.w));          // 穿到镜头后面的一端裁到近平面
  if (cq.w < 0.2) cq = mix(cq, cp, (0.2 - cq.w) / (cp.w - cq.w));
  vec2 dir = cq.xy / cq.w * uRes - cp.xy / cp.w * uRes; float dl = length(dir); dir = (dl > 1e-5 ? dir / dl : vec2(1.0, 0.0)) * (1.0 - 2.0 * flip);
  float hw = halfW * projectionMatrix[1][1] * uRes.y * 0.5 / cp.w, mn = 0.8 * uPx;
  thin = min(1.0, hw / mn);
  cp.xy += vec2(-dir.y, dir.x) * side * max(hw, mn) * wide / (uRes * 0.5) * cp.w;
  return cp;
}`;

const TREE_V = RIBBON + `
attribute vec3 aQ; attribute vec4 aI1, aI2; attribute vec2 aSE; uniform float uClip, uLv;
uniform vec2 uKick[4];
varying float vS, vB, vLv, vTip, vThin, vSky, vNear;
void main() {
  gl_Position = ribbon(position, aQ, aSE.x, aSE.y, aI2.x, 4.0, vThin); vNear = smoothstep(3.0, 18.0, gl_Position.w);
  float g = (uT - aI1.z) * aI1.w - aI1.x;                                   // 生长前沿超过这一点多远
  vTip = exp(-max(g, 0.0) / 2.5);                                           // 正在长的梢头更亮
  float pu = 0.0; for (int i = 0; i < 4; i++) { float x = aI1.y - uKick[i].x * 85.0; pu += uKick[i].y * exp(-x * x / 18.0) * exp(-uKick[i].x * 1.1); }   // 底鼓的光脉冲沿树往梢上跑
  vB = smoothstep(0.0, 0.6, g) * (1.0 + pu * 2.2 * smoothstep(8.0, 30.0, gl_Position.w)) * (1.0 - smoothstep(uClip * 0.55, uClip, length(position.xz))) * smoothstep(0.6, 4.0, gl_Position.w) * mix(0.4, 1.0, smoothstep(2.0, 16.0, gl_Position.w)) * (1.0 - smoothstep(uLv, uLv + 1.0, aI2.y)) * (1.0 - smoothstep(118.0, 132.0, max(position.y, aQ.y))); vS = aSE.x; vLv = aI2.y; vSky = aI2.z;   // 贴脸的枝压暗；通道不穿出云顶
}`;
const TREE_F = `
uniform vec3 uCore, uTint, uTint2; uniform float uGain, uSpring;
varying float vS, vB, vLv, vTip, vThin, vSky, vNear;
void main() {
  float d = abs(vS) * 4.0, core = exp(-d * d * 1.4), halo = exp(-d * d * 0.22) * 0.06 * vNear;   // 近处的枝不要晕，不然糊成一片
  vec3 tint = mix(mix(uTint, uTint2, clamp((vLv - 2.0) / 2.5, 0.0, 1.0) * uSpring), vec3(0.46, 0.40, 1.0), vSky);     // 细枝在「惊蛰」之后带青绿
  vec3 c = (uCore * core * (0.8 + 2.2 * vTip) * mix(1.0, 0.18, clamp(vLv / 3.0, 0.0, 1.0)) + tint * (core * 0.9 + halo)) * vB * uGain * max(vThin, 0.12) * (0.18 + 0.82 * pow(0.52, vLv)) * (1.0 - 0.4 * vSky);   // 不足一像素的细枝按真实粗细减亮，远看是一层微光
  gl_FragColor = vec4(c, 1.0);
}`;

const SPARK_V = RIBBON + `
attribute vec3 iP0, iV; attribute vec4 iA;
varying float vS, vK, vG, vE;
vec3 at(float u) { const float k = 0.9; float e = (1.0 - exp(-k * u)) / k; return iP0 + iV * e + vec3(0.0, -13.0, 0.0) * (u - e) / k; }   // 抛物线 + 空气阻力
void main() {
  float u = uT - iA.x, thin; vS = position.x; vE = position.y; vK = u / iA.y; vG = 0.0;
  if (u < 0.0 || u > iA.y) { ${HIDE} return; }
  vec3 b = at(u), a = at(max(u - 0.05, 0.0));
  if (b.y < 0.0) { ${HIDE} return; }                                        // 落到水面就灭
  gl_Position = position.y > 0.5 ? ribbon(b, a, position.x, 1.0, 0.035, 2.5, thin) : ribbon(a, b, position.x, 0.0, 0.035, 2.5, thin);
  vG = iA.w * smoothstep(0.0, 0.06, u) * pow(1.0 - vK, 1.3) * (0.75 + 0.25 * sin(u * (20.0 + iA.z * 30.0) + iA.z * 50.0)) * smoothstep(0.0, 0.5, b.y) * mix(0.5, 1.0, thin);
}`;
const SPARK_F = `
varying float vS, vK, vG, vE;
void main() {
  vec3 col = mix(mix(vec3(1.0, 0.93, 0.78), vec3(1.0, 0.62, 0.18), smoothstep(0.0, 0.35, vK)), vec3(0.85, 0.16, 0.03), smoothstep(0.45, 1.0, vK));   // 白热 → 金 → 暗红
  gl_FragColor = vec4(col * exp(-vS * vS * 5.0) * vG * smoothstep(0.0, 0.7, vE) * smoothstep(1.0, 0.92, vE), 1.0);   // 尾巴渐隐，头收圆
}`;

// ---------- 芽：两片合着的小叶裹成一个尖芽苞，军鼓一下张开成一对青绿透光的叶子；芽心有一点光，bar21 飞出去变成萤火虫 ----------
// 一个芽两片叶，每片一个四边形：position.x 从叶柄到叶尖 0→1，y 横跨叶面 -1→1，z 第几片
const LEAF_V = `
attribute vec3 iP, iD; attribute vec4 iA; uniform float uT, uPx, uGo; uniform vec2 uRes;
varying vec2 vU; varying float vG, vOpen, vCore;
void main() {
  float age = uT - iA.x, op = smoothstep(0.0, 0.28, uT - iA.w); vU = position.xy; vG = 0.0; vOpen = op;   // iA = (冒出来, 大小, 种子, 张开)
  if (age < 0.0) { ${HIDE} return; }
  float sd = iA.z * 6.283, side = position.z * 2.0 - 1.0;
  vec3 ax = iD, s0 = normalize(cross(ax, vec3(cos(sd), 0.31, sin(sd)))), w = cross(ax, s0);
  float an = 0.05 + op * (0.85 + 0.3 * sin(sd * 3.0)) + 0.04 * sin(uT * 1.7 + sd * 5.0);                  // 离开芽轴的角度；风里轻轻摆
  vec3 dir = normalize(ax * cos(an) + s0 * side * sin(an)), nw = normalize(cross(dir, w) * 0.35 * side + w);   // 张开的叶子稍微往里兜
  float L = iA.y * smoothstep(0.0, 0.35, age) * (0.6 + 0.4 * op) * 2.4, wd = L * mix(0.24, 0.4, op);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(iP, 1.0), c1 = projectionMatrix * viewMatrix * vec4(iP + dir * L, 1.0);
  if (c0.w < 0.05 || c1.w < 0.05) { ${HIDE} return; }
  float lp = length(c1.xy / c1.w - c0.xy / c0.w) * uRes.y * 0.5 + 1e-4, k = clamp(3.0 * uPx / lp, 1.0, 6.0);   // 小到不足 3 像素的放大（最多 6 倍）、按面积减亮（远看是一点青绿）
  gl_Position = projectionMatrix * viewMatrix * vec4(iP + (dir * position.x * L + nw * position.y * wd) * k, 1.0);
  vCore = 1.0 - smoothstep(uGo + iA.z * 0.35, uGo + iA.z * 0.35 + 0.15, uT);                               // 芽心的光：bar21 飞走
  vG = smoothstep(0.0, 0.25, age) * (1.0 + 0.15 * exp(-age * 4.0)) / (k * k) * smoothstep(0.12, 0.6, gl_Position.w) * mix(0.35, 1.0, smoothstep(0.5, 4.0, gl_Position.w));   // 贴脸的叶子压暗一些
}`;
const LEAF_F = `
uniform vec3 uJade; uniform float uGain; varying vec2 vU; varying float vG, vOpen, vCore;
void main() {
  float u = clamp(vU.x, 0.0, 1.0), v = vU.y, hw = pow(max(sin(3.14159 * pow(u, 0.7)), 0.0), 0.8) * (1.0 - 0.2 * u), e = hw - abs(v);   // 叶形：基部圆、叶尖收尖
  float aa = fwidth(e) + 1e-3, a = smoothstep(-aa, aa, e); if (a <= 0.0) discard; e = max(e, 0.0);
  float rim = exp(-e / max(hw, 0.05) * 5.0), rib = exp(-v * v * 300.0) * (1.0 - 0.6 * u);                                    // 叶缘、主脉
  float vein = pow(max(0.5 + 0.5 * cos(6.2832 * (u * 6.0 - abs(v) * 3.2)), 0.0), 10.0) * smoothstep(0.0, 0.5, e / max(hw, 0.05)) * smoothstep(0.05, 0.25, u);   // 侧脉
  vec3 c = uJade * (0.22 + 0.55 * rim + 0.45 * vein + 0.7 * rib) + vec3(0.85, 1.0, 0.75) * (0.5 * rim * rim + 0.4 * rib) * (1.0 - 0.6 * vOpen);   // 透光：叶缘和叶脉亮
  c += vec3(1.0, 0.95, 0.7) * vCore * exp(-((u - 0.22) * (u - 0.22) * 39.0 + v * v * 6.0)) * (0.5 + 0.8 * vOpen);             // 芽心的光
  gl_FragColor = vec4(c * a * vG * uGain, 1.0);
}`;

// ---------- 桃花（惊蛰一候「桃始华」）：镜头钻的那颗芽张开时，两片叶中间开出一朵；别处零星几颗芽也开花 ----------
// 五片花瓣开得几乎平：瓣根深玫红（花眼），往外淡成粉白；放射状的细脉、细密的颗粒、边缘不规则地起伏；花瓣往里兜，明暗按法线算，薄处透光。
// 二十五根粉白的花丝，顶上小小的椭圆形黄花药；中间一根淡黄绿的雌蕊。正常混合、互相遮挡（不是叠加的玻璃花），只带一点微光
// 每片花瓣、每根花丝一个四边形：position.x 从花心往外 0→1，y 横跨 -1→1
const FLOWER_V = `
attribute vec3 iP, iD; attribute vec4 iA; uniform float uT, uPx; uniform vec2 uRes;
varying vec2 vU; varying vec3 vN, vW; varying float vG, vK, vS;
void main() {
  float op = smoothstep(0.0, 0.6, uT - iA.x), sd = iA.z * 6.283, j = iA.w, st = j > 4.5 ? (j > 29.5 ? 2.0 : 1.0) : 0.0, pe = 1.0 - min(st, 1.0);   // iA = (开的时刻, 大小, 种子, 第几片：0–4 花瓣，5–29 花丝，30 雌蕊)
  vU = position.xy; vK = st; vS = iA.z * 7.0 + j * 0.37; vG = 0.0; vN = vec3(0.0, 1.0, 0.0); vW = iP;
  if (op <= 0.0) { ${HIDE} return; }
  vec3 ax = iD, s0 = normalize(cross(ax, vec3(cos(sd), 0.31, sin(sd)))), w = cross(ax, s0);
  float ph = st > 0.5 ? (j - 5.0) * 2.39996 + sd : j * 1.2566 + sd + 0.6;
  float an = st > 1.5 ? 0.02 : st > 0.5 ? 0.12 + op * (0.25 + 0.3 * fract(j * 0.37)) : 0.1 + op * (1.3 + 0.1 * sin(sd * 3.0 + j)) + 0.03 * sin(uT * 1.9 + j + sd);   // 花瓣从花苞张开，风里轻轻摆；花丝往外散一点
  vec3 rd = s0 * cos(ph) + w * sin(ph), dir = normalize(ax * cos(an) + rd * sin(an)), tg = normalize(cross(ax, rd)), ni = normalize(cross(tg, dir));
  float L = iA.y * (st > 1.5 ? 0.36 : st > 0.5 ? 0.5 + 0.12 * fract(j * 0.71) : 1.2) * (0.55 + 0.45 * op), wd = st > 0.5 ? 0.02 * iA.y : L * 0.5;
  vec4 c0 = projectionMatrix * viewMatrix * vec4(iP, 1.0), c1 = projectionMatrix * viewMatrix * vec4(iP + dir * L, 1.0);
  if (c0.w < 0.05 || c1.w < 0.05) { ${HIDE} return; }
  float lp = length(c1.xy / c1.w - c0.xy / c0.w) * uRes.y * 0.5 + 1e-4, k = clamp(3.0 * uPx / lp, 1.0, 6.0);   // 小到不足 3 像素的放大、按面积变淡（和叶子一样）
  float cup = pe * 0.22 * L, wr = pe * 0.012 * L * sin(position.x * 9.0 + sd * 5.0 + j);   // 花瓣往里兜，带一点皱
  vec3 off = dir * position.x * L + tg * position.y * wd + ni * (cup * position.y * position.y + wr + (1.0 - pe) * 0.08 * L * position.x * position.x);   // 花丝微微往外弯
  vec3 p = iP + ax * 0.02 * iA.y + off * k;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vN = normalize(ni - tg * (2.0 * cup * position.y / max(wd, 1e-4))); vW = p;
  vG = op / (k * k) * smoothstep(0.12, 0.6, gl_Position.w);
}`;
const FLOWER_F = JZ.GLSL + `
uniform float uGain, uT; varying vec2 vU; varying vec3 vN, vW; varying float vG, vK, vS;
void main() {
  float u = clamp(vU.x, 0.0, 1.0), v = vU.y, a;
  vec3 n = normalize(gl_FrontFacing ? vN : -vN), c;
  float lit = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.3, 1.0, 0.2))), 0.0), bk = pow(1.0 - abs(dot(n, normalize(cameraPosition - vW))), 2.0);   // 天光从上面来；斜着看的地方透光
  if (vK > 1.5) {   // 雌蕊：淡黄绿的一根，顶上一点柱头
    a = max((1.0 - smoothstep(0.12, 0.3, abs(v))) * step(u, 0.92), 1.0 - smoothstep(0.6, 1.0, length(vec2((u - 0.95) * 12.0, v))));
    c = vec3(0.86, 0.92, 0.58) * (0.5 + 0.5 * lit);
  } else if (vK > 0.5) {   // 花丝：粉白的细丝，顶上小小的椭圆形黄花药
    float an = 1.0 - smoothstep(0.6, 1.0, length(vec2((u - 0.9) * 9.0, v)));
    a = max((1.0 - smoothstep(0.1, 0.3, abs(v))) * step(u, 0.86), an);
    c = mix(vec3(1.0, 0.86, 0.86), vec3(1.0, 0.74, 0.24), an) * (0.5 + 0.5 * lit);
  } else {   // 花瓣
    float nz = vn(vec3(u * 7.0, v * 5.0, vS * 13.0)).x, hw = pow(max(sin(3.14159 * pow(u, 0.62)), 0.0), 0.55) * (1.0 + 0.08 * (nz - 0.5) * smoothstep(0.5, 1.0, u)), e = hw - abs(v);   // 瓣根窄、往外宽、顶上圆；边缘不规则地起伏
    float aa = fwidth(e) + 1e-3; a = smoothstep(-aa, aa, e);
    float x = v / max(hw, 0.05), fx = fwidth(x * 3.5), vein = (1.0 - smoothstep(0.0, 0.08 + fx, abs(fract(x * 3.5 + 0.2 * nz + 0.5) - 0.5))) * smoothstep(0.08, 0.5, u) * (1.0 - smoothstep(0.1, 0.4, fx));   // 放射状的细脉（远了淡掉）
    float gr = vn(vec3(u * 80.0, v * 60.0, vS * 5.0)).y;   // 细密的颗粒：花瓣表皮的细胞
    vec3 alb = mix(mix(vec3(0.70, 0.12, 0.28), vec3(0.97, 0.56, 0.66), smoothstep(0.02, 0.32, u)), vec3(1.0, 0.86, 0.88), 0.75 * smoothstep(0.45, 1.0, u)) * (1.0 - 0.18 * vein) * (0.94 + 0.12 * gr);   // 瓣根深玫红（花眼），往外淡成粉白
    float rim = exp(-max(e, 0.0) / max(hw, 0.05) * 6.0);
    c = alb * lit + alb * vec3(1.0, 0.8, 0.85) * (0.35 * bk + 0.25 * rim);   // 受光的一面 + 薄处、边上透光
  }
  if (a * min(vG, 1.0) < h01(uvec3(gl_FragCoord.xy, floor(uT * 240.0 + 1e5)))) discard;   // 半透明的边：按透明度丢像素，超采样、子帧平均下来是软的
  gl_FragColor = vec4(c * uGain, 1.0);
}`;

// ---------- 虫群：一只只萤火虫（芽心的光飞出来）。位置是时刻的函数：绕树 → 钻风暴眼 → 云顶喷出分两股 → 绞成太极 → 塌成一点 ----------
const SWARM_V = `
attribute vec3 iP; attribute vec4 iA; uniform float uT, uPx; uniform vec2 uRes;
varying vec2 vQ; varying float vG, vNear, vS, vA; varying vec3 vC;
uniform vec4 uPh; uniform float uEnd, uMix; uniform vec2 uKick[4], uQZ; uniform vec3 uCa, uCb, uCq, uCz, uHA, uHO;
vec3 atSw(float t) {   // uPh = (起飞, 往风暴眼收, 穿出云顶, 绞成太极)
  float W4 = fract(iA.w), tA = t - uPh.x - iA.x; if (tA < 0.0) return iP;
  float a1 = min(t, uPh.z) - uPh.x - iA.x, kA = 1.0 - exp(-tA * 1.1);
  float r = mix(length(iP.xz), 22.0 + 115.0 * pow(iA.y, 0.7), kA), y = mix(iP.y, 4.0 + 62.0 * iA.z, kA);
  float th = atan(iP.z, iP.x) + (0.9 + 0.6 * W4) * a1 * 48.0 / (30.0 + r);                 // 绕着树转，外圈慢
  float kB = smoothstep(uPh.y + 0.25 * iA.y, uPh.z, t); kB *= kB;                               // 收拢、往上，钻过风暴眼
  r = mix(r, (4.0 + 10.0 * W4) * (1.0 + y / 90.0), kB); y = mix(y, 50.0 + 140.0 * iA.z, kB);
  float tC = max(t - uPh.z, 0.0), sg = W4 > 0.5 ? 1.0 : -1.0, tD = max(t - uPh.w, 0.0), c = 1.0 - smoothstep(uEnd - 0.5, uEnd, t);
  r += (8.0 + 380.0 * pow(iA.y, 1.5)) * (1.0 - exp(-tC)); y = mix(y, 140.0 + 40.0 * fract(iA.z * 5.3), 1.0 - exp(-tC * 1.6));
  // 喷出云顶：两股各沿一条旋臂往外流，一条顺着拧一条逆着拧；到太极那一镜逆的那条翻过来，两条并成一个旋涡，越转越快，最后塌成一点
  float arm = (sg > 0.0 ? 0.0 : 3.14159) + mix(sg, 1.0, smoothstep(0.0, 0.9, tD)) * 2.4 * log(1.0 + r / 45.0) + (iA.z + fract(iA.y * 7.7) - 1.0) * 0.55;
  th = mix(th, arm, smoothstep(0.0, 0.6, tC)) + tD * (0.7 + 1.6 * tD);
  r *= c * c;
  vec3 buzz = vec3(sin(tA * (6.1 + 3.0 * iA.y) + iA.z * 40.0), sin(tA * (5.3 + 3.0 * W4) + iA.y * 40.0), sin(tA * (7.7 + 3.0 * iA.z) + W4 * 40.0));
  return vec3(r * cos(th), y, r * sin(th)) + buzz * 1.3 * c * min(tA * 3.0, 1.0) * (1.0 - 0.5 * smoothstep(0.0, 0.6, tC));
}
// 镜头钻的那颗芽里飞出来的那一股（iA.w ≥ 2）：先顺着芽口钻出来、散开，再往外飞，1–2 秒后汇进大群
vec3 at(float t) {
  if (iA.w < 1.5) return atSw(t);
  float u = max(t - uPh.x - iA.x, 0.0); vec3 r = normalize(vec3(sin(iA.y * 40.0), cos(iA.z * 37.0), sin(iA.z * 23.0 + 1.0)));
  vec3 p = iP + uHA * (0.1 + 1.1 * (1.0 - exp(-u * 3.0))) + r * 0.45 * (1.0 - exp(-u * 2.5)) + uHO * 4.0 * u * u + 0.1 * vec3(sin(u * 9.0 + iA.y * 30.0), sin(u * 7.0 + iA.z * 30.0), cos(u * 8.0 + iA.y * 20.0));
  return mix(p, atSw(t), smoothstep(1.2, 2.2, u));
}
void main() {
  float tA = uT - uPh.x - iA.x; vQ = position.xy; vG = 0.0; vA = 0.0; vC = vec3(0.0); vNear = 0.0; vS = 1.0;
  if (tA < 0.0) { ${HIDE} return; }
  vec3 b = at(uT), a = at(uT - 0.04);
  mat4 vp = projectionMatrix * viewMatrix * modelMatrix; vec4 cb = vp * vec4(b, 1.0), ca = vp * vec4(a, 1.0);
  if (cb.w < 0.05) { ${HIDE} return; }
  vec2 dv = (cb.xy / cb.w - (ca.w > 0.05 ? ca.xy / ca.w : cb.xy / cb.w)) * uRes; float dl = length(dv);
  vec2 ax = dl > 1e-4 ? dv / dl : vec2(1.0, 0.0);                                                    // 画面上朝着飞的方向
  float px = 0.06 * (0.8 + 0.4 * fract(iA.z * 7.1)) * projectionMatrix[1][1] * uRes.y * 0.5 / cb.w;   // 身长几像素
  float H = max(2.4 * uPx, px * 1.3); vNear = smoothstep(5.0, 14.0, px / uPx); vS = H / max(px, 1e-4);   // 够大才画身子和翅膀
  cb.xy += mat2(ax, vec2(-ax.y, ax.x)) * position.xy * H / (uRes * 0.5) * cb.w; gl_Position = cb;
  float r = length(b.xz), pu = 0.0, k = step(0.5, fract(iA.w));
  for (int i = 0; i < 4; i++) { float x = r - uKick[i].x * 90.0; pu += uKick[i].y * exp(-x * x / 500.0) * exp(-uKick[i].x * 1.5); }   // 底鼓：一圈光从树往外扫过虫群
  vC = mix(mix(uCa, uCb, step(0.62, fract(iA.z * 13.7))), mix(uCz, uCq, k), uMix);            // 起先黄绿夹金；出了云顶分成清（金白）浊（靛紫）
  vA = smoothstep(0.0, iA.w > 1.5 ? 0.25 : 0.12, tA) * pow(1.0 - smoothstep(uEnd - 0.5, uEnd, uT), 4.0) * smoothstep(0.03, 0.1, cb.w);   // 塌缩时面亮度不变
  vG = vA * (0.6 + 0.4 * sin(uT * (5.0 + 4.0 * iA.y) + iA.z * 60.0)) * (0.4 + 1.6 * iA.y * iA.y) * (1.0 + 1.6 * pu) * mix(1.0, mix(uQZ.y, uQZ.x, k), uMix);   // 尾灯一明一暗地呼吸
}`;
const SWARM_F = `
uniform float uGain; varying vec2 vQ; varying float vG, vNear, vS, vA; varying vec3 vC;
float ell(vec2 p, vec2 c, vec2 r, float s) { vec2 d = (p - c) / r; return 1.0 - smoothstep(1.0 - s, 1.0, dot(d, d)); }
float edge(vec2 p, vec2 c, vec2 r) { vec2 d = (p - c) / r; return smoothstep(0.45, 0.95, dot(d, d)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// 近的画成一只萤火虫（从背上看，x 朝前，以身长为单位）：前胸背板盖住头、边上橙黄；鞘翅张开、带浅色边；后翅扇得太快糊成两片；腹部末端两三节是灯。
// 身子、翅膀挡住后面（预乘 alpha），灯是叠上去的光。远的只是一点光
void main() {
  vec2 p = vQ * vS, q = vec2(p.x, abs(p.y)), e = rot(-0.32) * (q - vec2(0.05, 0.1)), w = rot(0.45) * (q - vec2(-0.02, 0.27)), l = p - vec2(-0.36, 0.0);
  float lamp = ell(p, vec2(-0.33, 0.0), vec2(0.15, 0.085), 0.5) * (0.75 + 0.25 * cos(p.x * 75.0)), halo = exp(-dot(l, l) / 0.035);
  float abd = ell(p, vec2(-0.1, 0.0), vec2(0.3, 0.095), 0.4), ely = ell(e, vec2(0.0), vec2(0.27, 0.075), 0.35), pro = ell(p, vec2(0.33, 0.0), vec2(0.12, 0.14), 0.35);
  vec2 ab = vec2(0.17, 0.1), ap = q - vec2(0.44, 0.03); float ant = 1.0 - smoothstep(0.006, 0.014, length(ap - ab * clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0)));   // 触角
  float leg = 0.0;   // 六条腿：从胸下伸出来，膝盖往后折
  for (int k = 0; k < 3; k++) { float x0 = 0.2 - 0.09 * float(k); vec2 a = vec2(x0, 0.05), b = vec2(x0 - 0.02 + 0.05 * float(k - 1), 0.17), c = vec2(x0 - 0.1 - 0.04 * float(k), 0.24);
    vec2 pa = q - a, ba = b - a, pb = q - b, cb = c - b; leg = max(leg, 1.0 - smoothstep(0.006, 0.012, min(length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)), length(pb - cb * clamp(dot(pb, cb) / dot(cb, cb), 0.0, 1.0))))); }
  float eye = ell(q, vec2(0.45, 0.045), vec2(0.035, 0.035), 0.5), band = 0.6 + 0.4 * smoothstep(0.2, 0.5, abs(fract(p.x * 18.0) - 0.5) * 2.0);   // 复眼；腹部一节一节
  float rib = 1.0 - smoothstep(0.0, 0.18, abs(e.y / 0.075 - 0.25)) * 0.7;                                                                     // 鞘翅上的纵脊
  float wing = ell(w, vec2(0.0), vec2(0.3, 0.15), 0.9) * (0.75 + 0.25 * smoothstep(0.6, 0.9, abs(fract(w.x * 9.0 + w.y * 4.0) - 0.5) * 2.0)), cov = max(max(abd * band, ely), max(max(pro, ant), max(leg * 0.9, eye)));
  vec3 bc = vec3(0.03, 0.022, 0.014) * (ely > 0.5 ? rib : 1.0) + vec3(0.14, 0.10, 0.06) * ely * edge(e, vec2(0.0), vec2(0.27, 0.075)) + vec3(0.5, 0.24, 0.06) * pro * (1.0 - eye) * edge(p, vec2(0.33, 0.0), vec2(0.12, 0.14)) + vec3(0.25, 0.25, 0.28) * eye * exp(-dot(q - vec2(0.46, 0.055), q - vec2(0.46, 0.055)) / 0.0002) + vC * 0.25 * halo;
  vec3 near = (bc * cov + vec3(0.30, 0.32, 0.36) * 0.16 * wing * (1.0 - cov)) * vA + vC * (2.2 * lamp + 0.5 * halo) * vG;
  float a = (0.95 * cov + 0.16 * wing * (1.0 - cov)) * vA;
  gl_FragColor = vec4(mix(vC * (exp(-dot(vQ, vQ) * 6.0) * 1.6 + exp(-dot(vQ, vQ) * 1.5) * 0.25) * vG, near, vNear) * uGain, vNear * a * min(uGain, 1.0));
}`;

// ---------- 建一次 ----------
W.build = (M) => {
  THREE = JZ.THREE;
  T0 = M.ref('bar17'); TJZ = M.word(13, '惊') - T0; const T1 = M.ref('bar25');
  T21 = M.ref('bar21') - T0; T23 = M.ref('bar23') - T0; T24 = M.ref('bar24') - T0; T25 = T1 - T0; TB = T23 - 0.62; TQ = M.word(18, '清') - T0; TZ = M.word(18, '浊') - T0;
  kicks = M.song.kicks.filter(k => k.t > T0 - 0.05 && k.t < T1).map(k => ({ t: k.t - T0, s: k.s }));
  snares = M.song.snares.filter(k => k.t > T0 - 0.05 && k.t < T1).map(k => k.t - T0);
  const rnd = M.rng(31747), R1 = () => rnd() * 2 - 1, norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const S = [], tips = [], defer = [], limbs = [], SP = [400, 46, 34, 26, 22, 20];   // SP：各级枝长多快（单位 / 秒）
  // 一根枝：从 p 沿 d 折着长 len。o = { lv 第几级, birth 几秒开始长, path 根到这里多远, w 粗细, up 往上弯, flat 贴着水面, kids 每单位长度分几次叉, next 下几级的 kids }
  function grow(p, d, len, o) {
    const step = o.lv <= 1 ? 0.8 : 0.5, n = Math.max(2, Math.ceil(len / step)), sp = o.sp || SP[Math.min(o.lv, 5)], tp = o.taper ?? 0.7, nodes = [];
    let arc = 0; d = norm(d);
    for (let i = 0; i < n; i++) {
      const j = (rnd() < 0.12 ? 0.85 : 0.3) * (o.jit ?? 1);                                  // 偶尔一个急折，像闪电
      d = norm([d[0] + R1() * j, o.flat ? 0 : o.hug ? (o.hug - p[1]) * 0.05 + R1() * j * 0.3 : d[1] + R1() * j + (o.up || 0), d[2] + R1() * j]);
      const q = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step], w0 = o.w * (1 - tp * arc / len), w1 = o.w * (1 - tp * Math.min(1, (arc + step) / len));
      S.push(p[0], p[1], p[2], q[0], q[1], q[2], arc, arc + step, o.path + arc, o.path + arc + step, o.birth, sp, w0, w1, o.lv, o.hug ? 1 : 0);
      arc += step; p = q; nodes.push({ p: q, d, arc });
      if (o.kids && o.lv < 5 && arc > len * 0.12 && rnd() < o.kids * step) {
        const cl = (len - arc) * (0.5 + 0.4 * rnd()); if (cl < 0.9) continue;
        const ax = [R1(), o.flat || o.hug ? 0 : R1(), R1()], dt = ax[0] * d[0] + ax[1] * d[1] + ax[2] * d[2], pr = norm([ax[0] - dt * d[0], ax[1] - dt * d[1], ax[2] - dt * d[2]]);
        const an = (26 + 34 * rnd()) * Math.PI / 180, cd = [0, 1, 2].map(k => d[k] * Math.cos(an) + pr[k] * Math.sin(an));
        const spec = { p: q, d: cd, len: cl, o: { lv: o.lv + 1, birth: o.birth + arc / sp, path: o.path + arc, w: w1 * 0.72, up: (o.up || 0) * 0.6, flat: o.flat, hug: o.hug, kids: o.next ? o.next[0] : 0, next: o.next ? o.next.slice(1) : null } };
        if (o.lv === 1 && !o.flat && !o.hug && rnd() < 0.55) defer.push(spec); else grow(spec.p, spec.d, spec.len, spec.o);   // 一半的大枝留给后面的底鼓，一下长一根
      }
    }
    tips.push({ p, d, lv: o.lv, born: o.birth + len / sp, path: o.path + len, flat: !!(o.flat || o.hug) });
    return nodes;
  }
  const trunk = grow([0, 0, 0], [0, 1, 0], 30, { lv: 0, birth: -0.2, path: 0, w: 0.62, up: 0.25, jit: 0.55, taper: 0.35 });
  grow(trunk[trunk.length - 1].p, [0, 1, 0], 150, { lv: 0, birth: -1, path: 30, w: 0.3, up: 0.3, jit: 0.8, taper: 0.5, kids: 0.03, sp: 2000 });   // 从风暴眼劈下来的通道
  for (let i = 0; i < 10; i++) {
    const k = i / 9, nd = trunk[Math.round((9 + 21 * k ** 0.8) / 0.8) - 1], az = i * 2.39996 + R1() * 0.3, el = (5 + 55 * k + R1() * 6) * Math.PI / 180;
    limbs.push(grow(nd.p, [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)], (60 - 20 * k) * (0.9 + 0.2 * rnd()), { lv: 1, birth: 0.02, path: nd.arc, w: 0.3, up: 0.025, kids: 0.38, next: [0.5, 0.55, 0.4] }));
  }
  for (let i = 0; i < 13; i++) { const az = (i + R1() * 0.3) / 13 * M.TAU; grow([0, 0.04, 0], [Math.cos(az), 0, Math.sin(az)], 28 + 44 * rnd(), { lv: 2, birth: 0, path: 0, w: 0.1, flat: true, kids: 0.22, next: [0.25], sp: 120 }); }   // 贴着水面散开的根
  for (let i = 0; i < 7; i++) { const az = i * 2.39996 + R1() * 0.25, c = Math.cos(az), z = Math.sin(az);   // 天根：通道穿出云底的地方，雷贴着云底往四面爬，带一点旋
    grow([0, 54 + 4 * rnd(), 0], [c - 0.35 * z, 0, z + 0.35 * c], 95 + 75 * rnd(), { lv: 1, birth: 0.04 + 0.05 * i, path: 56, w: 0.2, hug: 57 + 5 * rnd(), jit: 0.8, taper: 0.6, kids: 0.07, next: [0.14, 0.18], sp: 120 }); }
  defer.sort((a, b) => a.o.birth - b.o.birth);
  const showers = [{ t: 0, p: [0, 0.6, 0], d: [0, 1, 0], n: 5000, big: 1 }];
  defer.forEach((b, i) => { const k = kicks[i + 1]; if (k) { b.o.birth = Math.max(b.o.birth, k.t); showers.push({ t: b.o.birth, p: b.p, d: b.d, n: 1100 }); } grow(b.p, b.d, b.len, b.o); });

  const n = S.length / 16, pos = new Float32Array(n * 12), aQ = new Float32Array(n * 12), i1 = new Float32Array(n * 16), i2 = new Float32Array(n * 16), se = new Float32Array(n * 8), idx = new Uint32Array(n * 6);
  for (let s = 0; s < n; s++) { const o = s * 16;
    for (let v = 0; v < 4; v++) { const e = v >> 1, P = e ? 3 : 0, Q = e ? 0 : 3, k = s * 4 + v;
      pos.set([S[o + P], S[o + P + 1], S[o + P + 2]], k * 3); aQ.set([S[o + Q], S[o + Q + 1], S[o + Q + 2]], k * 3);
      i1.set([S[o + 6 + e], S[o + 8 + e], S[o + 10], S[o + 11]], k * 4); i2.set([S[o + 12 + e] * 0.5, S[o + 14], S[o + 15], 0], k * 4); se.set([v & 1 ? -1 : 1, e], k * 2); }
    idx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4 + 2, s * 4 + 1, s * 4 + 3], s * 6); }
  const BA = (a, k) => new THREE.BufferAttribute(a, k), IA = (a, k) => new THREE.InstancedBufferAttribute(a, k);
  const add = { blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide };
  const U = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
  const k4 = () => [0, 1, 2, 3].map(() => new THREE.Vector2(99, 0)), col = (h) => new THREE.Color(h);
  const com = () => ({ uT: 0, uPx: JZ.px, uRes: JZ.res });

  sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 3000); root = new THREE.Group(); sc.add(root);
  RT = new THREE.WebGLRenderTarget(JZ.GL.width, JZ.GL.height, { type: THREE.HalfFloatType, depthBuffer: false });
  sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: U({ uNoise: JZ.noise, uLand: JZ.land(), uRefl: RT.texture, uCam: new THREE.Vector3(), uFwd: new THREE.Vector3(), uRight: new THREE.Vector3(), uUp: new THREE.Vector3(), uTanH: 1, uAspect: 16 / 9, uHorizon: 0,
      uRes: JZ.res, uT: 0, uMirror: 0, uSpin: 0, uEyeR: 16, uCrawl: 0, uTreeI: 1, uTreeCol: col('#ffffff'), uFlashP: [0, 1, 2].map(() => new THREE.Vector4(0, 0, 0, 1)), uFlashC: [0, 1, 2].map(() => new THREE.Vector3()), uKick: k4(), uAbove: 0, uDisc: 1e5, uFog: 0.0016, uTop: new THREE.Vector3(), uSw: new THREE.Vector4(1, 0, 0, 0), uQZ: new THREE.Vector2(1, 1) }),
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`, fragmentShader: JZ.GLSL + JZ.LAND + SKY_F }));
  sky.frustumCulled = false; sky.renderOrder = -1; sc.add(sky);

  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', BA(pos, 3)); tg.setAttribute('aQ', BA(aQ, 3)); tg.setAttribute('aI1', BA(i1, 4)); tg.setAttribute('aI2', BA(i2, 4)); tg.setAttribute('aSE', BA(se, 2)); tg.setIndex(BA(idx, 1));
  tree = new THREE.Mesh(tg, new THREE.ShaderMaterial({ ...add, uniforms: U({ ...com(), uKick: k4(), uCore: col('#fff3d6'), uTint: col('#f2b84b'), uTint2: col('#3fe0a0'), uGain: 1, uSpring: 0, uClip: 1e5, uLv: 99 }), vertexShader: TREE_V, fragmentShader: TREE_F }));
  tree.frustumCulled = false; root.add(tree);

  // 铁花：开场砸在水面那一大蓬 + 每个底鼓从新枝的分叉处喷一蓬
  const ns = showers.reduce((a, s) => a + s.n, 0), p0 = new Float32Array(ns * 3), vv = new Float32Array(ns * 3), ia = new Float32Array(ns * 4); let c = 0;
  for (const s of showers) for (let i = 0; i < s.n; i++, c++) {
    let d = norm([R1(), R1(), R1()]); if (s.big) d = norm([d[0], Math.abs(d[1]) * 1.6 + 0.15, d[2]]);
    const sp = s.big ? 8 + 50 * rnd() ** 1.6 : 3 + 20 * rnd() ** 1.5, f = s.big ? 0 : 9;
    p0.set(s.p, c * 3); vv.set([d[0] * sp + s.d[0] * f, d[1] * sp + s.d[1] * f + (s.big ? 0 : 5), d[2] * sp + s.d[2] * f], c * 3);
    ia.set([s.t + rnd() * (s.big ? 0.06 : 0.3), (s.big ? 1.3 : 1.0) + 1.6 * rnd(), rnd(), 0.7 + 2.3 * rnd() ** 2], c * 4);
  }
  const ribQuad = () => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', BA(new Float32Array([1, 0, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]); return g; };
  const sprQuad = () => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', BA(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]); return g; };
  const sg = ribQuad(); sg.setAttribute('iP0', IA(p0, 3)); sg.setAttribute('iV', IA(vv, 3)); sg.setAttribute('iA', IA(ia, 4)); sg.instanceCount = ns;
  sparks = new THREE.Mesh(sg, new THREE.ShaderMaterial({ ...add, uniforms: U(com()), vertexShader: SPARK_V, fragmentShader: SPARK_F })); sparks.frustumCulled = false; root.add(sparks);

  // 光芽：「惊蛰」那一下从树干往梢头亮过去；之后新长出的梢头等下一个军鼓再亮
  const tt = tips.filter(t => !t.flat && t.lv >= 2), bp = new Float32Array(tt.length * 3), ba = new Float32Array(tt.length * 4);
  tt.forEach((t, i) => { const sn = snares.find(x => x >= t.born + 0.1) ?? t.born + 0.1; bp.set(t.p, i * 3); ba.set([Math.max(sn, TJZ + t.path / 110), 0.13 + 0.10 * rnd(), rnd(), 0], i * 4); });

  const bdir = new Float32Array(tt.length * 3); tt.forEach((t, i) => { const l = Math.hypot(t.d[0], t.d[1] + 0.7, t.d[2]); bdir.set([t.d[0] / l, (t.d[1] + 0.7) / l, t.d[2] / l], i * 3); });   // 芽朝着枝梢的方向，偏向上
  const lg = new THREE.InstancedBufferGeometry(); lg.setAttribute('position', BA(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0, 0, -1, 1, 1, -1, 1, 0, 1, 1, 1, 1, 1]), 3)); lg.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
  lg.setAttribute('iP', IA(bp, 3)); lg.setAttribute('iD', IA(bdir, 3)); lg.setAttribute('iA', IA(ba, 4)); lg.instanceCount = tt.length;
  buds = new THREE.Mesh(lg, new THREE.ShaderMaterial({ ...add, uniforms: U({ ...com(), uJade: col('#3fe0a0'), uGain: 1.0, uGo: 1e5 }), vertexShader: LEAF_V, fragmentShader: LEAF_F })); buds.frustumCulled = false; root.add(buds);
  // 镜头要用的：一根主枝的平滑走向、被镜头钻进去的那颗光芽
  const L3 = limbs[3]; W.limb = L3.map((_, i) => { const a = L3.slice(Math.max(0, i - 7), i + 8); return [0, 1, 2].map(k => a.reduce((x, n) => x + n.p[k], 0) / a.length); });
  const aEnd = Math.min(25, W.limb.length * 0.8 - 16), Q = W.limb[Math.min(W.limb.length - 1, Math.round((aEnd + 9) / 0.8))];   // 被镜头钻进去的那颗芽：顺着主枝飞到头，前面不远那颗（朝外、bar19 之前就冒出来了）
  let bi = 0, bd = 1e9; tt.forEach((t, i) => { const d = Math.hypot(t.p[0] - Q[0], t.p[1] - Q[1] - 2, t.p[2] - Q[2]); if (d < bd && ba[i * 4] < 3.9 && t.d[0] * t.p[0] + t.d[2] * t.p[2] > 0) { bd = d; bi = i; } }); W.budB = tt[bi].p; ba[bi * 4 + 2] = 0.03; ba[bi * 4 + 1] = 0.3;
  tt.forEach((t, i) => { const a = ba[i * 4], sn = snares.find(x => x >= a + 0.45); ba[i * 4 + 3] = i === bi ? T21 : Math.min(sn ?? T21, T21 + 0.2 * ba[i * 4 + 2]); });
  // 虫群：每颗光芽变几只虫，起飞时刻跟着光芽
  const per = Math.ceil(26000 / tt.length), nw = tt.length * per + 60, wp = new Float32Array(nw * 3), wa = new Float32Array(nw * 4);
  for (let i = 0; i < nw; i++) { const h = i >= nw - 60, j = h ? bi : i % tt.length; wp.set(tt[j].p, i * 3); wa.set([h ? 0.05 + 0.4 * rnd() : ba[j * 4 + 2] * 0.35 + (i >= tt.length ? 0.2 * rnd() : 0), rnd(), rnd(), (h ? 2 : 0) + rnd()], i * 4); }   // 最后 60 只：镜头钻的那颗芽张开时一股飞出来
  const wg = sprQuad(); wg.setAttribute('iP', IA(wp, 3)); wg.setAttribute('iA', IA(wa, 4)); wg.instanceCount = nw;
  swarm = new THREE.Mesh(wg, new THREE.ShaderMaterial({ ...add, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, uniforms: U({ ...com(), uKick: k4(), uPh: new THREE.Vector4(T21, TB, T23, T24), uEnd: T25, uMix: 0, uGain: 1, uQZ: new THREE.Vector2(1, 1),
    uHA: new THREE.Vector3(), uHO: new THREE.Vector3(), uCa: col("#86f08c"), uCb: col('#f2b84b'), uCq: new THREE.Color(1.0, 0.82, 0.5), uCz: new THREE.Color(0.36, 0.26, 0.95) }), vertexShader: SWARM_V, fragmentShader: SWARM_F })); swarm.frustumCulled = false; root.add(swarm);

  W.geo = { tree: tg };   // 宇宙网借树的几何（泡底那根主丝）
  // 镜头：整段一条路径（时间是 bar17 之后几秒）。升出水面 → 推到树下 → 绕着树干盘上去 → 视线甩到主枝上顺着飞 → 拐进树冠靠近那颗芽 → 芽张开，擦着它过去跟着萤火虫往外飞 → 转回来看全树 → 跟着虫群仰着钻进风暴眼 → 出了云顶慢慢低头 → 升到正上方
  const LB = W.limb, la = (a) => LB[Math.max(0, Math.min(LB.length - 1, Math.round(a / 0.8)))];
  const onLimb = (a) => { const n = la(a), m = la(a + 14), dx = m[0] - n[0], dz = m[2] - n[2], dl = Math.hypot(dx, dz) || 1; return { p: [n[0] - dz / dl * 2.2, n[1] + 1.6, n[2] + dx / dl * 2.2], l: [m[0], m[1] - 4, m[2]] }; };   // 视线略往下：多看山林，少看被照亮的云底
  const c0 = onLimb(9), te = Math.atan2(c0.p[2], c0.p[0]), re = Math.hypot(c0.p[0], c0.p[2]), ts = te - 3.3, pol = (th, r, y) => [Math.cos(th) * r, y, Math.sin(th) * r];
  const B = W.budB, ol = Math.hypot(B[0], B[2]), O = [B[0] / ol, 0, B[2] / ol], SD = [-O[2], 0, O[0]], Y = [0, 1, 0];
  // 那颗芽自己的朝向（和 LEAF_V 一样算）：两片叶绕 hW 张开。镜头从树冠里面斜着对准它（看得到叶面，也看得到张开的 V 形）
  { const l = Math.hypot(O[0], 0.4, O[2]); bdir.set([O[0] / l, 0.4 / l, O[2] / l], bi * 3); }   // 那颗芽朝外长，萤火虫从芽口出来就是往外飞
  // 桃花：那颗芽 + 另挑 90 颗（自己的随机数，不动别的东西的随机序列），每朵 5 片花瓣 + 25 根花丝 + 1 根雌蕊。镜头从 bar20 往那颗芽推近，花得在推近的路上就开：bar21 前 1.6 秒开始开，别处的在之后一秒半里陆续开
  const frnd = M.rng(5151), fl = [bi], fP = [], fD = [], fA = []; while (fl.length < 91) { const i = Math.floor(frnd() * tt.length); if (!fl.includes(i)) fl.push(i); }
  const hv = [-bdir[bi * 3] + 0.25 * SD[0], -bdir[bi * 3 + 1] + 0.5, -bdir[bi * 3 + 2] + 0.25 * SD[2]], hl = Math.hypot(...hv);   // 那一朵朝着镜头来的方向开（和下面的 off 一样算）：推近时看到的是花的正脸、花心的花蕊
  for (const i of fl) { const sd = frnd(); for (let j = 0; j < 31; j++) { fP.push(...tt[i].p); if (i === bi) fD.push(...hv.map(x => x / hl)); else fD.push(bdir[i * 3], bdir[i * 3 + 1], bdir[i * 3 + 2]); fA.push(i === bi ? T21 - 1.6 : T21 - 1.6 + 1.5 * sd, i === bi ? 0.17 : ba[i * 4 + 1], sd, j); } }
  const fg = new THREE.InstancedBufferGeometry(); fg.setAttribute('position', BA(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3)); fg.setIndex([0, 1, 2, 2, 1, 3]);
  fg.setAttribute('iP', IA(new Float32Array(fP), 3)); fg.setAttribute('iD', IA(new Float32Array(fD), 3)); fg.setAttribute('iA', IA(new Float32Array(fA), 4)); fg.instanceCount = fA.length / 4;
  blooms = new THREE.Mesh(fg, new THREE.ShaderMaterial({ ...add, blending: THREE.NormalBlending, depthTest: true, depthWrite: true, uniforms: U({ ...com(), uGain: 0.55, uNoise: JZ.noise }), vertexShader: FLOWER_V, fragmentShader: FLOWER_F })); blooms.frustumCulled = false; root.add(blooms);   // 正常混合、按深度互相遮挡
  const hA = [...bdir.slice(bi * 3, bi * 3 + 3)], sd = ba[bi * 4 + 2] * 6.283, cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const hS = norm(cr(hA, [Math.cos(sd), 0.31, Math.sin(sd)])), hW = cr(hA, hS), Cb = [0, 1, 2].map(k => B[k] + hA[k] * 0.3);
  const off = norm([0, 1, 2].map(k => -hA[k] + 0.5 * Y[k] + 0.25 * SD[k]));   // 镜头在芽的后上方，顺着芽的朝向看过去：张开时两片叶转过来正对镜头，萤火虫往画面前方飞
  const near = (d) => [0, 1, 2].map(k => Cb[k] + off[k] * d), mid = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const at = (a, y, b, o = [0, 0, 0]) => [0, 1, 2].map(k => o[k] + O[k] * a + SD[k] * b + (k === 1 ? y : 0));   // a 沿芽朝外的方向，y 往上，b 横着
  const bt = (n) => M.ref('bar' + n) - T0, keys = [
    { t: -0.28, p: pol(ts + 0.35, 70, 0.05), l: [0, 24, 0], up: Y, fov: 62, g: 1 },                          // 刚升出水面：仰看劈下来的雷
    { t: 0, p: pol(ts + 0.33, 67, 0.7), l: [0, 23, 0], up: Y, fov: 64, g: 1 },
    { t: 1.0, p: pol(ts + 0.2, 52, 1.4), l: [0, 23, 0], up: Y, fov: 64, g: 1 },
    { t: bt(18), p: pol(ts, 32, 1.4), l: [-0.3, 13.0, 0], up: Y, fov: 66, g: 0.8 }];                // bar18 推到树下，接着贴着树干直着往上升
  { const D = bt(19) - bt(18); keys.push(   // 第六次：不绕着树干盘（原来转 189°），在主枝的对面贴着树干直着往上升，视线一直朝主枝伸出去的方向（主枝往 +x 拐，视线一路慢慢往右偏），从仰着慢慢压平；过了分叉就落到主枝上（新看到的：树越升越高，到顶是分叉和伸出去的主枝）
    { t: bt(18) + 0.3 * D, p: [-0.5, 5, -18], l: [5.9, 11.4, 6], up: Y, fov: 64.4, g: 0.65 },
    { t: bt(18) + 0.55 * D, p: [-1.6, 11, -8], l: [7.7, 13.8, 12], up: Y, fov: 66.4, g: 0.56 },
    { t: bt(18) + 0.78 * D, p: [-1.9, 18, -2.5], l: [9.3, 16.6, 13.5], up: Y, fov: 68.2, g: 0.48 }); }
  keys.push(
    { t: bt(19), p: c0.p, l: [9.3, 17.8, 16.3], up: Y, fov: 74, g: 0.45 },                                                 // bar19 过了分叉落到主枝上，顺着枝往外飞（视线本来就朝这边，不甩）
    { t: bt(19) + 1.0, p: onLimb(9 + (aEnd - 9) * 0.55).p, l: mid(onLimb(9 + (aEnd - 9) * 0.55).l, Cb, 0.35), up: Y, fov: 74, g: 0.55 },   // 视线提前往那颗芽偏（第六次：原来最后 0.3 秒转 42°）
    { t: bt(20), p: near(6), l: Cb, up: Y, fov: 64, g: 0.5 },   // 拐进树冠最密的地方：树压暗，不一下亮起来                         // bar20 拐进树冠，慢慢靠近那颗芽（周围的芽一个军鼓张开一批）
    { t: bt(20) + 1.0, p: near(2.6), l: Cb, up: Y, fov: 60, g: 0.58 },
    { t: bt(21) - 0.4, p: near(1.3), l: [0, 1, 2].map(k => Cb[k] + hA[k] * 19.6 - off[k] * 82.3), up: Y, fov: 56, g: 0.6 },
    { t: bt(21), p: near(0.75), l: [0, 1, 2].map(k => Cb[k] + hA[k] * 71.4 - off[k] * 32.7), up: Y, fov: 56, g: 0.45 },        // bar21 芽张开，芽心的光变成萤火虫飞出来，镜头擦着芽过去
    { t: bt(21) + 0.3, p: [0, 1, 2].map(k => Cb[k] + hA[k] * 0.45 + off[k] * 0.2), l: [0, 1, 2].map(k => Cb[k] + hA[k] * 96.5 - off[k] * 5.2), up: Y, fov: 58, g: 0.45 },   // 从张开的 V 口上面跟着萤火虫出去
    { t: bt(21) + 0.65, p: [0, 1, 2].map(k => Cb[k] + hA[k] * 2.6 + SD[k] * 0.6), l: [0, 1, 2].map(k => Cb[k] + hA[k] * 100.2 + SD[k] * 21.9), up: Y, fov: 60, g: 0.5 },   // 注视点放远（同一条视线）
    { t: bt(21) + 1.0, p: at(8, 2.5, 2, B), l: at(103, 28.9, 17.8, B), up: Y, fov: 64, g: 0.45 },                       // 跟着往外飞（不再转回来）
    // 注视点都放在 100 米外（同一个距离）（远近换着插值会急转）。第六次：原来飞出去以后 0.35 秒掉头 180° 回看全树（672°/s），出云顶时又翻过天顶（437°/s）。改成不掉头：跟着萤火虫往外飞（满山谷的萤火虫，新东西），一路仰起来（到 42° 为止）跟虫群卷进风暴眼；出了云顶视线还朝外，往风暴眼另一侧退开，慢慢低头看萤火虫在云海上铺开，再升到正上方
    { t: bt(21) + 1.35, p: [9, 32, 28.5], l: [24.8, 74.3, 119.2], up: Y, fov: 66, g: 0.5 },          // 仰 25°
    { t: bt(22), p: [7, 38, 26], l: [21.2, 95.4, 106.7], up: Y, fov: 66, g: 0.7 },                   // bar22 仰 35°：虫群往上卷
    { t: bt(23) - 1.0, p: [5, 50, 17], l: [18.3, 114.3, 92.4], up: Y, fov: 68, g: 1 },             // 仰 40°，跟着虫群往风暴眼收
    { t: bt(23) - 0.45, p: [3.2, 70, 7.4], l: [16.1, 136.9, 80.6], up: Y, fov: 70, g: 1 },          // 仰 42°（只仰到这里：不过天顶画面不翻，出了云顶很快就能看到云海）
    { t: bt(23) - 0.1, p: [1.2, 112, 2.8], l: [14.5, 176.3, 78.2], up: Y, fov: 72, g: 1 },       // 钻过风暴眼
    { t: bt(23) + 0.35, p: [-2, 160, -8], l: [13.7, 202.3, 81.2], up: Y, fov: 70, g: 1 },        // bar23 出了云顶，缓缓低头（仰 25°），往风暴眼的另一侧退：萤火虫从风暴眼喷出来，一直在画面前方
    { t: bt(23) + 1.0, p: [-8, 195, -40], l: [43.9, 221.1, 254], up: Y, fov: 68, g: 1 },      // 仰 5°，往后退
    { t: bt(24), p: [-18, 232, -110], l: [147, -77, 827], up: Y, fov: 68, g: 1 },                // bar24 俯 18°：风暴眼在前下方，萤火虫在云海上铺开
    { t: bt(24) + 1.0, p: [-15, 560, -85], l: [66.5, -323, 377], up: Y, fov: 68, g: 1 },    // 往后退、升高，俯 62°，整个云旋转进画面
    { t: bt(25), p: at(3, 1100, 0), l: [0, 0, 0], up: [0.174, 0, 0.985], fov: 68, g: 1 });          // 正上方俯拍（画面上方朝外，和前面低头的方向接得上）
  CAM = JZ.path(keys); swarm.material.uniforms.uHA.value.set(...hA); swarm.material.uniforms.uHO.value.set(...O);
  W.stats = { segs: n, tips: tt.length, sparks: ns, kickBranches: showers.length - 1, swarm: nw };
};

JZ.kit = { RIBBON, HIDE, TREE_V, TREE_F, FLOWER_V, FLOWER_F, SWARM_V, SWARM_F };   // 别的世界借用的零件

// ---------- 每帧 ----------
W.pose = (ts, M) => {   // 摆好这一刻的世界，返回 { sc, cam }（ts 是歌曲时间）
  const t = ts - T0, C = CAM(t), V = THREE.Color;   // lerp 的目标类型要和自己一样，不然算出 NaN
  cam.fov = C.fov; cam.position.set(...C.p); cam.up.set(...C.up); cam.lookAt(...C.l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements, u = sky.material.uniforms, th = Math.tan(C.fov * Math.PI / 360);
  u.uCam.value.copy(cam.position); u.uRight.value.set(e[0], e[1], e[2]); u.uUp.value.set(e[4], e[5], e[6]); u.uFwd.value.set(-e[8], -e[9], -e[10]);
  const A = M.smooth(95, 150, C.p[1]);   // 升到云层上面：从云顶那一面看
  u.uTanH.value = th; u.uHorizon.value = A > 0.5 ? 0 : 0.5 + 0.5 * e[9] / (th * e[5]); u.uT.value = t; u.uSpin.value = 0.4 + t * 0.035;
  u.uEyeR.value = 8 + 20 * M.smooth(-0.05, 0.9, t); u.uCrawl.value = 26 + 120 * Math.min(Math.max(t, 0), 1.3);   // 雷把风暴眼撑开；天根爬到哪，云底亮到哪
  const settle = M.smooth(0.1, 1.1, t);                                     // 刚劈下来是白紫，一拍里沉成金
  u.uTreeCol.value.set(0.55, 0.42, 1.0).lerp(new V(1.0, 0.58, 0.18), settle);
  u.uTreeI.value = (t < 0 ? 0.55 * M.smooth(-0.6, 0, t) : 1.0 + 0.5 * Math.exp(-t / 1.5) + 0.5 * M.smooth(0, 16, t)) * (1 - 0.6 * A);   // 云上面看：眼壁别亮成一片
  const ks = []; for (let i = kicks.length - 1; i >= 0 && ks.length < 4; i--) if (kicks[i].t <= t) ks.push([i, kicks[i]]);
  for (const m of [sky, tree, swarm]) m.material.uniforms.uKick.value.forEach((v, i) => ks[i] ? v.set(t - ks[i][1].t, ks[i][1].s) : v.set(99, 0));
  for (let i = 0; i < 3; i++) {                                             // 云里的雷光：每个底鼓在云层某处亮一下，慢慢暗（不闪）
    const k = ks[i], P = u.uFlashP.value[i], Cc = u.uFlashC.value[i];
    if (!k) { Cc.set(0, 0, 0); continue; }
    const an = M.hash(k[0], 1) * M.TAU, r = 35 + 80 * M.hash(k[0], 2), g = 1.2 * k[1].s * Math.exp(-(t - k[1].t) / 0.9);
    P.set(Math.cos(an) * r, 88, Math.sin(an) * r, 30); Cc.set(0.72, 0.62, 1.0).lerp(new THREE.Vector3(1.0, 0.70, 0.36), settle).multiplyScalar(1.6 * g);
  }
  // 云上面那两镜：云顶受星月的光；虫群喷出来把云顶照亮，「清」「浊」两个字各亮一半；最后整团塌成一点
  const tC = Math.max(t - T23, 0), tD = Math.max(t - T24, 0), fall = (1 - M.smooth(T25 - 0.5, T25, t)) ** 2, qz = [1 + 1.6 * M.smooth(TQ, TQ + 0.12, t), 1 + 1.6 * M.smooth(TZ, TZ + 0.12, t)];
  u.uAbove.value = A; u.uFog.value = 0.0016 - 0.0014 * A; u.uTop.value.set(0.09, 0.12, 0.2).multiplyScalar(A);
  u.uDisc.value = t < T24 ? 1e5 : (520 + 2500 * (1 - M.smooth(0, 0.8, tD))) * fall;
  u.uSw.value.set((60 + 330 * (1 - Math.exp(-tC))) * fall + 1, 0.4 * M.smooth(0, 0.6, tC) * fall, M.smooth(0, 0.9, tD), tD * (0.7 + 1.6 * tD)); u.uQZ.value.set(...qz);
  const tu = tree.material.uniforms, bu = buds.material.uniforms, su = swarm.material.uniforms, sn = snares.filter(x => x <= t);
  tu.uGain.value = 1.5 * (C.g || 1) * (1 + 0.5 * Math.exp(-Math.max(t, 0) / 0.8)); tu.uSpring.value = M.smooth(TJZ, TJZ + 0.6, t); tu.uClip.value = 24 + 1e5 * (1 - A) ** 4;
  tu.uCore.value.set(0.92, 0.90, 1.0).lerp(new V(1.0, 0.95, 0.84), settle); tu.uTint.value.set(0.48, 0.36, 1.0).lerp(new V(0.95, 0.52, 0.09), settle);
  bu.uGo.value = T21; bu.uGain.value = 0.55;   // 军鼓：光芽胀一下，之后比原来亮一点
  su.uMix.value = M.smooth(T23 + 0.1, T23 + 0.9, t); su.uGain.value = (1.5 - 0.2 * A) * (1 - 0.75 * M.smooth(TB, T23, t) * (1 - M.smooth(T23, T23 + 0.9, t))) * (0.4 + 0.6 * M.smooth(T21, T21 + 1.3, t)); su.uQZ.value.set(1 + 1.6 * M.smooth(TQ, TQ + 0.4, t), 1 + 1.6 * M.smooth(TZ, TZ + 0.4, t));   // 钻风暴眼那一下压暗，不白成一片；「清」「浊」萤火虫亮起来比云慢（0.12 秒亮到 2.6 倍就成了闪）
  for (const m of [tree, sparks, buds, blooms, swarm]) m.material.uniforms.uT.value = t;
  sparks.visible = buds.visible = blooms.visible = A < 0.5; swarm.visible = t >= T21;
  if (A < 0.5) {   // 倒影那一遍：整个世界沿水面翻过去画进 RT，主画面的水面再从里面取（云上面看不到水，不画）
    u.uMirror.value = 1; u.uRefl.value = null; root.scale.y = -1;   // 这一遍不能同时采样正在写的 RT
    JZ.R.setRenderTarget(RT); JZ.R.render(sc, cam); JZ.R.setRenderTarget(null);
    u.uMirror.value = 0; u.uRefl.value = RT.texture; root.scale.y = 1;
  }
  return { sc, cam };
};
W.draw = (ctx, s, M) => { const a = W.pose(s.t, M); JZ.present(ctx, M, a.sc, a.cam); };
})();
