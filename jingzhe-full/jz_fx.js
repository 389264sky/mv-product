// jz_fx.js —— 2.5D 版共用的特效零件：带子（RIBBON）、拖尾壳（fly）、雷（bolt）、光点（motes）。从 3D 版 jz_tree.js、jz_lake.js、jz_spring.js 提出来的。
(() => {
const JZ = window.JZ, X = JZ.fx = {};
X.HIDE = 'gl_Position = vec4(2.0, 2.0, 2.0, 1.0);';
X.RIBBON = `
uniform float uT, uPx; uniform vec2 uRes;
// own / oth：这一端和另一端的世界坐标；flip：这一端是不是 B；返回裁剪坐标，hwOut：带子半宽（内部像素），thin：细到不足一像素的按比例减亮
vec4 ribbon(vec3 own, vec3 oth, float side, float flip, float halfW, float wide, out float thin) {
  mat4 vp = projectionMatrix * viewMatrix * modelMatrix;
  vec4 cp = vp * vec4(own, 1.0), cq = vp * vec4(oth, 1.0); thin = 0.0;
  if (cp.w < 0.02 && cq.w < 0.02) return vec4(2.0, 2.0, 2.0, 1.0);
  if (cp.w < 0.02) cp = mix(cp, cq, (0.02 - cp.w) / (cq.w - cp.w));          // 穿到镜头后面的一端裁到近平面
  if (cq.w < 0.02) cq = mix(cq, cp, (0.02 - cq.w) / (cp.w - cq.w));
  vec2 dir = cq.xy / cq.w * uRes - cp.xy / cp.w * uRes; float dl = length(dir); dir = (dl > 1e-5 ? dir / dl : vec2(1.0, 0.0)) * (1.0 - 2.0 * flip);
  float hw = halfW * projectionMatrix[1][1] * uRes.y * 0.5 / cp.w, mn = 0.8 * uPx;
  thin = min(1.0, hw / mn);
  cp.xy += vec2(-dir.y, dir.x) * side * max(hw, mn) * wide / (uRes * 0.5) * cp.w;
  return cp;
}`;
// 飞的东西共用一个壳：at(u) 给出出生 u 秒后的位置（原 JZ.kit.fly）
X.fly = (K, at, col) => ({ v: K.RIBBON + `
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
}`, f: `
varying float vS, vE, vG, vK;
void main() { ${col} gl_FragColor = vec4(c * exp(-vS * vS * 5.0) * vG * smoothstep(0.0, 0.7, vE) * (1.0 - smoothstep(0.92, 1.0, vE)), 1.0); }` });
X.quad = () => { const T = JZ.THREE, g = new T.InstancedBufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array([1, 0, 0, -1, 0, 0, 1, 1, 0, -1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]); return g; };
const U = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
X.U = U;

// 雷：从 top 折着劈到 p，带几根岔；一道一道是线段，亮一下、0.9 秒内暗完（不闪：只占画面一小条，场景不跟着亮）
// strikes = [{ t, top, p, w, br }]；抖动、岔的长短按雷的长度算，大小场景都能用。返回 mesh（改 material.uniforms.uT）
X.bolt = (strikes, rr) => {
  const T = JZ.THREE, sa = [], sb = [], Q = () => rr() * 2 - 1;
  for (const k of strikes) {
    const L = Math.hypot(k.top[0] - k.p[0], k.top[1] - k.p[1], k.top[2] - k.p[2]), J = 0.026 * L, pb = k.br ?? 0.15;
    const seg = (p, q, w, depth) => { const n = depth ? 10 : 40; let a = p; for (let i = 1; i <= n; i++) { const f = i / n, j = i < n ? J * (1 - f * 0.6) * (depth ? 0.6 : 1) : 0;
      const b = [p[0] + (q[0] - p[0]) * f + j * Q(), p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f + j * Q() * 0.3];
      sa.push(...a, k.t + 0.004 * i * (depth ? 1.5 : 1)); sb.push(...b, w * (1 - 0.4 * f));
      if (!depth && i > 4 && i < n - 6 && rr() < pb) seg(b, [b[0] + 0.2 * L * Q(), b[1] - 0.12 * L - 0.08 * L * rr(), b[2] + 0.05 * L * Q()], w * 0.45, 1); a = b; } };
    seg(k.top, k.p, k.w, 0);
  }
  const g = X.quad(); g.setAttribute('iA', new T.InstancedBufferAttribute(new Float32Array(sa), 4)); g.setAttribute('iB', new T.InstancedBufferAttribute(new Float32Array(sb), 4)); g.instanceCount = sa.length / 4;
  const m = new T.Mesh(g, new T.ShaderMaterial({ transparent: true, depthTest: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, uniforms: U({ uT: 0, uPx: JZ.px, uRes: JZ.res }), vertexShader: X.RIBBON + `
attribute vec4 iA, iB; varying float vS, vE, vG;
void main() { vS = position.x; vE = position.y; float u = uT - iA.w, thin; vG = 0.0; if (u < 0.0 || u > 0.9) { ${X.HIDE} return; }
  gl_Position = position.y > 0.5 ? ribbon(iB.xyz, iA.xyz, position.x, 1.0, iB.w, 3.0, thin) : ribbon(iA.xyz, iB.xyz, position.x, 0.0, iB.w, 3.0, thin);
  vG = smoothstep(0.0, 0.03, u) * (0.15 + 0.85 * exp(-u * 7.0)) * (1.0 - smoothstep(0.35, 0.9, u)) * mix(0.5, 1.0, thin); }`,
    fragmentShader: `varying float vS, vE, vG; void main() { gl_FragColor = vec4(mix(vec3(0.62, 0.55, 1.0), vec3(1.0, 0.98, 1.0), exp(-vS * vS * 12.0)) * vG * (exp(-vS * vS * 5.0) * 2.4 + 0.4 * exp(-vS * vS)), 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = 3; return m;
};

// 光点：雪、火星、花粉、光屑。位置只由时间算：p = 起点 + 速度·t（在盒子里循环）+ 一点摆动。o = { n, box: [x0,y0,z0,x1,y1,z1], v: [x,y,z], sway, size（米）, col, tw（闪多少）, seed }
X.motes = (o, rr) => {
  const T = JZ.THREE, n = o.n, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set([rr(), rr(), rr(), rr()], i * 4);
  const g = new T.InstancedBufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
  g.setAttribute('iA', new T.InstancedBufferAttribute(a, 4)); g.instanceCount = n;
  const b = o.box, m = new T.Mesh(g, new T.ShaderMaterial({ transparent: true, depthTest: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: U({ uT: 0, uPx: JZ.px, uRes: JZ.res, uK: 1, uB0: new T.Vector3(b[0], b[1], b[2]), uB1: new T.Vector3(b[3], b[4], b[5]), uV: new T.Vector3(...o.v), uSw: o.sway || 0, uSz: o.size, uCol: new T.Vector3(...o.col), uTw: o.tw || 0 }), vertexShader: `
attribute vec4 iA; uniform float uT, uPx, uK, uSw, uSz, uTw; uniform vec2 uRes; uniform vec3 uB0, uB1, uV; varying vec2 vQ; varying float vG;
void main() {
  vQ = position.xy; vec3 d = uB1 - uB0, p = uB0 + mod(iA.xyz * d + uV * uT * (0.7 + 0.6 * iA.w), d);
  p.x += uSw * sin(uT * (0.8 + iA.w) + iA.x * 40.0); p.z += uSw * cos(uT * (0.6 + iA.y) + iA.z * 30.0);
  vec4 c = projectionMatrix * viewMatrix * vec4(p, 1.0); float r = uSz * (0.5 + iA.w) * projectionMatrix[1][1] * uRes.y * 0.5 / max(c.w, 1e-3), px = max(r, 1.2 * uPx);
  c.xy += position.xy * px * 2.0 / (uRes * 0.5) * c.w; gl_Position = c;
  float e = min(min(p.y - uB0.y, uB1.y - p.y), min(p.x - uB0.x, uB1.x - p.x)) / max(d.y * 0.08, 1e-4);   // 盒子边上淡出，循环接口看不见
  vG = uK * min(1.0, r / (1.2 * uPx)) * clamp(e, 0.0, 1.0) * (1.0 - uTw + uTw * (0.5 + 0.5 * sin(uT * (3.0 + 4.0 * iA.y) + iA.x * 60.0))) * smoothstep(0.02, 0.2, c.w);
}`, fragmentShader: `uniform vec3 uCol; varying vec2 vQ; varying float vG; void main() { float r2 = dot(vQ, vQ); gl_FragColor = vec4(uCol * vG * (exp(-r2 * 9.0) * 1.6 + 0.25 * exp(-r2 * 2.5)), 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = 4; return m;
};
})();
