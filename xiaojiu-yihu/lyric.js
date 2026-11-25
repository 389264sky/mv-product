// lyric.js —— 右下角歌词「灌酒」：每一帧按唱到的位置往字里灌琥珀酒，前沿起浪、溅金珠，唱完化成酒气升走
XJ.lyric = (() => {
  const PX = 104, RM = 92, BM = 92, GAP = 1.16, cutOf = (t) => t.includes(' ') ? t.indexOf(' ') : 4;
  const LAY = {}; let P, cv, c2;
  const layout = (M, L) => { if (LAY[L.n]) return LAY[L.n]; const raw = L.text, cut = cutOf(raw), a = [...raw.slice(0, cut)], b = [...raw.slice(cut).trim()], m = (s) => s.length * PX * 1.02, x1 = M.W - RM, w2 = m(b), w1 = m(a), xb = x1 - w2, xa = xb - PX * 1.35 < x1 - w2 - PX * 2 ? xb : Math.max(xb - PX * .9, M.W * .46), yb = M.H - BM - PX / 2, ya = yb - PX * GAP, cs = []; a.forEach((c, i) => cs.push({ c, x: xa + (i + .5) * PX * 1.02, y: ya })); b.forEach((c, i) => cs.push({ c, x: xb + (i + .5) * PX * 1.02, y: yb })); return (LAY[L.n] = cs); };
  return (o, M) => {
    if (M.noLyrics) return; const t = M.t, S = M.song.lines, LG = window.__lyrLayout || (window.__lyrLayout = []), TAU = M.TAU, cl = M.clamp;
    for (let li = 0; li < S.length; li++) { const L = S[li], nx = S[li + 1], prev = S[li - 1], outOf = (q, n) => Math.min(q.sung_end + .48, n ? Math.max(q.sung_end + .18, n.t0 - .16) : 1e9), t0 = Math.max(L.t0 - .30, prev ? outOf(prev, L) : 0), outA = L.sung_end + .06, outB = outOf(L, nx); if (t < t0 || t > outB) continue;
      const cs = layout(M, L), appear = cl((t - t0) / .26), ex = cl((t - outA) / (outB - outA)), n = cs.length;
      // 底：右下角一团很软的暗，托字
      o.save(); const bg = o.createRadialGradient(M.W * .82, M.H * .88, 30, M.W * .82, M.H * .88, 620); const ba = .46 * appear * (1 - ex); bg.addColorStop(0, `rgba(4,8,12,${ba})`); bg.addColorStop(.55, `rgba(4,8,12,${ba * .45})`); bg.addColorStop(1, 'rgba(4,8,12,0)'); o.fillStyle = bg; o.fillRect(M.W * .30, M.H * .20, M.W * .70, M.H * .8); o.restore();
      o.save(); o.font = `${PX}px "ZCOOLKuaiLe"`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.lineJoin = 'round';
      let front = null;
      cs.forEach((k, i) => { const ts = L.chars[i].t, te = i + 1 < n ? L.chars[i + 1].t : L.sung_end, kd = Math.max(.12, Math.min(te - ts, 1.1)), p = cl((t - ts) / kd), done = t >= ts + kd, pop = t >= ts ? Math.exp(-(t - ts) / .20) : 0;
        const exk = cl(ex * 1.5 - i / n * .5), a = cl(appear * 1.6 - i / n * .6) * (1 - exk); if (a < .012) return; const y = k.y - exk * exk * 46 + (1 - cl(appear * 1.6 - i / n * .6)) * 16 - pop * 5, x = k.x + Math.sin(i * 1.7 + t) * exk * 14, sc = 1 + pop * .07;
        o.save(); o.globalAlpha = a; o.translate(x, y); o.scale(sc, sc); if (exk > 0) o.filter = `blur(${(exk * 7).toFixed(2)}px)`;
        // 空杯：半透米白 + 细金边
        o.shadowColor = 'rgba(0,0,0,.85)'; o.shadowBlur = 14; o.shadowOffsetY = 3; o.fillStyle = 'rgba(244,238,222,.40)'; o.fillText(k.c, 0, 0); o.shadowColor = 'transparent'; o.shadowBlur = 0; o.shadowOffsetY = 0; o.lineWidth = 1.6; o.strokeStyle = 'rgba(240,206,134,.62)'; o.strokeText(k.c, 0, 0);
        if (p > 0) { // 灌酒：离屏画字形当遮罩，液体在里面逐帧往右漫
          const W = PX * 1.3, sw = Math.round(W * M.SC); if (!cv) { cv = document.createElement('canvas'); c2 = cv.getContext('2d'); } if (cv.width !== sw) cv.width = cv.height = sw; c2.setTransform(M.SC, 0, 0, M.SC, 0, 0); c2.globalCompositeOperation = 'source-over'; c2.globalAlpha = 1; c2.clearRect(0, 0, W, W); c2.font = o.font; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillStyle = '#000'; c2.fillText(k.c, W / 2, W / 2); c2.globalCompositeOperation = 'source-in';
          const g = c2.createLinearGradient(0, W * .1, 0, W * .92); g.addColorStop(0, '#fff3cf'); g.addColorStop(.28, '#ffd27a'); g.addColorStop(.62, '#f09a2e'); g.addColorStop(1, '#b4520f'); const fx = -W * .05 + W * 1.1 * p; c2.beginPath(); c2.moveTo(-9, -9); for (let q = 0; q <= 26; q++) { const yy = q / 26 * W; c2.lineTo(done ? W * 1.2 : fx + (Math.sin(yy * .085 + t * 9) * 5 + Math.sin(yy * .19 - t * 13) * 3) * Math.sin(Math.PI * Math.min(1, p + .05)) + (yy / W - .5) * 10, yy); } c2.lineTo(-9, W + 9); c2.closePath(); c2.fillStyle = g; c2.fill();
          c2.globalCompositeOperation = 'source-atop'; // 酒里的流光
          for (let q = 0; q < 3; q++) { const xx = ((t * (.22 + .1 * q) + q * .37 + i * .21) % 1.4 - .2) * W, gl = c2.createLinearGradient(xx - 20, 0, xx + 20, 0); gl.addColorStop(0, 'rgba(255,250,225,0)'); gl.addColorStop(.5, `rgba(255,250,225,${.42 - q * .1})`); gl.addColorStop(1, 'rgba(255,250,225,0)'); c2.save(); c2.transform(1, 0, -.35, 1, W * .17, 0); c2.fillStyle = gl; c2.fillRect(xx - 22, 0, 44, W); c2.restore(); }
          if (!done) { const gl = c2.createLinearGradient(fx - 26, 0, fx + 6, 0); gl.addColorStop(0, 'rgba(255,255,240,0)'); gl.addColorStop(1, 'rgba(255,255,244,.95)'); c2.fillStyle = gl; c2.fillRect(fx - 26, 0, 34, W); }
          o.shadowColor = `rgba(255,176,64,${(.55 + .4 * pop + .12 * Math.sin(t * 2.4 + i)).toFixed(3)})`; o.shadowBlur = 20 + 26 * pop; o.drawImage(cv, -W / 2, -W / 2, W, W); o.shadowColor = 'transparent'; o.shadowBlur = 0;
          o.lineWidth = 1.2; o.strokeStyle = `rgba(255,240,200,${.35 * p})`; o.strokeText(k.c, 0, 0); if (!done) front = { x: x - W / 2 + fx, y, i, ts }; }
        o.restore();
        // 溅起的酒珠：每个字开唱起 0.9 秒
        const age = t - ts; if (age > 0 && age < .95) { o.save(); o.globalCompositeOperation = 'lighter'; for (let q = 0; q < 9; q++) { const h1 = M.hash(q + i * 11, L.n), h2 = M.hash(q * 3 + 1, L.n + i), h3 = M.hash(q + 5, i * 7 + L.n), al = age - h3 * .12; if (al < 0) continue; const vx = (h1 - .35) * 150, vy = -(90 + 150 * h2), px = k.x - PX * .3 + PX * .6 * h3 + vx * al, py = k.y - PX * .16 + vy * al + 260 * al * al, r = (1.5 + 3.2 * h1) * (1 - age / .95); const gr = o.createRadialGradient(px, py, 0, px, py, r * 3.2); gr.addColorStop(0, 'rgba(255,236,178,.95)'); gr.addColorStop(.3, 'rgba(255,176,64,.55)'); gr.addColorStop(1, 'rgba(255,140,30,0)'); o.fillStyle = gr; o.globalAlpha = a * (1 - age / .95); o.beginPath(); o.arc(px, py, r * 3.2, 0, TAU); o.fill(); } o.restore(); }
        if (exk > 0 && exk < 1) { o.save(); o.globalCompositeOperation = 'lighter'; for (let q = 0; q < 7; q++) { const h1 = M.hash(q + 31, i + L.n * 3), h2 = M.hash(q + 7, i * 5 + L.n), px = k.x + (h1 - .5) * PX + Math.sin(t * 3 + q) * 8, py = k.y + (h2 - .5) * PX - exk * (50 + 70 * h1); o.globalAlpha = (1 - exk) * .8; o.fillStyle = 'rgba(255,196,96,.9)'; o.beginPath(); o.arc(px, py, 1 + 2 * h2, 0, TAU); o.fill(); } o.restore(); }
        LG.push({ n: L.n, i, st: appear >= .99 && exk < .02 ? 1 : 1, c: k.c, x: k.x, y: k.y, r: PX / 2, a });
      });
      if (front) { o.save(); o.globalCompositeOperation = 'lighter'; const g = o.createRadialGradient(front.x, front.y, 0, front.x, front.y, 80); g.addColorStop(0, 'rgba(255,226,150,.55)'); g.addColorStop(.3, 'rgba(255,178,72,.20)'); g.addColorStop(1, 'rgba(255,150,40,0)'); o.fillStyle = g; o.fillRect(front.x - 80, front.y - 80, 160, 160); o.restore(); }
      o.restore(); M.logLyric(L.n, PX, appear * (1 - ex), L.text);
    }
  };
})();
