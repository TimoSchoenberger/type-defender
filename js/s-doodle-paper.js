/* Styles 3 + 4: Notebook Doodle, Paper Craft */
(() => {
'use strict';
const { W, H, GROUND, IMPACT, CANNON, BARREL, DOME, util: { rand, pick, lerp, rng }, rr, star, skyline, seg, arrowPath } = TD;

/* ---------------- 3 · Notebook Doodle ---------------- */
const D = { paper: '#fbfaf4', rule: 'rgba(96,150,214,.32)', margin: 'rgba(226,84,84,.5)', pencil: '#2d2f36', red: '#e0322b',
  blue: '#2f6fdb', green: '#2c9a4b', yellow: '#f6c33b', orange: '#f28c28', purple: '#8a5cd6', sky: '#7cc3f0', brown: '#8b5a2b' };
const boil = g => Math.floor(g.t * 8); // lines are redrawn 8× a second, like a flip-book
function wob(c, r, x1, y1, x2, y2, j = 1.6) {
  const mx = (x1 + x2) / 2 + (r() - 0.5) * j * 2, my = (y1 + y2) / 2 + (r() - 0.5) * j * 2;
  c.moveTo(x1 + (r() - 0.5) * j, y1 + (r() - 0.5) * j);
  c.quadraticCurveTo(mx, my, x2 + (r() - 0.5) * j, y2 + (r() - 0.5) * j);
}
function wring(c, r, cx, cy, rx, ry, j = 1) { // hand-drawn ellipse that overshoots its start
  const a0 = r() * 6.283, n = 18, over = 0.25 + r() * 0.35;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (6.283 + over), k = 1 + (r() - 0.5) * 0.06 * j;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
}
function hatch(c, r, x, y, w, h, gap, col, lw = 2) { // crayon strokes; the caller clips to the shape
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath();
  for (let k = x - h; k < x + w; k += gap) { const j = (r() - 0.5) * 3; c.moveTo(k + j, y + h + 2); c.lineTo(k + h + j + (r() - 0.5) * 3, y - 2); }
  c.stroke();
}
const houses = skyline(5, { minW: 64, maxW: 112, minH: 44, maxH: 96, gap: 22 });
const HC = [D.blue, D.yellow, D.purple, D.orange, D.green];

function paintCity(x, v) {
  const r = rng(500 + v * 97);
  x.lineCap = 'round';
  for (const b of houses) {
    const roofH = b.h > 82 ? 0 : Math.min(30, b.w * 0.42), top = b.top + roofH;
    x.save(); x.beginPath(); x.rect(b.x, top, b.w, GROUND - top); x.clip(); x.globalAlpha = 0.5;
    hatch(x, r, b.x, top, b.w, GROUND - top, 7, HC[(b.r * 5) | 0], 3); x.restore();
    x.strokeStyle = D.pencil; x.lineWidth = 2.2; x.beginPath();
    wob(x, r, b.x, GROUND, b.x, top); wob(x, r, b.x, top, b.x + b.w, top); wob(x, r, b.x + b.w, top, b.x + b.w, GROUND);
    if (roofH) {
      x.stroke();
      x.save(); x.beginPath(); x.moveTo(b.x - 6, top); x.lineTo(b.x + b.w / 2, b.top); x.lineTo(b.x + b.w + 6, top); x.closePath(); x.clip();
      x.globalAlpha = 0.65; hatch(x, r, b.x - 6, b.top, b.w + 12, roofH, 6, D.red, 3); x.restore();
      x.strokeStyle = D.pencil; x.beginPath();
      wob(x, r, b.x - 6, top, b.x + b.w / 2, b.top); wob(x, r, b.x + b.w / 2, b.top, b.x + b.w + 6, top); wob(x, r, b.x + b.w + 6, top, b.x - 6, top);
    } else { // flat roof with a flag
      const fx = b.x + b.w * 0.7;
      wob(x, r, fx, top, fx, top - 30, 1);
      x.stroke(); x.fillStyle = D.red; x.beginPath(); x.moveTo(fx, top - 30); x.lineTo(fx + 20, top - 24); x.lineTo(fx, top - 18); x.closePath(); x.fill(); x.beginPath();
    }
    x.stroke();
    x.lineWidth = 1.6; x.beginPath();
    for (let wy = top + 12; wy < GROUND - 30; wy += 24) for (let wx = b.x + 11; wx < b.x + b.w - 20; wx += 24) {
      wob(x, r, wx, wy, wx + 12, wy, 1); wob(x, r, wx + 12, wy, wx + 12, wy + 12, 1); wob(x, r, wx + 12, wy + 12, wx, wy + 12, 1); wob(x, r, wx, wy + 12, wx, wy, 1);
      wob(x, r, wx + 6, wy, wx + 6, wy + 12, 0.6); wob(x, r, wx, wy + 6, wx + 12, wy + 6, 0.6);
    }
    if (b.w > 70) { const dx = b.x + b.w / 2 - 7; wob(x, r, dx, GROUND, dx, GROUND - 22); wob(x, r, dx, GROUND - 22, dx + 14, GROUND - 22); wob(x, r, dx + 14, GROUND - 22, dx + 14, GROUND); }
    x.stroke();
    if (b.r2 > 0.45) { // tree in the gap
      const tx = b.x + b.w + 11;
      x.strokeStyle = D.brown; x.lineWidth = 3; x.beginPath(); wob(x, r, tx, GROUND, tx, GROUND - 24, 1); x.stroke();
      x.save(); x.beginPath(); x.arc(tx, GROUND - 36, 13, 0, 6.283); x.clip(); x.globalAlpha = 0.7; hatch(x, r, tx - 14, GROUND - 50, 28, 28, 5, D.green, 3); x.restore();
      x.strokeStyle = D.pencil; x.lineWidth = 1.8; wring(x, r, tx, GROUND - 36, 13, 13); x.stroke();
    }
  }
  x.strokeStyle = D.green; x.lineWidth = 2.5; x.beginPath();
  for (let i = 0; i < W; i += 40) wob(x, r, i, GROUND + 2, i + 40, GROUND + 2, 2.5);
  for (let i = 8; i < W; i += 23) { wob(x, r, i, GROUND + 3, i - 4, GROUND + 12, 1); wob(x, r, i + 4, GROUND + 3, i + 8, GROUND + 12, 1); }
  x.stroke();
}

TD.styles.push({
  id: 'doodle', name: 'Notebook Doodle',
  font: '400 34px "Patrick Hand", "Comic Sans MS", cursive', bombH: 52, padX: 34,
  flashColor: '#ffe3e0',
  hud: {
    font: '400 {s}px "Patrick Hand", "Comic Sans MS", cursive', color: D.pencil, dim: '#6b6f7a', accent: D.red, bar: D.red, barTrack: 'rgba(45,47,54,.15)',
    seg(c, x, y, w, on, i) { // the streak is counted in tally marks
      if (!on) { c.fillStyle = 'rgba(45,47,54,.2)'; c.fillRect(x + w / 2 - 1, y + 9, 2, 2); return; }
      c.strokeStyle = D.pencil; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath();
      if (i % 5 === 4) { const x0 = x - 4 * 19; c.moveTo(x0 + 1, y + 9); c.lineTo(x0 + 3 * 19 + 13, y - 9); }
      else { c.moveTo(x + w / 2 - 1, y - 11); c.lineTo(x + w / 2 + 1, y + 11); }
      c.stroke();
    }
  },
  gauge: { track: 'rgba(45,47,54,.12)', laser: D.orange, multi: D.blue, ink: D.pencil, lw: 5 },
  music: { // schoolyard: pizzicato bass, marimba, shaker and a whistled tune
    bpm: 104, swing: 0.16, chords: ['G', 'Em', 'C', 'D'],
    tracks: [
      { i: 'pizz', oct: 2, pat: '0...2...0...2.1.', v: 0.8 },
      { i: 'marimba', oct: 4, pat: '0.2.1.2.0.2.1.2.', v: 0.27, rev: 0.15 },
      { drum: 'shaker', pat: '.o.x.o.x.o.x.o.x', v: 0.8, lvl: 1 },
      { drum: 'snap', pat: '....x.......x...', v: 0.7, lvl: 1 },
      { drum: 'softkick', pat: 'x.......x.......', v: 0.7, lvl: 1 },
      { i: 'whistle', v: 0.08, rev: 0.25, lvl: 2, notes: `
        D5 - B4 - G4 - B4 - D5 - - - E5 - D5 -
        B4 - - - G4 - - - E4 - G4 - B4 - - -
        C5 - E5 - G5 - E5 - C5 - - - D5 - E5 -
        F#5 - - - D5 - - - A4 - - - . . . .` },
      { i: 'pluck', oct: 5, pat: '0123012301230123', v: 0.05, lvl: 3, boost: true }
    ]
  },
  overOpts: { font: '400 {s}px "Patrick Hand", "Comic Sans MS", cursive', title: 'Oh nein!', titleSize: 80, dim: 'rgba(251,250,244,.88)', color: D.pencil, accent: D.red },
  text: { font: '400 {s}px "Patrick Hand", "Comic Sans MS", cursive', fill: D.pencil },
  sfx: {
    shoot: [{ noise: 1, filter: 'highpass', f: 2600, d: 0.05, v: 0.07 }, { f: 620, d: 0.04, type: 'triangle', v: 0.04 }],
    chip: [{ noise: 1, filter: 'bandpass', f: 3200, d: 0.03, v: 0.06 }],
    boom: [{ noise: 1, f: 900, f2: 150, d: 0.3, v: 0.14 }, { f: 210, f2: 80, d: 0.25, type: 'triangle', v: 0.08 }],
    miss: [{ f: 320, f2: 220, d: 0.12, type: 'triangle', v: 0.08 }, { f: 250, f2: 150, d: 0.14, type: 'triangle', v: 0.08, at: 0.11 }],
    laser: [{ f: 800, f2: 1700, d: 0.3, type: 'triangle', v: 0.07 }],
    shield: [{ f: 520, f2: 300, d: 0.3, type: 'triangle', v: 0.1 }],
    power: [660, 880, 1100].map((f, i) => ({ f, d: 0.09, type: 'triangle', v: 0.07, at: i * 0.09 })),
    over: [{ f: 400, f2: 100, d: 0.8, type: 'triangle', v: 0.1 }]
  },
  drawBackground(c, g) {
    c.drawImage(g.layer('bg', x => {
      x.fillStyle = D.paper; x.fillRect(0, 0, W, H);
      const r = rng(3);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(120,110,90,${r() * 0.07})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); }
      x.strokeStyle = D.rule; x.lineWidth = 1.2; x.beginPath();
      for (let y = 72; y < H; y += 34) { x.moveTo(0, y); x.lineTo(W, y); }
      x.stroke();
      x.strokeStyle = D.margin; x.lineWidth = 1.6; x.beginPath(); x.moveTo(78, 0); x.lineTo(78, H); x.stroke();
      for (const y of [110, 300, 490]) { x.fillStyle = '#e8e4d7'; x.beginPath(); x.arc(34, y, 11, 0, 6.283); x.fill(); }
    }), 0, 0, W, H);
    const r = rng(900 + boil(g));
    c.save(); c.translate(850, 96); c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, 34, 0, 6.283); c.save(); c.clip(); hatch(c, r, -36, -36, 72, 72, 6, 'rgba(246,195,59,.85)', 3); c.restore();
    c.strokeStyle = D.orange; c.lineWidth = 2.4; wring(c, r, 0, 0, 34, 34); c.stroke();
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = i * 0.628 + g.t * 0.15; wob(c, r, Math.cos(a) * 44, Math.sin(a) * 44, Math.cos(a) * 62, Math.sin(a) * 62, 2); } c.stroke();
    c.restore();
    c.strokeStyle = D.sky; c.lineWidth = 2.2;
    for (let i = 0; i < 2; i++) {
      const x = ((g.t * 11 + i * 520) % (W + 260)) - 130, y = 92 + i * 70;
      for (const [dx, dy, rad] of [[0, 0, 22], [26, -10, 26], [54, 0, 20]]) { wring(c, r, x + dx, y + dy, rad, rad * 0.8); c.stroke(); }
    }
  },
  drawCity(c, g) {
    const v = boil(g) % 3;
    c.drawImage(g.layer('city' + v, x => paintCity(x, v)), 0, 0, W, H);
  },
  drawShield(c, g) {
    const v = boil(g) % 3;
    const img = g.layer('dome' + v, x => {
      const r = rng(300 + v);
      x.save(); x.beginPath(); x.ellipse(DOME.cx, DOME.cy, DOME.rx, DOME.ry, 0, Math.PI, 2 * Math.PI); x.closePath(); x.clip();
      x.globalAlpha = 0.28; hatch(x, r, 0, DOME.cy - DOME.ry, W, DOME.ry, 12, D.sky, 3); x.restore();
      x.strokeStyle = D.blue; x.lineWidth = 3; x.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        x.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = Math.PI + (i / 40) * Math.PI, j = (r() - 0.5) * 5;
          const px = DOME.cx + Math.cos(a) * (DOME.rx + j), py = DOME.cy + Math.sin(a) * (DOME.ry + j);
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
    });
    c.save(); c.globalAlpha = g.shieldVis; c.drawImage(img, 0, 0, W, H); c.restore();
  },
  drawBomb(c, b, g) {
    const r = rng(b.seed + boil(g) * 7919), y = b.y - b.kick * 6, rx = b.w / 2, ry = b.h / 2;
    const fx = b.x + rx * 0.35, fy = y - ry * 0.92;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = D.pencil; c.lineWidth = 2; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 12, fy - 12, fx + 5, fy - 20); c.stroke();
    c.fillStyle = r() > 0.5 ? D.yellow : D.orange; star(c, fx + 5, fy - 23, 5, 8, 3.5, r() * 6); c.fill();
    c.beginPath(); c.ellipse(b.x, y, rx, ry, 0, 0, 6.283); c.save(); c.clip(); c.globalAlpha = 0.38;
    hatch(c, r, b.x - rx, y - ry, rx * 2, ry * 2, 7, [D.red, D.blue, D.green, D.purple, D.orange, D.yellow][b.tint], 3); c.restore();
    c.strokeStyle = D.pencil; c.lineWidth = 2.3; wring(c, r, b.x, y, rx, ry); c.stroke();
    c.lineWidth = 1.2; wring(c, r, b.x, y, rx + 1.5, ry + 1); c.stroke();
    c.restore();
  },
  drawLabel(c, b) {
    seg(c, b.text, b.typed, b.x, b.y - b.kick * 6 + 2, { font: this.font, rest: D.pencil, done: D.green, next: D.red, under: D.red, ul: 14 });
  },
  drawShift(c, x, y, b, g) { // scribbled with the red pen, boiling like every other line
    const r = rng(b.id * 17 + boil(g) * 3);
    c.strokeStyle = D.red; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath();
    wob(c, r, x, y + 6, x, y - 6, 1); wob(c, r, x - 5.5, y - 0.5, x, y - 6.5, 0.8); wob(c, r, x + 5.5, y - 0.5, x, y - 6.5, 0.8);
    c.stroke();
  },
  drawReticle(c, b, g, locked) { // the teacher's red pen circles the target
    const r = rng(b.id * 31 + boil(g) * 13), y = b.y - b.kick * 6;
    c.save(); c.lineCap = 'round'; c.strokeStyle = locked ? D.red : 'rgba(224,50,43,.4)'; c.lineWidth = locked ? 3 : 2;
    if (!locked) c.setLineDash([8, 9]);
    wring(c, r, b.x, y, b.w / 2 + 14, b.h / 2 + 12, 2); c.stroke();
    if (locked) { wring(c, r, b.x + 1, y - 1, b.w / 2 + 18, b.h / 2 + 15, 2); c.stroke(); }
    c.restore();
  },
  drawShot(c, s) {
    const a = Math.atan2(s.vy, s.vx), ca = Math.cos(a), sa = Math.sin(a);
    c.save(); c.fillStyle = '#4b4f5a'; c.beginPath(); c.arc(s.x, s.y, 5.5, 0, 6.283); c.fill();
    c.strokeStyle = D.pencil; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath();
    for (const o of [-5, 5]) { const px = -sa * o, py = ca * o; c.moveTo(s.x + px - ca * 11, s.y + py - sa * 11); c.lineTo(s.x + px - ca * 26, s.y + py - sa * 26); }
    c.stroke(); c.restore();
  },
  drawLaser(c, l) { // highlighter stroke
    const a = l.life / l.max, r = rng(l.x2 | 0);
    c.save(); c.globalAlpha = a * 0.8; c.globalCompositeOperation = 'multiply'; c.lineCap = 'round';
    c.strokeStyle = '#ffe94a'; c.lineWidth = l.big ? 26 : 8; c.beginPath(); wob(c, r, l.x1, l.y1, l.x2, l.y2, 4); c.stroke();
    if (l.big) { c.strokeStyle = '#ffd000'; c.lineWidth = 10; c.beginPath(); wob(c, r, l.x1, l.y1, l.x2, l.y2, 7); c.stroke(); }
    c.restore();
  },
  drawCannon(c, g) {
    const r = rng(77 + boil(g)), bx = 4 - g.recoil * 10, L = BARREL - 4;
    c.save(); c.translate(CANNON.x, CANNON.y); c.lineCap = 'round';
    c.save(); c.rotate(g.angle);
    c.beginPath(); c.rect(bx, -11, L, 22); c.fillStyle = D.paper; c.fill(); c.save(); c.clip(); hatch(c, r, bx, -11, L, 22, 5, g.jam > 0 ? D.red : '#6b7280', 2.5); c.restore();
    c.strokeStyle = D.pencil; c.lineWidth = 2.2; c.beginPath();
    wob(c, r, bx, -11, bx + L, -11); wob(c, r, bx + L, -11, bx + L, 11); wob(c, r, bx + L, 11, bx, 11); c.stroke();
    c.restore();
    c.beginPath(); c.arc(0, 4, 24, Math.PI, 0); c.closePath(); c.fillStyle = D.paper; c.fill();
    c.save(); c.clip(); hatch(c, r, -26, -22, 52, 28, 6, D.brown, 2.5); c.restore();
    c.strokeStyle = D.pencil; c.lineWidth = 2.2; c.beginPath();
    for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; c.lineTo(Math.cos(a) * (24 + (r() - 0.5) * 2), 4 + Math.sin(a) * (24 + (r() - 0.5) * 2)); }
    c.closePath(); c.stroke();
    for (const wx of [-22, 22]) {
      c.fillStyle = D.paper; c.beginPath(); c.arc(wx, 16, 11, 0, 6.283); c.fill();
      wring(c, r, wx, 16, 11, 11); c.stroke(); c.beginPath(); wob(c, r, wx - 8, 16, wx + 8, 16, 1); wob(c, r, wx, 8, wx, 24, 1); c.stroke();
    }
    c.restore();
  },
  drawParticle(c, p, g) {
    const a = p.life / p.max, r = rng(((p.x * 3) | 0) + boil(g));
    c.save(); c.globalAlpha = Math.min(1, a * 2); c.lineCap = 'round';
    if (p.kind === 'burst') {
      const s = p.r * (1.15 - a * 0.5);
      star(c, p.x, p.y, 9, s, s * 0.55, p.rot); c.save(); c.clip(); hatch(c, r, p.x - s, p.y - s, s * 2, s * 2, 6, D.yellow, 4); c.restore();
      c.strokeStyle = D.orange; c.lineWidth = 2.5; star(c, p.x + (r() - 0.5) * 2, p.y + (r() - 0.5) * 2, 9, s, s * 0.55, p.rot); c.stroke();
    } else if (p.kind === 'puff') {
      c.strokeStyle = D.pencil; c.lineWidth = 1.6; wring(c, r, p.x, p.y, p.s * (1.6 - a), p.s * (1.6 - a)); c.stroke();
    } else if (p.kind === 'x') {
      c.strokeStyle = D.red; c.lineWidth = 3.5; c.beginPath(); wob(c, r, p.x - 12, p.y - 12, p.x + 12, p.y + 12, 3); wob(c, r, p.x + 12, p.y - 12, p.x - 12, p.y + 12, 3); c.stroke();
    } else {
      const ang = Math.atan2(p.vy, p.vx);
      c.strokeStyle = p.col; c.lineWidth = 2.2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - Math.cos(ang) * 10, p.y - Math.sin(ang) * 10); c.stroke();
    }
    c.restore();
  },
  scribbles(g, x, y, n, cols, v0, v1) {
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), v = rand(v0, v1); g.p({ kind: 'scrib', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rand(0.3, 0.6), col: pick(cols) }); }
  },
  explode(g, b) {
    g.p({ kind: 'burst', x: b.x, y: b.y, life: 0.45, r: b.w * 0.42 + 26, rot: rand(0, 1) });
    for (let i = 0; i < 4; i++) g.p({ kind: 'puff', x: b.x + rand(-24, 24), y: b.y + rand(-14, 14), vy: -30, life: rand(0.4, 0.7), s: rand(8, 14) });
    this.scribbles(g, b.x, b.y, 8, [D.pencil, D.orange, D.red], 120, 300);
    if (b.text.length > 2) g.say(pick(['bumm!', 'peng!', 'zack!']), b.x, b.y - 40, { size: 30, life: 0.7, vy: -40, col: pick([D.red, D.blue, D.purple]), rot: rand(-0.2, 0.2) });
  },
  chip(g, b, at) { this.scribbles(g, at.x, at.y, 3, [D.pencil], 60, 140); },
  misfire(g, tip) { g.p({ kind: 'x', x: tip.x, y: tip.y - 22, life: 0.5 }); g.say('hoppla!', tip.x + 60, tip.y - 40, { size: 26, life: 0.7, vy: -20, col: D.red }); },
  shieldHit(g, b) {
    for (let i = 0; i < 6; i++) g.p({ kind: 'puff', x: b.x + rand(-30, 30), y: b.y + b.h / 2, vy: -20, life: 0.6, s: rand(8, 16) });
    this.scribbles(g, b.x, b.y + b.h / 2, 10, [D.blue, D.sky], 100, 260);
  },
  cityHit(g, b) {
    g.p({ kind: 'burst', x: b.x, y: IMPACT, life: 0.8, r: 110, rot: 0 });
    this.scribbles(g, b.x, IMPACT, 20, [D.pencil, D.red, D.orange], 150, 420);
  }
});

/* ---------------- 4 · Paper Craft ---------------- */
const PA = { sky0: '#c9c1ff', sky1: '#ffc6d0', sky2: '#ffe3bd', sun: '#fff1a8', hillA: '#a8dcc8', hillB: '#86c9b2', ground: '#5aa58c',
  navy: '#3d405b', navyHi: '#5d6185', red: '#ef476f', yellow: '#ffd166', teal: '#2a9d8f', wood: '#c08552', gold: '#e9c46a', white: '#fffdf8' };
const shade = (c, b = 6, y = 3, a = 0.22) => { c.shadowColor = `rgba(60,40,70,${a})`; c.shadowBlur = b * TD.k; c.shadowOffsetY = y * TD.k; };
const noShade = c => { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0; };
const ph = skyline(12, { minW: 56, maxW: 100, minH: 46, maxH: 94, gap: 14 });
const BODY = ['#b8e0d2', '#f6a6a6', '#fbe7a1', '#a9d6f5', '#cdb4db'], ROOF = ['#5c7aa8', '#ef476f', '#e07a5f', '#3d405b'];
const CANOPY = [PA.red, PA.yellow, '#8ecae6', '#cdb4db'];
const tilt = b => Math.sin(b.age * 1.6 + b.phase) * 0.08;
function cloud(c, x, y, s) {
  c.beginPath();
  for (const [dx, dy, r] of [[0, 0, 26], [28, -12, 30], [58, 0, 24], [30, 8, 24]]) { c.moveTo(x + dx * s + r * s, y + dy * s); c.arc(x + dx * s, y + dy * s, r * s, 0, 6.283); }
  c.fill();
}

TD.styles.push({
  id: 'paper', name: 'Paper Craft',
  font: '600 28px Fredoka, "Avenir Next Rounded", system-ui, sans-serif', bombH: 50, padX: 34, sway: 2.2,
  flashColor: '#fff3e6',
  hud: {
    font: '600 {s}px Fredoka, system-ui, sans-serif', color: PA.navy, dim: '#8a8ca8', accent: PA.red, bar: PA.red, barTrack: 'rgba(61,64,91,.15)',
    panel(c, x, y, w, h) { c.save(); shade(c, 5, 3, 0.2); c.fillStyle = PA.white; rr(c, x, y, w, h, 12); c.fill(); c.restore(); },
    seg(c, x, y, w, on) { c.beginPath(); c.arc(x + w / 2, y, 6, 0, 6.283); c.fillStyle = on ? PA.red : 'rgba(61,64,91,.15)'; c.fill(); }
  },
  gauge: { track: 'rgba(61,64,91,.15)', laser: PA.red, multi: PA.teal, lw: 8 },
  music: { // music box lullaby with felt drums
    bpm: 92, chords: ['F', 'Dm', 'Bb', 'C'],
    tracks: [
      { i: 'musicbox', oct: 4, pat: '0.1.2.1.3.2.1.2.', v: 0.11, rev: 0.35 },
      { i: 'sub', oct: 2, pat: '0-------0---2---', v: 0.17 },
      { drum: 'softkick', pat: 'x.......x.......', v: 0.6, lvl: 1 },
      { drum: 'tap', pat: '....x.......x..o', v: 0.8, lvl: 1 },
      { drum: 'shaker', pat: '..o...o...o...o.', v: 0.7, lvl: 2 },
      { i: 'bell', v: 0.07, rev: 0.35, lvl: 2, notes: `
        A5 - - - C6 - - - A5 - G5 - F5 - - -
        D5 - - - F5 - - - A5 - - - G5 - - -
        F5 - - - D5 - - - Bb4 - D5 - F5 - - -
        E5 - - - G5 - - - C6 - - - - - . .` },
      { i: 'pluck', oct: 4, pat: 'C...C...C...C...', v: 0.06, lvl: 3, boost: true }
    ]
  },
  overOpts: { font: '600 {s}px Fredoka, system-ui, sans-serif', title: 'Oh nein!', titleSize: 76, dim: 'rgba(61,64,91,.62)', color: '#fff', accent: PA.yellow },
  text: { font: '600 {s}px Fredoka, system-ui, sans-serif', fill: '#fff', stroke: PA.navy, lw: 7 },
  sfx: {
    shoot: [{ f: 900, f2: 480, d: 0.06, type: 'sine', v: 0.08 }],
    chip: [{ f: 1250, d: 0.03, type: 'sine', v: 0.05 }],
    boom: [{ noise: 1, filter: 'bandpass', f: 1800, d: 0.2, v: 0.16 }, { f: 320, f2: 80, d: 0.2, type: 'sine', v: 0.1 }],
    miss: [{ noise: 1, f: 700, f2: 300, d: 0.22, v: 0.12 }],
    laser: [{ f: 600, f2: 1800, d: 0.25, type: 'sine', v: 0.08 }],
    shield: [{ f: 400, f2: 820, d: 0.3, type: 'sine', v: 0.1 }],
    power: [784, 988, 1175].map((f, i) => ({ f, d: 0.12, type: 'sine', v: 0.08, at: i * 0.09 })),
    over: [{ f: 500, f2: 120, d: 0.8, type: 'sine', v: 0.12 }]
  },
  drawBackground(c, g) {
    c.drawImage(g.layer('bg', x => {
      const gr = x.createLinearGradient(0, 0, 0, GROUND); gr.addColorStop(0, PA.sky0); gr.addColorStop(0.55, PA.sky1); gr.addColorStop(1, PA.sky2);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      shade(x, 10, 4); x.fillStyle = PA.sun; x.beginPath(); x.arc(170, 120, 54, 0, 6.283); x.fill(); noShade(x);
      const r = rng(9);
      for (let i = 0; i < 2600; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.13)' : 'rgba(80,60,90,.05)'; x.fillRect(r() * W, r() * H, 1.4, 1.4); }
    }), 0, 0, W, H);
    c.save(); shade(c, 6, 3, 0.15); c.fillStyle = PA.white;
    for (let i = 0; i < 3; i++) cloud(c, ((g.t * (8 + i * 3) + i * 360) % (W + 220)) - 160, 80 + i * 62, 0.8 + (i % 2) * 0.3);
    c.restore();
  },
  drawCity(c, g) {
    c.drawImage(g.layer('city', x => {
      const hill = (base, amp, f, p, col) => {
        x.beginPath(); x.moveTo(0, H);
        for (let i = 0; i <= W; i += 8) x.lineTo(i, base - amp * (0.6 * Math.sin(i * f + p) + 0.4 * Math.sin(i * f * 2.3 + p * 2)));
        x.lineTo(W, H); x.closePath(); shade(x, 8, -2, 0.18); x.fillStyle = col; x.fill(); noShade(x);
      };
      hill(470, 34, 0.008, 1, PA.hillA); hill(500, 22, 0.011, 3, PA.hillB);
      for (const b of ph) {
        const w = b.w, h = b.h, roof = Math.min(28, w * 0.36);
        x.save(); x.translate(b.x + w / 2, GROUND + 2); x.rotate((b.r - 0.5) * 0.05);
        shade(x, 6, 3); x.fillStyle = BODY[(b.r * 5) | 0]; x.fillRect(-w / 2, -h + roof, w, h - roof);
        x.fillStyle = ROOF[(b.r2 * 4) | 0]; x.beginPath(); x.moveTo(-w / 2 - 6, -h + roof); x.lineTo(0, -h); x.lineTo(w / 2 + 6, -h + roof); x.closePath(); x.fill();
        shade(x, 2, 1, 0.18); x.fillStyle = PA.white;
        for (let wy = -h + roof + 10; wy < -26; wy += 22) for (let wx = -w / 2 + 10; wx < w / 2 - 20; wx += 22) x.fillRect(wx, wy, 12, 13);
        x.fillStyle = PA.navy; rr(x, -8, -24, 16, 24, 6); x.fill();
        noShade(x); x.restore();
      }
      x.beginPath(); x.moveTo(0, H); x.lineTo(0, GROUND);
      for (let i = 0; i < W; i += 30) x.quadraticCurveTo(i + 15, GROUND - 7, i + 30, GROUND);
      x.lineTo(W, H); x.closePath(); shade(x, 8, -3, 0.2); x.fillStyle = PA.ground; x.fill(); noShade(x);
      x.setLineDash([7, 6]); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(0, GROUND + 16); x.lineTo(W, GROUND + 16); x.stroke(); x.setLineDash([]);
    }), 0, 0, W, H);
  },
  drawShield(c, g) {
    c.save(); c.globalAlpha = g.shieldVis;
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx, DOME.ry, 0, Math.PI, 2 * Math.PI); c.closePath();
    c.fillStyle = 'rgba(170,225,255,.26)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx - 30, DOME.ry - 24, 0, Math.PI * 1.12, Math.PI * 1.36);
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
    c.restore();
  },
  drawBomb(c, b) { // bombs float down on paper parachutes
    const cw = Math.max(b.w * 0.95, 60), chh = cw * 0.4, top = -b.h / 2 - 40;
    c.save(); c.translate(b.x, b.y - b.kick * 5); c.rotate(tilt(b));
    c.strokeStyle = 'rgba(61,64,91,.55)'; c.lineWidth = 1.2; c.beginPath();
    c.moveTo(-cw / 2 + 2, top); c.lineTo(-b.w * 0.28, -b.h / 2 + 5); c.moveTo(cw / 2 - 2, top); c.lineTo(b.w * 0.28, -b.h / 2 + 5); c.moveTo(0, top); c.lineTo(0, -b.h / 2 + 2); c.stroke();
    shade(c, 5, 2);
    c.beginPath(); c.ellipse(0, top, cw / 2, chh, 0, Math.PI, 0); c.closePath(); c.fillStyle = CANOPY[b.tint % 4]; c.fill();
    noShade(c);
    c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.35)';
    for (const k of [-1, 1]) { c.beginPath(); c.ellipse(k * cw * 0.2, top, cw * 0.09, chh, 0, 0, 6.283); c.fill(); }
    c.restore();
    shade(c, 6, 3); rr(c, -b.w / 2, -b.h / 2, b.w, b.h, b.h / 2); c.fillStyle = PA.navy; c.fill(); noShade(c);
    c.fillStyle = PA.navyHi; c.beginPath(); c.ellipse(-b.w / 2 + b.h * 0.4, -b.h * 0.18, b.h * 0.15, b.h * 0.08, -0.6, 0, 6.283); c.fill();
    c.restore();
  },
  drawLabel(c, b) {
    c.save(); c.translate(b.x, b.y - b.kick * 5); c.rotate(tilt(b));
    seg(c, b.text, b.typed, 0, 1, { font: this.font, rest: PA.white, done: 'rgba(255,253,248,.38)', next: PA.yellow, under: PA.yellow, ul: 14 });
    c.restore();
  },
  drawShift(c, x, y, b) { // a cut-out paper arrow, tilting with its bomb
    const cx = b.x, cy = b.y - b.kick * 5;
    c.translate(cx, cy); c.rotate(tilt(b));
    shade(c, 3, 1.5, 0.3); c.fillStyle = PA.yellow; c.lineJoin = 'round';
    arrowPath(c, x - cx, y - cy, 6.5); c.fill();
    noShade(c);
  },
  drawReticle(c, b, g, locked) {
    const rx = b.w / 2 + 14, ry = b.h / 2 + 14;
    c.save(); c.translate(b.x, b.y - b.kick * 5); c.rotate(tilt(b));
    if (locked) { shade(c, 4, 2); c.strokeStyle = PA.red; c.lineWidth = 4; c.setLineDash([12, 8]); }
    else { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.5; c.setLineDash([6, 8]); }
    c.lineDashOffset = -g.t * 30; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 6.283); c.stroke();
    if (locked) {
      c.setLineDash([]); c.fillStyle = PA.red; const o = 9 + 2 * Math.sin(g.t * 8);
      for (const [px, py, a] of [[-rx - o, 0, 0], [rx + o, 0, Math.PI], [0, -ry - o, Math.PI / 2], [0, ry + o, -Math.PI / 2]]) {
        c.save(); c.translate(px, py); c.rotate(a); c.beginPath(); c.moveTo(6, 0); c.lineTo(-6, -7); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore();
      }
    }
    c.restore();
  },
  drawShot(c, s) { // paper planes
    c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx)); shade(c, 3, 2, 0.25);
    c.fillStyle = PA.white; c.beginPath(); c.moveTo(13, 0); c.lineTo(-10, -8); c.lineTo(-5, 0); c.lineTo(-10, 8); c.closePath(); c.fill();
    noShade(c); c.strokeStyle = 'rgba(61,64,91,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(13, 0); c.lineTo(-5, 0); c.stroke();
    c.restore();
  },
  drawLaser(c, l) { // a ribbon cut with pinking shears
    const a = l.life / l.max, len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1), hw = (l.big ? 12 : 4) * (0.5 + a * 0.5);
    c.save(); c.globalAlpha = Math.min(1, a * 1.5); c.translate(l.x1, l.y1); c.rotate(Math.atan2(l.y2 - l.y1, l.x2 - l.x1)); shade(c, 5, 3);
    c.fillStyle = l.big ? PA.yellow : PA.white; c.beginPath(); c.moveTo(0, -hw);
    for (let x = 0, i = 0; x <= len; x += 8, i++) c.lineTo(x, -hw - (i % 2 ? 4 : 0));
    for (let x = len, i = 0; x >= 0; x -= 8, i++) c.lineTo(x, hw + (i % 2 ? 4 : 0));
    c.closePath(); c.fill(); c.restore();
  },
  drawCannon(c, g) {
    c.save(); c.translate(CANNON.x, CANNON.y);
    c.save(); c.rotate(g.angle); shade(c, 6, 3); c.fillStyle = g.jam > 0 ? PA.red : PA.teal; rr(c, 4 - g.recoil * 10, -11, BARREL, 22, 8); c.fill();
    noShade(c); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(12 - g.recoil * 10, -11, BARREL - 22, 5); c.restore();
    shade(c, 6, 3); c.fillStyle = PA.wood; c.beginPath(); c.moveTo(-42, 28); c.lineTo(-26, -2); c.lineTo(26, -2); c.lineTo(42, 28); c.closePath(); c.fill();
    c.fillStyle = '#a86f43'; c.beginPath(); c.arc(0, 0, 21, Math.PI, 0); c.closePath(); c.fill();
    shade(c, 2, 1, 0.3); c.fillStyle = PA.gold; c.beginPath(); c.arc(0, -6, 5, 0, 6.283); c.fill(); noShade(c);
    c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(-1.5, -7.5, 1.6, 0, 6.283); c.fill();
    c.restore();
  },
  drawParticle(c, p) {
    const a = p.life / p.max;
    c.save(); c.globalAlpha = Math.min(1, a * 2); c.translate(p.x, p.y); c.rotate(p.rot);
    if (p.kind === 'conf') { c.scale(1, Math.cos(p.rot * 1.7)); c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s * 0.3, p.s, p.s * 0.6); }
    else if (p.kind === 'star') { const s = p.r * (a > 0.7 ? 0.4 + (1 - a) * 2.3 : 1.1); shade(c, 5, 3); c.fillStyle = PA.yellow; star(c, 0, 0, 5, s, s * 0.5, -Math.PI / 2); c.fill(); }
    else if (p.kind === 'puff') { c.fillStyle = 'rgba(250,248,255,.9)'; c.beginPath(); c.arc(0, 0, p.s * (1.5 - a * 0.5), 0, 6.283); c.fill(); }
    else { c.fillStyle = '#d8d4e3'; c.beginPath(); for (let i = 0; i < 7; i++) { const an = (i / 7) * 6.283, rr2 = p.s * (0.7 + ((i * 37) % 10) / 25); c.lineTo(Math.cos(an) * rr2, Math.sin(an) * rr2); } c.closePath(); c.fill(); }
    c.restore();
  },
  confetti(g, x, y, n, v0, v1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), v = rand(v0, v1);
      g.p({ kind: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 320, drag: 1.4, life: rand(0.7, 1.3), s: rand(7, 12), rot: rand(0, 6), vr: rand(-10, 10), col: pick([PA.red, PA.yellow, PA.teal, '#8ecae6', '#cdb4db', PA.white]) });
    }
  },
  explode(g, b) { g.p({ kind: 'star', x: b.x, y: b.y, life: 0.45, r: 26 + b.w * 0.2 }); this.confetti(g, b.x, b.y, 24, 120, 360); },
  chip(g, b, at) { this.confetti(g, at.x, at.y, 3, 60, 140); },
  misfire(g, tip) {
    for (let i = 0; i < 3; i++) g.p({ kind: 'puff', x: tip.x + rand(-10, 10), y: tip.y - 6, vx: rand(-20, 20), vy: rand(-50, -25), life: rand(0.5, 0.8), s: rand(8, 12) });
    g.p({ kind: 'ball', x: tip.x, y: tip.y, vx: rand(-60, 60), vy: -120, g: 500, life: 0.8, s: 7, vr: 6 });
  },
  shieldHit(g, b) { this.confetti(g, b.x, b.y + b.h / 2, 18, 80, 260); g.p({ kind: 'star', x: b.x, y: b.y + b.h / 2, life: 0.4, r: 34 }); },
  cityHit(g, b) { this.confetti(g, b.x, IMPACT, 50, 150, 520); for (let i = 0; i < 8; i++) g.p({ kind: 'puff', x: b.x + rand(-60, 60), y: IMPACT + rand(-10, 20), vy: -30, life: 1, s: rand(14, 24) }); }
});
})();
