// jz_deep.js —— 第二段的世界（bar9–16）：同一个湖的水下，画成真的水下。
// 头顶是从下面看的水面（正上方一圈看得到天、火星和山火的光，圈外是水下自己的倒影），雷在水面上方的云里打，光一下一下透下来成光柱，在湖底铺成光网；
// 湖底有石头、沉木、水草，水里有气泡和悬浮的碎屑。bar13 一滴朱红染料落进来，「红」化开；「风起」水流起来，一切横着流；bar16 卷成带气芯的旋涡。
// 时间是歌曲时间（秒）；水面 y = 0，湖底约 y = -9。镜头整段走一条路径（CAM）。
(() => {
const JZ = window.JZ, W = JZ.deep = {};
let THREE, K, sc, cam, sky, parts, weeds, T, TR, TW, kicks, CAM, CU, HB, hb, HF;
const VERT = `varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BASE = [0.012, 0.022, 0.034], BOLT = [0.10, 0.115, 0.17], WARM = [0.10, 0.035, 0.008];   // 水面上的光：夜色、雷、火星和山火
const ramp = (x, d) => x <= 0 ? 0 : x < d ? d * ((x / d) ** 3 - (x / d) ** 4 / 2) : d / 2 + (x - d);   // 速度从 0 平滑升到 1 之后走了多远（升速用 d 秒）

// 那一滴血（前面要先有 JZ.GLSL、uT、WATER）：入水，卷成涡环往下沉（先快后慢）；「红」那一刻涡环不稳，分成 6 个小环，各自往外、往下走，越走越慢、越散越大。
// 只分这一次（用户 2026-11-20：原来 bar14 每个再分 4 个，一共 31 个小圈，太多；要画细，不要分那么多层）：第 2 级的分裂时刻 uTk.z 放到很远，那套代码不动。
// 上一级分裂以后留在原地化开、变淡。环上的点走过的路就是细丝：一缕缕连回上一级，成一棵倒挂的墨水树
const INK = `
uniform vec4 uTk;   // x 入水、y 第一次分裂（「红」）、z 第二次分裂（bar14，每个环前后错开一点）
float hk(float a, float b) { return h01(uvec3(uint(a + 0.5), uint(b + 0.5), 31u)); }
float t2(float i) { return uTk.z + 0.35 * (hk(i, 7.0) - 0.5); }   // 第 1 级第 i 个环再分裂的时刻：各个环不同时
float tbK(float L, float i) { return L < 0.5 || L > 2.5 ? uTk.x : L < 1.5 ? uTk.y : t2(floor(i / 4.0)); }   // 第 L 级第 i 个环出生的时刻（3 是第 0 级身后的细尾巴）
float aK(float L, float i) { return L < 1.5 ? 6.2832 * (i + 0.08 * hk(i, 1.0)) / 6.0 : 6.2832 * (i + 0.25 * hk(i, 3.0)) / 4.0 + 1.5 * hk(floor(i / 4.0), 8.0); }   // 往哪边走（第 2 级每组转个随机的角度）
vec3 C0(float t) { float s = clamp(t, uTk.x, uTk.y) - uTk.x; return vec3(DYE.x, -0.05 - 3.0 * (1.0 - exp(-1.2 * s)), DYE.y); }
vec3 C1(float i, float t) { float s = clamp(t, uTk.y, t2(i)) - uTk.y, a = aK(1.0, i); return C0(uTk.y) + vec3(cos(a), 0.0, sin(a)) * (0.35 + (0.7 + 0.4 * hk(i, 9.0)) * (1.0 - exp(-0.9 * s))) - vec3(0.0, (1.6 + 0.6 * hk(i, 2.0)) * (1.0 - exp(-0.8 * s)), 0.0); }
vec3 C2(float i, float t) { float q = floor(i / 4.0), s = max(t - t2(q), 0.0), a = aK(2.0, i); return C1(q, t2(q)) + vec3(cos(a), 0.0, sin(a)) * (0.18 + (0.4 + 0.4 * hk(i, 10.0)) * (1.0 - exp(-0.8 * s))) - vec3(0.0, (1.2 + 0.6 * hk(i, 4.0)) * (1.0 - exp(-0.6 * s)), 0.0); }
float Rk(float L, float i, float t) { float s = max(t - tbK(L, i), 0.0); return 1.5 * (0.8 + 0.4 * hk(i, L + 11.0)) * (L < 0.5 ? 0.03 + 0.17 * (1.0 - exp(-4.0 * s)) + 0.05 * s : L < 1.5 ? 0.05 + 0.06 * (1.0 - exp(-2.0 * s)) + 0.03 * s : 0.03 + 0.04 * (1.0 - exp(-2.0 * s)) + 0.02 * s); }   // 一样一级的环大小也不一样
vec3 axK(float L, float i) {   // 环的轴顺着它走的方向：往外斜着走的环，环面也跟着歪
  if (L < 0.5) return vec3(0.0, -1.0, 0.0);
  float a = aK(L, i), k = L < 1.5 ? 0.4 + 0.25 * hk(i, 5.0) : 0.3 + 0.35 * hk(i, 6.0); return normalize(vec3(cos(a) * k, -1.0, sin(a) * k));
}
vec3 inkP(float L, float i, float ph, float ps, float t) {   // 第 L 级第 i 个环上的一点：ph 绕着环的角度，ps 管子截面上的角度（绕着芯转：涡环在卷）
  vec3 c = L < 0.5 ? C0(t) : L < 1.5 ? C1(i, t) : C2(i, t), ax = axK(L, i), e1 = normalize(vec3(1.0, 0.0, 0.0) - ax * ax.x), e2 = cross(ax, e1);
  float R = Rk(L, i, t), rc = (L < 0.5 ? 0.2 : 0.27) * R; ps += 2.5 * t;   // 只分一次：第 1 级的环粗一点、软一点，像一团卷着的墨，不像细圈
  float lb = L < 0.5 ? exp(-max(uTk.y - t, 0.0) * 3.0) : L < 1.5 ? exp(-max(t2(i) - t, 0.0) * 3.0) : 0.3 * (1.0 - exp(-max(t - tbK(L, i), 0.0))), cl = L < 0.5 ? cos(ph * 6.0) : cos((ph - 1.5 * hk(i, 8.0)) * 4.0);   // 分裂前环沿一圈起瓣（6 个、4 个），越长越大，瓣尖就是下一级小环出生的地方
  R *= 1.0 + 0.35 * lb * cl + 0.06 * sin(ph * 3.0 + i * 1.7) + 0.05 * sin(ph * 5.0 + i * 3.1);
  return c + (cos(ph) * e1 + sin(ph) * e2) * (R + rc * cos(ps)) - ax * (rc * sin(ps) - 0.3 * R * lb * max(cl, 0.0));   // 瓣尖往下坠
}
vec3 inkMove(vec3 p, float age) {   // 化开（越老越散）；「风起」被急流按深浅不同地往横里拉，扯成横的丝；bar16 卷进旋涡
  p += ((vn(p * 2.5 + 3.0).xyz - 0.5) * 0.2 + (vn(p * 7.0 + 9.0).xyz - 0.5) * 0.06) * age;
  p.x += uFlow * (0.35 + 0.9 * vn(vec3(p.y * 0.6, p.z * 0.5, 7.0)).x);
  return swirl(p, uSpin);
}
`;

// 全屏着色器和粒子共用（前面要先有 JZ.GLSL 和 uT）：湖底、旋涡的气芯、水流和旋涡把漂着的东西带到哪
const WATER = `
uniform float uFlow, uSpin, uVx, uShaft;   // 水流把东西带出去多远、旋涡转了多少、旋涡成形几成、染料那束光柱亮几成
const vec2 DYE = vec2(-3.0, -4.0);          // 染料落下来的地方
const vec3 ATT = vec3(0.30, 0.13, 0.10);   // 光往下每深一个单位衰减多少（红的先没）
float bed(vec2 x) { return -9.0 + 2.6 * (fbm(vec3(x * 0.07, 1.3), 4) - 0.45) + 1.6 * pow(vn(vec3(x * 0.3, 4.1)).x, 3.0); }   // 湖底：起伏的沙，零星的石头
vec2 vaxis(float y) { return vec2(16.0, -6.0) + 0.5 * vec2(sin(y * 0.9 + uT * 2.3), cos(y * 0.8 + uT * 1.9)) * (1.0 - exp(y * 0.5)); }   // 气芯的中轴：越深越晃
float ra(float y) { return uVx * (0.16 + 1.7 * exp(y * 1.1) + 1.6 * exp(y * 3.0)) * smoothstep(-8.5 * uVx, -8.5 * uVx + 1.5, y); }   // 气芯多粗：贴着水面摊成喇叭口，往下收细
vec3 swirl(vec3 p, float sp) {   // 旋涡把漂着的东西卷着转、往中轴拉
  vec2 ax = vaxis(p.y), d = p.xz - ax; float r = length(d), a = sp / (0.5 + 0.1 * r * r), c = cos(a), s = sin(a);
  d = vec2(c * d.x - s * d.y, s * d.x + c * d.y) * (1.0 - 0.45 * uVx * exp(-r * 0.2));
  return vec3(ax.x + d.x, p.y, ax.y + d.y);
}
float shafts(vec3 p) {   // 光柱：水面的波把光聚成一束一束，斜着照下来；染料要落的地方有一束特别亮
  vec2 dx = p.xz - DYE; return 6.0 * pow(vn(vec3((p.xz + vec2(0.22, 0.10) * p.y) * 0.5, uT * 0.08)).x, 4.0) + 3.0 * uShaft * exp(-dot(dx, dx) / 1.2);
}
`;
const DEEP_F = `
uniform vec3 uCam, uFwd, uRight, uUp, uLit; uniform vec4 uEm; uniform float uTanH, uAspect, uL, uWarm, uRough, uDyeT; varying vec2 vP;
const vec3 SIG = vec3(0.16, 0.07, 0.055);   // 水每个单位吃掉多少光

vec3 down(float y) { return uLit * exp(min(y, 0.0) * ATT); }   // 这么深的地方从上面照下来多少光
float caus(vec2 x) { vec2 w = vn(vec3(x * 0.5, uT * 0.22)).xy - 0.5; return pow(1.0 - abs(vn(vec3(x * 1.1 + w * 1.6, uT * 0.3)).x - vn(vec3(x * 1.45 - w * 1.3 + 5.0, uT * 0.33 + 2.0)).y), 9.0); }   // 光网
float segd(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float logs(vec3 p, float hb) {   // 三根沉木，躺在湖底
  return min(min(length(vec2(segd(p.xz, vec2(-4.5, -2.0), vec2(1.5, 0.5)), hb - 0.30)) - 0.34, length(vec2(segd(p.xz, vec2(-7.0, 4.5), vec2(-2.5, 6.0)), hb - 0.22)) - 0.26), length(vec2(segd(p.xz, vec2(5.0, -6.5), vec2(7.5, -1.0)), hb - 0.25)) - 0.30);
}
float map(vec3 p) {   // 到最近的实物多远：湖底、沉木、旋涡的气芯
  float hb = p.y - bed(p.xz), d = min(hb * 0.6, logs(p, hb)), rr = ra(p.y);
  if (rr > 0.02) d = min(d, (length(p.xz - vaxis(p.y)) - rr) * 0.35);   // 喇叭口那里坡很陡，步子要小，不然边上出锯齿
  return d;
}

vec3 solid(vec3 p, vec3 rd) {
  const vec2 e = vec2(0.03, 0.0); float hb = p.y - bed(p.xz), rr = ra(p.y);
  vec3 n = normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)) + 1e-6);
  if (rr > 0.02 && length(p.xz - vaxis(p.y)) - rr < 0.05) {   // 气芯的壁：水和空气的交界像一面拧着的水银镜子。顺着旋转方向拉长的细波纹，正对着看透进去是亮的，斜着看反射上面的光；壁上挂着气泡
    vec2 dx = p.xz - vaxis(p.y); float th = atan(dx.y, dx.x), hel = th * 3.0 + p.y * 8.0 - uT * 13.0;   // 螺旋坐标：沿着它是一道道被拧长的纹
    vec3 tg = vec3(-dx.y, 0.0, dx.x) / max(length(dx), 1e-3);
    float w1 = vn(vec3(hel * 1.6, p.y * 3.0, 1.0)).x - 0.5, w2 = vn(vec3(hel * 5.0, p.y * 14.0 - uT * 3.0, 5.0)).y - 0.5, w3 = vn(vec3(hel * 13.0, p.y * 40.0, 9.0)).z - 0.5;
    n = normalize(n + vec3(0.0, 1.0, 0.0) * (0.9 * w1 + 0.5 * w2 + 0.25 * w3) + tg * (0.6 * w2 + 0.3 * w3));
    vec3 rf = reflect(rd, n), up = down(0.0) * 2.5 + vec3(0.10, 0.11, 0.16) * uL, dn = down(p.y) * vec3(0.06, 0.37, 0.58);
    float fr = 0.2 + 0.8 * pow(1.0 - abs(dot(rd, n)), 2.0), gl = pow(max(w2 + w3 + 0.35, 0.0), 6.0), bub = pow(vn(vec3(th * 18.0, p.y * 30.0 - uT * 6.0, 3.0)).x, 14.0);
    return mix(dn * 1.6 + up * 0.1, mix(dn * 0.8, up * 1.4, smoothstep(-0.3, 0.6, rf.y)), fr) + up * (3.0 * gl * fr + 6.0 * bub);
  }
  float dl = 1.0 - smoothstep(4.0, 18.0, length(p - uCam)); vec3 alb;   // dl：近了才画的细节（远了糊成一片会闪）
  if (logs(p, hb) < 0.03) {   // 沉木：朝上的那面长了一层青苔
    alb = vec3(0.075, 0.052, 0.035) * (0.5 + vn(vec3(p.xz * 6.0, p.y * 1.5)).x);
    alb = mix(alb, vec3(0.05, 0.11, 0.03) * (0.6 + 0.8 * vn(p * 60.0).z), smoothstep(0.15, 0.6, n.y) * smoothstep(0.35, 0.6, vn(p * 9.0).x + 0.25 * vn(p * 37.0).y));
  } else {
    float rk = smoothstep(0.15, 0.5, pow(vn(vec3(p.xz * 0.3, 4.1)).x, 3.0));   // 长了青苔的石头
    alb = mix(vec3(0.30, 0.27, 0.20), vec3(0.09, 0.11, 0.08), rk) * (0.6 + 0.8 * vn(vec3(p.xz * 3.0, 0.0)).x);
    float an = 0.6 + 1.2 * vn(vec3(p.xz * 0.06, 2.0)).x, ph = dot(p.xz, vec2(cos(an), sin(an))) * 52.0 + 9.0 * vn(vec3(p.xz * 0.35, 7.0)).y, sa = (1.0 - rk) * dl;   // 沙纹：一道道细棱，波长约 12 厘米，方向慢慢变
    n = normalize(n - vec3(cos(an), 0.0, sin(an)) * (cos(ph) + 0.5 * cos(2.0 * ph)) * 0.5 * sa); alb *= mix(1.0, 0.65 + 0.5 * smoothstep(-0.5, 0.7, sin(ph)), sa);   // 波谷里积着细的暗泥
    vec2 q = p.xz / 0.18, ci = floor(q); float pm = 0.8 * smoothstep(0.55, 0.75, vn(vec3(p.xz * 0.12, 9.0)).x + 0.4 * rk) * dl;   // 卵石：一片一片的，圆顶，灰白褐不一
    for (int k = 0; k < 9; k++) {
      vec2 cc = ci + vec2(float(k % 3 - 1), float(k / 3 - 1)); ivec3 cs = ivec3(ivec2(cc) + 8192, 11);
      float h1 = h01(uvec3(cs)), h2 = h01(uvec3(cs + ivec3(0, 0, 1))), h3 = h01(uvec3(cs + ivec3(0, 0, 2))); vec2 dq = q - cc - 0.2 - 0.6 * vec2(h1, h2); float rr = 0.12 + 0.38 * h3 * h3, ea = h2 * 9.0; dq = vec2(dot(dq, vec2(cos(ea), sin(ea))), dot(dq, vec2(-sin(ea), cos(ea))) / (0.55 + 0.45 * h1));   // 扁长的，转个随机的方向
      if (h3 < pm && dot(dq, dq) < rr * rr) { n = normalize(n + vec3(dq.x, 0.0, dq.y) / rr * 0.45); alb = mix(mix(vec3(0.12, 0.11, 0.10), vec3(0.36, 0.35, 0.32), h1), vec3(0.42, 0.30, 0.18), step(0.7, h2)) * (0.75 + 0.5 * h3) * (0.8 + 0.2 * vn(vec3(p.xz * 40.0, h3 * 9.0)).x); }
    }
    vec2 lq = p.xz / 0.5, li = floor(lq); float lm = smoothstep(0.35, 0.6, vn(vec3(p.xz * 0.2, 3.0)).y) * dl;   // 落叶：零零星星，褐色，两头尖，中间一条叶脉
    for (int k = 0; k < 9; k++) {
      vec2 cc = li + vec2(float(k % 3 - 1), float(k / 3 - 1)); ivec3 cs = ivec3(ivec2(cc) + 8192, 21);
      float h1 = h01(uvec3(cs)), h2 = h01(uvec3(cs + ivec3(0, 0, 1))), h3 = h01(uvec3(cs + ivec3(0, 0, 2))), a = h1 * 31.0, Lh = 0.04 + 0.03 * h2;
      vec2 d = (lq - cc - 0.5 - 0.3 * vec2(h2 - 0.5, h3 - 0.5)) * 0.5, lw = vec2(dot(d, vec2(cos(a), sin(a))), dot(d, vec2(-sin(a), cos(a))));
      if (h3 < 0.5 * lm && abs(lw.x) < Lh && abs(lw.y) < 0.45 * Lh * (1.0 - lw.x * lw.x / (Lh * Lh))) alb = mix(vec3(0.34, 0.15, 0.04), vec3(0.42, 0.24, 0.07), h2) * (abs(lw.y) < 0.002 ? 0.6 : 1.0) * (0.85 + 0.3 * vn(vec3(lw * 90.0, h1 * 9.0)).x);
    }
  }
  float ls = max(dot(n, normalize(vec3(-0.22, 1.0, -0.10))), 0.0);   // 光顺着光柱斜着照下来
  return alb * down(p.y) * (0.3 + 0.7 * ls) * (0.3 + 1.9 * caus(p.xz) * ls * ls) * 3.0;
}

vec3 surface(vec3 S, vec3 rd) {   // 从下面看水面
  vec2 g = (vn(vec3(S.xz * 0.6 + uT * 0.10, uT * 0.2)).xy - 0.5) * (0.12 + 0.5 * uRough) + (vn(vec3(S.xz * 1.9, uT * 0.35)).zw - 0.5) * 0.08 * (1.0 + uRough);
  float se = uDyeT - 0.12, rs = length(S.xz - DYE), xs = rs - 0.9 * se; vec2 gd = se > 0.0 && se < 3.0 ? (S.xz - DYE) / max(rs, 1e-3) * (0.35 * sin(xs * 22.0) * exp(-xs * xs / 0.05) * exp(-1.2 * se) + 1.5 * rs * exp(-rs * rs / 0.03) * exp(-10.0 * se)) : vec2(0.0); g += gd;   // 那一滴血砸进水面：先凹一下，再荡开一圈
  vec3 n = normalize(vec3(g.x, -1.0, g.y)), tr = refract(rd, n, 1.33), amb = down(-1.5) * vec3(0.10, 0.36, 0.42);
  if (dot(tr, tr) < 0.5) return amb * 0.8 * (1.0 + 3.0 * dot(gd, normalize(rd.xz + 1e-5)));                       // 圈外：全反射，看到的是水下自己（入水荡开的那圈让它明暗起伏）
  float cl = fbm(vec3(tr.xz / (tr.y + 0.15) * 0.6, uT * 0.02), 4), el = asin(clamp(tr.y, 0.0, 1.0)), az = atan(tr.z, tr.x);
  float fs = smoothstep(0.1, 0.9, dot(normalize(tr.xz + 1e-5), vec2(0.738, -0.674)));                                  // 山火那一面
  vec3 sq = tr * 140.0, si = floor(sq); float sh = h01(uvec3(ivec3(si) + 1024));
  vec3 c = vec3(0.016, 0.024, 0.050) * (0.5 + 0.8 * tr.y) + vec3(0.07, 0.085, 0.13) * smoothstep(0.45, 0.72, cl) + vec3(0.8, 0.85, 1.0) * step(0.985, sh) * (1.0 - smoothstep(0.05, 0.3, length(sq - si - 0.5))) * 0.6   // 圈里：月光下的夜空、云、星
    + vec3(0.14, 0.155, 0.24) * uL * (0.05 + 1.0 * smoothstep(0.42, 0.72, cl) * smoothstep(0.42, 0.72, cl))   // 圈里：夜空，云里的雷
    + vec3(1.0, 0.36, 0.08) * uWarm * 0.35 * fs * exp(-el * 6.0)
    + vec3(1.0, 0.55, 0.16) * uEm.w * 0.004 / (1.0 - dot(tr, normalize(uEm.xyz - S)) + 0.003);                           // 火星
  float hz = 0.07 + 0.17 * fbm(vec3(cos(az), sin(az), 0.0) * 2.2 + 3.0, 4);                                             // 围着湖的山：从水下看，被压在窗口边上一圈
  vec3 mt = vec3(0.004, 0.005, 0.010) + vec3(1.0, 0.30, 0.05) * uWarm * 1.4 * fs * exp(-max(el - 0.015, 0.0) / 0.02) * (0.6 + 0.8 * vn(vec3(az * 30.0, uT * 2.0, 1.0)).x);   // 山是黑剪影，着火那一面山脚一线橙红
  c = mix(mt, c, smoothstep(hz - 0.006, hz + 0.006, el));
  return mix(c, amb * 0.8, pow(1.0 - tr.y, 14.0)) + vec3(0.35, 0.55, 0.6) * uLit * 6.0 * exp(-tr.y * tr.y / 0.0006);   // 窗口的边清楚，边上一圈亮
}


void main() {
  vec3 rd = normalize(uFwd + vP.x * uAspect * uTanH * uRight + vP.y * uTanH * uUp), ro = uCam, col, p;
  float jit = h01(uvec3(gl_FragCoord.xy, 7.0)), ts = rd.y > 1e-4 ? -ro.y / rd.y : 1e5, tm = min(ts, 60.0), t = 0.02, d = 1.0;
  for (int i = 0; i < 72; i++) { p = ro + rd * t; d = map(p); if (d < 0.002 + 0.002 * t || t > tm) break; t += d; }
  if (t <= tm && d < 0.01 + 0.004 * t) col = solid(p, rd);
  else if (ts < 60.0) { t = ts; col = surface(ro + rd * ts, rd); }
  else { t = 60.0; col = vec3(0.0); }
  vec3 T = vec3(1.0), acc = vec3(0.0); float dt = t / 20.0;   // 水本身：越远越蓝越暗，光柱照亮水里的微粒
  for (int i = 0; i < 20; i++) { float s = (float(i) + jit) * dt; vec3 q = ro + rd * s; acc += T * down(q.y) * (vec3(0.010, 0.026, 0.032) + vec3(0.045, 0.055, 0.065) * shafts(q) * mix(1.0, smoothstep(0.5, 3.5, s), smoothstep(0.0, 1.0, uFlow))) * dt; T *= exp(-SIG * dt); }   // 「风起」以后镜头身边 3 米内的光柱不算（审片：60.9 秒镜头被冲着横穿一束光柱，整屏一亮）；下潜那段照旧，穿过光柱就是它在动
  col = col * T + acc;
  gl_FragColor = vec4(col, 1.0);
  gl_FragDepth = t >= 59.9 ? 1.0 : clamp(1.0000167 - 0.05000083 / (t * dot(rd, uFwd)), 0.0, 1.0);   // 写深度，水草和粒子才会被石头、气芯挡住
}`;

// ---------- 建一次 ----------
W.build = (M) => {
  THREE = JZ.THREE; K = JZ.kit;
  const rnd = M.rng(4471), R1 = () => rnd() * 2 - 1;
  T = []; for (let n = 9; n <= 17; n++) T[n] = M.ref('bar' + n);
  kicks = M.song.kicks.filter(k => k.t > T[9] - 0.05 && k.t < T[17] - 0.05); TR = M.word(10, '红'); TW = M.word(11, '风');
  // bar11 那颗气泡：镜头退出来的时候一直正对着它；T[11] + 0.95 退到 1.6 米，正好是原来那个机位
  HF = [-0.8, 3.7, -6]; const hl = Math.hypot(...HF); HF = HF.map(v => v / hl);
  HB = { x: 0.8 + HF[0] * 1.6, z: 4.0 + HF[2] * 1.6, sd: 0.37, sp: 0.5, sz: 0.07, tb: T[11] - 1.5 };
  HB.y = -4.2 + HF[1] * 1.6 - HB.sp * 2.45 * (1 + 0.3 * 2.45);
  hb = (t) => { const u = t - HB.tb, y = HB.y + HB.sp * u * (1 + 0.3 * u); return [HB.x + Math.sin(y * 5 + HB.sd * 50) * 0.04, y, HB.z + Math.cos(y * 4.3 + HB.sd * 33) * 0.04]; };
  const U = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
  const BA = (a, k) => new THREE.BufferAttribute(a, k), IA = (a, k) => new THREE.InstancedBufferAttribute(a, k);
  const add = { blending: THREE.AdditiveBlending, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide };
  const quad = (v) => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', BA(new Float32Array(v), 3)); g.setIndex([0, 1, 2, 2, 1, 3]); return g; };
  sc = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 3000);
  const com = U({ uNoise: JZ.noise, uT: 0, uFlow: 0, uSpin: 0, uVx: 0, uShaft: 0, uLit: new THREE.Vector3(), uPx: JZ.px, uRes: JZ.res });   // 全屏和粒子共用的参数
  sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthFunc: THREE.AlwaysDepth, vertexShader: VERT, fragmentShader: JZ.GLSL + 'uniform float uT;' + WATER + DEEP_F, uniforms: { ...com, ...U({
    uCam: new THREE.Vector3(), uFwd: new THREE.Vector3(), uRight: new THREE.Vector3(), uUp: new THREE.Vector3(), uEm: new THREE.Vector4(0, 0.12, 0, 1), uTanH: 1, uAspect: 16 / 9, uL: 0, uWarm: 1, uRough: 0, uDyeT: 0 }) } }));
  sky.frustumCulled = false; sky.renderOrder = -1; sc.add(sky);
  parts = [];
  const put = (g, n, v, f, uni, opt) => { g.instanceCount = n; const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ ...add, ...opt, vertexShader: v, fragmentShader: f, uniforms: { ...com, ...U(uni || {}) } })); m.frustumCulled = false; m.renderOrder = 2; sc.add(m); parts.push(m); return m; };
  const box = () => [-15 + 45 * rnd(), -9 * rnd(), -20 + 35 * rnd()];   // 镜头会经过的那一片水

  // 悬浮的碎屑：不动的时候是一个个小点，水流起来按速度拖尾巴
  const nd = 16000, da = new Float32Array(nd * 4); for (let i = 0; i < nd; i++) da.set([...box(), rnd()], i * 4);
  const dg = quad([1, 0, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0]); dg.setAttribute('iA', IA(da, 4));
  put(dg, nd, JZ.GLSL + K.RIBBON + WATER + `
attribute vec4 iA; uniform float uFlowP, uSpinP; uniform vec3 uLit; varying float vS, vE; varying vec3 vC;
vec3 where(float fl, float sp, float t) {
  vec3 p = iA.xyz + vec3(sin(t * 0.31 + iA.w * 40.0), 0.5 * sin(t * 0.23 + iA.w * 17.0), cos(t * 0.27 + iA.w * 31.0)) * 0.25;
  p.x = mod(p.x + fl * (0.7 + 0.6 * fract(iA.w * 7.3)) + 15.0, 45.0) - 15.0;   // 被水流带出这片水的，从另一头回来
  return swirl(p, sp);
}
void main() {
  float thin; vS = position.x; vE = position.y;
  vec3 b = where(uFlow, uSpin, uT), a = where(uFlowP, uSpinP, uT - 0.06); if (abs(b.x - a.x) > 20.0) a = b;
  float fl = step(fract(iA.w * 17.3), 0.1), w = mix(0.003 + 0.012 * pow(fract(iA.w * 53.1), 3.0), 0.03 + 0.04 * fract(iA.w * 29.7), fl);   // 大小不一的颗粒；一成是絮状的一小团（大、淡、软）
  gl_Position = position.y > 0.5 ? ribbon(b, a, position.x, 1.0, w, 2.0, thin) : ribbon(a, b, position.x, 0.0, w, 2.0, thin);
  float gl = pow(0.5 + 0.5 * sin(uT * (2.0 + 5.0 * fract(iA.w * 3.3)) + iA.w * 40.0), 16.0);   // 扁的碎片转到对着光的那一下
  mat4 vp = projectionMatrix * viewMatrix * modelMatrix; vec4 qa = vp * vec4(a, 1.0), qb = vp * vec4(b, 1.0); float sl = length(qb.xy / max(qb.w, 0.2) - qa.xy / max(qa.w, 0.2)) * 0.5 * uRes.y;
  float ec = clamp(14.0 * uPx / max(sl, 1e-3), 0.15, 1.0) * smoothstep(0.4, 2.5, qb.w);   // 审片：60.9、61.7 秒水流里贴着镜头的碎屑拖成很长的白线、白团，整屏一亮——拖尾越长越暗、贴着镜头的淡掉
  vC = vec3(0.75, 0.85, 0.85) * uLit * (1.0 + 1.5 * smoothstep(0.0, 3.0, uFlow)) * exp(b.y * ATT) * exp(-gl_Position.w * 0.09) * (0.5 + fract(iA.w * 91.0)) * mix(0.5, 1.0, thin) * 2.5 * smoothstep(0.1, 0.6, gl_Position.w)
     * mix((0.35 + 0.3 * shafts(b) * (1.0 + 3.0 * gl)) * 1.3, 0.3, fl) * ec;   // 被光柱照到的亮，扁的碎片在光柱里闪一下
}`, `varying float vS, vE; varying vec3 vC; void main() { gl_FragColor = vec4(vC * exp(-vS * vS * 4.0) * smoothstep(0.0, 0.3, vE) * (1.0 - smoothstep(0.7, 1.0, vE)), 1.0); }`, { uFlowP: 0, uSpinP: 0 });

  // 那一滴血：深红的圆珠砸进水里，0.3 秒内压扁卷成涡环；之后是一棵细线画的墨水树（INK）。正常混合：浓的地方压暗，深红近黑；薄的地方透出朱红；管子朝上那面被照亮
  const TE = T[13] + 0.12, tk = new THREE.Vector4(TE, TR, 1e4, 0), ia = [], ib = [];
  const rings = [], ring = (L, i) => rings.push(L, i, 0, 0);   // 环：一个圆环面网格（见下面）
  const strand = (L, i, ph, nSeg, hw, k) => { const w = hw * (0.5 + rnd()), d = k * (0.7 + 0.6 * rnd()); for (let j = 0; j < nSeg; j++) { ia.push(L, i, ph, -1); ib.push(j / nSeg, (j + 1) / nSeg, w, d); } };   // 粗细浓淡不一
  ring(0, 0); for (let k = 0; k < 5; k++) strand(3, 0, k * 1.26 + 0.3 * rnd(), 36, 0.0045, 0.5);   // 第 0 级的环、身后那几根细尾巴
  for (let i = 0; i < 6; i++) { ring(1, i); for (let k = 0; k < 18; k++) strand(1, i, (k + 0.6 * rnd()) / 18 * M.TAU, 36, k % 3 ? 0.0022 : 0.0045, k % 3 ? 0.3 : 0.5); }   // 每个环 18 缕：粗的一缕夹两缕发丝细的
  const ig = quad([1, 0, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0]); ig.setAttribute('iA', IA(new Float32Array(ia), 4)); ig.setAttribute('iB', IA(new Float32Array(ib), 4));
  put(ig, ia.length / 4, JZ.GLSL + K.RIBBON + WATER + INK + `
attribute vec4 iA, iB; uniform vec3 uLit; varying float vS, vA; varying vec3 vC;   // iA：哪一级（1、2；3 是第 0 级身后的细尾巴）、第几个环、这根丝在环上的角度；iB：这一段的起止、半宽、浓淡
void main() {
  float thin, L = iA.x, tb = tbK(L, iA.y), ag = 0.0; vS = position.x; vA = 0.0; vC = vec3(0.0);
  if (uT < tb + 0.02) { ${K.HIDE} return; }
  vec3 a, b; float t0 = mix(tb, uT, iB.x), t1 = mix(tb, uT, iB.y);
  if (L > 2.5) { vec3 o = vec3(cos(iA.z), 0.0, sin(iA.z)) * 0.012; a = inkMove(C0(t0) + o + vec3(0.0, 0.25, 0.0) * (1.0 - iB.x), uT - t0); b = inkMove(C0(t1) + o + vec3(0.0, 0.25, 0.0) * (1.0 - iB.y), uT - t1); ag = uT - t1; }   // 细尾巴：涡环沉下去时身后拖着的那一根，连着水面
  else { a = inkMove(inkP(L, iA.y, iA.z, 0.0, t0), uT - t0); b = inkMove(inkP(L, iA.y, iA.z, 0.0, t1), uT - t1); ag = uT - t1; }   // 细丝：这个环上的一点从出生到现在走过的路
  gl_Position = position.y > 0.5 ? ribbon(b, a, position.x, 1.0, iB.z, 1.5, thin) : ribbon(a, b, position.x, 0.0, iB.z, 1.5, thin);
  float dn = iB.w * (L < 0.5 && uT > uTk.y ? 0.3 + 0.7 * exp(-(uT - uTk.y) * 0.8) : 1.0) * (L > 0.5 && L < 1.5 && uT > t2(iA.y) ? 0.3 + 0.7 * exp(-(uT - t2(iA.y)) * 0.8) : 1.0);   // 分裂以后上一级化开、变淡
  vA = dn * mix(0.35, 1.0, thin) * smoothstep(0.1, 0.5, gl_Position.w) * smoothstep(0.0, 0.15, uT - tb);
  vC = mix(vec3(0.95, 0.20, 0.06), vec3(0.22, 0.01, 0.008), dn) * uLit * exp(min(b.y, 0.0) * ATT) * 6.0;   // 浓的深红近黑，薄的透出朱红
}`, `varying float vS, vA; varying vec3 vC; void main() { gl_FragColor = vec4(vC, vA * exp(-vS * vS * 3.0)); }`, { uTk: tk }, { blending: THREE.NormalBlending });
  const tg = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, 48, 8)); tg.setAttribute('iA', IA(new Float32Array(rings), 4));
  put(tg, rings.length / 4, JZ.GLSL + 'uniform float uT;' + WATER + INK + `
attribute vec4 iA; uniform vec3 uLit; varying vec3 vC; varying vec2 vQ; varying float vA, vTh, vAg;   // iA：哪一级、第几个环
void main() {   // 涡环：一根实心的染料管子绕成的环。网格的两个方向就是绕着环、绕着管子截面
  float L = iA.x, tb = tbK(L, iA.y), ph = (position.x + 0.5) * 6.2832, ps = (position.y + 0.5) * 6.2832; vC = vec3(0.0); vA = 0.0; vTh = 0.0; vAg = 0.0; vQ = vec2(ph, ps);
  if (uT < tb + 0.02) { ${K.HIDE} return; }
  vec3 p = inkMove(inkP(L, iA.y, ph, ps, uT), 0.0), n = normalize(p - inkMove(inkP(L, iA.y, ph, ps + 3.1416, uT), 0.0));   // 截面上对面那一点：两点连线就是这里的法线方向
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  float dn = (L < 0.5 ? 0.9 : L < 1.5 ? 0.8 : 0.65) * (L < 0.5 && uT > uTk.y ? 0.3 + 0.7 * exp(-(uT - uTk.y) * 0.8) : 1.0) * (L > 0.5 && L < 1.5 && uT > t2(iA.y) ? 0.3 + 0.7 * exp(-(uT - t2(iA.y)) * 0.8) : 1.0);   // 分裂以后上一级化开、变淡
  float th = abs(dot(n, normalize(cameraPosition - p)));   // 正对着看管子最厚：最浓、最暗；边上薄、软，透出朱红
  vA = dn * (0.55 + 0.45 * th) * smoothstep(0.0, 0.15, uT - tb) * smoothstep(0.1, 0.5, gl_Position.w); vTh = th; vAg = min((uT - tb) / 2.5, 1.0);
  vC = mix(mix(vec3(0.95, 0.22, 0.06), vec3(0.16, 0.008, 0.006), smoothstep(0.0, 0.35, th) * dn), vec3(0.95, 0.22, 0.06), 0.25 * max(n.y, 0.0)) * uLit * exp(min(p.y, 0.0) * ATT) * 6.0;   // 厚处深红近黑，朝上那面被照到透出朱红
}`, `varying vec3 vC; varying vec2 vQ; varying float vA, vTh, vAg;
void main() { float st = 0.5 + 0.5 * sin(vQ.y * 2.0 + vQ.x * 24.0), sf = 0.5 + 0.5 * sin(vQ.y * 3.0 - vQ.x * 61.0 + 2.0 * sin(vQ.x * 7.0)); st = mix(st, sf, 0.4);   // 两层螺纹：粗的卷、细的丝
  gl_FragColor = vec4(vC * (0.85 + 0.3 * st), vA * smoothstep(0.0, 0.3 + 0.3 * vAg, vTh) * (0.84 + 0.16 * st) * (1.0 - 0.35 * vAg)); }`, { uTk: tk }, { blending: THREE.NormalBlending });   // 轮廓收紧成一圈清楚的边；管子上绕着芯一层层卷进去的细螺纹
  const vg = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, 32, 16)); vg.setAttribute('iA', IA(new Float32Array(rings.filter((_, k) => k >= 4)), 4));
  put(vg, rings.length / 4 - 1, JZ.GLSL + 'uniform float uT;' + WATER + INK + `
attribute vec4 iA; uniform vec3 uLit; varying vec3 vC; varying vec2 vQ; varying float vA;   // iA：哪一级（1、2）、第几个环
void main() {   // 薄幕：子环从上一级拖下来的那一层（环走过的路扫出的漏斗面），网格横着绕环一圈、竖着从出生到现在
  float L = iA.x, tb = tbK(L, iA.y), ph = (position.x + 0.5) * 6.2832, f = position.y + 0.5, tau = mix(tb, uT, f); vC = vec3(0.0); vA = 0.0; vQ = vec2(ph, f);
  if (uT < tb + 0.05) { ${K.HIDE} return; }
  vec3 p = inkMove(inkP(L, iA.y, ph, 1.5708 - 2.5 * tau, tau), uT - tau);   // 管子靠后（朝上）那一侧拖下来
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vA = 0.16 * smoothstep(0.0, 0.15, f) * (1.0 - 0.6 * smoothstep(0.7, 1.0, f)) * smoothstep(0.1, 0.5, gl_Position.w) * smoothstep(0.0, 0.3, uT - tb) * (L > 1.5 ? 0.8 : 1.0);
  vC = vec3(0.55, 0.05, 0.03) * uLit * exp(min(p.y, 0.0) * ATT) * 6.0;
}`, JZ.GLSL + `varying vec3 vC; varying vec2 vQ; varying float vA;
void main() { float s = smoothstep(0.3, 0.75, 0.55 * vn(vec3(vQ.x * 5.0, vQ.y * 1.2, 3.0)).x + 0.3 * vn(vec3(vQ.x * 17.0, vQ.y * 3.0, 9.0)).y + 0.15 * vn(vec3(vQ.x * 45.0, vQ.y * 7.0, 5.0)).z); gl_FragColor = vec4(vC, vA * (0.12 + 0.88 * s)); }`, { uTk: tk }, { blending: THREE.NormalBlending });   // 被扯开成一缕一缕的
  const bdg = quad([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]); bdg.setAttribute('iA', IA(new Float32Array(4), 4));
  put(bdg, 1, JZ.GLSL + 'uniform float uT;' + WATER + INK + `
attribute vec4 iA; uniform vec3 uLit; varying vec2 vU; varying float vA; varying vec3 vL;
void main() {   // 入水的那颗圆珠：沉下去压扁、摊开，0.3 秒卷成涡环
  float s = uT - uTk.x, k = smoothstep(0.1, 0.35, s); vU = position.xy; vA = 0.0; vL = vec3(0.0);
  if (s < 0.0 || s > 0.35) { ${K.HIDE} return; }
  vec3 c = inkMove(C0(uT) + vec3(0.0, 0.05, 0.0), 0.0); vec4 mv = viewMatrix * vec4(c, 1.0); mv.xy += position.xy * 0.14 * vec2(1.0 + 0.6 * k, 1.0 - 0.5 * k);
  gl_Position = projectionMatrix * mv; vA = 1.0 - smoothstep(0.15, 0.35, s); vL = uLit * exp(min(c.y, 0.0) * ATT) * 6.0;
}`, `varying vec2 vU; varying float vA; varying vec3 vL;
void main() { float r2 = dot(vU, vU); if (r2 > 1.0) discard; vec3 n = vec3(vU, sqrt(1.0 - r2));
  vec3 c = vec3(0.30, 0.012, 0.008) * vL * (0.4 + 0.6 * max(n.y, 0.0)) + vL * 2.5 * pow(max(dot(n, normalize(vec3(-0.3, 0.8, 0.5))), 0.0), 40.0) + vec3(0.9, 0.2, 0.06) * vL * 0.3 * pow(1.0 - n.z, 3.0);   // 深红的圆珠：顶上一个高光，边上透一圈朱红
  gl_FragColor = vec4(c, vA * (1.0 - smoothstep(0.9, 1.0, r2))); }`, { uTk: tk }, { blending: THREE.NormalBlending });

  // 气泡：真的球（水里的空气泡）。边上一圈全反射像水银：上半圈映着头顶的光、下半圈映着黑的湖底；顶上一个高光；中间透明，透过去是缩小的、正着的景（空气泡是发散透镜）
  // 大的上升时扁、会晃、表面会抖；小的从湖底的气口成串冒上来；越大浮得越快。平时零零星星从湖底往上浮；镜头扎进水里那一下带下来一团
  const bl = []; for (let i = 0; i < 2500; i++) bl.push([...box(), rnd(), 0, 0.012 + 0.04 * rnd() ** 2, -1, 0]);
  for (let i = 0; i < 500; i++) bl.push([-2.2 + R1() * 0.6, -0.3 - 1.8 * rnd(), 2.0 + R1() * 0.6, rnd(), 0.6 + 1.4 * rnd(), 0.01 + 0.05 * rnd() ** 2, T[9] - 0.1 + 0.4 * rnd(), 0]);
  for (let v = 0; v < 16; v++) { const [x, , z] = box(), sd = rnd(), r = 0.004 + 0.004 * rnd(); for (let k = 0; k < 150; k++) bl.push([x, -9 + k * 0.06, z, sd, 0, r * (0.7 + 0.6 * rnd()), -1, 1]); }   // 成串的：一个气口一串，走同一条弯弯曲曲的路
  bl.push([HB.x, HB.y, HB.z, HB.sd, HB.sp, HB.sz, HB.tb, 2]);   // bar27 那颗（iB.w = 2：圆的，按成串的那样随高度晃，hb() 和它一致）
  const ba = new Float32Array(bl.length * 4), bb = new Float32Array(bl.length * 4); bl.forEach((q, i) => { ba.set(q.slice(0, 4), i * 4); bb.set(q.slice(4), i * 4); });
  const bg = quad([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]); bg.setAttribute('iA', IA(ba, 4)); bg.setAttribute('iB', IA(bb, 4));
  put(bg, bl.length, JZ.GLSL + 'uniform float uT;' + WATER + `
attribute vec4 iA, iB; uniform vec3 uLit; uniform vec2 uRes; varying vec2 vU; varying vec3 vC, vUp; varying float vJ, vA;   // iA：起点和种子；iB：上浮速度（0 = 按大小算）、半径、出生时刻（负的是一直在的，循环着从湖底浮到水面）、成串的是 1
void main() {
  float u = uT - iB.z, sz = iB.y, big = iB.w > 1.5 ? 0.0 : smoothstep(0.02, 0.05, sz), sp = iB.x > 0.0 ? iB.x : (0.12 + 6.0 * sz) * (0.85 + 0.3 * fract(iA.w * 7.1));   // 越大浮得越快
  vU = position.xy; vC = vec3(0.0); vUp = vec3(0.0, 1.0, 0.0); vJ = 0.0; vA = 0.0; vec3 p = iA.xyz;
  p.y = iB.z < 0.0 ? mod(p.y + sp * uT, 9.0) - 9.0 : p.y + sp * u * (1.0 + 0.3 * u);
  if ((iB.z >= 0.0 && u < 0.0) || p.y > -0.03) { ${K.HIDE} return; }
  p.xz += iB.w > 0.5 ? vec2(sin(p.y * 5.0 + iA.w * 50.0), cos(p.y * 4.3 + iA.w * 33.0)) * 0.04 : vec2(sin(uT * 2.1 + iA.w * 50.0), cos(uT * 1.7 + iA.w * 33.0)) * 0.05;   // 成串的走同一条路；单个的各晃各的
  if (iB.z < 0.0) p.x = mod(p.x + uFlow * 0.8 + 15.0, 45.0) - 15.0;
  vec4 c = projectionMatrix * viewMatrix * vec4(swirl(p, uSpin), 1.0); if (c.w < 0.08) { ${K.HIDE} return; }
  float wb = sin(uT * 13.0 + iA.w * 40.0), an = 0.35 * big * sin(uT * 7.0 + iA.w * 21.0), ca = cos(an), sa = sin(an);   // 大的：扁、一胀一缩、左右歪
  vec2 q = vec2(position.x * (1.0 + 0.08 * big * wb), position.y * (1.0 - 0.32 * big - 0.08 * big * wb)); q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
  c.xy += q * sz * projectionMatrix[1][1] / vec2(uRes.x / uRes.y, 1.0); gl_Position = c;
  vUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); vJ = big; vC = uLit * exp(p.y * ATT) * 4.0; vA = exp(-c.w * 0.08) * smoothstep(0.08, 0.3, c.w);
}`, `uniform float uT; varying vec2 vU; varying vec3 vC, vUp; varying float vJ, vA;
vec3 env(vec3 d) { return vC * mix(vec3(0.03, 0.08, 0.10), vec3(0.75, 0.92, 1.0), smoothstep(-0.35, 0.85, dot(d, vUp))); }   // 四周的光：头顶亮，湖底黑
void main() {
  float r2 = dot(vU, vU); if (r2 > 1.0) discard;
  vec3 n = normalize(vec3(vU + vJ * 0.12 * vec2(sin(vU.y * 7.0 + uT * 23.0), cos(vU.x * 6.0 - uT * 19.0)), sqrt(1.0 - r2)));   // 大的表面在抖
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), n); float F = mix(0.04, 1.0, 1.0 - smoothstep(0.6, 0.68, n.z));   // 过了临界角（水到空气约 49°，cos ≈ 0.66）全反射：只在最外面一圈
  vec3 col = mix(env(normalize(vec3(vU * 0.7, -1.0))) * 0.9, env(R) * 1.3, F) + vC * vec3(0.9, 1.0, 1.0) * 3.0 * pow(max(dot(R, vUp), 0.0), 60.0);   // 中间透过去的景；边上映的；顶上映着水面那块亮的
  gl_FragColor = vec4(col, mix(0.18, 0.95, F) * vA * (1.0 - smoothstep(0.85, 1.0, r2)));
}`, {}, { blending: THREE.NormalBlending });   // 下半圈映着黑湖底，比后面的水暗：要正常混合，不能叠加

  // 水草两种：带状的苦草（细长等宽、会扭、边上半透明、叶脉平行）；羽状的狐尾藻（一根细茎，一节节四片一轮的细叶，两片交叉的面画）。
  // 一丛里高矮粗细都不一样；摆动从根往梢传，梢头卷；颜色从根部深褐到梢头黄绿；从下面看，头顶透下来的光穿过叶片，整片发亮。水流起来被压倒
  const wa = [], wb = [], plant = (x, z, H, fe, hw) => { const sd = rnd(); for (const k of fe ? [1, 2] : [0]) { wa.push(x, z, H, sd); wb.push(k, hw, 0, 0); } };
  const clump = (cx, cz, s, fe) => { if (fe) for (let i = 0; i < 6; i++) plant(cx + R1() * 0.45, cz + R1() * 0.45, s * (0.7 + 1.1 * rnd()), true, 0.05 + 0.035 * rnd()); else for (let i = 0; i < 18; i++) plant(cx + R1() * 0.8, cz + R1() * 0.8, s * (0.6 + 1.6 * rnd() ** 1.5), false, 0.005 + 0.006 * rnd()); };
  for (let c = 0; c < 120; c++) clump(-14 + 40 * rnd(), -16 + 30 * rnd(), 0.8 + 1.0 * rnd(), rnd() < 0.3);
  clump(-0.5, 2.0, 2.0, false); clump(2.8, 3.6, 1.6, true); clump(0.6, 1.0, 1.6, false); clump(1.4, 5.6, 1.2, false); clump(-0.8, 4.6, 2.0, false); clump(3.6, 5.2, 1.8, true); for (const z of [6.9, 7.5, 8.1]) { clump(1.55, z, 2.6, false); clump(2.7, z - 0.1, 2.6, false); }   // bar12 转场 B：两道苦草墙，镜头退着从中间穿过去（bar12 小节头在 z ≈ 7.4）   // bar11–12 镜头跟前的几丛：(1.4, 5.6) 在镜头下沉的路线正下方（飞过时离草梢 0.8 米），沉下来以后就在前方 1.3 米
  const wg = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, 1, 32)); wg.setAttribute('iA', IA(new Float32Array(wa), 4)); wg.setAttribute('iB', IA(new Float32Array(wb), 4));
  weeds = put(wg, wa.length / 4, JZ.GLSL + 'uniform float uT;' + WATER + `
attribute vec4 iA, iB; uniform float uBend; uniform vec3 uLit; varying vec3 vN, vL, vW; varying vec2 vQ; varying float vF, vK, vX, vH;   // iA：xz 位置、高、种子；iB：种类（0 苦草；1、2 狐尾藻的两片交叉面）、半宽
vec3 stem(float h) {   // 沿草长 h（0 根、1 梢）的中轴：摆动沿草往上传（根先动、梢后动），梢头往一边卷下去；水流起来被压倒
  float sd = iA.w, H = iA.z, ph = uT * (0.55 + 0.3 * fract(sd * 3.1)) - h * 2.4 + sd * 30.0, c = smoothstep(0.7, 1.0, h) * (iB.x < 0.5 ? 1.0 : 0.3);
  vec2 sw = h * h * H * (vec2(sin(ph), 0.6 * cos(ph * 0.8 + 1.3)) * 0.12 + vec2(uBend * (0.7 + 0.3 * sin(uT * 3.0 + sd * 9.0 + h * 3.0)), 0.0)), cd = normalize(sw + 0.01 * vec2(cos(sd * 40.0), sin(sd * 40.0)));
  return vec3(iA.x + sw.x + cd.x * 0.09 * H * c * c, bed(iA.xy) - 0.05 + H * h * (1.0 - 0.45 * uBend * h) - 0.04 * H * c * c, iA.y + sw.y + cd.y * 0.09 * H * c * c);
}
void main() {
  float h = position.y + 0.5, sd = iA.w, fe = step(0.5, iB.x), an = sd * 6.283 + (iB.x > 1.5 ? 1.5708 : 0.0) + (1.0 - fe) * (1.5 + 3.0 * fract(sd * 5.3)) * sign(fract(sd * 9.1) - 0.5) * h;   // 苦草顺着长度扭
  vec3 wd = vec3(cos(an), 0.0, sin(an)), c = stem(h), tg = normalize(stem(h + 0.02) - stem(h - 0.02));
  float hw = iB.y * (fe > 0.5 ? 1.0 - 0.45 * h : (1.0 - 0.8 * smoothstep(0.88, 1.0, h)) * smoothstep(0.0, 0.04, h + 0.02));   // 苦草等宽、梢头圆；狐尾藻越往梢叶越短
  vec3 p = c + wd * position.x * 2.0 * hw;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vN = normalize(cross(tg, wd)); vQ = vec2(position.x * 2.0, h); vK = iB.x; vX = hw; vH = iA.z; vW = p;
  vF = exp(-gl_Position.w * 0.075); vL = uLit * exp(p.y * ATT) * 5.0 * (0.7 + 0.6 * fract(sd * 7.7));
}`, JZ.GLSL + `uniform float uT; uniform vec3 uLit; varying vec3 vN, vL, vW; varying vec2 vQ; varying float vF, vK, vX, vH;
void main() {
  float u = vQ.x, h = vQ.y, a = 1.0;
  vec3 tint = mix(mix(vec3(0.055, 0.035, 0.015), vec3(0.07, 0.17, 0.04), smoothstep(0.0, 0.3, h)), vec3(0.20, 0.30, 0.06), smoothstep(0.45, 1.0, h));   // 根部深褐、中段绿、梢头黄绿
  if (vK < 0.5) {   // 苦草：几条平行的叶脉（近了才看得见），边上薄、半透明
    float fu = fwidth(u) * 2.0; tint *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.1 + fu, abs(fract(u * 2.0 + 0.5) - 0.5))) * (1.0 - smoothstep(0.15, 0.45, fu));   // 中脉加两侧共几条，十几像素宽也看得见
    tint *= 0.85 + 0.3 * vn(vec3(u * 4.0, h * vH * 6.0, vH * 37.0)).x;   // 沿叶长的细纹，打破一片均匀的绿
    a = 1.0 - 0.75 * smoothstep(0.55, 1.0, abs(u));
  } else {   // 狐尾藻：一根细茎，每 3.5 厘米一轮细叶，往外往上翘，长短不一
    float x = u * vX, y = h * vH, D = 0.035, n0 = floor(y / D), d = abs(x) - 0.0015, fw = fwidth(y) + fwidth(x);
    for (int k = 0; k < 3; k++) { float yn = (n0 - float(k)) * D, L = vX * (0.55 + 0.45 * h01(uvec3(ivec3(int(n0) - k + 4096, 21, int(vH * 997.0))))); if (abs(x) < L) d = min(d, abs(y - yn - 0.55 * abs(x) - 3.0 * x * x) - 0.0009); }
    a = 1.0 - smoothstep(-0.5 * fw, 0.5 * fw, d); tint *= 1.25;
  }
  vec3 vd = vW - cameraPosition; a *= smoothstep(0.25, 0.7, length(vd));   // 贴着镜头的淡掉（镜头擦过叶子不闪）
  if (a < h01(uvec3(gl_FragCoord.xy, floor(uT * 240.0 + 1e5)))) discard;   // 半透明：按透明度丢掉一些像素，超采样、子帧平均下来就是半透明
  vec3 n = normalize(gl_FrontFacing ? vN : -vN);
  vec3 col = tint * vL * (0.2 + 0.6 * max(n.y, 0.0)) + tint * vec3(1.6, 2.0, 0.6) * vL * (0.25 + 1.4 * pow(smoothstep(-0.2, 0.7, normalize(vd).y), 2.0)) * (vK < 0.5 ? 0.6 : 0.5);   // 受光的一面；叶片薄，透过它往亮处（上方）看时整片透亮，平时也透一点水里的散射光
  gl_FragColor = vec4(col * vF + uLit * vec3(0.0075, 0.148, 0.29) * (1.0 - vF), 1.0);   // 远了化进水的颜色里
}`,
    { uBend: 0 }, { blending: THREE.NormalBlending, transparent: false, depthWrite: true });

  // 镜头：整段一条路径。染料落在 (-3, -4)，旋涡在 (16, -6)
  const U0 = [0, 1, 0], V = [16, -6];
  CAM = JZ.path([
    { t: T[9], p: [-2.2, -0.12, 2.0], l: [0.44, -1.94, -0.4], up: U0, fov: 50 },                               // bar9 扎进水里，接着往下沉
    { t: T[9] + 0.45, p: [-1.6, -1.3, 1.5], l: [0.9, -3.4, -1.6], up: U0, fov: 52 },
    { t: T[9] + 1.1, p: [-1.0, -2.3, 1.2], l: [1.2, -4.6, -3.6], up: U0, fov: 56 },                     // #16（第六次）：不抬头看火种，往下沉，看水下的世界：光柱一根根插下来、气泡、湖底的草（新东西）；火种只是头顶一团光
    { t: T[10], p: [-0.5, -3.0, 1.0], l: [1.5, -5.3, -4.2], up: U0, fov: 60 },
    { t: T[11] + 0.95, p: hb(T[11] + 0.95).map((v, i) => v - HF[i] * 1.6), l: hb(T[11] + 0.95), up: U0, fov: 60 },                         // bar11 从气泡里退出来（见 W.draw），接着往深处沉、拉远，看湖底
    { t: T[11] + 1.75, p: [2.0, -7.0, 7.0], l: [-1, -3.0, -6], up: U0, fov: 58 },                        // 沉到草丛中间，稍微仰着：水草衬着上面亮的水，透光
    { t: T[13] - 0.4, p: [3.0, -7.3, 10], l: [-2.5, -4.6, -5], up: U0, fov: 56, v: [-3, 1, 0] },          // 退到头不停：往左上带过去，接着冲向光柱
    { t: T[13], p: [1.6, -4.8, 5.2], l: [-3, -2.0, -4], up: U0, fov: 52 },                  // bar13 推向那束最亮的光柱，染料从里面落下来
    { t: TR, p: [-1.3, -2.0, -1.0], l: [-3, -2.2, -4], up: U0, fov: 48, v: [2.2, -0.6, 0] },                                // 「红」：推近到 3.5 米左右，看得清那一滴卷成的环分成几个
    { t: TW, p: [0.8, -3.2, 1.5], l: [-2.5, -3.2, -4], up: U0, fov: 48 },                  // 「风起」：染料被水流扯着从镜头前扫过，镜头转向下游
    { t: T[15] + 0.6, p: [2.3, -3.3, -0.4], l: [1.1, -2.8, -4.5], up: U0, fov: 54 },                    // 看着被冲到下游、拉成横丝的那一片墨水
    { t: T[16] - 0.35, p: [8.0, -3.6, 0.2], l: [11.5, -3.3, -5.9], up: U0, fov: 56 },                    // 被水流带着往下游漂，视线慢慢从那片横丝转向下游（别离太近：墨幕一下涨满画面会算闪）
    { t: T[16], p: [10.2, -3.5, 0.4], l: [V[0], -2.6, V[1]], up: U0, fov: 60 },                          // bar31→32 A（第六次，原 J 甩镜加翻滚）：顺着水流平移，前方染料卷成了旋涡（新东西）
    { t: T[16] + 0.6, p: [12.2, -3.1, -0.9], l: [V[0], -1.8, V[1]], up: U0, fov: 60 },                    // 到旋涡跟前（离气芯约 6 米）
    { t: T[16] + 1.1, p: [12.6, -2.2, -1.3], l: [V[0], -0.6, V[1]], up: U0, fov: 61 },                    // 沿着气芯直着往上升（不绕）
    { t: T[16] + 1.6, p: [12.8, -1.1, -1.5], l: [V[0], 0.4, V[1]], up: U0, fov: 62 },
    { t: T[17] - 0.02, p: [12.9, -0.08, -1.6], l: [V[0], 1.4, V[1]], up: U0, fov: 64 },                   // 升到水面（之后升出水面是第三段的世界，见 scene.js 的 rise）
  ]);
  // bar10 仰拍水面那一段一直漂到 bar11 后（bar11 前 0.35 秒起它只在气泡里看得见）
  CU = JZ.path([{ t: T[10], p: [-0.5, -3.0, 1.0], l: [1.5, -5.3, -4.2], up: U0, fov: 60 }, { t: T[10] + 0.6, p: [-0.15, -3.35, 0.75], l: [1.7, -5.45, -4.4], up: U0, fov: 61 }, { t: T[11] + 0.95, p: [0.6, -3.9, 0.0], l: [2.3, -5.9, -4.9], up: U0, fov: 62 }]);   // 第六次：气泡里装的是往下看的水下（原来是仰拍水面）
};

// ---------- 每帧 ----------
W.pose = (t, M, C = CAM(Math.max(t, T[9]))) => {   // 摆好这一刻的世界，返回 { sc, cam }；C：另给的机位（转场里同一时刻的另一个镜头）
  cam.fov = C.fov; cam.position.set(...C.p); cam.up.set(...C.up); cam.lookAt(...C.l); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements, u = sky.material.uniforms;
  u.uCam.value.copy(cam.position); u.uRight.value.set(e[0], e[1], e[2]); u.uUp.value.set(e[4], e[5], e[6]); u.uFwd.value.set(-e[8], -e[9], -e[10]); u.uTanH.value = Math.tan(C.fov * Math.PI / 360); u.uT.value = t;
  const L = (1 - M.smooth(T[17] - 0.9, T[17] - 0.5, t)) * kicks.reduce((a, k) => a + (t > k.t ? Math.min(1, k.s / 0.5) * (1 - Math.exp(-(t - k.t) * (k.t < TW ? 4 : 1.8))) * Math.exp(-(t - k.t) * 0.7) : 0), 0);   // 雷：底鼓一下，慢亮慢暗；「风起」以后亮得更慢（镜头被冲着走，再快就算闪，审片 61.6 秒）
  const warm = 0.12 + 0.88 * (1 - M.smooth(T[9] + 0.5, T[11], t)), vx = M.smooth(T[16] - 0.3, T[16] + 0.9, t);                                      // 火星和山火的光：沉下去就淡了
  u.uL.value = L; u.uWarm.value = warm; u.uLit.value.set(...BASE.map((b, i) => b + BOLT[i] * L + WARM[i] * warm));
  u.uFlow.value = 7 * ramp(t - TW, 0.45); u.uSpin.value = 4.5 * ramp(t - T[16] + 0.4, 1.2); u.uVx.value = vx;   // 「风起」一阵急流，半秒内就流起来；bar16 卷成旋涡
  u.uRough.value = 0.15 + 0.85 * M.smooth(TW, TW + 1.5, t) + 0.6 * vx;
  u.uDyeT.value = t - T[13]; u.uShaft.value = M.smooth(T[13] - 1.5, T[13] - 0.3, t);
  parts[0].material.uniforms.uFlowP.value = 7 * ramp(t - 0.06 - TW, 0.45); parts[0].material.uniforms.uSpinP.value = 4.5 * ramp(t - 0.06 - T[16] + 0.4, 1.2);
  weeds.material.uniforms.uBend.value = 0.9 * M.smooth(TW, TW + 0.5, t);
  return { sc, cam };
};
W.draw = (ctx, s, M) => {
  const t = s.t, w0 = T[11] - 0.3, w1 = T[11] + 0.95;
  if (t >= T[10] && t < w0) { const a = W.pose(t, M, CU(t)); return JZ.present(ctx, M, a.sc, a.cam); }
  if (t < w0 || t >= w1) { const a = W.pose(t, M); return JZ.present(ctx, M, a.sc, a.cam); }
  // bar10→11 转场 D（反着的尺度推进）：刚才仰拍的水面原来是一颗气泡里的景。镜头从气泡跟前往后退，气泡缩小，四周露出湖底；退得越来越快，接上往下沉的路线（T[11] + 0.95 退到 1.6 米，就是 CAM 那个机位）
  const x = (t - w0) / (w1 - w0), d = 0.04 + 0.1 * x + 1.46 * x ** 2.5,   // 先慢慢退（圆约 0.4 秒从盖满缩到三分之一，最快那段在小节头），再加速到约 3 米/秒接上路线
    P = hb(t), C = { p: P.map((v, i) => v - HF[i] * d), l: P, up: [0, 1, 0], fov: 60 };
  const r = 0.85 * 0.5 * HB.sz / (d * Math.tan(Math.PI / 6));
  JZ.blend(ctx, M, () => W.pose(t, M, C), () => W.pose(t, M, CU(t)), { c: [0.5, 0.5], r, soft: Math.min(0.02, 0.3 * r), k: 1 - M.smooth(w1 - 0.25, w1, t) });
};
})();
