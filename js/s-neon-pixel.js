/* Styles 1 + 2: Neon Pulse, Pixel Arcade */
(() => {
'use strict';
const { W, H, GROUND, IMPACT, CANNON, BARREL, DOME, domeY, util: { rand, pick, lerp, rng }, skyline, seg, arrowPath } = TD;

/* ---------------- 1 · Neon Pulse ---------------- */
const N = { bg0: '#07041a', bg1: '#1b0838', cyan: '#29f0ff', pink: '#ff3df2', yellow: '#ffe14d', violet: '#7c5cff', red: '#ff4d6d', ink: '#100828' };
// 120 bpm pulse; in the game it follows the music's beat instead.
const beat = g => { const b = g.mode === 'play' && TD.Music ? TD.Music.beatPos() : null; return Math.pow(1 - ((b ?? g.t * 2) % 1), 3); };

TD.styles.push({
  id: 'neon', name: 'Neon Pulse',
  font: '800 30px "Exo 2", system-ui, sans-serif', bombH: 54, padX: 46,
  flashColor: N.pink,
  hud: {
    font: '700 {s}px Orbitron, "Exo 2", sans-serif', color: '#fff', dim: 'rgba(255,255,255,.6)', accent: N.yellow, bar: N.cyan, barTrack: 'rgba(124,92,255,.38)',
    panel(c, x, y, w, h) {
      c.save(); c.fillStyle = 'rgba(7,4,26,.65)'; c.strokeStyle = 'rgba(41,240,255,.55)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + 10, y); c.lineTo(x + w, y); c.lineTo(x + w - 10, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); c.stroke(); c.restore();
    },
    seg(c, x, y, w, on) {
      c.save(); c.fillStyle = on ? N.yellow : 'rgba(124,92,255,.38)';
      if (on) { c.shadowColor = N.yellow; c.shadowBlur = (8) * TD.k; }
      c.beginPath(); c.moveTo(x + 4, y - 6); c.lineTo(x + w, y - 6); c.lineTo(x + w - 4, y + 6); c.lineTo(x, y + 6); c.closePath(); c.fill(); c.restore();
    }
  },
  gauge: { track: 'rgba(124,92,255,.35)', laser: N.pink, multi: N.cyan, glow: 12, lw: 5 },
  music: { // synthwave: four on the floor, rolling saw bass, arps when it gets hot
    bpm: 120, chords: ['Am', 'F', 'C', 'G'],
    tracks: [
      { drum: 'kick', pat: 'x...x...x...x...', v: 0.8 },
      { i: 'bass', oct: 1, pat: '0.0.0.0.0.0.o.0.', v: 0.34 },
      { i: 'pad', oct: 3, pat: 'C---------------', v: 0.085, rev: 0.4 },
      { drum: 'ohat', pat: '..x...x...x...x.', v: 0.7, lvl: 1 },
      { drum: 'clap', pat: '....x.......x...', v: 0.55, lvl: 1 },
      { i: 'arp', oct: 4, pat: '0123210301232103', v: 0.07, dly: 0.35, lvl: 2, boost: true },
      { i: 'synlead', v: 0.08, dly: 0.25, rev: 0.2, lvl: 2, notes: `
        E5 - - . E5 - D5 - C5 - - . D5 - E5 -
        C5 - - . A4 - - . A4 - C5 - D5 - - .
        E5 - - . G5 - - . E5 - D5 - C5 - D5 -
        B4 - - . D5 - - . G5 - - - - - . .` }
    ]
  },
  overOpts: { font: '700 {s}px Orbitron, "Exo 2", sans-serif', title: 'GAME OVER', titleSize: 60, dim: 'rgba(7,4,26,.8)', color: '#fff', accent: N.pink },
  text: { font: '700 {s}px Orbitron, "Exo 2", sans-serif', fill: N.yellow, stroke: N.bg0, lw: 6 },
  sfx: {
    shoot: [{ f: 880, f2: 1500, d: 0.06, type: 'square', v: 0.04 }],
    chip: [{ f: 1300, d: 0.03, type: 'triangle', v: 0.04 }],
    boom: [{ f: 240, f2: 50, d: 0.3, type: 'sawtooth', v: 0.07 }, { noise: 1, f: 3500, f2: 200, d: 0.25, v: 0.1 }],
    miss: [{ f: 150, f2: 90, d: 0.18, type: 'square', v: 0.07 }],
    laser: [{ f: 2200, f2: 300, d: 0.35, type: 'sawtooth', v: 0.06 }],
    shield: [{ f: 640, f2: 200, d: 0.4, type: 'triangle', v: 0.1 }, { noise: 1, f: 2000, d: 0.3, v: 0.08 }],
    power: [{ f: 523, d: 0.08, v: 0.05 }, { f: 659, d: 0.08, v: 0.05, at: 0.08 }, { f: 784, d: 0.18, v: 0.05, at: 0.16 }],
    over: [{ f: 420, f2: 60, d: 0.9, type: 'sawtooth', v: 0.09 }, { noise: 1, f: 1500, f2: 100, d: 0.8, v: 0.12 }]
  },
  drawBackground(c, g) {
    c.drawImage(g.layer('bg', x => {
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, N.bg0); gr.addColorStop(1, N.bg1);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(124,92,255,.13)'; x.lineWidth = 1; x.beginPath();
      for (let i = 0; i <= W; i += 48) { x.moveTo(i, 0); x.lineTo(i, GROUND); }
      for (let j = 0; j <= GROUND; j += 48) { x.moveTo(0, j); x.lineTo(W, j); }
      x.stroke();
    }), 0, 0, W, H);
    const p = beat(g);
    c.save(); c.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const s = 16 + (i % 3) * 14, x = ((i * 173 + g.t * (10 + i * 4)) % (W + 2 * s)) - s, y = 50 + ((i * 97) % 340);
      c.save(); c.translate(x, y); c.rotate(g.t * (0.4 + i * 0.09));
      c.strokeStyle = i % 2 ? `rgba(41,240,255,${0.12 + p * 0.18})` : `rgba(255,61,242,${0.1 + p * 0.15})`;
      c.strokeRect(-s / 2, -s / 2, s, s); c.restore();
    }
    c.restore();
  },
  drawCity(c, g) {
    c.drawImage(g.layer('city', x => {
      for (const b of skyline(11, { minW: 40, maxW: 80, minH: 60, maxH: 112, gap: 2 })) { x.fillStyle = '#170c3a'; x.fillRect(b.x, b.top, b.w, b.h); }
      for (const b of skyline(7, { minW: 54, maxW: 104, minH: 34, maxH: 92, gap: 10 })) {
        x.fillStyle = N.ink; x.fillRect(b.x, b.top, b.w, b.h);
        const r = rng((b.x * 13) | 0);
        for (let wy = b.top + 12; wy < GROUND - 14; wy += 15) for (let wx = b.x + 9; wx < b.x + b.w - 15; wx += 14) {
          const v = r(); if (v < 0.45) { x.globalAlpha = 0.85; x.fillStyle = v < 0.15 ? N.yellow : v < 0.3 ? N.pink : N.cyan; x.fillRect(wx, wy, 6, 6); x.globalAlpha = 1; }
        }
        x.save(); x.shadowColor = N.cyan; x.shadowBlur = (10) * TD.k; x.strokeStyle = N.cyan; x.lineWidth = 2; x.beginPath();
        x.moveTo(b.x + 1, GROUND); x.lineTo(b.x + 1, b.top + 1); x.lineTo(b.x + b.w - 1, b.top + 1); x.lineTo(b.x + b.w - 1, GROUND);
        if (b.r > 0.7) { x.moveTo(b.x + b.w / 2, b.top); x.lineTo(b.x + b.w / 2, b.top - 18); }
        x.stroke(); x.restore();
      }
      x.fillStyle = '#0b0620'; x.fillRect(0, GROUND, W, H - GROUND);
      x.strokeStyle = 'rgba(255,61,242,.28)'; x.lineWidth = 1; x.beginPath();
      for (let i = -14; i <= 14; i++) { x.moveTo(W / 2 + i * 36, GROUND); x.lineTo(W / 2 + i * 120, H); }
      for (let j = 1; j <= 4; j++) { const y = GROUND + j * j * 2.5; x.moveTo(0, y); x.lineTo(W, y); }
      x.stroke();
      x.save(); x.shadowColor = N.pink; x.shadowBlur = (14) * TD.k; x.strokeStyle = N.pink; x.lineWidth = 3;
      x.beginPath(); x.moveTo(0, GROUND); x.lineTo(W, GROUND); x.stroke(); x.restore();
    }), 0, 0, W, H);
    c.fillStyle = `rgba(255,61,242,${beat(g) * 0.3})`; c.fillRect(0, GROUND - 3, W, 6);
  },
  drawShield(c, g) {
    c.save(); c.globalAlpha = g.shieldVis;
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx, DOME.ry, 0, Math.PI, 2 * Math.PI);
    c.fillStyle = 'rgba(41,240,255,.07)'; c.fill();
    c.shadowColor = N.cyan; c.shadowBlur = (16) * TD.k; c.strokeStyle = N.cyan; c.lineWidth = 2.5 + beat(g) * 2; c.stroke();
    c.shadowBlur = (0) * TD.k; c.globalAlpha = g.shieldVis * 0.5; c.setLineDash([4, 10]); c.lineDashOffset = -g.t * 40;
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx - 18, DOME.ry - 14, 0, Math.PI, 2 * Math.PI); c.stroke();
    c.restore();
  },
  drawBomb(c, b, g) {
    const col = [N.pink, N.cyan, N.yellow, N.violet][b.tint % 4], y = b.y - b.kick * 6;
    c.save(); c.translate(b.x, y);
    for (let i = 1; i <= 3; i++) { c.globalAlpha = 0.3 / i; c.fillStyle = col; const s = 10 - i * 2; c.fillRect(-s / 2, -b.h / 2 - i * 13 - s, s, s); }
    c.globalAlpha = 1; c.shadowColor = col; c.shadowBlur = (12 + beat(g) * 10) * TD.k;
    c.lineWidth = 3; c.strokeStyle = col; c.fillStyle = 'rgba(10,6,24,.9)'; c.lineJoin = 'round';
    if (b.text.length === 1) {
      const s = b.h * 0.8; c.rotate(b.rot);
      c.beginPath(); c.rect(-s / 2, -s / 2, s, s); c.fill(); c.stroke();
      c.rotate(Math.PI / 4); c.globalAlpha = 0.45; c.strokeRect(-s * 0.34, -s * 0.34, s * 0.68, s * 0.68);
    } else {
      const w = b.w, h = b.h * 0.82, e = h / 2;
      c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 + e, -h / 2); c.lineTo(w / 2 - e, -h / 2); c.lineTo(w / 2, 0); c.lineTo(w / 2 - e, h / 2); c.lineTo(-w / 2 + e, h / 2); c.closePath();
      c.fill(); c.stroke();
    }
    c.restore();
  },
  drawLabel(c, b) {
    c.save(); c.shadowColor = 'rgba(255,255,255,.55)'; c.shadowBlur = (6) * TD.k;
    seg(c, b.text, b.typed, b.x, b.y - b.kick * 6 + 1, { font: this.font, rest: '#fff', done: 'rgba(255,255,255,.28)', next: N.yellow, under: N.yellow, ul: 15 });
    c.restore();
  },
  drawShift(c, x, y) { // a little neon tube in the shape of the shift key
    c.shadowColor = N.yellow; c.shadowBlur = 8 * TD.k;
    c.strokeStyle = N.yellow; c.lineWidth = 2; c.lineJoin = 'round';
    arrowPath(c, x, y, 6.5); c.stroke();
  },
  drawReticle(c, b, g, locked) {
    const y = b.y - b.kick * 6, rw = b.w / 2 + 12, rh = b.h / 2 + 10, k = 14, br = locked ? 0 : 5 + 3 * Math.sin(g.t * 5);
    if (locked) {
      const t = g.tip();
      c.save(); c.strokeStyle = 'rgba(255,225,77,.35)'; c.lineWidth = 1.5; c.setLineDash([6, 8]); c.lineDashOffset = -g.t * 60;
      c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(b.x, y + b.h / 2); c.stroke(); c.restore();
    }
    c.save(); c.translate(b.x, y);
    c.strokeStyle = locked ? N.yellow : 'rgba(255,225,77,.5)'; c.lineWidth = locked ? 3 : 2;
    if (locked) { c.shadowColor = N.yellow; c.shadowBlur = (10) * TD.k; }
    c.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const X = sx * (rw + br), Y = sy * (rh + br);
      c.moveTo(X, Y - sy * k); c.lineTo(X, Y); c.lineTo(X - sx * k, Y);
    }
    c.stroke(); c.restore();
  },
  drawShot(c, s) {
    const tx = s.trail.length ? s.trail[0] : s.x, ty = s.trail.length ? s.trail[1] : s.y;
    c.save(); c.lineCap = 'round'; c.shadowColor = N.cyan; c.shadowBlur = (12) * TD.k;
    c.strokeStyle = 'rgba(41,240,255,.8)'; c.lineWidth = 5; c.beginPath(); c.moveTo(tx, ty); c.lineTo(s.x, s.y); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(s.x - 4, s.y - 4, 8, 8); c.restore();
  },
  drawLaser(c, l) {
    const a = l.life / l.max;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.shadowColor = N.cyan; c.shadowBlur = (18) * TD.k;
    c.beginPath(); c.moveTo(l.x1, l.y1); c.lineTo(l.x2, l.y2);
    c.strokeStyle = `rgba(41,240,255,${a})`; c.lineWidth = (l.big ? 22 : 6) * a + 1; c.stroke();
    c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = (l.big ? 7 : 2) * a + 0.5; c.stroke();
    c.restore();
  },
  drawCannon(c, g) {
    const col = g.jam > 0 ? N.red : N.cyan;
    c.save(); c.translate(CANNON.x, CANNON.y);
    c.shadowColor = col; c.shadowBlur = (14) * TD.k; c.strokeStyle = col; c.lineWidth = 3; c.fillStyle = N.ink; c.lineJoin = 'round';
    c.save(); c.rotate(g.angle); c.beginPath(); c.rect(8 - g.recoil * 12, -9, BARREL - 6, 18); c.fill(); c.stroke();
    c.fillStyle = col; c.fillRect(BARREL - 16 - g.recoil * 12, -9, 4, 18); c.restore();
    c.beginPath(); c.arc(0, 0, 22, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-46, 26); c.lineTo(-30, 0); c.lineTo(30, 0); c.lineTo(46, 26); c.closePath(); c.fill(); c.stroke();
    c.restore();
  },
  drawParticle(c, p) {
    const a = p.life / p.max;
    c.save(); c.globalAlpha = Math.min(1, a * 1.6);
    if (p.kind === 'ring') {
      c.strokeStyle = p.col; c.lineWidth = 2 + 4 * a; c.shadowColor = p.col; c.shadowBlur = (14) * TD.k;
      c.beginPath(); c.arc(p.x, p.y, lerp(p.r1, p.r0, a), 0, 6.283); c.stroke();
    } else if (p.kind === 'x') {
      const s = p.s * (1.4 - a * 0.4); c.strokeStyle = p.col; c.lineWidth = 4; c.lineCap = 'round'; c.shadowColor = p.col; c.shadowBlur = (10) * TD.k;
      c.beginPath(); c.moveTo(p.x - s, p.y - s); c.lineTo(p.x + s, p.y + s); c.moveTo(p.x + s, p.y - s); c.lineTo(p.x - s, p.y + s); c.stroke();
    } else { c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); }
    c.restore();
  },
  shards(g, x, y, n, cols, v0, v1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), v = rand(v0, v1);
      g.p({ kind: 'sq', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: rand(0.35, 0.8), s: rand(4, 10), rot: a, vr: rand(-9, 9), col: pick(cols) });
    }
  },
  explode(g, b) {
    g.p({ kind: 'ring', x: b.x, y: b.y, life: 0.45, r0: 12, r1: b.w * 0.6 + 50, col: N.yellow });
    g.p({ kind: 'ring', x: b.x, y: b.y, life: 0.3, r0: 6, r1: b.w * 0.4 + 20, col: N.pink });
    this.shards(g, b.x, b.y, 18, [N.pink, N.cyan, N.yellow], 140, 440);
  },
  chip(g, b, at) { this.shards(g, at.x, at.y, 4, [N.cyan, '#fff'], 80, 200); },
  misfire(g, tip) { g.p({ kind: 'x', x: tip.x, y: tip.y - 18, life: 0.5, s: 12, col: N.red }); this.shards(g, tip.x, tip.y, 6, [N.red], 60, 160); },
  shieldHit(g, b) { g.p({ kind: 'ring', x: b.x, y: b.y + b.h / 2, life: 0.7, r0: 20, r1: 260, col: N.cyan }); },
  cityHit(g, b) { g.p({ kind: 'ring', x: b.x, y: IMPACT, life: 0.9, r0: 20, r1: 340, col: N.red }); this.shards(g, b.x, IMPACT, 30, [N.red, N.yellow, N.pink], 150, 520); }
});

/* ---------------- 2 · Pixel Arcade ---------------- */
// The world is drawn into a 240×150 buffer and scaled up with hard edges; labels and HUD stay sharp on top.
const P = 4, PW = W / P, PH = H / P, Q = v => Math.round(v / P);
const X = { sky0: '#0d0b2a', sky1: '#1d1650', sky2: '#33236d', sky3: '#4e2c80', star: '#fff6d5', moon: '#f4e7b0', crater: '#d6c58c',
  far: '#2a1f5c', bld: '#24204f', edge: '#3a3378', win: '#ffd34e', winOff: '#3d3577', ground: '#2f6b3a', ground2: '#3f8f49',
  bomb: '#211b38', shine: '#6a6488', fuse: '#c28b4a', spark: '#ffef5a', orange: '#ff9a2e', red: '#ff3b3b', cyan: '#57e0ff', grey: '#8a8fa8' };
const fill = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
function pcap(c, cx, cy, w, h, col) { // pixel circle or capsule, world px
  const r = h / 2; c.fillStyle = col;
  for (let j = 0; j < h; j++) {
    const dy = j + 0.5 - r, hw = Math.round(w / 2 - r + Math.sqrt(Math.max(0, r * r - dy * dy)));
    c.fillRect(Math.round(cx) - hw, Math.round(cy - r) + j, hw * 2, 1);
  }
}
function pline(c, x1, y1, x2, y2, t, col) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
  c.fillStyle = col;
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x1 + ((x2 - x1) * i) / n - t / 2), Math.round(y1 + ((y2 - y1) * i) / n - t / 2), t, t);
}
function pring(c, cx, cy, r, col) {
  const n = Math.max(12, Math.round(r * 6)); c.fillStyle = col;
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
}
let buf = null, bctx = null;
const front = skyline(8, { minW: 52, maxW: 100, minH: 36, maxH: 92, gap: 8 });
const antennas = front.filter(b => b.r > 0.6).map(b => ({ x: Q(b.x) + (Q(b.w) >> 1), y: Q(b.top) - 5, ph: b.r2 * 6 }));

TD.styles.push({
  id: 'pixel', name: 'Pixel Arcade',
  font: '700 26px "Pixelify Sans", ui-monospace, monospace', bombH: 52, padX: 36, sway: 0.6,
  hud: {
    font: '{s}px "Press Start 2P", ui-monospace, monospace', color: '#fff', dim: '#a59fd6', accent: X.win, bar: X.win, barTrack: '#3b3470',
    seg(c, x, y, w, on) { c.fillStyle = on ? X.win : '#3b3470'; c.fillRect(Math.round(x / 4) * 4, y - 6, 12, 12); if (on) { c.fillStyle = '#fff3b0'; c.fillRect(Math.round(x / 4) * 4, y - 6, 4, 4); } }
  },
  music: { // chiptune: triangle bass, pulse-wave lead, noise drums
    bpm: 138, chords: ['C', 'Am', 'F', 'G'],
    tracks: [
      { i: 'tri', oct: 2, pat: '0.o.0.o.0.o.0.o.', v: 0.32 },
      { drum: 'nkick', pat: 'x.......x.......', v: 0.8 },
      { i: 'pulse', v: 0.075, notes: `
        C5 . E5 . G5 . E5 . C6 - - . G5 . E5 .
        A4 . C5 . E5 . C5 . A5 - - . E5 . C5 .
        F4 . A4 . C5 . F5 . A5 - G5 - F5 - E5 -
        D5 - - . B4 . D5 . G5 - - - - . . .` },
      { drum: 'nsnare', pat: '....x.......x...', v: 0.8, lvl: 1 },
      { drum: 'nhat', pat: 'x.x.x.x.x.x.x.x.', v: 0.7, lvl: 1 },
      { i: 'pulse12', oct: 5, pat: '0120012001200120', v: 0.04, lvl: 2, boost: true }
    ]
  },
  drawGauge(c, g) { // a ring of chunky pixels around the cannon
    const n = 22, on = Math.ceil(n * Math.min(1, g.weaponT / TD.POWER_T)), dim = g.weaponT < 2.5 && Math.sin(g.t * 16) < 0;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + 0.22 + (Math.PI - 0.44) * (i / (n - 1));
      fill(c, Q(CANNON.x + Math.cos(a) * 80) - 1, Q(CANNON.y + Math.sin(a) * 80) - 1, 2, 2, i < on && !dim ? (g.weapon === 'laser' ? X.red : X.cyan) : '#3b3470');
    }
  },
  overOpts: { font: '{s}px "Press Start 2P", ui-monospace, monospace', title: 'GAME OVER', titleSize: 52, dim: 'rgba(13,11,42,.84)', color: '#fff', accent: X.win },
  text: { font: '{s}px "Press Start 2P", ui-monospace, monospace', fill: X.win, stroke: X.sky0, lw: 8 },
  sfx: {
    shoot: [{ f: 660, f2: 990, d: 0.05, v: 0.04 }],
    chip: [{ f: 990, d: 0.03, v: 0.03 }],
    boom: [{ noise: 1, f: 1400, f2: 100, d: 0.35, v: 0.14 }, { f: 130, f2: 40, d: 0.3, v: 0.06 }],
    miss: [{ f: 110, d: 0.09, v: 0.07 }, { f: 82, d: 0.12, v: 0.07, at: 0.09 }],
    laser: [{ f: 1600, f2: 200, d: 0.3, v: 0.05 }],
    shield: [{ f: 300, f2: 900, d: 0.3, type: 'triangle', v: 0.1 }],
    power: [523, 659, 784, 1046].map((f, i) => ({ f, d: 0.07, v: 0.05, at: i * 0.07 })),
    over: [{ f: 440, f2: 55, d: 1, v: 0.08 }, { noise: 1, f: 900, f2: 80, d: 0.7, v: 0.1 }]
  },
  beginWorld() {
    if (!buf) { buf = document.createElement('canvas'); buf.width = PW; buf.height = PH; bctx = buf.getContext('2d'); }
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    return bctx;
  },
  endWorld(g, c) {
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(buf, 0, 0, W, H); c.restore();
    c.drawImage(g.layer('scan', x => { x.fillStyle = 'rgba(0,0,0,.16)'; for (let y = 2; y < H; y += 4) x.fillRect(0, y, W, 1.5); }), 0, 0, W, H);
  },
  drawBackground(c, g) {
    c.drawImage(g.layer('bg', x => {
      const bands = [X.sky0, X.sky1, X.sky2, X.sky3], at = [0, 46, 86, 116];
      bands.forEach((col, i) => fill(x, 0, at[i], PW, (at[i + 1] ?? PH) - at[i], col));
      for (let i = 1; i < bands.length; i++) { // checker dithering between bands
        x.fillStyle = bands[i]; for (let xx = 0; xx < PW; xx += 2) { x.fillRect(xx, at[i] - 1, 1, 1); x.fillRect(xx + 1, at[i] - 3, 1, 1); }
      }
      const r = rng(42);
      for (let i = 0; i < 70; i++) fill(x, r() * PW, r() * 104, 1, 1, r() > 0.75 ? X.star : 'rgba(255,246,213,.5)');
      pcap(x, 204, 24, 16, 16, X.moon); fill(x, 200, 20, 2, 2, X.crater); fill(x, 206, 27, 3, 2, X.crater); fill(x, 202, 29, 1, 1, X.crater);
    }, PW, PH, 1), 0, 0);
    const r = rng(7);
    for (let i = 0; i < 6; i++) { const x = r() * PW, y = r() * 90; if (((g.t * 3 + i) | 0) % 3 === 0) { fill(c, x, y, 1, 1, '#fff'); fill(c, x - 1, y, 3, 1, 'rgba(255,255,255,.5)'); } }
  },
  drawCity(c, g) {
    c.drawImage(g.layer('city', x => {
      for (const b of skyline(21, { minW: 36, maxW: 70, minH: 60, maxH: 112, gap: 0 })) fill(x, Q(b.x), Q(b.top), Q(b.w), PH, X.far);
      for (const b of front) {
        const bx = Q(b.x), by = Q(b.top), bw = Q(b.w), bh = Q(GROUND) - by, r = rng((b.x * 7) | 0);
        fill(x, bx, by, bw, bh, X.bld); fill(x, bx, by, bw, 1, X.edge); fill(x, bx, by, 1, bh, X.edge);
        for (let wy = by + 3; wy < Q(GROUND) - 3; wy += 4) for (let wx = bx + 2; wx < bx + bw - 2; wx += 3) fill(x, wx, wy, 1, 2, r() < 0.5 ? X.win : X.winOff);
        if (b.r > 0.6) fill(x, bx + (bw >> 1), by - 4, 1, 4, X.edge);
      }
      const gy = Q(GROUND);
      fill(x, 0, gy, PW, PH - gy, X.ground);
      for (let xx = 0; xx < PW; xx += 2) fill(x, xx + ((xx >> 1) & 1), gy, 1, 1, X.ground2);
      for (let xx = 0; xx < PW; xx += 3) fill(x, xx, gy + 3 + (xx % 5), 1, 1, '#24542d');
    }, PW, PH, 1), 0, 0);
    for (const a of antennas) if (Math.sin(g.t * 3 + a.ph) > 0) fill(c, a.x, a.y, 1, 1, X.red);
  },
  drawShield(c, g) {
    const dome = g.layer('dome', x => {
      for (let xx = 0; xx < PW; xx++) {
        const yy = Math.round(domeY(xx * P) / P);
        fill(x, xx, yy, 1, 1, X.cyan);
        x.fillStyle = 'rgba(87,224,255,.4)';
        for (let y2 = yy + 2; y2 < Q(GROUND); y2 += 2) if (((xx + y2) & 3) === 0) x.fillRect(xx, y2, 1, 1);
      }
    }, PW, PH, 1);
    c.save(); c.globalAlpha = g.shieldVis * (0.8 + 0.2 * Math.sin(g.t * 8)); c.drawImage(dome, 0, 0); c.restore();
    const sx = (g.t * 70) % PW; fill(c, sx, Math.round(domeY(sx * P) / P), 2, 1, '#fff');
  },
  drawBomb(c, b, g) {
    const cx = Q(b.x), cy = Q(b.y - b.kick * 6), w = Math.round(b.w / P), h = Math.round(b.h / P);
    pcap(c, cx, cy, w + 2, h + 2, ['#b9b0ff', '#ff8fa3', '#7fe7ff', '#ffd34e'][b.tint % 4]);
    pcap(c, cx, cy, w, h, X.bomb);
    fill(c, cx - (w >> 1) + 2, cy - (h >> 1) + 2, 2, 1, X.shine);
    const fx = cx + (w >> 1) - 3, fy = cy - (h >> 1) - 1, on = ((g.t * 10) | 0) % 2;
    fill(c, fx, fy - 2, 1, 2, X.fuse); fill(c, fx + 1, fy - 3, 1, 1, X.fuse);
    fill(c, fx + 1 + on, fy - 4 - on, 1, 1, on ? X.spark : X.orange); fill(c, fx + 2 - on, fy - 5 + on, 1, 1, X.spark);
  },
  drawLabel(c, b) {
    seg(c, b.text, b.typed, Q(b.x) * P, Q(b.y - b.kick * 6) * P + 1, { font: this.font, rest: '#fff', done: '#7d76a8', next: X.win, under: X.win, ul: 13 });
  },
  drawShift(c, x, y, b) { // a tiny sprite, fixed to the bomb's snapped position (like the label) so they move as one
    const ART = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..'], u = 2;
    const x0 = Q(b.x) * P + Math.round(((b.tw || 20) / 2 + 9) / u) * u - 3 * u, y0 = Q(b.y - b.kick * 6) * P - 12 - 4 * u;
    ART.forEach((row, j) => [...row].forEach((p, i) => { if (p === '#') fill(c, x0 + i * u, y0 + j * u, u, u, X.win); }));
  },
  drawReticle(c, b, g, locked) {
    const S = v => Math.round(v / P) * P, cx = S(b.x), cy = S(b.y - b.kick * 6), rw = S(b.w / 2 + 12), rh = S(b.h / 2 + 10);
    c.fillStyle = locked ? (((g.t * 4) | 0) % 2 ? X.red : '#fff') : 'rgba(255,255,255,.4)';
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = cx + sx * rw - (sx > 0 ? P : 0), y = cy + sy * rh - (sy > 0 ? P : 0);
      c.fillRect(sx > 0 ? x - 2 * P : x, y, 3 * P, P);
      c.fillRect(x, sy > 0 ? y - 2 * P : y, P, 3 * P);
    }
  },
  drawShot(c, s) {
    const t = s.trail;
    if (t.length >= 2) fill(c, Q(t[t.length - 2]), Q(t[t.length - 1]), 1, 1, X.orange);
    fill(c, Q(s.x) - 1, Q(s.y) - 1, 2, 2, X.spark);
  },
  drawLaser(c, l, g) {
    const on = ((g.t * 20) | 0) % 2;
    pline(c, Q(l.x1), Q(l.y1), Q(l.x2), Q(l.y2), l.big && l.life / l.max > 0.4 ? 3 : 1, on ? '#fff' : X.cyan);
  },
  drawCannon(c, g) {
    const cx = Q(CANNON.x), cy = Q(CANNON.y), L = (BARREL - g.recoil * 10) / P, body = g.jam > 0 ? X.red : '#9fb1d6';
    const ex = cx + Math.cos(g.angle) * L, ey = cy + Math.sin(g.angle) * L;
    pline(c, cx, cy, ex, ey, 3, '#4b5877'); pline(c, cx, cy, ex, ey, 1, body);
    pcap(c, cx, cy, 12, 12, '#4b5877'); pcap(c, cx, cy - 1, 10, 10, body);
    for (let j = 0; j < 6; j++) fill(c, cx - 7 - j, cy + 1 + j, 14 + 2 * j, 1, j === 0 ? '#c3d0ea' : '#4b5877');
  },
  drawParticle(c, p) {
    const a = p.life / p.max;
    if (p.kind === 'ring') return pring(c, Q(p.x), Q(p.y), lerp(p.r1, p.r0, a) / P, a > 0.6 ? '#fff' : p.col);
    if (p.kind === 'flash') return pcap(c, Q(p.x), Q(p.y), p.s, p.s, '#fff');
    if (p.kind === 'x') { const x = Q(p.x), y = Q(p.y); pline(c, x - 2, y - 2, x + 2, y + 2, 1, X.red); pline(c, x + 2, y - 2, x - 2, y + 2, 1, X.red); return; }
    if (p.kind === 'smoke') return fill(c, Q(p.x), Q(p.y), p.s, p.s, a > 0.5 ? X.grey : '#555a70');
    fill(c, Q(p.x), Q(p.y), p.s, p.s, a > 0.7 ? '#fff6a8' : a > 0.35 ? p.col : '#a8351f');
  },
  sparks(g, x, y, n, cols, v0, v1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.283), v = rand(v0, v1);
      g.p({ kind: 'px', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 380, drag: 1.5, life: rand(0.4, 0.9), s: Math.random() < 0.3 ? 2 : 1, col: pick(cols) });
    }
  },
  explode(g, b) {
    g.p({ kind: 'flash', x: b.x, y: b.y, life: 0.08, s: 10 });
    g.p({ kind: 'ring', x: b.x, y: b.y, life: 0.4, r0: 8, r1: b.w * 0.5 + 40, col: X.orange });
    this.sparks(g, b.x, b.y, 22, [X.orange, X.spark, X.red], 80, 300);
  },
  chip(g, b, at) { this.sparks(g, at.x, at.y, 4, ['#fff', X.spark], 60, 160); },
  misfire(g, tip) {
    g.p({ kind: 'x', x: tip.x, y: tip.y - 20, life: 0.5 });
    for (let i = 0; i < 6; i++) g.p({ kind: 'smoke', x: tip.x + rand(-8, 8), y: tip.y, vx: rand(-20, 20), vy: rand(-60, -30), life: rand(0.4, 0.7), s: 2 });
  },
  shieldHit(g, b) { g.p({ kind: 'ring', x: b.x, y: b.y + b.h / 2, life: 0.6, r0: 10, r1: 180, col: X.cyan }); this.sparks(g, b.x, b.y + b.h / 2, 12, [X.cyan, '#fff'], 80, 240); },
  cityHit(g, b) { g.p({ kind: 'ring', x: b.x, y: IMPACT, life: 0.8, r0: 10, r1: 280, col: X.red }); this.sparks(g, b.x, IMPACT, 40, [X.orange, X.spark, X.red], 100, 420); }
});
})();
