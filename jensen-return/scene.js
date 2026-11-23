// 黑白漫画分格：只有墨、纸和一个英伟达绿；灰一律是网点。画法参考 lemo-opuscar 的 manga-panels（见 NOTES.md）。
const PAPER = '#F3F0E8', INK = '#121212', ACC = '#76B900';
const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };

function tone(M, key, w, h, cover, cell = 9) {
  return M.cached('tone_' + key, w, h, (g) => {
    g.fillStyle = INK;
    const q = Math.SQRT1_2, n = Math.ceil((w + h) / cell) + 2;
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const x = w / 2 + (i - j) * q * cell, y = h / 2 + (i + j) * q * cell;
      if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
      const v = cover(x / w, y / h);
      if (v > 0.02) { g.beginPath(); g.arc(x, y, cell * Math.sqrt(Math.min(v, 0.62) / Math.PI), 0, M.TAU); g.fill(); }
    }
  }, true);
}

function focus(ctx, M, cx, cy, rx, ry, n, seed, col = INK) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = ((i + M.hash(i + 31) * 0.8 + (M.hash(seed + i) - 0.5) * 0.06) / n) * M.TAU, k = 1 + M.hash(i + 531) * 0.45 + (M.hash(seed + i + 500) - 0.5) * 0.03;
    const w = (1.5 + M.hash(i + 931) * 8) / 1700, r = 2200;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
    ctx.lineTo(cx + Math.cos(a - w) * r, cy + Math.sin(a - w) * r);
    ctx.lineTo(cx + Math.cos(a + w) * r, cy + Math.sin(a + w) * r);
    ctx.fill();
  }
}

// 出格的人物带白边：纸色一圈 + 细墨线
function halo(M, key, im, r = 12) {
  const pad = r + 4;
  return M.cached('halo_' + key, im.width + pad * 2, im.height + pad * 2, (g) => {
    const mask = (col) => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      return c;
    };
    const ring = (c, rr) => { for (let i = 0; i < 32; i++) { const a = (i / 32) * M.TAU; g.drawImage(c, pad + Math.cos(a) * rr, pad + Math.sin(a) * rr); } };
    ring(mask(INK), r + 3); ring(mask(PAPER), r); g.drawImage(im, pad, pad);
  }, true);
}

// 字的白底：描边再铺满字的外接框，笔画间的缝一定是白的，不会夹出黑线（「仁」变「仨」就是这条黑线）
function plate(M, ch, font, px, stroke = 1) {
  const S = 2, size = Math.ceil(px * 2.1), W = size * S;
  return M.cached(`plate_${font}_${px}_${stroke}_${ch}`, W, W, (x) => {
    x.font = `${px * S}px "${font}"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = px * 0.3 * stroke * S; x.strokeStyle = x.fillStyle = PAPER;
    x.strokeText(ch, W / 2, W / 2);
    const m = x.measureText(ch);
    x.fillRect(W / 2 - m.actualBoundingBoxLeft, W / 2 - m.actualBoundingBoxAscent, m.actualBoundingBoxLeft + m.actualBoundingBoxRight, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  });
}

// 白底外的一圈墨线单独一层：整行先画墨线、再画白底，字和字之间不留黑缝
function plateInk(M, ch, font, px, stroke = 1) {
  const S = 2, W = Math.ceil(px * 2.1) * S;
  return M.cached(`plateInk_${font}_${px}_${stroke}_${ch}`, W, W, (g) => {
    const ink = document.createElement('canvas'); ink.width = ink.height = W;
    const y = ink.getContext('2d'); y.drawImage(plate(M, ch, font, px, stroke), 0, 0); y.globalCompositeOperation = 'source-in'; y.fillStyle = INK; y.fillRect(0, 0, W, W);
    const r = Math.max(3, px * 0.04 * stroke) * S;
    for (let i = 0; i < 28; i++) { const a = (i / 28) * M.TAU; g.drawImage(ink, Math.cos(a) * r, Math.sin(a) * r); }
  });
}

function slam(ctx, M, txt, x, y, px, rot, font = 'NotoSansSC-900') {
  const b = Math.floor(M.t * 12);
  ctx.save();
  ctx.translate(x + (M.hash(b + 11) - 0.5) * 3, y + (M.hash(b + 23) - 0.5) * 3); ctx.rotate(rot);
  ctx.font = `${px}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const z = Math.ceil(px * 2.1); ctx.drawImage(plateInk(M, txt, font, px), -z / 2, -z / 2, z, z); ctx.drawImage(plate(M, txt, font, px), -z / 2, -z / 2, z, z);
  ctx.fillStyle = INK; ctx.fillText(txt, 0, 0);
  ctx.restore();
}

function balloon(ctx, M, cx, cy, rx, ry, tail, lines, zh, side = 1) {
  if (M.noLyrics) return;
  const parts = [
    () => ctx.ellipse(cx, cy, rx, ry, 0, 0, M.TAU),
    () => { ctx.moveTo(cx + side * rx * 0.72, cy - ry * 0.34); ctx.lineTo(tail[0], tail[1]); ctx.lineTo(cx + side * rx * 0.62, cy + ry * 0.62); ctx.closePath(); },
  ];   // 椭圆和尾巴分开填，绕向相反时才不会抠出一个洞
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineJoin = 'round';
  parts.forEach((p) => { ctx.beginPath(); p(); ctx.stroke(); });
  ctx.fillStyle = PAPER; parts.forEach((p) => { ctx.beginPath(); p(); ctx.fill(); });
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '84px "Anton"'; lines.forEach((l, i) => ctx.fillText(l, cx, cy - 74 + i * 92));
  ctx.font = '42px "NotoSansSC-900"'; ctx.fillText(zh, cx, cy + 96);
  ctx.restore();
}

function narration(ctx, M, xr, y, cols) {
  if (M.noLyrics) return;
  const px = 46, step = 54, gap = 66, h = Math.max(...cols.map((c) => c.length)) * step + 36, w = cols.length * gap + 26;
  ctx.save();
  ctx.fillStyle = INK; ctx.fillRect(xr - w + 9, y + 9, w, h);
  ctx.fillStyle = PAPER; ctx.fillRect(xr - w, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.strokeRect(xr - w, y, w, h);
  ctx.fillStyle = INK; ctx.font = `${px}px "NotoSansSC-900"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  cols.forEach((c, i) => [...c].forEach((ch, j) => ctx.fillText(ch, xr - 13 - gap / 2 - i * gap, y + 18 + step / 2 + j * step)));
  ctx.restore();
}

const bbox = (p) => { const xs = p.map((a) => a[0]), ys = p.map((a) => a[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const T = (M, ref) => M.events([ref])[0];   // 时间只从 song.json 来

function cover(ctx, im, x, y, w, h, z = 1, u = 0.5, v = 0.5) {
  const k = Math.max(w / im.width, h / im.height) * z, dw = im.width * k, dh = im.height * k;
  ctx.drawImage(im, x + (w - dw) * u, y + (h - dh) * v, dw, dh);
}

// 一格：按阅读方向（右→左）擦入，内容滑进来后落定
function panel(ctx, M, s, pts, tin, draw, o = {}) {
  if (tin <= s.t0 + 0.001) tin = s.t0 - 1;   // 镜头第一格由转场带进来，转场前半段就要在
  const age = s.t - tin;
  if (age < 0) return false;
  const [x0, y0, x1, y1] = bbox(pts), w = x1 - x0, h = y1 - y0;
  const wipe = M.ease.inOut2(M.clamp(age / 0.34, 0, 1)), slide = (1 - M.ease.out3(M.clamp(age / 0.24, 0, 1))) * (o.slide ?? 70);
  ctx.save();
  ctx.beginPath(); ctx.rect(x1 - w * wipe - 1, y0 - 8, w * wipe + 9, h + 16); ctx.clip();
  ctx.save(); poly(ctx, pts); ctx.clip();
  ctx.fillStyle = o.bg || PAPER; ctx.fillRect(x0, y0, w, h);
  ctx.translate(slide, 0);
  draw(x0, y0, w, h, age);
  ctx.restore();
  poly(ctx, pts); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineJoin = 'miter'; ctx.setLineDash(o.dash || []); ctx.stroke();
  ctx.restore();
  return true;
}

// 手写大字：逐字砸下，三层描边，线条 12fps 抖动
function shout(ctx, M, s, txt, x, y, px, tin, o = {}) {
  if (M.noLyrics) return;
  const font = o.font || 'NotoSansSC-900', chars = [...txt], vert = !!o.vert, b = Math.floor(s.t * 12);
  ctx.save(); ctx.font = `${px}px "${font}"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const adv = chars.map((c) => (vert ? px * 1.08 : ctx.measureText(c).width + (o.track ?? px * 0.04)));
  const total = adv.reduce((a, v) => a + v, 0), stroke = o.stroke ?? 1;
  for (let pass = 0; pass < 3; pass++) {
    let pos = -total / 2;
    chars.forEach((ch, i) => {
      const c = pos + adv[i] / 2; pos += adv[i];
      const a = s.t - tin - i * (o.stagger ?? 0.05);
      if (ch === ' ' || a < 0) return;
      const k = 1 + 0.75 * (1 - M.ease.outBack(M.clamp(a / 0.18, 0, 1), 2));
      ctx.save();
      ctx.translate(x + (vert ? 0 : c) + (M.hash(b, i + 3) - 0.5) * 3, y + (vert ? c : 0) + (M.hash(b, i + 41) - 0.5) * 3);
      ctx.rotate((o.tilt || 0) + (M.hash(i, 7) - 0.5) * (o.rot ?? 0.14)); ctx.scale(k, k);
      const rv = M.clamp(a / 0.12, 0, 1); if (rv < 1) { ctx.beginPath(); ctx.arc(0, 0, px * 1.3 * rv * (2 - rv), 0, M.TAU); ctx.clip(); }
      const z = Math.ceil(px * 2.1);
      if (pass === 0) ctx.drawImage(plateInk(M, ch, font, px, stroke), -z / 2, -z / 2, z, z);
      if (pass === 1) ctx.drawImage(plate(M, ch, font, px, stroke), -z / 2, -z / 2, z, z);
      if (pass === 2) { ctx.fillStyle = INK; ctx.fillText(ch, 0, 0); }
      ctx.restore();
    });
  }
  ctx.restore();
}

function caption(ctx, M, txt, cx, cy, px = 40) {
  if (M.noLyrics) return;
  ctx.save(); ctx.font = `${px}px "Anton"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 44, h = px + 26;
  ctx.fillStyle = INK; ctx.fillRect(cx - w / 2 + 7, cy - h / 2 + 7, w, h);
  ctx.fillStyle = PAPER; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.fillStyle = INK; ctx.fillText(txt, cx, cy + 2);
  ctx.restore();
}

function stars(ctx, M, s, n, x, y, w, h, seed) {
  const beat = M.pulse('beat', { decay: 0.25 });
  for (let i = 0; i < n; i++) {
    const px = x + M.hash(i, seed) * w, py = y + M.hash(i, seed + 1) * h, tw = 0.5 + 0.5 * Math.sin(s.t * 3 + i * 1.7);
    const R = (3 + M.hash(i, seed + 2) * 8) * (0.35 + tw * 0.75) + beat * 2.5, r = R * 0.16;
    ctx.fillStyle = PAPER; ctx.beginPath();
    for (let j = 0; j < 8; j++) { const a = (j / 8) * M.TAU, q = j % 2 ? r : R; ctx[j ? 'lineTo' : 'moveTo'](px + Math.cos(a) * q, py + Math.sin(a) * q); }
    ctx.closePath(); ctx.fill();
  }
}

function dust(ctx, M, s, n, seed, col = INK) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const v = 14 + M.hash(i, seed) * 34, x = (M.hash(i, seed + 1) * 2100 + s.t * v) % 2100 - 90, y = M.hash(i, seed + 2) * 1080 + Math.sin(s.t * 0.7 + i) * 16;
    ctx.beginPath(); ctx.arc(x, y, 1.4 + M.hash(i, seed + 3) * 3.2, 0, M.TAU); ctx.fill();
  }
}

function stampMark(ctx, M, s, txt, cx, cy, tin, rot, w = 430, h = 190) {
  const a = s.t - tin;
  if (a < 0 || M.noLyrics) return;
  const k = 1 + 0.65 * (1 - M.ease.inOut2(M.clamp(a / 0.22, 0, 1)));
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k);
  const rv = M.clamp(a / 0.2, 0, 1); if (rv < 1) { ctx.beginPath(); ctx.arc(0, 0, Math.hypot(w, h) * 0.55 * rv * (2 - rv), 0, M.TAU); ctx.clip(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = txt === 'CEO' ? '130px "Anton"' : '112px "NotoSansSC-900"'; ctx.fillText(txt, 0, 5);
  ctx.restore();
}

MV.scene({
  bg: PAPER,
  shots: {
    key(ctx, s, M) {
      const pts = [[36, 30], [1888, 46], [1878, 1050], [44, 1034]], boil = Math.floor(s.t * 12), beat = M.pulse('beat', { decay: 0.22 });
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, M.W, M.H);
      ctx.save(); poly(ctx, pts); ctx.clip();
      ctx.drawImage(tone(M, 'radial2', 1920, 1080, (u, v) => 0.56 * M.smooth(0.22, 0.86, Math.hypot((u - 0.3) * 1.5, v - 0.4))), 0, 0, 1920, 1080);
      focus(ctx, M, 590, 430, 640, 470, 170, boil * 37);
      const c = M.img.chip, k = 0.82 * (1 + beat * 0.012);
      ctx.save(); ctx.translate(1510, 690); ctx.rotate(0.08); ctx.scale(k, k);
      ctx.drawImage(halo(M, 'chip', c, 9), -c.width / 2 - 13, -c.height / 2 - 13, c.width + 26, c.height + 26); ctx.restore();
      ctx.restore();
      ctx.save(); poly(ctx, pts); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.restore();
      const h = M.img.jh_gesture, q = 1060 / h.height, bob = beat * 4;
      ctx.drawImage(halo(M, 'jhg', h, 8), 10 - 12 * q, 30 - 12 * q - bob, (h.width + 24) * q, (h.height + 24) * q);
      balloon(ctx, M, 1370, 216, 470, 176, [640, 300], ["I CAN'T WAIT TO GET", 'BACK TO WORK.'], '我等不及要回去工作了', -1);
      narration(ctx, M, 196, 66, ['十一月二十三日', '即刻生效']);
      slam(ctx, M, '轰', 1130, 965, 150, -0.14);
    },
    campus(ctx, s, M) {
      const pts = [[30, 26], [1890, 34], [1884, 1054], [36, 1046]];
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        cover(ctx, M.img.s_campus, x, y, w, h, 1.03 + s.p * 0.08, 0.5, 0.36);
        stars(ctx, M, s, 46, x + 10, y + 8, w - 20, 170, 11);
      }, { slide: 0 });
      narration(ctx, M, 1846, 66, ['十一月二十三日', '二〇二六年']);
      shout(ctx, M, s, '黄仁勋回归', 930, 850, 176, T(M, 'bar2'), { stagger: 0.07, tilt: -0.025 });
      if (s.t >= T(M, 'bar2.3')) caption(ctx, M, 'MUSIC  VICTORY  /  TWO STEPS FROM HELL', 930, 1000, 34);
      const op = M.clamp((s.t - T(M, 'bar1')) / 1.1, 0, 1);   // 第一拍：夜景从黑页中间打开，开口面积匀速变大
      if (op < 1) {
        const R = Math.sqrt(M.ease.inOut2(op)) * 1120;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, M.W, M.H); ctx.moveTo(960 + R, 540); ctx.arc(960, 540, R, 0, M.TAU);
        ctx.fillStyle = INK; ctx.fill('evenodd'); ctx.restore();
      }
    },
    press(ctx, s, M) {
      const pts = [[26, 30], [1894, 18], [1880, 1060], [44, 1046]], z = 1.03 + s.p * 0.05;
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        ctx.save(); ctx.translate(960, 540); ctx.scale(z, z); ctx.translate(-960, -540);
        cover(ctx, M.img.s_press, x, y, w, h);
        ctx.save(); poly(ctx, [[306, 420], [1200, 210], [1914, 720], [1914, 1090], [795, 1090]]); ctx.clip();
        if (!M.noLyrics) {
          ctx.transform(0.974, -0.225, 0.61, 0.79, 470, 470);
          ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          const roll = -210 + s.p * 330;
          ['NVIDIA BOARD', 'REINSTATES', 'JENSEN HUANG'].forEach((l, i) => { ctx.font = `${i === 2 ? 118 : 86}px "Anton"`; ctx.fillText(l, 40, roll + i * 122); });
        }
        ctx.restore(); ctx.restore();
      }, { slide: 0 });
    },
    effective(ctx, s, M) {
      const glow = M.pulse('beat', { decay: 0.2 });
      panel(ctx, M, s, [[1010, 30], [1890, 26], [1880, 1052], [900, 1048]], s.t0, (x, y, w, h) => {
        ctx.drawImage(tone(M, 'eff', 1920, 1080, (u, v) => 0.5 * M.smooth(0.15, 0.75, Math.hypot(u - 0.72, v - 0.5) * 1.5)), 0, 0, 1920, 1080);
        focus(ctx, M, 1400, 500, 330, 420, 110, Math.floor(s.t * 12) * 31);
      }, { slide: 40 });
      panel(ctx, M, s, [[30, 34], [986, 30], [876, 1048], [40, 1052]], s.t0, (x, y, w, h) => {
        ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
        const c = M.img.chip_dark, k = 0.86 + s.p * 0.05;
        ctx.save(); ctx.translate(470, 540); ctx.rotate(-0.08); ctx.scale(k, k); ctx.drawImage(halo(M, 'chipd', c, 9), -c.width / 2 - 13, -c.height / 2 - 13, c.width + 26, c.height + 26); ctx.restore();
      });
      shout(ctx, M, s, '即刻生效', 1400, 470, 178, s.t0 + 0.04, { vert: true, stagger: 0.06 });
      if (s.t >= T(M, 'bar5.2')) caption(ctx, M, 'EFFECTIVE IMMEDIATELY', 1400, 960 - glow * 3, 46);
    },
    board(ctx, s, M) {
      const pts = [[34, 30], [1886, 22], [1892, 1050], [28, 1056]];
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        cover(ctx, M.img.s_board, x, y, w, h, 1.03 + s.p * 0.11, 0.5, 0.34);
        dust(ctx, M, s, 34, 5);
      }, { slide: 0 });
      narration(ctx, M, 1846, 66, ['董事会']);
    },
    vote(ctx, s, M) {
      const lv = ['bar8', 'bar9', 'bar10', 'bar11'].map((r) => T(M, r)), l = Math.max(1, lv.filter((t) => s.t >= t - 0.001).length) - 1;
      const g = 22, X0 = 30, Y0 = 30, W = 1860, H = 1020, shear = (y) => (y - 540) * -0.035;
      const inked = s.t >= lv[l] + [1, 2, 4, 8][l] * (l === 3 ? 0.05 : 0.08) + 0.36;   // 新格都盖好后撤掉垫底的上一级，缝里不露旧图
      for (let L = inked ? l : Math.max(0, l - 1); L <= l; L++) {
      const n = [1, 2, 4, 8][L], cols = [1, 2, 2, 4][L], rows = [1, 1, 2, 2][L];
      const cw = (W - g * (cols - 1)) / cols, ch = (H - g * (rows - 1)) / rows;
      for (let i = 0; i < n; i++) {
        const c = cols - 1 - (i % cols), r = Math.floor(i / cols), x = X0 + c * (cw + g), y = Y0 + r * (ch + g);
        const pts = [[x + shear(y), y], [x + cw + shear(y), y], [x + cw + shear(y + ch), y + ch], [x + shear(y + ch), y + ch]];
        panel(ctx, M, s, pts, lv[L] + i * (L === 3 ? 0.05 : 0.08), (x0, y0, w, h, age) => {
          ctx.drawImage(tone(M, 'v' + L, 1920, 1080, (u, v) => 0.34 + 0.2 * Math.sin(u * 5 + v * 3)), 0, 0, 1920, 1080);
          focus(ctx, M, x0 + w / 2, y0 + h * 0.42, w * 0.3, h * 0.34, 54, (Math.floor(s.t * 12) + i) * 23);
          const im = i % 2 ? M.img.hand_b : M.img.hand_a, q = (h * 0.98) / im.height, rise = (1 - M.ease.outBack(M.clamp(age / 0.24, 0, 1), 1.6)) * h * 0.42;
          ctx.save(); ctx.translate(x0 + w / 2, y0 + h + rise + M.pulse('beat', { decay: 0.16 }) * 7); if (i % 3 === 2) ctx.scale(-1, 1);
          ctx.drawImage(halo(M, i % 2 ? 'hb' : 'ha', im, 6), -im.width * q / 2 - 10 * q, -im.height * q - 10 * q, (im.width + 20) * q, (im.height + 20) * q); ctx.restore();
        }, { slide: 34 });
      }
      }
    },
    unanimous(ctx, s, M) {
      const pts = [[24, 40], [1896, 24], [1884, 1058], [40, 1044]], a = M.img.hand_a, q = 1010 / a.height;
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        ctx.drawImage(tone(M, 'una', 1920, 1080, (u, v) => 0.6 * M.smooth(0.18, 0.72, Math.hypot((u - 0.5) * 1.5, v - 0.42))), 0, 0, 1920, 1080);
        focus(ctx, M, 960, 450, 470, 330, 190, Math.floor(s.t * 12) * 17);
        const rise = (1 - M.ease.out3(M.clamp(s.lt / 0.5, 0, 1))) * 260;
        ctx.drawImage(halo(M, 'ha', a, 6), 960 - a.width * q / 2, 1100 - a.height * q + rise, (a.width + 20) * q, (a.height + 20) * q);
      }, { slide: 0 });
      shout(ctx, M, s, '全票通过', 960, 850, 220, T(M, 'bar12.2'), { stagger: 0.08, tilt: -0.03 });
      if (s.t >= T(M, 'bar13')) caption(ctx, M, 'THE BOARD VOTED UNANIMOUSLY', 960, 1002, 44);
    },
    stamps(ctx, s, M) {
      const press = M.pulse(['bar14.3', 'bar15', 'bar15.3'], { decay: 0.25, pre: 0.12 });
      panel(ctx, M, s, [[1060, 30], [1892, 24], [1886, 1054], [960, 1050]], s.t0, (x, y, w, h) => {
        ctx.save(); ctx.translate(0, press * 12); cover(ctx, M.img.s_stamp, x, y - 30, w, h + 60, 1, 0.86, 0.5); ctx.restore();
      }, { slide: 46 });
      panel(ctx, M, s, [[28, 30], [1036, 26], [936, 1050], [36, 1054]], s.t0, (x, y, w, h) => {
        ctx.drawImage(tone(M, 'stp', 1920, 1080, (u, v) => 0.12 + 0.2 * v), 0, 0, 1920, 1080);
        ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 5;
        ctx.save(); ctx.translate(510, 540); ctx.rotate(-0.035); ctx.fillRect(-370, -470, 740, 940); ctx.strokeRect(-370, -470, 740, 940); ctx.restore();
      });
      stampMark(ctx, M, s, '总裁', 510, 245, T(M, 'bar14.3'), -0.07);
      stampMark(ctx, M, s, 'CEO', 500, 540, T(M, 'bar15'), 0.05);
      stampMark(ctx, M, s, '董事', 520, 832, T(M, 'bar15.3'), -0.04);
    },
    corridor(ctx, s, M) {
      const pts = [[30, 28], [1890, 22], [1884, 1056], [34, 1050]], z = 1.04 + M.ease.inOut2(s.p) * 0.3;
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        ctx.save(); ctx.translate(960, 300); ctx.scale(z, z); ctx.translate(-960, -300);
        cover(ctx, M.img.hero_back, x, y, w, h); ctx.restore();
        dust(ctx, M, s, 40, 9);
      }, { slide: 0 });
      narration(ctx, M, 1846, 66, ['回到英伟达']);
    },
    shoes(ctx, s, M) {
      const pts = [[26, 40], [1894, 26], [1882, 1050], [40, 1056]];
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        cover(ctx, M.img.s_shoes, x, y, w, h, 1.05 + s.p * 0.07, 0.5, 0.7);
        focus(ctx, M, 1400, 780, 640, 420, 80, Math.floor(s.t * 12) * 13);
      }, { slide: 0 });
      shout(ctx, M, s, '咚', 340, 280, 230, T(M, 'bar18'), { rot: 0.1 });
      shout(ctx, M, s, '咚', 1745, 285, 170, T(M, 'bar19'), { rot: -0.1 });
    },
    eyes(ctx, s, M) {
      ctx.fillStyle = INK; ctx.fillRect(0, 0, M.W, M.H);
      const pts = [[30, 170], [1890, 150], [1884, 930], [36, 910]], z = 1.2 + s.p * 0.1, g = M.pulse(['bar21'], { decay: 0.45 });
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        const im = M.img.s_eyes, k = Math.max(w / im.width, h / im.height) * z, ox = x + (w - im.width * k) * 1, oy = y + (h - im.height * k) * 0.42;
        ctx.drawImage(im, ox, oy, im.width * k, im.height * k);
        if (g > 0.02) {
          const R = 150 * g, r = R * 0.12, cx = ox + 1120 * k, cy = oy + 470 * k;
          ctx.beginPath(); for (let j = 0; j < 8; j++) { const a = (j / 8) * M.TAU, q = j % 2 ? r : R; ctx[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
          ctx.closePath(); ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
        }
      }, { slide: 0, bg: INK });
    },
    talk(ctx, s, M) {
      const pts = [[36, 30], [1886, 40], [1880, 1050], [42, 1040]], im = M.img.jh_talk, q = 1010 / im.height, beat = M.pulse('beat', { decay: 0.22 });
      panel(ctx, M, s, pts, s.t0, () => {
        ctx.drawImage(tone(M, 'talk', 1920, 1080, (u, v) => 0.56 * M.smooth(0.2, 0.85, Math.hypot((u - 0.36) * 1.5, v - 0.46))), 0, 0, 1920, 1080);
        focus(ctx, M, 650, 500, 590, 480, 140, Math.floor(s.t * 12) * 19);
      }, { slide: 0 });
      ctx.drawImage(halo(M, 'jht', im, 8), -20 - 12 * q, 1090 - im.height * q - 12 * q - beat * 3, (im.width + 24) * q, (im.height + 24) * q);
      const ba = s.t - T(M, 'bar22.2');
      if (ba >= 0) { ctx.save(); if (ba < 0.2) { const e = ba / 0.2; ctx.beginPath(); ctx.arc(905, 600, 1500 * e * (2 - e), 0, M.TAU); ctx.clip(); } balloon(ctx, M, 1400, 250, 470, 186, [905, 600], ['I AM HONORED', 'TO RETURN TO NVIDIA'], '很荣幸回到英伟达', -1); ctx.restore(); }
    },
    chipon(ctx, s, M) {
      ctx.fillStyle = INK; ctx.fillRect(0, 0, M.W, M.H);
      const on = M.clamp((s.t - T(M, 'bar24.3')) / 0.42, 0, 1), c = M.img.chip, d = M.img.chip_dark, k = 1.18 + s.p * 0.05, W = c.width + 26, H = c.height + 26;
      if (on > 0) { ctx.save(); ctx.globalAlpha = M.clamp(on * 2, 0, 1); focus(ctx, M, 960, 540, 560 + on * 90, 420 + on * 60, 170, Math.floor(s.t * 12) * 29, PAPER); ctx.restore(); }
      ctx.save(); ctx.translate(960, 540); ctx.rotate(-0.08); ctx.scale(k, k);
      ctx.drawImage(halo(M, 'chipd', d, 9), -W / 2, -H / 2, W, H);
      if (on > 0) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, M.ease.out3(on) * 640, 0, M.TAU); ctx.clip(); ctx.drawImage(halo(M, 'chip', c, 9), -W / 2, -H / 2, W, H); ctx.restore(); }
      ctx.restore();
      shout(ctx, M, s, '嗡', 1650, 240, 200, T(M, 'bar24.3'), { rot: 0.12 });
    },
    servers(ctx, s, M) {
      const pts = [[30, 26], [1890, 36], [1882, 1054], [38, 1046]];
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        cover(ctx, M.img.s_servers, x, y, w, h, 1.03 + s.p * 0.08);
        for (const side of [-1, 1]) for (let c = 0; c < 26; c++) {   // 指示灯排在机柜面上，按透视从走廊深处一路亮到眼前
          const z = 1.08 * Math.pow(4.6 / 1.08, c / 25), tin = s.t0 + (1 - c / 25) * 1.1;
          if (s.t < tin) continue;
          for (let r = 0; r < 18; r++) {
            if (M.hash(c * 31 + r, side + 2) < 0.38) continue;
            const px = 950 + side * 930 / z, py = 553 + (-470 + r * 58) / z, q = Math.max(1.6, 8 / z);
            ctx.fillStyle = INK; ctx.fillRect(px - q - 1.5, py - q - 1.5, q * 2 + 3, q * 2 + 3);
            ctx.fillStyle = ACC; ctx.fillRect(px - q, py - q, q * 2, q * 2);
          }
        }
      }, { slide: 0 });
    },
    stock(ctx, s, M) {
      const pts = [[30, 34], [1890, 26], [1882, 1050], [40, 1044]], P = [[110, 900], [340, 850], [540, 875], [750, 770], [930, 800], [1120, 630], [1290, 660], [1480, 390], [1640, 310], [1850, 46]];
      panel(ctx, M, s, pts, s.t0, () => {
        ctx.drawImage(tone(M, 'stk', 1920, 1080, (u, v) => 0.1 + 0.26 * v), 0, 0, 1920, 1080);
        ctx.strokeStyle = INK; ctx.lineWidth = 2;
        for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, i * 120); ctx.lineTo(1920, i * 120); ctx.moveTo(i * 213, 0); ctx.lineTo(i * 213, 1080); ctx.stroke(); }
      }, { slide: 0 });
      const e = M.ease.out3(M.clamp((s.t - T(M, 'bar26')) / 1.1, 0, 1)) * (P.length - 1), n = Math.floor(e), f = e - n;
      const line = P.slice(0, n + 1); if (n < P.length - 1) line.push([M.lerp(P[n][0], P[n + 1][0], f), M.lerp(P[n][1], P[n + 1][1], f)]);
      const tip = line[line.length - 1], prev = line[line.length - 2] || P[0], a = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
      for (const [col, lw, R] of [[INK, 30, 66], [ACC, 16, 50]]) {
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'miter';
        ctx.beginPath(); line.forEach(([x, y], i) => ctx[i ? 'lineTo' : 'moveTo'](x, y)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tip[0] + Math.cos(a) * R, tip[1] + Math.sin(a) * R); ctx.lineTo(tip[0] + Math.cos(a + 2.4) * R, tip[1] + Math.sin(a + 2.4) * R); ctx.lineTo(tip[0] + Math.cos(a - 2.4) * R, tip[1] + Math.sin(a - 2.4) * R); ctx.closePath(); ctx.fill();
      }
      shout(ctx, M, s, '盘前大涨近三成', 660, 270, 132, T(M, 'bar26.2'), { stagger: 0.05, tilt: -0.03 });
      if (s.t >= T(M, 'bar27')) caption(ctx, M, 'NVDA  PRE-MARKET', 470, 440, 46);
    },
    hold(ctx, s, M) {
      const pts = [[34, 34], [1888, 24], [1884, 1052], [30, 1046]], im = M.img.jh_hold, q = 1010 / im.height, X = 130;
      const rise = (1 - M.ease.outBack(M.clamp(s.lt / 0.5, 0, 1), 1.4)) * 230, Y = 1090 - im.height * q + rise;
      panel(ctx, M, s, pts, s.t0, () => {
        ctx.drawImage(tone(M, 'hold', 1920, 1080, (u, v) => 0.56 * M.smooth(0.16, 0.8, Math.hypot((u - 0.24) * 1.4, v - 0.32))), 0, 0, 1920, 1080);
        focus(ctx, M, 360, 320, 430, 330, 150, Math.floor(s.t * 12) * 41);
      }, { slide: 0 });
      ctx.drawImage(halo(M, 'jhh', im, 8), X - 12 * q, Y - 12 * q, (im.width + 24) * q, (im.height + 24) * q);
      const on = M.ease.out3(M.clamp((s.t - T(M, 'bar29')) / 0.3, 0, 1));
      if (on > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(X, Y, 420 * q * on, 360 * q); ctx.clip();
        poly(ctx, [[14, 167], [355, 89], [395, 112], [392, 244], [49, 327], [14, 323]].map(([a, b]) => [X + a * q, Y + b * q]));
        ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ACC; ctx.fill(); ctx.restore();
      }
      shout(ctx, M, s, 'NVIDIA', 860, 170, 130, T(M, 'bar29'), { font: 'Anton', rot: 0.05, track: 10 });
    },
    heroic(ctx, s, M) {
      const pts = [[30, 40], [1892, 26], [1886, 1050], [36, 1040]], im = M.img.jh_heroic, q = (1060 / im.height) * (1 + s.p * 0.04);
      panel(ctx, M, s, pts, s.t0, () => {
        ctx.drawImage(tone(M, 'hrc', 1920, 1080, (u, v) => 0.6 * M.smooth(0.16, 0.8, Math.hypot((u - 0.62) * 1.4, v - 0.36))), 0, 0, 1920, 1080);
        focus(ctx, M, 1190, 380, 560, 470, 180, Math.floor(s.t * 12) * 53);
      }, { slide: 0 });
      ctx.drawImage(halo(M, 'jhr', im, 8), 1200 - im.width * q / 2, 1095 - im.height * q, (im.width + 24) * q, (im.height + 24) * q);
      shout(ctx, M, s, '回来了', 380, 540, 240, T(M, 'bar32.2'), { vert: true, stagger: 0.09 });
    },
    office(ctx, s, M) {
      const pts = [[30, 28], [1890, 34], [1884, 1052], [36, 1046]], z = 1.16 + M.ease.inOut2(s.p) * 0.16, E = (r) => M.ease.inOut2(M.clamp((s.t - T(M, r)) / 1.4, 0, 1));
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        ctx.save(); ctx.translate(880, 520); ctx.scale(z, z); ctx.translate(-880, -520);
        ctx.drawImage(M.img.s_office, 0, -60, 1920, 1129); ctx.restore();
        // 光用「去掉网点」来画：灯从他的书桌一圈圈亮开
        const R = 190 + 300 * E('bar35') + 620 * E('bar36'), rx = R * 1.5, ry = R * 0.86;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.moveTo(880 + rx, 540); ctx.ellipse(880, 540, rx, ry, 0, 0, M.TAU); ctx.clip('evenodd');
        ctx.drawImage(tone(M, 'dim', 1920, 1080, () => 0.6, 7), 0, 0, 1920, 1080); ctx.restore();
      }, { slide: 0 });
      narration(ctx, M, 1846, 66, ['回到工作']);
    },
    desk(ctx, s, M) {
      const pts = [[34, 30], [1886, 24], [1880, 1050], [40, 1056]], k = 1.16 + s.p * 0.05;
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        ctx.save(); ctx.translate(960, 500); ctx.scale(k, k); ctx.translate(-960, -560);
        ctx.drawImage(M.img.s_desk, 0, 0, 1920, 1080);
        for (let i = 0; i < 9; i++) {   // 屏幕上一行行打出来的代码
          const tin = s.t0 + 0.35 + i * (s.dur - 0.8) / 9, age = s.t - tin;
          if (age < 0) break;
          const yy = 282 + i * 44, reach = M.clamp(age / 0.42, 0, 1);
          let xx = 552 + (M.hash(i, 3) > 0.55 ? 34 : 0), left = (130 + M.hash(i, 5) * 150) * reach;
          for (let j = 0; left > 0 && j < 5; j++) {
            const seg = Math.min(left, 34 + M.hash(i, j + 20) * 70);
            ctx.fillStyle = INK; ctx.fillRect(xx - 2, yy - 2, seg + 4, 20);
            ctx.fillStyle = ACC; ctx.fillRect(xx, yy, seg, 16);
            xx += seg + 13; left -= seg + 13;
          }
        }
        ctx.restore();
      }, { slide: 0 });
    },
    hands(ctx, s, M) {
      const pts = [[28, 34], [1892, 26], [1886, 1054], [34, 1046]];
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        cover(ctx, M.img.s_hands, x, y, w, h, 1.04 + s.p * 0.07, 0.42, 0.72);
      }, { slide: 0 });
      [['bar40.3', 300, 240, 136, -0.12], ['bar41', 560, 150, 104, 0.08], ['bar41.3', 150, 470, 112, 0.1], ['bar42', 760, 118, 88, -0.08]]
        .forEach(([r, x, y, px, tilt]) => shout(ctx, M, s, '嗒', x, y, px, T(M, r), { tilt, rot: 0 }));
    },
    dawn(ctx, s, M) {
      const pts = [[32, 26], [1888, 36], [1882, 1050], [38, 1044]], k = 1.2 + s.p * 0.05, on = M.ease.out3(M.clamp(s.lt / 2.4, 0, 1));
      panel(ctx, M, s, pts, s.t0, (x, y, w, h) => {
        ctx.save(); ctx.translate(960, 540); ctx.scale(k, k); ctx.translate(-1040, -500);
        ctx.drawImage(M.img.s_dawn, 0, 0, 1920, 961);
        ctx.save(); poly(ctx, [[0, 0], [1920, 0], [1920, 400], [1780, 390], [1570, 280], [1280, 40], [830, 240], [600, 340], [380, 440], [220, 560], [0, 560]]); ctx.clip();
        ctx.fillStyle = PAPER;
        for (let i = 0; i < 11; i++) {   // 太阳光是去掉天空网点的白色楔形
          const a = 0.1 + i * 0.27 + Math.sin(s.t * 0.25) * 0.025, w0 = 0.035 + M.hash(i, 9) * 0.05, r = 1500 * on;
          ctx.beginPath(); ctx.moveTo(700, -40); ctx.lineTo(700 + Math.cos(a - w0) * r, -40 + Math.sin(a - w0) * r); ctx.lineTo(700 + Math.cos(a + w0) * r, -40 + Math.sin(a + w0) * r); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = INK; ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {   // 掠过天空的鸟群
          const px = 260 + i * 62 + s.lt * (70 + i * 5), py = 300 - i * 24 + Math.sin(s.t * 0.9 + i) * 10, q = 13 + M.hash(i, 4) * 8, f = Math.sin(s.t * 8 + i * 1.3) * 0.55;
          ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(px - q, py - q * f); ctx.quadraticCurveTo(px - q * 0.4, py - q * 0.25, px, py); ctx.quadraticCurveTo(px + q * 0.4, py - q * 0.25, px + q, py - q * f); ctx.stroke();
        }
        ctx.restore();
      }, { slide: 0 });
      narration(ctx, M, 1846, 66, ['新的一天']);
    },
    page(ctx, s, M) {
      const z = 1.05 - M.ease.out3(M.clamp(s.lt / 2.2, 0, 1)) * 0.05;
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, M.W, M.H);
      ctx.save(); ctx.translate(960, 540); ctx.scale(z, z); ctx.translate(-960, -540);
      [[[1012, 34], [1886, 28], [1880, 512], [990, 520]], [[34, 40], [990, 34], [968, 520], [40, 526]], [[1262, 536], [1880, 534], [1886, 1050], [1244, 1044]], [[640, 542], [1240, 536], [1222, 1044], [622, 1050]], [[40, 548], [618, 542], [600, 1050], [34, 1056]]]
        .forEach((q) => { ctx.save(); poly(ctx, q); ctx.clip(); ctx.drawImage(tone(M, 'pgbase', 1920, 1080, () => 0.3, 9), 0, 0, 1920, 1080); ctx.restore(); });   // 空格先铺网点，分格落下时亮度不跳
      panel(ctx, M, s, [[1012, 34], [1886, 28], [1880, 512], [990, 520]], s.t0, (x, y, w, h) => cover(ctx, M.img.th_campus, x, y, w, h, 1.04, 0.5, 0.42), { slide: 0 });
      panel(ctx, M, s, [[34, 40], [990, 34], [968, 520], [40, 526]], T(M, 'bar46.2'), (x, y, w, h) => cover(ctx, M.img.th_board, x, y, w, h, 1.04, 0.5, 0.42), { slide: 30 });
      panel(ctx, M, s, [[1262, 536], [1880, 534], [1886, 1050], [1244, 1044]], T(M, 'bar46.3'), (x, y, w, h) => {
        ctx.drawImage(tone(M, 'pg1', 1920, 1080, (u, v) => 0.42 * M.smooth(0.1, 0.5, Math.hypot(u - 0.82, v - 0.72))), 0, 0, 1920, 1080);
        const im = M.img.th_heroic, q = 500 / im.height; ctx.drawImage(im, x + (w - im.width * q) / 2, y + h - im.height * q, im.width * q, im.height * q);
      }, { slide: 30 });
      panel(ctx, M, s, [[640, 542], [1240, 536], [1222, 1044], [622, 1050]], T(M, 'bar46.4'), (x, y, w, h) => {
        ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
        const c = M.img.th_chip, q = 1.1; ctx.drawImage(c, x + (w - c.width * q) / 2, y + (h - c.height * q) / 2 - 22, c.width * q, c.height * q);
      }, { slide: 30, bg: INK });
      panel(ctx, M, s, [[40, 548], [618, 542], [600, 1050], [34, 1056]], T(M, 'bar47'), () => {}, { slide: 0, dash: [24, 16] });
      shout(ctx, M, s, '未完待续', 322, 796, 98, T(M, 'bar47') + 0.25, { vert: true, stagger: 0.16, rot: 0.04 });
      ctx.restore();
      if (s.t >= T(M, 'bar47') + 0.9 && s.t < s.t1 - 0.7) caption(ctx, M, 'MUSIC  VICTORY  /  TWO STEPS FROM HELL', 930, 1006, 30);
    },
  },
  // 高能段里没有切镜的小节头：集中线从四边冲进来再退回去，画面主体不动
  overlay(ctx, M) {
    const b = M.bar(), age = M.t - b.t0;
    if (b.n < 2 || b.n > 33 || age < 0 || age > 0.42 || M.shots().some((x) => Math.abs(x.t0 - b.t0) < 0.05)) return;
    const on = age < 0.12 ? age / 0.12 : 1 - (age - 0.12) / 0.3, n = 54;
    ctx.save(); ctx.fillStyle = INK;
    for (let i = 0; i < n; i++) {
      const a = ((i + M.hash(i, b.n) * 0.7) / n) * M.TAU, w = 0.006 + M.hash(i, 61) * 0.012, q = 1 - on * (0.12 + M.hash(i, 83) * 0.16);   // 只到画面边缘，不碰脸和字
      ctx.beginPath(); ctx.moveTo(960 + Math.cos(a) * 1180 * q, 540 + Math.sin(a) * 660 * q);
      ctx.lineTo(960 + Math.cos(a - w) * 1400, 540 + Math.sin(a - w) * 900); ctx.lineTo(960 + Math.cos(a + w) * 1400, 540 + Math.sin(a + w) * 900); ctx.fill();
    }
    ctx.restore();
  },
});
