// jz_land.js —— 第一、三段共用的山和湖盆。地形烤成一张高度图（只烤一次），各个世界的着色器对着它做光线步进；林带是一棵棵针叶树。
(() => {
const JZ = window.JZ;
const BAKE = `
varying vec2 vP;
float hh(vec2 i) { return h01(uvec3(ivec3(ivec2(i) + 32768, 7))); }
vec3 nd(vec2 p) {   // 值噪声和它的坡度
  vec2 i = floor(p), f = p - i, u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hh(i), b = hh(i + vec2(1.0, 0.0)), c = hh(i + vec2(0.0, 1.0)), d = hh(i + vec2(1.0, 1.0));
  return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
}
float height(vec2 x) {   // 侵蚀地形：坡越陡，往上叠的细节越少，自己长出山脊和冲沟；中间压成湖盆（水面 y = 0）
  vec2 p = x / 95.0 + vec2(3.1, 7.7), d = vec2(0.0); float a = 0.0, b = 1.0;
  for (int i = 0; i < 11; i++) { vec3 n = nd(p); d += n.yz; a += b * n.x / (1.0 + dot(d, d)); b *= 0.5; p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.0; }
  return -3.0 + smoothstep(28.0, 170.0, length(x)) * 110.0 * pow(a, 1.3);
}
void main() {
  vec2 x = vP * 400.0; const vec2 e = vec2(0.1, 0.0);
  gl_FragColor = vec4(height(x), (height(x + e.xy) - height(x - e.xy)) / 0.2, (height(x + e.yx) - height(x - e.yx)) / 0.2, 0.6 * nd(x / 70.0 + 9.0).x + 0.3 * nd(x / 31.0 + 5.0).x + 0.1 * nd(x / 13.0).x);
}`;

// 着色器零件（接在 JZ.GLSL 后面）。高度图盖住 ±400，一格约 0.2
JZ.LAND = `
uniform highp sampler2D uLand;
const float TH = 5.0;   // 最高的树多高
vec4 land(vec2 x, float t) { return textureLod(uLand, x / 800.0 + 0.5, log2(max(t * 0.006, 1.0))); }   // r 高度，gb 坡度，a 低频噪声；t：离镜头多远（远了取粗一级，不闪）
float forest(vec4 L) { return (1.0 - smoothstep(30.0, 46.0, L.r + 20.0 * (L.a - 0.5))) * smoothstep(0.15, 0.8, L.r) * (1.0 - smoothstep(0.8, 1.3, length(L.gb))); }   // 林带：水边到半山腰，太陡的地方不长
float treeFade(float t) { return 1.0 - smoothstep(140.0, 260.0, t); }   // 远处不画一棵棵的树
// 一格一棵针叶树：细树干，一层层往下垂的枝，越往上越窄。返回离这棵树表面的水平距离（格子单位，负的在树里）
// hg：离地多高；s：这里的树长到几成高（林线上的、烧过的矮）；bare：枝叶烧掉多少（1 = 只剩树干）
float gPk = 0.0;   // 春天：这一片山坡上几成是桃树（湖这个世界的 bar57 以后才不是 0）
bool peachy(vec3 r) { return gPk > 0.0 && r.z >= 0.18 && fract(r.y * 7.13 + r.x * 3.7) < gPk; }
float fir(vec2 x, float hg, float s, float bare, int sd) {
  vec2 c = floor(x); uint h = h3(uvec3(ivec3(ivec2(c) + 8192, sd)));
  vec3 r = vec3(float(h & 1023u), float((h >> 10) & 1023u), float((h >> 20) & 1023u)) / 1023.0;
  if (peachy(r)) {   // 桃树：矮，一根短树干上一团圆的树冠，边上一瓣瓣地鼓出来
    float yp = hg / (TH * s * (0.42 + 0.3 * r.x)); if (yp > 1.0) return 0.5;
    vec2 o = x - c - 0.5 - (r.xy - 0.5) * 0.34; float e = (yp - 0.66) / 0.32, th = atan(o.y, o.x);   // 树冠宽、扁，边上一瓣瓣鼓出来
    float cr = 0.47 * sqrt(max(1.0 - e * e, 0.0)) * (0.78 + 0.45 * (vn(vec3(x * 2.6, hg * 1.1 + r.z * 9.0)).x - 0.5) + 0.12 * sin(th * 3.0 + r.z * 40.0));
    return length(o) - max(cr, yp < 0.5 ? 0.035 * (1.0 - yp) + 0.012 : 0.0);
  }
  float y = hg / (TH * s * (0.4 + 0.6 * r.x));
  if (r.z < 0.18 || y > 1.0) return 0.5;   // 空格，或者已经在树梢上面
  float tier = 1.0 - fract(y * (4.0 + 3.0 * r.y) + r.z * 7.0);
  return length(x - c - 0.5 - (r.xy - 0.5) * 0.34) - (y < 0.12 ? 0.03 : mix(0.33 * pow(1.0 - y, 0.9) * (0.5 + 0.5 * tier) + 0.012, 0.03 * (1.0 - y) + 0.008, bare));
}
vec4 treeId(vec2 x, float hg, float s) {   // 这一点最近的那棵树：是不是桃树、树干在哪（世界坐标 xz）、种子
  vec2 x1 = x * 0.42, x2 = mat2(0.8, -0.6, 0.6, 0.8) * x * 0.5 + 7.3; bool a = fir(x1, hg, s, 0.0, 1) < fir(x2, hg, s, 0.0, 2);
  vec2 c = floor(a ? x1 : x2); uint h = h3(uvec3(ivec3(ivec2(c) + 8192, a ? 1 : 2)));
  vec3 r = vec3(float(h & 1023u), float((h >> 10) & 1023u), float((h >> 20) & 1023u)) / 1023.0;
  vec2 w = c + 0.5 + (r.xy - 0.5) * 0.34;
  return vec4(peachy(r) ? 1.0 : 0.0, a ? w / 0.42 : transpose(mat2(0.8, -0.6, 0.6, 0.8)) * ((w - 7.3) / 0.5), r.z);
}
float firs(vec2 x, float hg, float s, float bare) { return 2.0 * min(fir(x * 0.42, hg, s, bare, 1), fir(mat2(0.8, -0.6, 0.6, 0.8) * x * 0.5 + 7.3, hg, s, bare, 2)); }   // 两层错开的格子，看不出行列；返回世界单位
`;

let tex;
JZ.land = () => {   // 高度图（第一次用的时候烤）
  if (tex) return tex;
  const THREE = JZ.THREE, rt = new THREE.WebGLRenderTarget(4096, 4096, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const sc = new THREE.Scene(), m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { uNoise: { value: JZ.noise } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`, fragmentShader: JZ.GLSL + BAKE }));
  m.frustumCulled = false; sc.add(m);
  JZ.R.setRenderTarget(rt); JZ.R.render(sc, new THREE.Camera()); JZ.R.setRenderTarget(null);
  return tex = rt.texture;
};
})();
