// title.js —— 片名、演唱者：志莽行书，月白天青釉、金丝铁线冰裂、描金边（用户 2026-11-25 选定）；写字过程仍用运行库的线条字（笔描轮廓 → 从下往上灌满 → 走光）
XJ.build.push((X, THREE, M) => {
  const TR = M.trace, FONT = 'ZhiMangXing', U = (v) => ({ value: v }), RX = 160, RY = 40, RW = 1600, RH = 660, S = Math.max(1, M.SC);
  const ITEMS = [{ s: '小酒一壶', size: 290, y: 398, b1: 2.6, b2: 7.5, bold: 2.6 }, { s: '灼夭', size: 118, y: 596, b1: 1.3, b2: 3.2, bold: 1.2 }];
  for (const it of ITEMS) { const c0 = TR.compose(FONT, it.s, it.size, 0, 0), b = TR.ink(c0.raw), c = TR.compose(FONT, it.s, it.size, it.x = M.W / 2 - (b[0] + b[2]) / 2, it.y); it.ink = TR.ink(c.raw); }
  const cvs = () => { const c = document.createElement('canvas'); c.width = RW * S; c.height = RH * S; const g = c.getContext('2d'); g.setTransform(S, 0, 0, S, -RX * S, -RY * S); g.fillStyle = '#fff'; return [c, g]; };
  const [mask, gm] = cvs(), [bl1, g1] = cvs(), [bl2, g2] = cvs();
  for (const it of ITEMS) { const [tc, tg] = cvs(); tg.font = `${it.size}px "${FONT}"`; tg.textAlign = 'left'; tg.textBaseline = 'alphabetic'; tg.strokeStyle = '#fff'; tg.lineJoin = 'round'; tg.lineWidth = it.bold; let x = it.x; for (const ch of it.s) { tg.fillText(ch, x, it.y); tg.strokeText(ch, x, it.y); x += TR.font(FONT).glyphs[ch].a * it.size; }   /* 用字体本身的字形（有空隙），不用烘的轮廓填：那样会把空隙填实 */ for (const [g, b] of [[gm, 0], [g1, it.b1], [g2, it.b2]]) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = b ? `blur(${b * S}px)` : 'none'; g.drawImage(tc, 0, 0); g.restore(); } }
  const tx = (c) => { const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; };
  const mat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tA: U(tx(bl1)), tB: U(tx(bl2)), uT: U(0) }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }', fragmentShader: 'varying vec2 vUv;\n' + X.GLSL + `
    uniform sampler2D tA,tB; uniform float uT; const vec2 R=vec2(${RW}.,${RH}.);
    float hgt(vec2 u){ return texture2D(tA,u).a*.42+texture2D(tB,u).a*.58; }
    float crk(vec2 p){ vec2 n=floor(p),f=fract(p); float a=9.,b=9.; for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); float d=length(g+vec2(h2(n+g),h2(n+g+31.7))-f); if(d<a){b=a;a=d;} else if(d<b) b=d; } return b-a; }
    void main(){ vec2 p=vUv*R; float small=step(p.y,R.y-(${(596 - 118 * .95).toFixed(1)}-${RY}.)); float sc=mix(1.,.46,small); vec2 d=vec2(1.3)/R;
      float e=texture2D(tA,vUv).a; float hx=hgt(vUv+vec2(d.x,0.))-hgt(vUv-vec2(d.x,0.)), hy=hgt(vUv+vec2(0.,d.y))-hgt(vUv-vec2(0.,d.y)); vec3 n=normalize(vec3(-vec2(hx,hy)*6.2*sc,1.));
      vec2 q=p/sc; float w=fbm(q*.020); float c1=crk(q/44.+w*1.1), c2=crk(q/17.+w*1.6+9.); float pool=fbm(q*.013+4.)*.62+fbm(q*.05)*.38;
      n=normalize(n+vec3(fbm(q*.045)-.5,fbm(q*.045+7.)-.5,0.)*.14);
      vec3 g=mix(vec3(.50,.775,.745),vec3(.925,.985,.945),smoothstep(.24,.70,pool)); g=mix(g,vec3(.98,.99,.94),smoothstep(.95,.78,e)*.5); g=mix(g,vec3(.36,.66,.68),smoothstep(.46,.26,pool)*.45);
      float iron=smoothstep(.052,.012,c1), gold=smoothstep(.050,.010,c2)*smoothstep(.40,.58,fbm(q*.017+2.)); g=mix(g,g*.86,smoothstep(.13,.02,c1)*.5); g=mix(g,vec3(.30,.185,.125),iron*.72); g=mix(g,vec3(.83,.57,.20),gold*.85*(1.-iron));
      vec3 L=normalize(vec3(-.42,.66,.62)); float df=max(dot(n,L),0.); vec3 r=reflect(vec3(0.,0.,-1.),n); float fr=pow(1.-n.z,1.6);
      vec3 env=mix(vec3(.05,.16,.20),vec3(.98,.86,.66),smoothstep(-.55,.35,r.y)); env=mix(env,vec3(1.,1.,.98),smoothstep(.30,.75,r.y));
      vec3 col=g*(.46+.66*df)+env*fr*.34; float bx=smoothstep(.10,.18,r.y)*smoothstep(.66,.55,r.y)*smoothstep(-.62,-.50,r.x)*smoothstep(.02,-.10,r.x); col+=vec3(1.,.99,.95)*bx*.26; col+=vec3(1.,.97,.88)*pow(max(dot(r,L),0.),70.)*.7;
      float rim=smoothstep(.90,.78,e); float gt=.5+.5*r.y+.22*(vn(vec2(q.x*.9,q.y*.10))-.5)+.10*(fbm(q*.2)-.5); vec3 au=mix(vec3(.34,.165,.030),vec3(.90,.60,.17),smoothstep(.12,.50,gt)); au=mix(au,vec3(1.,.90,.58),smoothstep(.58,.95,gt)); au+=vec3(1.,.9,.6)*pow(max(dot(r,L),0.),34.)*.6; col=mix(col,au,rim);
      float bd=p.x*.9+(R.y-p.y)*.35-mod(uT*520.,2600.)+260.; col+=vec3(1.,.98,.90)*exp(-bd*bd/5200.)*(.30+.35*rim); gl_FragColor=vec4(clamp(col,0.,1.),1.); }` });
  X.drawTitle = (o, lt, a) => {
    const ez = (t0, d) => M.ease.inOut3(M.clamp((lt - t0) / d)), fp = ez(3.05, 1.1), af = M.clamp((lt - 6.15) / .45);
    const no = 'rgba(255,236,180,0)', Lt = M.layer('ttl2'), q = Lt.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.clearRect(0, 0, Lt.width, Lt.height); q.setTransform(M.SC, 0, 0, M.SC, 0, 0); M.trace.title(q, lt, 1, { title: ITEMS[0].s, artist: ITEMS[1].s, font: FONT, artistFont: FONT, size: ITEMS[0].size, y: ITEMS[0].y, artistY: ITEMS[1].y, artistSize: ITEMS[1].size, line: '#ffe6ae', fill: [no, no] });
    const L = M.layer('ttl'), c = L.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, L.width, L.height); c.setTransform(M.SC, 0, 0, M.SC, 0, 0);
    if (fp > 0) { mat.uniforms.uT.value = Math.max(0, lt - 3.6); X.draw(mat, null); X.R.getContext().finish(); c.imageSmoothingQuality = 'high'; c.drawImage(X.GL, RX, RY, RW, RH); c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, RX, RY, RW, RH); const t = ITEMS[0].ink, b = ITEMS[1].ink, fy = t[3] + 6 - (t[3] - t[1] + 12) * fp; c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fillRect(0, 0, M.W, fy); if (af < 1) { c.globalAlpha = 1 - af; c.fillRect(0, b[1] - 12, M.W, b[3] - b[1] + 24); c.globalAlpha = 1; } c.globalCompositeOperation = 'source-over'; }
    { const sy = ITEMS[0].ink[3] + 34, ry = ITEMS[1].ink[1] - 12; for (const [y0, y1, al] of [[0, sy, 1 - .95 * M.smooth(4.0, 4.5, lt)], [sy, ry, 1], [ry, M.H, 1 - .95 * M.smooth(6.5, 6.9, lt)]]) { c.save(); c.globalCompositeOperation = 'destination-over'; c.globalAlpha = al; c.beginPath(); c.rect(0, y0, M.W, y1 - y0); c.clip(); c.drawImage(Lt, 0, 0, M.W, M.H); c.restore(); } }
    o.save(); o.globalAlpha *= a; o.filter = 'drop-shadow(0px 0px 5px rgba(2,9,15,.95)) drop-shadow(0px 7px 16px rgba(2,9,15,.80)) drop-shadow(0px 0px 34px rgba(255,206,120,.20))'; o.drawImage(L, 0, 0, M.W, M.H); o.restore();
  };
});
