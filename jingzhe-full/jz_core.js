// jz_core.js —— 全片共用：一个 WebGL 渲染器、噪声贴图、后期（辉光 + 调色）、右下角的歌词火星。
(() => {
const JZ = window.JZ = {};
const QS = new URLSearchParams(location.search), SS = +(QS.get('ss') || (QS.has('render') ? 2 : 1));   // 出图、成片（render.py 带 ?render）2× 超采样（three.md「画质」）；预览默认 1×，播放才跟得上，要看全画质加 &ss=2

// 着色器公用：整数哈希（不用 fract(sin)，换显卡图案也一样）、值噪声、分形噪声
JZ.GLSL = `
uniform highp sampler3D uNoise;
uint h3(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v.x ^ v.y ^ v.z; }
float h01(uvec3 v) { return float(h3(v) >> 8) / 16777216.0; }
vec4 vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return texture(uNoise, (i + f + 0.5) / 64.0); }
float fbm(vec3 p, int oct) { float s = 0.0, a = 0.5; for (int k = 0; k < 6; k++) { if (k >= oct) break; s += a * vn(p).x; p = p * 2.03 + vec3(11.7, 3.1, 7.3); a *= 0.5; } return s; }
`;

JZ.init = async (M) => {
  const THREE = JZ.THREE = await import('three');
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { ShaderPass } = await import('three/addons/postprocessing/ShaderPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  const GL = JZ.GL = document.createElement('canvas'); GL.width = M.W * M.SC * SS; GL.height = M.H * M.SC * SS;
  const R = JZ.R = new THREE.WebGLRenderer({ canvas: GL, antialias: false, preserveDrawingBuffer: true, precision: 'highp', powerPreference: 'high-performance' });
  R.setPixelRatio(1); R.setSize(GL.width, GL.height, false);
  if (R.getContext().drawingBufferWidth !== GL.width) throw new Error(`WebGL 画布开不到 ${GL.width}×${GL.height}，画质会悄悄变低`);
  R.toneMapping = THREE.ACESFilmicToneMapping;   // 画风卡：发光体压在墨黑里，高光要柔着收
  JZ.res = new THREE.Vector2(GL.width, GL.height); JZ.px = GL.height / 1080;   // px：一个 1080p 像素合几个内部像素

  const N = 64, d = new Uint8Array(N * N * N * 4), rnd = M.rng(20261116);
  for (let i = 0; i < d.length; i++) d[i] = rnd() * 256;
  const nz = JZ.noise = new THREE.Data3DTexture(d, N, N, N);
  nz.format = THREE.RGBAFormat; nz.type = THREE.UnsignedByteType; nz.minFilter = nz.magFilter = THREE.LinearFilter;
  nz.wrapS = nz.wrapT = nz.wrapR = THREE.RepeatWrapping; nz.needsUpdate = true;

  const FX = JZ.FX = new EffectComposer(R); FX.setPixelRatio(1); FX.setSize(GL.width, GL.height);
  JZ.pass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); FX.addPass(JZ.pass);
  JZ.mix = new ShaderPass({   // 两个世界合成（JZ.blend 用，平时关着）：圆里、水线下是另一个世界
    uniforms: { tDiffuse: { value: null }, tB: { value: null }, uL: { value: new THREE.Vector4() }, uC: { value: new THREE.Vector4(0.5, 0.5, 9, 0.02) }, uY: { value: new THREE.Vector4(9, 0, 0, 0.01) }, uK: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse, tB; uniform vec4 uC, uY, uL; uniform float uK; varying vec2 vUv;
      void main() {
        float ln = 1.0 - smoothstep(-uY.w, uY.w, vUv.y - uY.x - uY.y * (vUv.x - 0.5) - uY.z * sin(vUv.x * 23.0));
        float m = uK * (1.0 - smoothstep(uC.z - uC.w, uC.z + uC.w, length((vUv - uC.xy) * vec2(16.0 / 9.0, 1.0)))) * ln;
        vec4 a = texture2D(tDiffuse, vUv), b = texture2D(tB, vUv);
        if (uL.x > 0.0) {   // 露珠、雨珠（jz_spring.js 的 lens）：圆里是 B 整个画面缩进去，越往边上压得越扁（凸面镜）；边上一圈暗、一道亮边，左上一点高光。uL = (开, 鱼眼多少, 圆边对着 B 的多高, 珠子的样子多重)
          vec2 d = (vUv - uC.xy) * vec2(16.0 / 9.0, 1.0); float q = min(length(d) / uC.z, 1.0); vec2 e = d / max(length(d), 1e-6), qv = d / uC.z - vec2(-0.36, 0.42);
          float sr = mix(q, tan(q * 1.3) / tan(1.3), uL.y);
          b = texture2D(tB, 0.5 + e * sr * uL.z * vec2(9.0 / 16.0, 1.0)) * (1.0 - 0.55 * uL.w * smoothstep(0.62, 1.0, q)) + vec4(1.0, 0.97, 0.92, 0.0) * uL.w * (1.6 * exp(-dot(qv, qv) / 0.0025) + 0.12 * exp(-pow((q - 0.97) / 0.025, 2.0)));
        }
        gl_FragColor = mix(a, b, m) + (a + b) * 1.5 * ln * (1.0 - ln) * step(uY.x, 8.0);   // 水线上一道亮边
      }`,
  }); JZ.mix.enabled = false; FX.addPass(JZ.mix);
  // 泛光前清掉坏像素：哪个着色器偶尔在某个时刻、某个像素算出 NaN / 无穷大，泛光的多级模糊会把它扩成一大块黑方块（审片：草稿 20.47 秒那一帧左半边一块黑）。换成 0，只是一个看不见的黑点
  FX.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); bool ok = !(any(isnan(c)) || any(isinf(c))) && c.r < 6e4 && c.g < 6e4 && c.b < 6e4 && c.r > -1.0 && c.g > -1.0 && c.b > -1.0; gl_FragColor = ok ? c : vec4(0.0, 0.0, 0.0, 1.0); }` }));
  JZ.bloom = new UnrealBloomPass(new THREE.Vector2(GL.width, GL.height), 0.35, 0.6, 0.9); FX.addPass(JZ.bloom);
  JZ.grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 }, uPx: { value: JZ.px }, uVig: { value: 0.55 }, uGrain: { value: 0.035 }, uToon: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uFrame, uPx, uVig, uGrain, uToon; varying vec2 vUv;
      uint h3(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v.x ^ v.y ^ v.z; }
      void main() {
        vec2 p = vUv - 0.5; float ca = 0.006 * dot(p, p);                                          // 镜头边缘一点色散
        vec3 c = vec3(texture2D(tDiffuse, vUv + p * ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - p * ca).b);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722)), lq = l / (1.0 + l);                     // 国风（后半段）：饱和一点，暗部偏青、亮部偏金；暗角减半、不加颗粒
        c = mix(c, max(l + (c - l) * 1.45, 0.0) * mix(vec3(0.88, 1.0, 1.14), vec3(1.10, 1.0, 0.84), smoothstep(0.04, 0.45, lq)) * 1.2 + vec3(0.006, 0.010, 0.024), uToon);   // 第十次：更艳、亮两成，暗部抬成靛蓝（动画里的夜是发光的蓝，不是死黑）
        c *= 1.0 - uVig * (1.0 - 0.5 * uToon) * smoothstep(0.45, 1.1, length(p * vec2(1.0, 0.9)) * 1.6);                 // 暗角
        c += vec3(0.0010, 0.0013, 0.0034);                                                         // 黑里留一点靛青，不死黑
        float g = float(h3(uvec3(uvec2(gl_FragCoord.xy / uPx), uint(uFrame))) >> 8) / 16777216.0 - 0.5;   // 颗粒：一个成片像素一粒
        c += g * uGrain * (1.0 - uToon) * (0.012 + 0.25 * sqrt(max(dot(c, vec3(0.3, 0.6, 0.1)), 0.0)));
        gl_FragColor = vec4(max(c, 0.0), 1.0);
      }`,
  }); FX.addPass(JZ.grade);
  FX.addPass(new OutputPass());   // 色调映射 + sRGB 输出，放最后
};

// 一个 3D 镜头画完：过后期，贴进 2D 画布
JZ.present = (ctx, M, sc, cam) => {
  JZ.pass.scene = sc; JZ.pass.camera = cam; JZ.grade.uniforms.uToon.value = sc.userData.toon || 0; JZ.grade.uniforms.uFrame.value = Math.round(M.t * 60);
  JZ.FX.render();
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(JZ.GL, 0, 0, M.W, M.H);
};
JZ.todo = () => { };   // 还没做的镜头：只有底色

// 61 秒版的四个世界搬进整首：世界里写的 barN、lineN 是片内的号（片内 bar1 = 整首 bar17，line1 = 整首 line5）。
// 给它们一个换过号的 M：ref、word 加偏移，song 的结尾、鼓点只留这一段（bar17 到 bar48）。其余字段照原来的 M（原型链）。
JZ.seg = (M, bar, line, t0, t1) => {
  const W = Object.create(M), S = M.song;
  W.full = M;   // 要用整首小节号的地方（前奏、A2 是湖这个世界在 bar1–16）
  const f = (a) => a.filter(k => (k.t ?? k) > t0 - 0.05 && (k.t ?? k) < t1);
  W.ref = (r) => M.ref(String(r).replace(/^bar([\d.]+)/, (_, n) => 'bar' + (+n + bar)).replace(/^line(\d+)/, (_, n) => 'line' + (+n + line)));
  W.word = (n, c) => M.word(n + line, c);
  W.song = { ...S, dur: t1, kicks: f(S.kicks), snares: f(S.snares) };
  return W;
};

// 两个世界画在同一帧里。poseA、poseB：各自摆好自己的世界，返回 { sc, cam }（先摆 B 画进一张图，再摆 A 过后期，所以两个可以是同一个世界的不同时刻）
// m = { k, c: [x, y], r, soft, y, tilt, wave, ysoft }，画面坐标 0–1、原点左下：圆里（给了 r）、水线下（给了 y）是 B，再乘 k；都不给就是按 k 叠化
JZ.blend = (ctx, M, poseA, poseB, m) => {
  const T = JZ.THREE, u = JZ.mix.uniforms, b = poseB();
  if (!JZ.rtB) u.tB.value = (JZ.rtB = new T.WebGLRenderTarget(JZ.GL.width, JZ.GL.height, { type: T.HalfFloatType })).texture;
  JZ.R.setRenderTarget(JZ.rtB); JZ.R.render(b.sc, b.cam); JZ.R.setRenderTarget(null);
  u.uK.value = m.k ?? 1; u.uL.value.set(...(m.lens || [0, 0, 0, 0])); u.uC.value.set(...(m.c || [0.5, 0.5]), m.r ?? 9, m.soft ?? 0.02); u.uY.value.set(m.y ?? 9, m.tilt || 0, m.wave || 0, m.ysoft ?? 0.01);
  const a = poseA(); JZ.mix.enabled = true; JZ.present(ctx, M, a.sc, a.cam); JZ.mix.enabled = false;
};

// 镜头路径：keys = [{ t, p, l, up, fov, …, v }]，按 t 升序。v：这个机位上镜头的速度（米/秒，xyz），不写就自动算；转弯、升到顶的机位写上横着走的 v，镜头就不会在那儿停住。返回 at(t)：每一项沿样条走，过机位时方向和速度都接得上，不冲过头
// 不为卡点刹车：用户 2026-11-18 定的，镜头不在小节头前减速、悬停再冲（原来的 punch 删了）
JZ.path = (keys) => {
  keys.forEach((k, i) => { if (i && k.t <= keys[i - 1].t) throw new Error(`JZ.path：机位要按时间升序（第 ${i} 个）`); });
  const n = keys.length, K = (j) => keys[Math.max(0, Math.min(n - 1, j))], vel = (f, c, a, b) => b.t > a.t ? ([].concat(b[f])[c] - [].concat(a[f])[c]) / (b.t - a.t) : 0;
  const tan = (f, c, j) => {   // 写了 v 的机位用 v；其余：前后两段的平均速度；压到不超过较慢那段的 3 倍，掉头的那一项取 0，曲线才不会冲过头（比如镜头掉到水面下）
    if (f === 'p' && K(j).v) return K(j).v[c];
    if (j <= 0 || j >= n - 1) return j <= 0 ? vel(f, c, K(0), K(1)) : vel(f, c, K(n - 2), K(n - 1));
    const s0 = vel(f, c, K(j - 1), K(j)), s1 = vel(f, c, K(j), K(j + 1));
    return s0 * s1 <= 0 ? 0 : Math.sign(s0) * Math.min(Math.abs(s0 + s1) / 2, 3 * Math.abs(s0), 3 * Math.abs(s1));
  };
  return (t) => {
    let i = 0; while (i < n - 2 && t >= keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1], dt = b.t - a.t, out = {};
    const x = Math.max(0, Math.min(1, (t - a.t) / dt));
    const x2 = x * x, x3 = x2 * x;
    for (const f in a) if (f !== 't' && f !== 'v') {
      const v = [].concat(a[f]).map((p0, c) => (2 * x3 - 3 * x2 + 1) * p0 + (x3 - 2 * x2 + x) * dt * tan(f, c, i) + (3 * x2 - 2 * x3) * [].concat(b[f])[c] + (x3 - x2) * dt * tan(f, c, i + 1));
      out[f] = v.length > 1 ? v : v[0];
    }
    return out;
  };
};

// ---------- 右下角歌词：一行小字，火星沿着字按逐字时间走，唱到的字烧亮，唱完化灰飘走 ----------
const LY = { size: 58, right: 1846, base: 1004, gap: 5, font: 'MaShanZheng' };
const LAY = {};   // 每句的排版（只和字体有关，算一次）
const layout = (o, L) => {
  if (LAY[L.n]) return LAY[L.n];
  const w = L.chars.map(c => o.measureText(c.c).width), tot = w.reduce((a, b) => a + b, 0) + LY.gap * (w.length - 1);
  let x = LY.right - tot; const xs = w.map(v => { const r = x; x += v + LY.gap; return r; });
  return LAY[L.n] = { w, xs, x0: LY.right - tot, x1: LY.right };
};
const timing = (M, L) => {
  const nx = M.song.lines.find(l => l.n === L.n + 1), cs = L.chars;
  const d = cs.map((c, i) => M.clamp((i + 1 < cs.length ? cs[i + 1].t : L.sung_end) - c.t, 0.10, 0.32));   // 每个字烧多久
  const out0 = Math.min(L.sung_end + 0.45, nx ? nx.t0 - 0.02 : 1e9);                                        // 开始化灰：不拖过下一句开唱
  return { d, out0, outDur: M.clamp((nx ? nx.t0 : 1e9) + 0.2 - out0, 0.2, 0.6) };
};
const sparkX = (M, L, G, T, t) => {   // 火星在 t 时刻走到哪
  const cs = L.chars; let k = -1; for (let i = 0; i < cs.length; i++) if (t >= cs[i].t) k = i;
  return k < 0 ? G.x0 - 4 : G.xs[k] + G.w[k] * M.clamp((t - cs[k].t) / T.d[k]);
};
const burning = (L, T, t) => L.chars.some((c, i) => t >= c.t && t < c.t + T.d[i]);
const mix3 = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
const heatCol = (h) => h > 0.55 ? mix3([255, 190, 78], [255, 246, 222], (h - 0.55) / 0.45) : mix3([232, 112, 38], [255, 190, 78], h / 0.55);

JZ.lyrics = (o, M) => {
  if (M.noLyrics) return;
  const t = M.t, S = LY.size;
  o.font = `${S}px ${LY.font}`; o.textBaseline = 'alphabetic'; o.textAlign = 'left'; o.lineJoin = 'round'; o.lineCap = 'round';
  for (const L of M.song.lines) {
    const T = timing(M, L); if (t < L.t0 || t > T.out0 + T.outDur + 1.2) continue;   // +1.2：灰屑还在飘
    const G = layout(o, L), cs = L.chars;
    const e = M.clamp((t - T.out0) / T.outDur), a = M.clamp((t - L.t0) / 0.08) * (1 - e), dy = -62 * M.ease.out3(e), dx = 12 * e;
    const fy = LY.base + 15 + dy, sx = sparkX(M, L, G, T, t) + dx;
    if (a > 0.01) {
      // 垫一块很淡的暗，亮场景里也看得清
      const cx = (G.x0 + G.x1) / 2, cy = LY.base - S * 0.36 + dy, pg = o.createRadialGradient(cx, cy, 10, cx, cy, (G.x1 - G.x0) / 2 + 150);
      pg.addColorStop(0, `rgba(0,0,0,${0.5 * a})`); pg.addColorStop(1, 'rgba(0,0,0,0)');
      o.save(); o.translate(0, cy); o.scale(1, 0.42); o.translate(0, -cy); o.fillStyle = pg; o.fillRect(G.x0 - 220, cy - 420, G.x1 - G.x0 + 440, 840); o.restore();
      // 引线：没烧的灰，烧过的留余烬
      o.lineWidth = 1.6; o.strokeStyle = `rgba(150,140,128,${0.55 * a})`; o.beginPath(); o.moveTo(sx, fy); o.lineTo(G.x1 + dx, fy); o.stroke();
      const lg = o.createLinearGradient(G.x0, 0, Math.max(sx, G.x0 + 1), 0); lg.addColorStop(0, `rgba(120,50,20,${0.15 * a})`); lg.addColorStop(1, `rgba(255,150,60,${0.8 * a})`);
      o.strokeStyle = lg; o.beginPath(); o.moveTo(G.x0 - 4 + dx, fy); o.lineTo(sx, fy); o.stroke();
      cs.forEach((c, i) => {
        const x = G.xs[i] + dx, y = LY.base + dy, w = G.w[i], age = t - c.t, p = M.clamp(age / T.d[i]);
        o.globalAlpha = a; o.lineWidth = 5; o.strokeStyle = 'rgba(0,0,0,0.72)'; o.strokeText(c.c, x, y);
        o.globalAlpha = a * 0.72; o.fillStyle = 'rgb(138,130,121)'; o.fillText(c.c, x, y); o.globalAlpha = a;   // 没烧到：灰烬色
        if (age <= 0) return;
        const heat = (0.25 + 0.75 * Math.exp(-age / 1.1)) * (0.92 + 0.08 * Math.sin(t * 23 + i * 1.7) * Math.sin(t * 7.3 + i));
        const front = x - 4 + (w + 8) * p;
        o.save(); o.beginPath(); o.rect(x - 40, y - S * 1.5, front - (x - 40), S * 2.2); o.clip();                // 烧到的部分：从左往右
        o.shadowColor = `rgba(255,${Math.round(120 + 70 * heat)},40,0.95)`; o.shadowBlur = 16 + 10 * heat;
        o.fillStyle = heatCol(heat); o.fillText(c.c, x, y); o.restore();
        if (p < 1) { o.save(); o.beginPath(); o.rect(front - 9, y - S * 1.5, 9, S * 2.2); o.clip(); o.shadowColor = '#fff'; o.shadowBlur = 12; o.fillStyle = '#fffaf0'; o.fillText(c.c, x, y); o.restore(); }   // 火头：白热的窄带
      });
      o.globalAlpha = 1;
      M.logLyric(L.n, S, a, L.text);
      if (window.__lyrLayout) cs.forEach((c, i) => window.__lyrLayout.push({ n: L.n, i, st: e > 0 ? 0 : 1, c: c.c, x: G.xs[i] + G.w[i] / 2 + dx, y: LY.base - S * 0.36 + dy, r: S / 2, a }));
    }
    o.save(); o.globalCompositeOperation = 'lighter';
    // 火星本体：唱完 0.35 秒内烧尽
    const k = (1 - M.clamp((t - L.sung_end) / 0.35)) * a;
    if (k > 0.01) {
      const fl = 0.8 + 0.2 * Math.sin(t * 61) * Math.sin(t * 37 + 1), g2 = o.createRadialGradient(sx, fy, 0, sx, fy, 30 * fl);
      g2.addColorStop(0, `rgba(255,220,150,${0.9 * k})`); g2.addColorStop(0.25, `rgba(255,150,50,${0.5 * k})`); g2.addColorStop(1, 'rgba(255,90,20,0)');
      o.fillStyle = g2; o.beginPath(); o.arc(sx, fy, 30, 0, M.TAU); o.fill();
      o.fillStyle = `rgba(255,252,240,${k})`; o.beginPath(); o.arc(sx, fy, 3.2 * fl, 0, M.TAU); o.fill();
    }
    // 溅出来的火花：每个时间格子一粒，位置只由出生时刻算
    const RATE = 110;
    for (let j = Math.floor(t * RATE), m = 0; m < RATE * 0.8; m++, j--) {
      const tb = j / RATE, age = t - tb, life = 0.28 + 0.5 * M.hash(j, 1);
      if (tb < L.t0 || tb > L.sung_end + 0.12 || tb > T.out0 || age > life || age < 0) continue;
      if (!burning(L, T, tb) && M.hash(j, 5) > 0.3) continue;
      const an = -1.92 + (M.hash(j, 2) - 0.5) * 2.3, sp = 50 + 170 * M.hash(j, 3) ** 2, ox = sparkX(M, L, G, T, tb), kk = age / life;
      const at = (u) => [ox + Math.cos(an) * sp * u * (1 - 0.35 * u / life), LY.base + 15 + Math.sin(an) * sp * u + 170 * u * u];
      const p1 = at(age), p0 = at(Math.max(0, age - 0.035));
      o.strokeStyle = kk < 0.3 ? '#fff4d8' : kk < 0.7 ? '#ffb040' : '#e0501c'; o.globalAlpha = (1 - kk) ** 1.2; o.lineWidth = 2.2 * (1 - kk) + 0.6;
      o.beginPath(); o.moveTo(p0[0], p0[1]); o.lineTo(p1[0], p1[1]); o.stroke();
    }
    o.restore();
    // 化灰：每个字散几片灰屑往右上飘
    if (t >= T.out0) cs.forEach((c, i) => { for (let m = 0; m < 6; m++) {
      const h = (q) => M.hash(L.n * 131 + i * 17 + m, q), u = t - (T.out0 + h(1) * T.outDur), life = 0.5 + 0.6 * h(2); if (u < 0 || u > life) continue;
      const kk = u / life, x = G.xs[i] + G.w[i] * h(3) + (30 + 80 * h(4)) * u, y = LY.base - S * 0.8 * h(5) - (45 + 100 * h(6)) * u - 30 * kk * kk, r = 1.4 + 2 * h(7);
      o.globalAlpha = 0.8 * (1 - kk); o.fillStyle = mix3([255, 150, 60], [120, 114, 108], Math.min(1, kk * 2.2));
      o.save(); o.translate(x, y); o.rotate(h(8) * 6 + u * 4); o.fillRect(-r, -r * 0.5, r * 2, r); o.restore();
    } });
    o.globalAlpha = 1;
  }
};
})();
