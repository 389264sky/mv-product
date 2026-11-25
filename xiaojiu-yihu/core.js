// core.js —— 渲染核心：一个 WebGLRenderer，场景 → 半浮点 HDR → 体积云 → SSAO / 景深 / 体积光 / 泛光 → 描金、绢纹、调色
(() => {
const X = window.XJ = { build: [], S: {} };
X.GLSL = /* glsl */`
uint _h(uint x){ x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float h2(vec2 p){ ivec2 i = ivec2(floor(p)); return float(_h(uint(i.x) * 1597334677u ^ _h(uint(i.y) * 3812015801u))) / 4294967295.0; }
float h3(vec3 p){ ivec3 i = ivec3(floor(p)); return float(_h(uint(i.x) * 1597334677u ^ _h(uint(i.y) * 3812015801u ^ _h(uint(i.z) * 2798796415u)))) / 4294967295.0; }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*f*(f*(f*6.-15.)+10.); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=mat2(1.6,1.2,-1.2,1.6)*p+7.3; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn3(p); p=p*2.03+5.1; a*=.5; } return s; }
`;
X.SKYGLSL = /* glsl */`
uniform vec3 uZen, uHor, uGnd, uSunCol, uSunDir, uMoonDir; uniform float uSunSize, uMoon, uStars, uT, uHaze;
vec3 skyBase(vec3 rd){ float y = rd.y; vec3 c = mix(uHor, uZen, pow(clamp(y,0.,1.), .55)); c = mix(c, uGnd, smoothstep(0.,-.35,y));
  float s = max(dot(rd,uSunDir),0.); c += uSunCol*(.35*pow(s,6.)+.5*pow(s,40.))*uHaze; return c; }
`;
// 调色板：天、太阳、雾、云、绢色；可以插值
X.PAL = {
  dawn:  { zen: [.10,.26,.34], hor: [1.02,.66,.40], gnd: [.42,.34,.26], sun: [1.9,1.05,.46], fog: [.62,.55,.44], cl: [1.25,.98,.74], cs: [.20,.30,.36], amb: [.34,.42,.46], haze: .9, stars: 0, moon: 0, int: 2.6, sunE: 8, sunA: 20 },
  qing:  { zen: [.05,.24,.36], hor: [.62,.78,.70], gnd: [.30,.40,.34], sun: [1.5,1.32,.95], fog: [.46,.64,.60], cl: [1.12,1.10,1.0], cs: [.26,.44,.46], amb: [.42,.52,.50], haze: .5, stars: 0, moon: 0, int: 2.7, sunE: 34, sunA: 50 },
  dusk:  { zen: [.10,.10,.24], hor: [1.15,.42,.18], gnd: [.36,.18,.14], sun: [2.2,.80,.28], fog: [.60,.30,.24], cl: [1.3,.66,.40], cs: [.24,.16,.28], amb: [.34,.28,.36], haze: 1.1, stars: .15, moon: 0, int: 2.8, sunE: 6, sunA: -30 },
  night: { zen: [.006,.022,.060], hor: [.030,.085,.150], gnd: [.010,.030,.050], sun: [.62,.78,1.0], fog: [.030,.075,.125], cl: [.30,.42,.58], cs: [.015,.040,.080], amb: [.08,.14,.22], haze: .35, stars: 1, moon: 1, int: 1.25, sunE: 24, sunA: 0 },
  storm: { zen: [.025,.050,.070], hor: [.16,.24,.26], gnd: [.04,.08,.09], sun: [.75,.85,.85], fog: [.11,.17,.19], cl: [.34,.42,.44], cs: [.04,.07,.09], amb: [.16,.22,.25], haze: .3, stars: 0, moon: 0, int: 1.3, sunE: 30, sunA: 10 },
  snow:  { zen: [.24,.36,.50], hor: [.80,.82,.86], gnd: [.62,.68,.76], sun: [1.1,1.0,.9], fog: [.66,.72,.80], cl: [.95,.96,1.0], cs: [.46,.54,.66], amb: [.56,.62,.70], haze: .3, stars: 0, moon: 0, int: 1.5, sunE: 24, sunA: 30 },
  snown: { zen: [.012,.028,.070], hor: [.070,.110,.190], gnd: [.05,.08,.14], sun: [.70,.80,1.0], fog: [.065,.095,.160], cl: [.40,.50,.66], cs: [.03,.05,.10], amb: [.13,.18,.28], haze: .3, stars: .5, moon: 1, int: 1.2, sunE: 30, sunA: 25 },
  wine:  { zen: [.16,.045,.015], hor: [1.10,.50,.12], gnd: [.50,.16,.03], sun: [2.3,1.15,.36], fog: [.55,.22,.06], cl: [1.4,.78,.34], cs: [.26,.09,.04], amb: [.42,.26,.16], haze: 1.2, stars: .2, moon: 0, int: 2.6, sunE: 12, sunA: 0 },
};
X.mix = (a, b, k) => Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k;
X.pal = (p, q, k = 0) => { const a = typeof p === 'string' ? X.PAL[p] : p; if (!q || k <= 0) return { ...a }; const b = typeof q === 'string' ? X.PAL[q] : q, o = {}; for (const n in a) o[n] = X.mix(a[n], b[n], k); return o; };

X.init = async (M) => {
  const THREE = X.THREE = await import('three'); X.M = M;
  const W = X.W = Math.round(M.W * M.SC), H = X.H = Math.round(M.H * M.SC);
  const GL = X.GL = document.createElement('canvas'); GL.width = W; GL.height = H;
  const R = X.R = new THREE.WebGLRenderer({ canvas: GL, antialias: false, preserveDrawingBuffer: true, precision: 'highp', powerPreference: 'high-performance' });
  R.setPixelRatio(1); R.setSize(W, H, false);
  if (R.getContext().drawingBufferWidth !== W) throw new Error('WebGL 画布开不到 ' + W + '×' + H);
  R.toneMapping = THREE.NoToneMapping; R.outputColorSpace = THREE.LinearSRGBColorSpace; R.autoClear = false;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), U = (v) => ({ value: v });
  X.V3 = V3;
  const G = X.G = { uZen: U(V3()), uHor: U(V3()), uGnd: U(V3()), uSunCol: U(V3()), uSunDir: U(V3(0, 1, 0)), uMoonDir: U(V3(0, 1, 0)), uSunSize: U(.02), uMoon: U(0), uStars: U(0), uT: U(0), uHaze: U(.5),
    uFogCol: U(V3()), uFogD: U(.0012), uFogH: U(.006), uFogY: U(0), uCl: U(V3()), uCs: U(V3()), uAmb: U(V3()), uWind: U(1), uGold: U(1), uWet: U(0), uSnow: U(0), uPC: U(V3()), uPR: U(0), uPS: U(0), uBlm: U(0), uWineR: U(0) };
  X.AERIAL = /* glsl */`
    uniform vec3 uPC; uniform float uPR, uPS;
    vec3 ringGold(vec3 wp){ if(uPS<.003) return vec3(0.); float d = length(wp.xz-uPC.xz) + (vn(wp.xz*.06)-.5)*uPR*.10; float w = .012*uPR+.10; float r = exp(-abs(d-uPR)/w) + .55*exp(-abs(d-uPR*.86)/(w*.5)) + .3*exp(-abs(d-uPR*.74)/(w*.35)); return vec3(1.35,.82,.26)*r*uPS; }
    uniform vec3 uFogCol; uniform float uFogD, uFogH, uFogY;
    vec3 aerial(vec3 col, vec3 wp){ vec3 v = wp - cameraPosition; float d = length(v); vec3 rd = v/max(d,1e-4); float fh = exp(-max(0., wp.y - uFogY)*uFogH);
      float f = 1. - exp(-d*uFogD*(.18+.82*fh)); float s = pow(max(dot(rd,uSunDir),0.),6.); vec3 fc = mix(uFogCol, uFogCol*.5 + uSunCol*.42, s*.8*uHaze); return mix(col, fc, clamp(f,0.,1.)); }`;
  // 通用材质：PBR + 矿物颜料噪声 + 描金边 + 自己的空气透视。o.color(GLSL 片段，改 dc) o.vert(GLSL，改 transformed) o.emis
  X.mat = (o = {}) => {
    const m = new (o.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial)({ color: o.c ?? 0xffffff, roughness: o.rough ?? .8, metalness: o.metal ?? 0, side: o.side ?? THREE.FrontSide, vertexColors: !!o.vc, transparent: !!o.transparent, depthWrite: o.depthWrite ?? true, ...(o.more || {}) });
    m.onBeforeCompile = (s) => {
      for (const k in G) s.uniforms[k] = G[k];
      const U2 = o.u || {}; for (const k in U2) s.uniforms[k] = U2[k];
      const decl = (o.decl || '');
      s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
        ${X.GLSL} uniform float uT, uWind; varying vec3 vWP, vOP; varying vec2 vUvX; ${o.vdecl || ''} ${o.vary || ''} ${decl}`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n vUvX = uv; ${o.vnorm || ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n vOP = position; ${o.vert || ''}`)
        .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 _wp = vec4(transformed, 1.);
        #ifdef USE_INSTANCING
          _wp = instanceMatrix * _wp;
        #endif
        vWP = (modelMatrix * _wp).xyz;`);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
        ${X.GLSL} ${X.SKYGLSL.replace('uniform vec3 uZen', 'uniform vec3 uZen')} ${X.AERIAL} uniform vec3 uAmb; uniform float uWind, uGold, uSnow, uBlm; varying vec3 vWP, vOP; varying vec2 vUvX; ${o.vary || ''} ${decl}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n { vec3 dc = diffuseColor.rgb; ${o.color || ''} diffuseColor.rgb = dc; }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n ${o.roughf || ''}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n ${o.normalf || ''}`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n { vec3 em = vec3(0.); ${o.emis || ''} totalEmissiveRadiance += em; }`)
        .replace('#include <opaque_fragment>', `
          { vec3 N = normalize(normal), Vv = normalize(vViewPosition); float fr = 1. - abs(dot(N, Vv)); vec3 Nw = inverseTransformDirection(N, viewMatrix);
            outgoingLight += diffuseColor.rgb * uAmb * (.55 + .45*Nw.y) * ${o.amb ?? '1.0'};
            ${o.rim === 0 ? '' : `outgoingLight += (uSunCol*.30+uHor*.22) * pow(fr, 3.) * ${(o.rim ?? 1).toFixed(2)} * (.4+.6*max(dot(Nw,uSunDir)+.35,0.));`}
            ${o.late || ''}
            ${o.ring === 0 ? '' : 'outgoingLight += ringGold(vWP);'}
            ${o.fog === 0 ? '' : 'outgoingLight = aerial(outgoingLight, vWP);'} }
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => (o.key || '') + (o.color || '') + (o.vert || '') + (o.emis || '') + (o.late || '') + (o.normalf || '') + (o.rim ?? 1) + (o.roughf || '') + (o.amb || '') + (o.vdecl || '') + (o.vary || '') + (o.fog ?? 1) + (o.vnorm || '');
    return m;
  };
  // 自定义着色器（天、水、粒子、酒）：带上全部公共 uniform
  X.smat = (o) => new THREE.ShaderMaterial({ uniforms: { ...G, ...(o.u || {}) }, vertexShader: X.GLSL + 'uniform float uT, uWind;\n' + (o.vs || 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }'),
    fragmentShader: X.GLSL + X.SKYGLSL + X.AERIAL + 'uniform vec3 uAmb, uCl, uCs; uniform float uWind, uGold;\n' + o.fs, transparent: !!o.transparent, depthWrite: o.depthWrite ?? !o.transparent, depthTest: o.depthTest ?? true, side: o.side ?? THREE.FrontSide, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });

  // ---------- 天 ----------
  X.sky = () => {
    const m = X.smat({ side: THREE.BackSide, depthWrite: false, vs: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position*100.,1.); gl_Position = p.xyww; }',
      fs: `varying vec3 vD; uniform vec4 uMoonP; uniform float uMilky;
      void main(){ vec3 rd = normalize(vD); vec3 c = skyBase(rd);
        float s = dot(rd,uSunDir); c += uSunCol * smoothstep(cos(uSunSize), cos(uSunSize*.86), s) * (1.-uMoon) * 3.2;
        if(uStars>.01 && (rd.y>-.1||uMoonP.w>.5)){ vec2 q = vec2(atan(rd.z,rd.x)*90., asin(rd.y)*120.); for(int k=0;k<2;k++){ vec2 g=floor(q),f=fract(q)-.5; float r=h2(g+float(k)*37.); if(r>.86){ vec2 o=(vec2(h2(g+3.1),h2(g+9.7))-.5)*.7; float d=length(f-o); c += uStars*smoothstep(.10*r,.0,d)*(.5+.5*sin(uT*(1.+3.*r)+r*60.))*mix(vec3(.7,.85,1.),vec3(1.,.82,.5),h2(g+1.7))*1.6*max(uMoonP.w,smoothstep(-.05,.25,rd.y)); } q=q*1.9+11.; }
          float mw = fbm(rd.xz*3.+rd.y*2.)*exp(-pow((rd.x*.7+rd.y*.5-rd.z*.2)*2.2,2.)); c += uStars*uMilky*vec3(.16,.22,.34)*pow(mw,2.)*3.*max(uMoonP.w,smoothstep(-.1,.12,rd.y)); }
        if(uMoon>.01){ float a = acos(clamp(dot(rd,uMoonDir),-1.,1.)); float r = uMoonP.x; vec3 t = normalize(cross(vec3(0.,1.,0.),uMoonDir)), b = cross(uMoonDir,t); vec2 m = vec2(dot(rd,t),dot(rd,b))/sin(r);
          float disc = smoothstep(1.0,.985,length(m)); if(disc>0.){ float z = sqrt(max(0.,1.-dot(m,m))); vec3 n = vec3(m,z); float mar = fbm(n.xy*2.1+n.z+3.7); float cr = fbm(n.xy*9.+2.); vec3 mc = mix(vec3(1.,.93,.76), vec3(.66,.58,.46), smoothstep(.42,.66,mar)*.75) * (.86+.28*cr) * (.72+.28*z); c = mix(c, mc*uMoonP.y, disc*uMoon); }
          c += uMoon*vec3(.85,.74,.52)*(.30*exp(-max(a-r,0.)*9.)+.10*exp(-max(a-r,0.)*2.6))*uMoonP.y*.5; }
        gl_FragColor = vec4(c,1.); }`, u: { uMoonP: X.uMoonP = U(new THREE.Vector4(.09, 1.5, 0, 0)), uMilky: X.uMilky = U(1) } });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), m); mesh.frustumCulled = false; mesh.renderOrder = -100; return mesh;
  };
  // 场景工厂：每个世界一份场景，带天、主光、补光
  X.world = (far = 4000) => { const sc = new THREE.Scene(), sky = X.sky(); sc.add(sky);
    const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0005; sun.shadow.normalBias = .04; sc.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, .0); sc.add(hemi); const cam = new THREE.PerspectiveCamera(45, 16 / 9, .1, far); return { sc, sky, sun, hemi, cam }; };

  // ---------- 后期 ----------
  const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, ...o });
  const main = X.main = rt(W, H, { depthBuffer: true }); main.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
  X.refl = rt(W / 2, H / 2, { depthBuffer: true });
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
  const pass = (fs, u) => new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: u, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }', fragmentShader: 'varying vec2 vUv;\n' + X.GLSL + fs });
  const draw = X.draw = (m, target) => { quad.material = m; R.setRenderTarget(target); R.render(qs, qc); };
  // 体积云噪声 64³：低频 Perlin-Worley + 高频 Worley（可平铺）
  const N3 = 48, nd = new Uint8Array(N3 * N3 * N3 * 4), hh = (x, y, z, s) => M.hash(x * 73 + y * 179 + z * 283 + s * 1013, x + y * 57 + z * 113 + s);
  const worley = (cells, s) => { const P = new Float32Array(cells ** 3 * 3); for (let z = 0; z < cells; z++) for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) { const i = (z * cells * cells + y * cells + x) * 3; P[i] = hh(x, y, z, s); P[i + 1] = hh(x, y, z, s + 7); P[i + 2] = hh(x, y, z, s + 13); }
    return (u, v, w) => { const fx = u * cells, fy = v * cells, fz = w * cells, cx = Math.floor(fx), cy = Math.floor(fy), cz = Math.floor(fz); let d = 9; for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const a = cx + i, b = cy + j, c = cz + k, q = (((c + cells) % cells) * cells * cells + ((b + cells) % cells) * cells + ((a + cells) % cells)) * 3, dx = a + P[q] - fx, dy = b + P[q + 1] - fy, dz = c + P[q + 2] - fz; d = Math.min(d, dx * dx + dy * dy + dz * dz); } return 1 - Math.min(1, Math.sqrt(d)); }; };
  const w1 = worley(4, 1), w2 = worley(8, 2), w3 = worley(12, 3);
  for (let z = 0, i = 0; z < N3; z++) for (let y = 0; y < N3; y++) for (let x = 0; x < N3; x++, i += 4) { const u = x / N3, v = y / N3, w = z / N3, a = w1(u, v, w), b = w2(u, v, w), c = w3(u, v, w); nd[i] = 255 * Math.min(1, a * .62 + b * .26 + c * .12); nd[i + 1] = 255 * (b * .62 + c * .38); nd[i + 2] = 255 * c; nd[i + 3] = 255; }
  const tex3 = X.tex3 = new THREE.Data3DTexture(nd, N3, N3, N3); tex3.format = THREE.RGBAFormat; tex3.minFilter = tex3.magFilter = THREE.LinearFilter; tex3.wrapS = tex3.wrapT = tex3.wrapR = THREE.RepeatWrapping; tex3.needsUpdate = true;
  const cloudRT = rt(W / 3, H / 3), DU = { tD: U(main.depthTexture), uIP: U(new THREE.Matrix4()), uIV: U(new THREE.Matrix4()), uCam: U(V3()) };
  const DGL = `uniform highp sampler2D tD; uniform mat4 uIP, uIV; uniform vec3 uCam; float zAt(vec2 uv){ return texture2D(tD,uv).x; } vec3 vpos(vec2 uv, float z){ vec4 p = uIP*vec4(uv*2.-1., z*2.-1., 1.); return p.xyz/p.w; }`;
  const cloudM = pass(`precision highp sampler3D; uniform sampler3D t3; ${X.SKYGLSL} uniform vec3 uCl,uCs; uniform vec4 uC; uniform float uCD,uCS,uCF; uniform vec2 uCW; ${DGL}
    float den(vec3 p){ float h = (p.y-uC.x)/(uC.y-uC.x); if(h<0.||h>1.) return 0.; vec3 q = p*uCS + vec3(uCW.x,0.,uCW.y); float b = texture(t3, q*vec3(1.,1.2,1.)).r; float big = texture(t3, q.xzy*.27+.3).r;
      float shape = smoothstep(0.,.22,h)*smoothstep(1.,.25,h); float d = b*.62+big*.55 - (1.-uC.z) ; d -= (1.-texture(t3,q*3.7+vec3(0.,uT*.01,0.)).g)*.22; return clamp(d*shape*3.2,0.,1.); }
    void main(){ float z = zAt(vUv); vec3 vp = vpos(vUv, z); vec3 rd = normalize((uIV*vec4(normalize(vpos(vUv,.5)),0.)).xyz); float tD2 = z>=1. ? 1e9 : length(vp);
      float ta = (uC.x-uCam.y)/rd.y, tb = (uC.y-uCam.y)/rd.y; float t0 = max(0.,min(ta,tb)), t1 = min(min(max(ta,tb), tD2), uC.w); if(uCam.y>uC.x && uCam.y<uC.y) t0 = 0.;
      if(t1<=t0 || (abs(rd.y)<1e-5 && (uCam.y<uC.x||uCam.y>uC.y))) { gl_FragColor = vec4(0.,0.,0.,1.); return; }
      float dt = (t1-t0)/56.; dt = max(dt, 1.2); float jit = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056,.00583715)))); float t = t0 + dt*jit; vec3 acc = vec3(0.); float T = 1.; float cs = dot(rd,uSunDir); float ph = .55 + 1.6*pow(max(cs,0.),5.)+.5*pow(max(cs,0.),24.);
      for(int i=0;i<56;i++){ if(t>t1||T<.02) break; vec3 p = uCam+rd*t; float d = den(p); if(d>.004){ float l=0.; float ls=(uC.y-uC.x)*.09; vec3 lp=p; for(int j=0;j<4;j++){ lp += uSunDir*ls; l += den(lp)*ls; ls*=1.7; } float sh = exp(-l*uCD*.9)*.86+exp(-l*uCD*.22)*.14; float hh_ = clamp((p.y-uC.x)/(uC.y-uC.x),0.,1.);
          vec3 c = uCs*(.55+.65*hh_) + uCl*uSunCol*.50*sh*ph*(1.-exp(-d*7.)*.45); float a = 1.-exp(-d*uCD*dt); float fog = 1.-exp(-t*uCF); c = mix(c, uHor*.8+uSunCol*.18*pow(max(cs,0.),4.), fog*.85); acc += T*a*c; T *= 1.-a; } t += dt*(d>.004?1.:1.6); }
      gl_FragColor = vec4(acc, T); }`, { ...G, ...DU, t3: U(tex3), uC: U(new THREE.Vector4(0, 40, .5, 3000)), uCD: U(.05), uCS: U(.004), uCW: U(new THREE.Vector2()), uCF: U(.0012) });
  const bloomN = 6, bd = [], bu = []; for (let i = 0; i < bloomN; i++) { bd.push(rt(W / 2 ** (i + 1), H / 2 ** (i + 1))); bu.push(rt(W / 2 ** (i + 1), H / 2 ** (i + 1))); }
  const downM = pass(`uniform sampler2D tS; uniform vec2 px; uniform float uThr; void main(){ vec3 c=vec3(0.); float w=0.; for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){ vec3 s=texture2D(tS,vUv+vec2(i,j)*px).rgb; float k=(2.-abs(float(i)))*(2.-abs(float(j))); if(uThr>0.){ float l=max(s.r,max(s.g,s.b)); s*=smoothstep(uThr,uThr*2.2,l); s=min(s,vec3(9.)); k/=1.+l*.25; } c+=s*k; w+=k; } gl_FragColor=vec4(c/w,1.); }`, { tS: U(null), px: U(new THREE.Vector2()), uThr: U(0) });
  const upM = pass(`uniform sampler2D tS,tB; uniform vec2 px; uniform float uK; void main(){ vec3 c=vec3(0.); for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) c+=texture2D(tS,vUv+vec2(i,j)*px).rgb*(2.-abs(float(i)))*(2.-abs(float(j))); gl_FragColor=vec4(texture2D(tB,vUv).rgb+c/16.*uK,1.); }`, { tS: U(null), tB: U(null), px: U(new THREE.Vector2()), uK: U(.85) });
  const rayRT = rt(W / 4, H / 4), aoRT = rt(W / 2, H / 2), dofRT = rt(W / 2, H / 2), comp = X.comp = rt(W, H);
  const rayM = pass(`uniform sampler2D tS; ${DGL} uniform vec2 uSP; uniform float uOn; void main(){ if(uOn<.01){ gl_FragColor=vec4(0.); return; } vec2 d=(uSP-vUv)/40.; vec2 p=vUv; vec3 c=vec3(0.); float w=1.; float jit=fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056,.00583715)))); p+=d*jit; for(int i=0;i<40;i++){ vec2 q=clamp(p,.001,.999); float z=texture2D(tD,q).x; vec3 s=texture2D(tS,q).rgb; float l=max(s.r,max(s.g,s.b)); float ins=step(0.,p.x)*step(p.x,1.)*step(0.,p.y)*step(p.y,1.); c+=w*ins*(z>=.99999?min(s,vec3(4.))*smoothstep(.6,1.6,l):vec3(0.)); w*=.965; p+=d; } gl_FragColor=vec4(c/26.*uOn,1.); }`, { ...DU, tS: U(null), uSP: U(new THREE.Vector2()), uOn: U(0) });
  const aoM = pass(`${DGL} uniform float uR; uniform vec2 px; vec2 sn(vec2 u){ return (floor(u/px+.25)+.5)*px; }   // 半分辨率的像素中心落在深度像素的交角上，先对齐到深度像素中心，不然掠射面上一行行误判成遮挡（横杠）
    void main(){ vec2 uv=sn(vUv); float z=zAt(uv); if(z>=1.){ gl_FragColor=vec4(1.); return; } vec3 p=vpos(uv,z); vec2 ex=vec2(px.x,0.), ey=vec2(0.,px.y); vec3 dx=vpos(uv+ex,zAt(uv+ex))-p, dx2=p-vpos(uv-ex,zAt(uv-ex)); vec3 dy=vpos(uv+ey,zAt(uv+ey))-p, dy2=p-vpos(uv-ey,zAt(uv-ey)); if(abs(dx2.z)<abs(dx.z)) dx=dx2; if(abs(dy2.z)<abs(dy.z)) dy=dy2; vec3 n=normalize(cross(dx,dy)); float rs=min(.22,uR/max(.1,-p.z)); if(rs<.003){ gl_FragColor=vec4(1.); return; } float a=0.; float rot=6.2831*fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056,.00583715))));
      for(int i=0;i<12;i++){ float f=(float(i)+.5)/12.; float th=rot+float(i)*2.39996; vec2 o=vec2(cos(th),sin(th))*sqrt(f)*rs*vec2(.5625,1.); vec2 q=sn(uv+o); if(q.x<0.||q.y<0.||q.x>1.||q.y>1.) continue; float zz=zAt(q); if(zz>=1.) continue; vec3 v=vpos(q,zz)-p; float l=length(v); a+=max(0.,dot(n,v)/(l+1e-3)-.08)*smoothstep(uR*1.6,0.,l); } gl_FragColor=vec4(vec3(clamp(1.-a/12.*2.1,0.,1.)),1.); }`, { ...DU, uR: U(1), px: U(new THREE.Vector2(1 / W, 1 / H)) });
  const dofM = pass(`uniform sampler2D tS; ${DGL} uniform vec4 uF; void main(){ float z=zAt(vUv); float d=z>=1.?uF.w:-vpos(vUv,z).z; float coc=clamp(abs(d-uF.x)/(uF.y*max(d,.01)+1e-3)*uF.z,0.,1.); if(d<uF.x) coc=clamp((uF.x-d)/(uF.x*uF.y)*uF.z*1.2,0.,1.); vec3 c=vec3(0.); float w=0.; for(int i=0;i<36;i++){ float f=sqrt((float(i)+.5)/36.); float th=float(i)*2.39996; vec2 o=vec2(cos(th),sin(th))*f*coc*.018*vec2(.5625,1.); vec2 q=vUv+o; float zz=zAt(q); float dd=zz>=1.?uF.w:-vpos(q,zz).z; float c2=clamp(abs(dd-uF.x)/(uF.y*max(dd,.01)+1e-3)*uF.z,0.,1.); if(dd<uF.x) c2=clamp((uF.x-dd)/(uF.x*uF.y)*uF.z*1.2,0.,1.); float k=(dd>d-.02*d)?1.:smoothstep(0.,.3,c2); k*=mix(.15,1.,smoothstep(f*coc-.2,f*coc+.02,c2)); vec3 s=min(texture2D(tS,q).rgb,vec3(6.)); float l=max(s.r,max(s.g,s.b)); k*=1.+.6*smoothstep(1.,3.,l); c+=s*k; w+=k; } gl_FragColor=vec4(c/max(w,1e-3),coc); }`, { ...DU, tS: U(null), uF: U(new THREE.Vector4(10, 1, 0, 1000)) });
  const mergeM = pass(`uniform sampler2D tS,tC,tA; uniform float uAO; void main(){ vec3 c=texture2D(tS,vUv).rgb; float a=texture2D(tA,vUv).r; c*=mix(1.,a,uAO); vec4 k=texture2D(tC,vUv); c=c*k.a+k.rgb; if(!(c.r+c.g+c.b<1e6)) c=vec3(0.); gl_FragColor=vec4(c,1.); }`, { tS: U(main.texture), tC: U(cloudRT.texture), tA: U(aoRT.texture), uAO: U(.8) });
  const finM = pass(`uniform sampler2D tS,tB,tR,tDf; ${DGL} uniform vec2 px; uniform float uBl,uEdge,uVig,uGr,uSilk,uExp,uSat,uCon,uT2,uDof,uRayK; uniform vec3 uEdgeC,uTint,uLift; uniform vec4 uWarm;
    vec3 tone(vec3 x){ x*=uExp; float a=2.51,b=.03,c=2.43,d=.59,e=.14; vec3 y=clamp((x*.72*(a*x*.72+b))/(x*.72*(c*x*.72+d)+e),0.,1.); float l=dot(x,vec3(.2126,.7152,.0722)); vec3 soft=x/(1.+max(x.r,max(x.g,x.b))*.55); return mix(y,clamp(soft,0.,1.),.42); }
    float lin(vec2 uv){ return -vpos(uv,zAt(uv)).z; }
    void main(){ vec3 c=texture2D(tS,vUv).rgb; vec4 df=texture2D(tDf,vUv); if(uDof>.001) c=mix(c,df.rgb,smoothstep(.04,.28,df.a)*uDof);
      if(uEdge>.001){ float z=zAt(vUv); if(z<1.){ float d=lin(vUv); vec2 o=px*1.25; float l=lin(vUv-vec2(o.x,0.)),r=lin(vUv+vec2(o.x,0.)),u=lin(vUv+vec2(0.,o.y)),b=lin(vUv-vec2(0.,o.y)); float e=abs(l+r-2.*d)+abs(u+b-2.*d); e=smoothstep(.006,.03,e/d)*smoothstep(1200.,200.,d); float br=.55+.9*vn(vUv*vec2(420.,240.)); c=mix(c, uEdgeC, clamp(e*uEdge*br,0.,.85)*(1.-smoothstep(.1,.4,df.a)*step(.001,uDof))); } }
      c+=texture2D(tB,vUv).rgb*uBl; c+=texture2D(tR,vUv).rgb*uRayK;
      c=tone(c); c=pow(max(c,0.),vec3(1./2.2)); float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,uSat); c=(c-.5)*uCon+.5; c=c+uLift*(1.-l)*(1.-l); c*=mix(vec3(1.),uTint,.5);
      vec2 sp=vUv*vec2(1920.,1080.)+vec2(3000.,5000.); float wv=sin(sp.x*1.9)*.5+sin(sp.y*2.1+sin(sp.x*.02)*2.)*.5; float fib=vn(vec2(sp.x*.06,sp.y*.9))*.6+vn(vec2(sp.x*.9,sp.y*.06))*.6-.6; c+= (wv*.0025+fib*.018)*uSilk;
      vec2 q=vUv-.5; c*=1.-uVig*smoothstep(.18,.95,dot(q,q)*2.1); c+=(h2(gl_FragCoord.xy+floor(uT2*24.)*vec2(17.,59.))-.5)*uGr; c+=(h2(gl_FragCoord.xy*1.7+3.)-.5)/255.; gl_FragColor=vec4(c,1.); }`,
    { ...DU, tS: U(comp.texture), tB: U(null), tR: U(rayRT.texture), tDf: U(dofRT.texture), px: U(new THREE.Vector2(1 / W, 1 / H)), uBl: U(.5), uEdge: U(.5), uVig: U(.35), uGr: U(.02), uSilk: U(1), uExp: U(1), uSat: U(1.06), uCon: U(1.04), uT2: U(0), uDof: U(0), uRayK: U(.5), uEdgeC: U(V3(.95, .70, .28)), uTint: U(V3(1, 1, 1)), uLift: U(V3(0, 0, 0)), uWarm: U(new THREE.Vector4()) });
  X.pre = rt(W, H, { type: THREE.UnsignedByteType }); const trM = pass(`uniform sampler2D tS; uniform float uZ; uniform vec2 uW; uniform vec4 uRp; void main(){ vec2 uv=vUv; vec2 d=uv-uRp.xy; d.x*=1.7778; float r=length(d), g=(r-uRp.z)/.085; float k=exp(-g*g)*uRp.w; uv-=d/max(r,.02)*vec2(.5625,1.)*k*sin(g*2.4)*.020; vec3 c=vec3(0.); if(uZ>.002||dot(uW,uW)>1e-6){ float jit=h2(gl_FragCoord.xy); for(int i=0;i<18;i++){ float f=(float(i)+jit)/18.-.5; vec2 q=uv+(uv-.5)*f*uZ+uW*f; c+=texture2D(tS,clamp(q,.001,.999)).rgb; } c/=18.; } else c=texture2D(tS,clamp(uv,.001,.999)).rgb; c+=vec3(1.,.72,.30)*k*(.5+.5*sin(g*2.4+1.2))*.10; gl_FragColor=vec4(c,1.); }`, { tS: U(X.pre.texture), uZ: U(0), uW: U(new THREE.Vector2()), uRp: U(new THREE.Vector4(.5, .5, 0, 0)) });
  // 转场：推进（改视野）、甩（转机位），模糊在 trM 里做；前后两镜各画各的，运行库叠化
  const DIR = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] };
  X.trans = (cam) => { const s = M.s, p = s && s.params || {}, r = { z: 0, w: [0, 0] }; if (!s) return r; const xo = M.t - s.t1, xi = M.t - s.t0; const ao = p.tout ? M.smooth(-.36, .17, xo) ** 2 : 0, ai = p.tin ? (1 - M.smooth(-.17, .40, xi)) ** 2 : 0; for (const [k, a, sg] of [[p.tout, ao, 1], [p.tin, ai, -1]]) { if (!k || a < .001) continue; if (k === 'zoom') { cam.fov *= sg > 0 ? 1 - .50 * a : 1 + .36 * a; r.z += a * (sg > 0 ? .42 : .30); } else { const d = DIR[k.split('-')[1]]; cam.rotateY(d[0] * sg * a * .50); cam.rotateX(d[1] * -sg * a * .34); r.w[0] += d[0] * a * .26; r.w[1] += d[1] * a * .26; } } return r; };
  X.snap = rt(W, H, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, anisotropy: 4 }); const black = rt(2, 2); R.setRenderTarget(black); R.setClearColor(0, 1); R.clear(); const noCloud = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); noCloud.needsUpdate = true; const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;

  // 设调色板：太阳方向由仰角、方位角定
  X.light = (w, p, o = {}) => {
    const e = (o.sunE ?? p.sunE) * Math.PI / 180, a = (o.sunA ?? p.sunA) * Math.PI / 180, d = V3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    G.uSunDir.value.copy(d); G.uMoonDir.value.copy(d); G.uZen.value.set(...p.zen); G.uHor.value.set(...p.hor); G.uGnd.value.set(...p.gnd); G.uSunCol.value.set(...p.sun); G.uFogCol.value.set(...p.fog); G.uCl.value.set(...p.cl); G.uCs.value.set(...p.cs); G.uAmb.value.set(...p.amb);
    G.uHaze.value = o.haze ?? p.haze; G.uStars.value = o.stars ?? p.stars; G.uMoon.value = o.moon ?? p.moon; G.uSunSize.value = o.sunSize ?? .045; X.uMoonP.value.set(o.moonR ?? .09, o.moonB ?? 1.5, 0, o.full ? 1 : 0); w.sky.material.uniforms.uMoonP.value.copy(X.uMoonP.value); w.sky.material.uniforms.uMilky.value = o.milky ?? 1;
    G.uFogD.value = o.fogD ?? .00055; G.uFogH.value = o.fogH ?? .006; G.uFogY.value = o.fogY ?? 0; G.uSnow.value = o.snow ?? 0; G.uWind.value = o.wind ?? 1; G.uGold.value = o.gold ?? 1; G.uPS.value = 0; G.uBlm.value = 0; G.uWineR.value = 0;
    w.sky.material.uniforms.uStars.value = G.uStars.value; const s = w.sun, c = o.focus || V3(), sd = o.shadowDir || d, r = o.shadowR ?? 12; s.color.setRGB(...p.sun); s.intensity = p.int * (o.int ?? 1) * .55; s.position.copy(c).addScaledVector(sd, r * 4); s.target.position.copy(c); s.target.updateMatrixWorld(); const q = s.shadow.camera; q.left = q.bottom = -r; q.right = q.top = r; q.near = r * .2; q.far = r * 9; q.updateProjectionMatrix(); s.castShadow = o.shadow !== false; s.shadow.normalBias = (o.nb ?? .02) * r / 12;
  };
  // 出一张：w 世界，o 后期参数
  X.render = (ctx, w, o = {}) => {
    const cam = w.cam, f = o, tr = o.to ? { z: 0, w: [0, 0] } : X.trans(cam); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    G.uT.value = o.t ?? 0;
    if (o.mirror) {   // 平面镜像（湖面）：水面 y = o.mirror.y
      const y = o.mirror.y, m = o.mirror.mesh, vc = w.mcam || (w.mcam = new THREE.PerspectiveCamera()); m.visible = false; (o.mirror.hide || []).forEach(x => x.visible = false);
      vc.fov = cam.fov; vc.aspect = cam.aspect; vc.near = cam.near; vc.far = cam.far; vc.updateProjectionMatrix();
      const p = cam.position.clone(); p.y = 2 * y - p.y; const dir = cam.getWorldDirection(V3()); dir.y *= -1; const up = V3(0, 1, 0).applyQuaternion(cam.quaternion); up.y *= -1; vc.position.copy(p); vc.up.copy(up).negate(); vc.up.set(-up.x, -up.y, -up.z); vc.up.set(up.x, -up.y, up.z); vc.up.set(0, 1, 0); vc.lookAt(p.clone().add(dir)); vc.updateMatrixWorld();
      const L = R.localClippingEnabled; R.clippingPlanes = [new THREE.Plane(V3(0, 1, 0), -y + .02)]; R.setRenderTarget(X.refl); R.setClearColor(0, 1); R.clear(); R.render(w.sc, vc); R.clippingPlanes = []; R.localClippingEnabled = L;
      m.visible = true; (o.mirror.hide || []).forEach(x => x.visible = true); o.mirror.mesh.material.uniforms.tRefl.value = X.refl.texture; o.mirror.mesh.material.uniforms.uVPm.value.multiplyMatrices(vc.projectionMatrix, vc.matrixWorldInverse);
    }
    R.setRenderTarget(main); R.setClearColor(0, 1); R.clear(); R.render(w.sc, cam);
    DU.uIP.value.copy(cam.projectionMatrixInverse); DU.uIV.value.copy(cam.matrixWorld); DU.uCam.value.copy(cam.position);
    const cl = o.cloud; let cTex = noCloud;
    if (cl) { const u = cloudM.uniforms; u.uC.value.set(cl.y0, cl.y1, cl.cov ?? .5, cl.far ?? 3000); u.uCD.value = cl.den ?? .05; u.uCS.value = cl.scale ?? .004; u.uCW.value.set(...(cl.wind || [0, 0])); u.uCF.value = cl.fog ?? .0012; draw(cloudM, cloudRT); cTex = cloudRT.texture; }
    mergeM.uniforms.tC.value = cTex; const ao = o.ao ?? .7; if (ao > 0) { aoM.uniforms.uR.value = o.aoR ?? .6; draw(aoM, aoRT); } mergeM.uniforms.tA.value = ao > 0 ? aoRT.texture : white; mergeM.uniforms.uAO.value = ao;
    draw(mergeM, comp);
    // 体积光
    const ld = (o.rayDir || G.uSunDir.value).clone(), fwd = cam.getWorldDirection(V3()), vis = ld.dot(fwd), sp = cam.position.clone().addScaledVector(ld, 1000).project(cam), on = (o.rays ?? .5) * Math.max(0, Math.min(1, (vis - .1) * 2)) * (1 - M.smooth(.55, 1.15, Math.max(Math.abs(sp.x), Math.abs(sp.y)) * .5));
    rayM.uniforms.tS.value = comp.texture; rayM.uniforms.uSP.value.set(sp.x * .5 + .5, sp.y * .5 + .5); rayM.uniforms.uOn.value = on; draw(rayM, rayRT);
    const dof = o.dof; finM.uniforms.uDof.value = dof ? 1 : 0; if (dof) { dofM.uniforms.tS.value = comp.texture; dofM.uniforms.uF.value.set(dof.d, dof.r ?? 1, dof.k ?? 1, dof.far ?? 200); draw(dofM, dofRT); }
    // 泛光
    let src = comp.texture, sw = W, sh = H; for (let i = 0; i < bloomN; i++) { downM.uniforms.tS.value = src; downM.uniforms.px.value.set(1 / sw, 1 / sh); downM.uniforms.uThr.value = i ? 0 : (o.thr ?? .95); draw(downM, bd[i]); src = bd[i].texture; sw = bd[i].width; sh = bd[i].height; }
    let up = bd[bloomN - 1]; for (let i = bloomN - 2; i >= 0; i--) { upM.uniforms.tS.value = up.texture; upM.uniforms.tB.value = bd[i].texture; upM.uniforms.px.value.set(1 / up.width, 1 / up.height); draw(upM, bu[i]); up = bu[i]; }
    const u = finM.uniforms; u.tB.value = up.texture; u.uBl.value = (o.bloom ?? .5) * .22; u.uRayK.value = o.rayK ?? .55; u.uEdge.value = o.edge ?? .45; u.uEdgeC.value.set(...(o.edgeC || [.92, .66, .26])); u.uVig.value = o.vig ?? .42; u.uGr.value = o.grain ?? .018; u.uSilk.value = o.silk ?? 1; u.uExp.value = o.exp ?? 1; u.uSat.value = o.sat ?? 1.22; u.uCon.value = o.con ?? 1.20; u.uT2.value = o.lt ?? 0; u.uTint.value.set(...(o.tint || [1, 1, 1])); u.uLift.value.set(...(o.lift || [0, 0, 0]));
    if (o.to) { draw(finM, o.to); return; }
    const it = M.intensity(), bt = M.t - M.bar().t0, ra = it > .8 && o.ripple !== 0 ? (it - .8) * 5 * Math.exp(-bt * 2.6) * Math.min(1, bt * 14) : 0; if (tr.z > .002 || Math.abs(tr.w[0]) + Math.abs(tr.w[1]) > .001 || ra > .01) { draw(finM, X.pre); const q = trM.uniforms; q.uZ.value = tr.z; q.uW.value.set(...tr.w); q.uRp.value.set(...(o.ripAt || [.42, .5]), .06 + bt * 1.25, ra); draw(trM, null); } else draw(finM, null); R.getContext().finish();
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(GL, 0, 0, M.W, M.H);
  };
  // 通用小工具
  X.pulse = (c, t0, sp, k = 1, dec = 1.6) => { const dt = Math.max(0, M.t - t0); G.uPC.value.copy(c); G.uPR.value = 1 + dt * sp; G.uPS.value = k * Math.exp(-dt * dec) * Math.min(1, dt * 18); };
  X.rng = M.rng; X.sm = M.smooth; X.lerp = M.lerp; X.clamp = M.clamp; X.TAU = M.TAU;
  const P = new Uint8Array(512); for (let i = 0; i < 256; i++) P[i] = P[i + 256] = Math.floor(M.hash(i, 911) * 256);
  X.n2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = (p, q) => P[(P[p & 255] + q) & 255] / 255, f = u * u * (3 - 2 * u), g = v * v * (3 - 2 * v); return (a(i, j) * (1 - f) + a(i + 1, j) * f) * (1 - g) + (a(i, j + 1) * (1 - f) + a(i + 1, j + 1) * f) * g; };
  X.fbm = (x, y, o = 5) => { let s = 0, a = .5; for (let k = 0; k < o; k++) { s += a * X.n2(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= .5; } return s; };
  for (const f of X.build) await f(X, THREE, M);
};
})();
