/* Styles 5 + 6: Comic Pop, Deep Sea */
(() => {
'use strict';
const { W, H, GROUND, IMPACT, CANNON, BARREL, DOME, domeY, util: { rand, pick, lerp, rng }, rr, star, skyline, seg, arrowPath } = TD;

/* ---------------- 5 · Comic Pop ---------------- */
const C = { sky0: '#47c3ff', sky1: '#b5ecff', ink: '#111111', yellow: '#ffd400', red: '#ff3b3b', blue: '#3a86ff', purple: '#8e7dff', street: '#5b6470' };
const SOUND_WORDS = ['ZACK!', 'PENG!', 'BUMM!', 'KRACH!', 'WUMMS!'];
const cb = skyline(3, { minW: 56, maxW: 104, minH: 40, maxH: 96, gap: 6 });
const BOMB_DY = -26, BUBBLE_DY = 26; // bomb above, speech bubble below it

TD.styles.push({
  id: 'comic', name: 'Comic Pop',
  font: '700 28px "Comic Neue", "Comic Sans MS", system-ui, sans-serif', bombH: 92, padX: 30,
  flashColor: C.yellow,
  hud: {
    font: '400 {s}px Bangers, Impact, sans-serif', color: C.ink, dim: '#4a4f57', accent: C.red, bar: C.ink, barTrack: 'rgba(17,17,17,.18)',
    panel(c, x, y, w, h, kind) {
      c.fillStyle = C.ink; c.fillRect(x + 5, y + 5, w, h);
      c.fillStyle = kind === 'chip' ? C.yellow : '#fff'; c.fillRect(x, y, w, h);
      c.lineWidth = 3; c.strokeStyle = C.ink; c.strokeRect(x, y, w, h);
    },
    seg(c, x, y, w, on) { c.beginPath(); c.arc(x + w / 2, y, 6.5, 0, 6.283); c.fillStyle = on ? C.red : '#fff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = C.ink; c.stroke(); }
  },
  gauge: { ink: C.ink, track: '#fff', laser: C.yellow, multi: C.red, lw: 7 },
  music: { // surf rock: plucked bass, backbeat, brass stabs and a twangy guitar
    bpm: 148, chords: ['Em', 'G', 'A', 'B7'],
    tracks: [
      { i: 'pluckbass', oct: 2, pat: '0.o.2.o.0.o.2.3.', v: 0.34 },
      { drum: 'kick', pat: 'x.....x.x.......', v: 0.75 },
      { drum: 'snare', pat: '....x.......x...', v: 0.7 },
      { drum: 'hat', pat: 'x.x.x.x.x.x.x.x.', v: 0.8, lvl: 1 },
      { i: 'brass', oct: 4, pat: '..C...C...C...C.', len: 1, v: 0.09, lvl: 1 },
      { i: 'twang', v: 0.09, dly: 0.2, rev: 0.15, lvl: 2, notes: `
        B4 - - . B4 . A4 . G4 - - . E4 - - .
        D5 - - . D5 . C5 . B4 - - . G4 - - .
        C#5 - E5 - A5 - - . G5 - F#5 - E5 - - .
        D#5 - F#5 - A5 - - . B5 - - - - - . .` },
      { i: 'twang', oct: 4, pat: '0000000000000000', len: 1, v: 0.045, lvl: 3, boost: true }
    ]
  },
  overOpts: { font: '400 {s}px Bangers, Impact, sans-serif', title: 'KAWUMM!', titleSize: 104, dim: 'rgba(17,17,17,.55)', color: '#fff', accent: C.yellow, stroke: C.ink },
  text: { font: '400 {s}px Bangers, Impact, sans-serif', fill: '#fff', stroke: C.ink, lw: 8 },
  sfx: {
    shoot: [{ noise: 1, f: 3000, f2: 500, d: 0.07, v: 0.1 }, { f: 220, f2: 110, d: 0.07, v: 0.04 }],
    chip: [{ f: 320, d: 0.03, v: 0.04 }],
    boom: [{ noise: 1, f: 2200, f2: 60, d: 0.45, v: 0.22 }, { f: 95, f2: 40, d: 0.4, type: 'sawtooth', v: 0.08 }],
    miss: [{ noise: 1, filter: 'bandpass', f: 900, d: 0.16, v: 0.14 }],
    laser: [{ f: 1300, f2: 300, d: 0.35, type: 'sawtooth', v: 0.07 }],
    shield: [{ f: 200, f2: 900, d: 0.3, type: 'sine', v: 0.14 }],
    power: [392, 523, 659, 784].map((f, i) => ({ f, d: 0.08, v: 0.05, at: i * 0.07 })),
    over: [{ f: 300, f2: 40, d: 1, type: 'sawtooth', v: 0.1 }, { noise: 1, f: 1800, f2: 60, d: 0.9, v: 0.2 }]
  },
  drawBackground(c, g) {
    c.drawImage(g.layer('bg', x => {
      const gr = x.createLinearGradient(0, 0, 0, GROUND); gr.addColorStop(0, C.sky0); gr.addColorStop(1, C.sky1);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      x.save(); x.translate(W / 2, -60); x.fillStyle = 'rgba(255,255,255,.14)';
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 1400, a, a + Math.PI / 18); x.closePath(); x.fill(); }
      x.restore();
      x.fillStyle = 'rgba(20,110,200,.2)';
      for (let y = 8; y < GROUND - 40; y += 14) for (let xx = ((y / 14) % 2) * 7; xx < W; xx += 14) {
        const r = 3.6 * (1 - y / GROUND); if (r > 0.5) { x.beginPath(); x.arc(xx, y, r, 0, 6.283); x.fill(); }
      }
      for (const [cx, cy, s] of [[150, 112, 1], [770, 76, 0.8]]) {
        const parts = [[0, 0, 26], [30, -14, 32], [62, 0, 26], [30, 10, 24]];
        x.lineWidth = 8; x.strokeStyle = C.ink; x.fillStyle = '#fff';
        for (const [dx, dy, r] of parts) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 6.283); x.stroke(); }
        for (const [dx, dy, r] of parts) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, 6.283); x.fill(); }
      }
    }), 0, 0, W, H);
  },
  drawCity(c, g) {
    c.drawImage(g.layer('city', x => {
      for (const b of cb) {
        x.fillStyle = [C.yellow, C.red, C.blue, C.purple, '#fff'][(b.r * 5) | 0]; x.fillRect(b.x, b.top, b.w, b.h + 2);
        x.save(); x.beginPath(); x.rect(b.x + b.w * 0.66, b.top, b.w * 0.34, b.h); x.clip(); x.fillStyle = 'rgba(0,0,0,.22)';
        for (let yy = b.top + 3; yy < GROUND; yy += 7) for (let xx = b.x + b.w * 0.66; xx < b.x + b.w; xx += 7) { x.beginPath(); x.arc(xx, yy, 2, 0, 6.283); x.fill(); }
        x.restore();
        for (let wy = b.top + 12; wy < GROUND - 18; wy += 22) for (let wx = b.x + 10; wx < b.x + b.w - 18; wx += 20) {
          x.fillStyle = C.ink; x.fillRect(wx, wy, 10, 13); x.fillStyle = '#fff'; x.fillRect(wx + 2, wy + 2, 3, 4);
        }
        x.strokeStyle = C.ink; x.lineWidth = 4; x.strokeRect(b.x, b.top, b.w, b.h + 6);
        if (b.r2 > 0.65 && b.h > 50) {
          const tx = b.x + b.w * 0.3; x.lineWidth = 3;
          x.beginPath(); x.moveTo(tx + 4, b.top); x.lineTo(tx + 4, b.top - 10); x.moveTo(tx + 20, b.top); x.lineTo(tx + 20, b.top - 10); x.stroke();
          x.fillStyle = '#c98b52'; x.fillRect(tx, b.top - 28, 24, 18); x.strokeRect(tx, b.top - 28, 24, 18);
        }
      }
      x.fillStyle = C.street; x.fillRect(0, GROUND, W, H - GROUND); x.fillStyle = C.ink; x.fillRect(0, GROUND - 2, W, 4);
      x.fillStyle = C.yellow; for (let i = 10; i < W; i += 60) x.fillRect(i, GROUND + 20, 30, 5);
    }), 0, 0, W, H);
  },
  drawShield(c, g) {
    c.save(); c.globalAlpha = g.shieldVis;
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx, DOME.ry, 0, Math.PI, 2 * Math.PI); c.closePath();
    c.fillStyle = 'rgba(120,230,255,.3)'; c.fill(); c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke();
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx - 26, DOME.ry - 22, 0, Math.PI * 1.15, Math.PI * 1.32);
    c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round'; c.stroke();
    for (const [sx, i] of [[300, 0], [520, 1], [700, 2]]) { const tw = 0.6 + 0.4 * Math.sin(g.t * 4 + i * 2); c.fillStyle = '#fff'; star(c, sx, domeY(sx) + 20, 4, 10 * tw, 2.5); c.fill(); }
    c.restore();
  },
  drawBomb(c, b, g) {
    const R = 19, fl = 0.8 + 0.4 * Math.sin(g.t * 30 + b.id);
    c.save(); c.translate(b.x, b.y - b.kick * 6 + BOMB_DY); c.lineJoin = 'round';
    c.strokeStyle = '#8b5a2b'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(8, -R - 4); c.quadraticCurveTo(18, -R - 10, 14, -R - 17); c.stroke();
    c.fillStyle = C.yellow; c.strokeStyle = C.ink; c.lineWidth = 2; star(c, 14, -R - 19, 6, 9 * fl, 4, g.t * 5); c.fill(); c.stroke();
    c.fillStyle = C.red; star(c, 14, -R - 19, 6, 4.5 * fl, 2, g.t * 5); c.fill();
    c.fillStyle = '#26262b'; c.lineWidth = 3; c.fillRect(2, -R - 5, 12, 8); c.strokeRect(2, -R - 5, 12, 8);
    c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill(); c.lineWidth = 4; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-7, -8, 6, 3.5, -0.7, 0, 6.283); c.fill();
    c.restore();
  },
  labelY(b) { return b.y - b.kick * 6 + BUBBLE_DY; }, // where the text sits (the engine puts the capital mark next to it)
  drawShift(c, x, y) { // inked like everything else: black outline, flat red
    c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = C.ink; c.fillStyle = C.red;
    arrowPath(c, x + 1, y, 6.5); c.stroke(); c.fill();
  },
  drawLabel(c, b, g) { // every bomb shouts its word in a speech bubble
    const y = b.y - b.kick * 6, bw = Math.max(46, b.tw + 30), bh = 40, by = y + BUBBLE_DY, locked = b === g.target;
    c.save(); c.lineJoin = 'round';
    rr(c, b.x - bw / 2, by - bh / 2, bw, bh, 14);
    c.moveTo(b.x - 9, by - bh / 2 + 3); c.lineTo(b.x + 2, y + BOMB_DY + 17); c.lineTo(b.x + 9, by - bh / 2 + 3); c.closePath();
    c.lineWidth = 7; c.strokeStyle = locked ? C.red : C.ink; c.stroke(); c.fillStyle = '#fff'; c.fill();
    seg(c, b.text, b.typed, b.x, by + 1, { font: this.font, rest: C.ink, done: '#b8bec6', next: C.ink,
      nextBox: (x, x0, cy, w) => { x.fillStyle = C.yellow; x.fillRect(x0 - 2, cy - 15, w + 4, 30); } });
    c.restore();
  },
  drawReticle(c, b, g, locked) {
    const R = 34;
    c.save(); c.translate(b.x, b.y - b.kick * 6 + BOMB_DY);
    if (!locked) { c.setLineDash([7, 7]); c.strokeStyle = 'rgba(17,17,17,.5)'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.stroke(); c.restore(); return; }
    c.rotate(g.t * 2); c.beginPath(); c.arc(0, 0, R, 0, 6.283);
    c.lineWidth = 8; c.strokeStyle = C.ink; c.stroke(); c.lineWidth = 4; c.strokeStyle = C.red; c.stroke();
    c.beginPath(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; c.moveTo(Math.cos(a) * (R - 8), Math.sin(a) * (R - 8)); c.lineTo(Math.cos(a) * (R + 10), Math.sin(a) * (R + 10)); }
    c.lineWidth = 5; c.strokeStyle = C.ink; c.stroke();
    c.restore();
  },
  drawShot(c, s) {
    c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx)); c.lineWidth = 3; c.strokeStyle = C.ink; c.fillStyle = C.yellow;
    rr(c, -9, -5, 18, 10, 5); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-14, -4); c.lineTo(-27, -4); c.moveTo(-14, 4); c.lineTo(-22, 4); c.lineWidth = 2.5; c.stroke();
    c.restore();
  },
  drawLaser(c, l) {
    const a = l.life / l.max, w = (l.big ? 20 : 7) * (0.4 + 0.6 * a);
    c.save(); c.lineCap = 'round'; c.beginPath(); c.moveTo(l.x1, l.y1); c.lineTo(l.x2, l.y2);
    c.strokeStyle = C.ink; c.lineWidth = w + 7; c.stroke(); c.strokeStyle = C.yellow; c.lineWidth = w; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = w * 0.35; c.stroke();
    c.restore();
  },
  drawCannon(c, g) {
    c.save(); c.translate(CANNON.x, CANNON.y); c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = C.ink;
    c.save(); c.rotate(g.angle); const o = -g.recoil * 12;
    c.fillStyle = g.jam > 0 ? '#ff9a9a' : C.red; rr(c, 2 + o, -12, BARREL + 2, 24, 6); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(BARREL - 20 + o, -12, 7, 24); c.strokeRect(BARREL - 20 + o, -12, 7, 24); c.restore();
    c.fillStyle = '#c7ced6'; c.beginPath(); c.arc(0, 0, 23, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8d96a0'; c.beginPath(); c.moveTo(-44, 28); c.lineTo(-30, 0); c.lineTo(30, 0); c.lineTo(44, 28); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = C.ink; for (const rx of [-22, 0, 22]) { c.beginPath(); c.arc(rx, 14, 2.5, 0, 6.283); c.fill(); }
    c.restore();
  },
  drawParticle(c, p) {
    const a = p.life / p.max;
    c.save(); c.globalAlpha = Math.min(1, a * 2.2); c.lineJoin = 'round';
    if (p.kind === 'boom') {
      const s = p.r * (a > 0.75 ? lerp(1, 0.3, (a - 0.75) / 0.25) : 1);
      star(c, p.x, p.y, 12, s, s * 0.62, p.rot); c.fillStyle = C.yellow; c.fill(); c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke();
      star(c, p.x, p.y, 12, s * 0.55, s * 0.34, p.rot + 0.2); c.fillStyle = p.col || C.red; c.fill();
    } else {
      c.beginPath(); c.arc(p.x, p.y, p.s * (1.4 - a * 0.4), 0, 6.283); c.fillStyle = p.col || '#e8edf2'; c.fill(); c.lineWidth = 3; c.strokeStyle = C.ink; c.stroke();
    }
    c.restore();
  },
  puffs(g, x, y, n, col) { for (let i = 0; i < n; i++) g.p({ kind: 'puff', x: x + rand(-26, 26), y: y + rand(-16, 16), vx: rand(-40, 40), vy: rand(-60, -20), life: rand(0.35, 0.6), s: rand(7, 13), col }); },
  explode(g, b) {
    g.p({ kind: 'boom', x: b.x, y: b.y, life: 0.42, r: 44 + b.w * 0.15, rot: rand(0, 1) });
    g.say(pick(SOUND_WORDS), b.x + rand(-10, 10), b.y - 8, { size: 40 + Math.min(20, b.text.length * 4), life: 0.6, vy: -50, col: pick([C.yellow, '#fff']), rot: rand(-0.25, 0.25) });
    this.puffs(g, b.x, b.y, 4);
  },
  chip(g, b, at) { g.p({ kind: 'boom', x: at.x, y: at.y, life: 0.15, r: 12, rot: rand(0, 1) }); },
  misfire(g, tip) { this.puffs(g, tip.x, tip.y - 8, 3, '#c9d1d9'); g.say('PFFT!', tip.x + 50, tip.y - 40, { size: 30, life: 0.6, vy: -30, col: '#c9d1d9', rot: -0.15 }); },
  shieldHit(g, b) { g.p({ kind: 'boom', x: b.x, y: b.y + b.h / 2, life: 0.4, r: 50, rot: 0, col: '#7ee8ff' }); g.say('BOING!', b.x, b.y - 10, { size: 46, life: 0.8, vy: -40, col: '#7ee8ff', rot: 0.1 }); },
  cityHit(g, b) { g.p({ kind: 'boom', x: b.x, y: IMPACT, life: 0.8, r: 120, rot: 0 }); this.puffs(g, b.x, IMPACT, 8); }
});

/* ---------------- 6 · Deep Sea ---------------- */
const S = { top: '#2ab3c9', mid: '#0d6b93', deep: '#06304f', sand: '#d9c08a', sand2: '#bfa46a', coral1: '#ff7f7f', coral2: '#ffb36b',
  weed: '#2fa36b', mine: '#1c2b3a', mineHi: '#3e5a72', glow: '#5ff2d6', lime: '#d4ff4a', ping: '#3cffb4', white: '#eafcff',
  orange: '#ffb347', tower: '#3f7686', towerHi: '#5a96a6', port: '#ffe08a' };
const sea = skyline(14, { minW: 60, maxW: 104, minH: 48, maxH: 100, gap: 26 });
const bob = b => b.y - b.kick * 6 + Math.sin(b.age * 2 + b.phase) * 2.5;

TD.styles.push({
  id: 'sea', name: 'Deep Sea',
  font: '700 28px "Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif', bombH: 52, padX: 40, sway: 0.8,
  flashColor: '#bffcff',
  hud: {
    font: '700 {s}px "Baloo 2", system-ui, sans-serif', color: S.white, dim: 'rgba(234,252,255,.65)', accent: S.lime, bar: S.lime, barTrack: 'rgba(234,252,255,.25)',
    panel(c, x, y, w, h) { c.save(); c.fillStyle = 'rgba(4,30,50,.5)'; c.strokeStyle = 'rgba(234,252,255,.3)'; c.lineWidth = 1.5; rr(c, x, y, w, h, 14); c.fill(); c.stroke(); c.restore(); },
    seg(c, x, y, w, on) { c.beginPath(); c.arc(x + w / 2, y, 6, 0, 6.283); if (on) { c.fillStyle = S.lime; c.fill(); } c.strokeStyle = 'rgba(234,252,255,.7)'; c.lineWidth = 1.5; c.stroke(); }
  },
  gauge: { track: 'rgba(234,252,255,.2)', laser: S.lime, multi: S.orange, glow: 10, lw: 6 },
  music: { // ambient: glassy pad, sonar pings with echo, a slow heartbeat
    bpm: 72, chords: ['Dm9', 'Bbmaj7', 'Fmaj7', 'Cadd9'],
    tracks: [
      { i: 'glasspad', oct: 3, pat: 'C---------------', v: 0.17, rev: 0.6 },
      { i: 'ping', oct: 5, pat: '0...............................', v: 0.1, dly: 0.5, rev: 0.5 },
      { i: 'sub', oct: 2, pat: '0---------------', v: 0.12, lvl: 1 },
      { drum: 'heart', pat: 'x..x............', v: 0.7, lvl: 1 },
      { i: 'glass', oct: 4, pat: '0..2..1..3..2...', v: 0.07, dly: 0.4, rev: 0.4, lvl: 1 },
      { i: 'bell', v: 0.055, dly: 0.3, rev: 0.5, lvl: 2, notes: `
        A5 - - - - - - - F5 - - - E5 - - -
        D5 - - - - - - - - - - - . . . .
        C6 - - - A5 - - - G5 - - - A5 - - -
        G5 - - - - - - - - - - - . . . .` },
      { i: 'pluck', oct: 5, pat: '0213021302130213', v: 0.04, dly: 0.3, lvl: 3, boost: true }
    ]
  },
  overOpts: { font: '700 {s}px "Baloo 2", system-ui, sans-serif', title: 'Blubb! Getroffen', titleSize: 64, dim: 'rgba(6,48,79,.78)', color: S.white, accent: S.lime },
  text: { font: '700 {s}px "Baloo 2", system-ui, sans-serif', fill: S.lime, stroke: S.deep, lw: 6 },
  sfx: {
    shoot: [{ f: 300, f2: 760, d: 0.1, type: 'sine', v: 0.1 }],
    chip: [{ f: 900, d: 0.04, type: 'sine', v: 0.05 }],
    boom: [{ noise: 1, f: 800, f2: 100, d: 0.5, v: 0.18 }, { f: 160, f2: 60, d: 0.4, type: 'sine', v: 0.14 }],
    miss: [{ f: 200, f2: 120, d: 0.15, type: 'sine', v: 0.12 }, { f: 260, f2: 180, d: 0.1, type: 'sine', v: 0.08, at: 0.08 }],
    laser: [{ f: 1800, f2: 600, d: 0.4, type: 'sine', v: 0.08 }, { f: 900, f2: 300, d: 0.4, type: 'triangle', v: 0.05 }],
    shield: [{ f: 300, f2: 1200, d: 0.5, type: 'sine', v: 0.1 }],
    power: [523, 784, 1046].map((f, i) => ({ f, d: 0.25, type: 'sine', v: 0.07, at: i * 0.1 })),
    over: [{ f: 400, f2: 80, d: 1.2, type: 'sine', v: 0.14 }]
  },
  drawBackground(c, g) {
    c.drawImage(g.layer('bg', x => {
      const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S.top); gr.addColorStop(0.5, S.mid); gr.addColorStop(1, S.deep);
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
      const r = rng(4); x.fillStyle = 'rgba(6,48,79,.55)'; x.beginPath(); x.moveTo(0, H);
      for (let i = 0; i <= W; i += 24) x.lineTo(i, 440 + r() * 50 - Math.sin(i * 0.01) * 30);
      x.lineTo(W, H); x.closePath(); x.fill();
    }), 0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter';
    const ray = c.createLinearGradient(0, 0, 0, 460); ray.addColorStop(0, 'rgba(200,255,255,.16)'); ray.addColorStop(1, 'rgba(200,255,255,0)');
    c.fillStyle = ray;
    for (let i = 0; i < 5; i++) {
      const x0 = 100 + i * 190 + Math.sin(g.t * 0.3 + i) * 30, sw = 40 + (i % 2) * 30, sk = 150 + Math.sin(g.t * 0.2 + i * 2) * 40;
      c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + sw, 0); c.lineTo(x0 + sw + sk, 460); c.lineTo(x0 + sk - 30, 460); c.closePath(); c.fill();
    }
    c.restore();
    c.fillStyle = 'rgba(220,255,250,.5)';
    for (let i = 0; i < 36; i++) c.fillRect((i * 131 + g.t * (6 + (i % 4) * 3)) % W, (i * 67 + Math.sin(g.t * 0.6 + i) * 14 + 600) % 520, 2, 2);
  },
  drawCity(c, g) {
    c.drawImage(g.layer('city', x => {
      for (const b of sea) {
        const tw = b.w * 0.62, tx = b.x + (b.w - tw) / 2;
        x.fillStyle = S.tower; rr(x, tx, b.top + 18, tw, b.h - 10, 8); x.fill();
        x.fillStyle = S.towerHi; x.fillRect(tx + 5, b.top + 26, 5, b.h - 30);
        for (let wy = b.top + 36; wy < GROUND - 12; wy += 20) { x.fillStyle = S.port; x.beginPath(); x.arc(tx + tw / 2, wy, 5, 0, 6.283); x.fill(); x.strokeStyle = '#2a5563'; x.lineWidth = 2; x.stroke(); }
        x.beginPath(); x.ellipse(b.x + b.w / 2, b.top + 22, b.w / 2, 22, 0, Math.PI, 0); x.closePath();
        x.fillStyle = 'rgba(190,250,255,.28)'; x.fill(); x.strokeStyle = 'rgba(230,255,255,.7)'; x.lineWidth = 2; x.stroke();
        x.beginPath(); x.ellipse(b.x + b.w / 2, b.top + 22, b.w / 2 - 7, 15, 0, Math.PI * 1.15, Math.PI * 1.4); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; x.stroke();
      }
      x.fillStyle = S.sand; x.beginPath(); x.moveTo(0, H);
      for (let i = 0; i <= W; i += 16) x.lineTo(i, GROUND - 2 + Math.sin(i * 0.03) * 4);
      x.lineTo(W, H); x.closePath(); x.fill();
      x.strokeStyle = S.sand2; x.lineWidth = 2;
      for (let j = 0; j < 3; j++) { x.beginPath(); for (let i = 0; i <= W; i += 16) x.lineTo(i, GROUND + 12 + j * 9 + Math.sin(i * 0.05 + j) * 3); x.stroke(); }
      const r = rng(77); x.lineCap = 'round';
      const branch = (x0, y0, a, len, d) => {
        const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
        x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
        if (d > 0) { branch(x1, y1, a - 0.5, len * 0.7, d - 1); branch(x1, y1, a + 0.45, len * 0.7, d - 1); }
      };
      for (let i = 0; i < 9; i++) { x.strokeStyle = i % 2 ? S.coral1 : S.coral2; x.lineWidth = 5; branch(36 + i * 110 + r() * 40, GROUND + 8, -Math.PI / 2 + (r() - 0.5) * 0.4, 15 + r() * 8, 2); }
    }), 0, 0, W, H);
    c.save(); c.strokeStyle = S.weed; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = 0; i < 7; i++) {
      const bx = 70 + i * 136 + (i % 2) * 30; c.beginPath(); c.moveTo(bx, GROUND + 10);
      for (let k = 1; k <= 4; k++) c.lineTo(bx + Math.sin(g.t * 1.4 + i + k * 0.7) * k * 4, GROUND + 10 - k * 16);
      c.stroke();
    }
    c.strokeStyle = 'rgba(234,252,255,.6)'; c.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const per = 7 + (i % 3) * 2, pr = ((g.t + i * 1.7) % per) / per;
      c.beginPath(); c.arc(60 + i * 95 + Math.sin(g.t * 2 + i) * 6, GROUND - pr * 560, 2 + (i % 3), 0, 6.283); c.stroke();
    }
    c.restore();
  },
  drawShield(c, g) { // the shield is one giant bubble
    c.save(); c.globalAlpha = g.shieldVis;
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx, DOME.ry, 0, Math.PI, 2 * Math.PI); c.closePath();
    c.fillStyle = 'rgba(200,255,255,.12)'; c.fill();
    const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#7ff7ff'); gr.addColorStop(0.5, '#ff9ff3'); gr.addColorStop(1, '#fff59d');
    c.strokeStyle = gr; c.lineWidth = 3 + Math.sin(g.t * 3); c.stroke();
    c.beginPath(); c.ellipse(DOME.cx, DOME.cy, DOME.rx - 24, DOME.ry - 20, 0, Math.PI * 1.16, Math.PI * 1.34);
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
    c.restore();
  },
  drawBomb(c, b) { // spiked sea mine
    const hw = b.w / 2, r = b.h / 2 - 4, sp = [];
    if (b.text.length === 1) for (let i = 0; i < 8; i++) { const a = b.rot + (i * Math.PI) / 4; sp.push([Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r + 9), Math.sin(a) * (r + 9)]); }
    else {
      const n = Math.max(1, Math.round((2 * hw - 2 * r) / 22));
      for (let k = 0; k <= n; k++) { const x = -hw + r + (k * (2 * hw - 2 * r)) / n; sp.push([x, -r, x, -r - 9], [x, r, x, r + 9]); }
      sp.push([-hw + 4, 0, -hw - 5, 0], [hw - 4, 0, hw + 5, 0]);
    }
    c.save(); c.translate(b.x, bob(b));
    c.strokeStyle = '#2c4257'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath();
    for (const s of sp) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }
    c.stroke(); c.fillStyle = '#4d6e8a';
    for (const s of sp) { c.beginPath(); c.arc(s[2], s[3], 3.2, 0, 6.283); c.fill(); }
    const gr = c.createRadialGradient(-hw * 0.3, -r * 0.4, 2, 0, 0, Math.max(hw, r) * 1.1); gr.addColorStop(0, S.mineHi); gr.addColorStop(1, S.mine);
    rr(c, -hw + 4, -r, (hw - 4) * 2, r * 2, r); c.fillStyle = gr; c.fill();
    c.strokeStyle = 'rgba(95,242,214,.55)'; c.lineWidth = 2; c.stroke();
    c.restore();
  },
  labelY: bob,
  drawShift(c, x, y) { // a soft glowing chevron, like the sonar and the bubbles
    c.shadowColor = S.lime; c.shadowBlur = 6 * TD.k;
    c.strokeStyle = S.lime; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - 5, y + 0.5); c.lineTo(x, y - 5.5); c.lineTo(x + 5, y + 0.5); c.moveTo(x, y - 5); c.lineTo(x, y + 6); c.stroke();
  },
  drawLabel(c, b) {
    seg(c, b.text, b.typed, b.x, bob(b) + 2, { font: this.font, rest: S.white, done: 'rgba(95,242,214,.5)', next: S.lime, under: S.lime, ul: 14 });
  },
  drawReticle(c, b, g, locked) { // sonar pings
    const rx = b.w / 2 + 12, ry = b.h / 2 + 12;
    c.save(); c.translate(b.x, bob(b)); c.lineWidth = 2.5;
    const ring = (grow, alpha) => { c.strokeStyle = `rgba(60,255,180,${alpha})`; c.beginPath(); c.ellipse(0, 0, rx + grow, ry + grow, 0, 0, 6.283); c.stroke(); };
    if (locked) {
      for (let k = 0; k < 3; k++) { const p = (g.t * 1.2 + k / 3) % 1; ring(p * 40, (1 - p) * 0.8); }
      ring(2, 1); c.beginPath();
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; c.moveTo(Math.cos(a) * (rx - 4), Math.sin(a) * (ry - 4)); c.lineTo(Math.cos(a) * (rx + 9), Math.sin(a) * (ry + 9)); }
      c.stroke();
    } else { const p = (g.t * 0.7) % 1; ring(p * 30, (1 - p) * 0.4); }
    c.restore();
  },
  drawShot(c, s) { // torpedo with a bubble trail
    const t = s.trail;
    c.save(); c.strokeStyle = 'rgba(234,252,255,.7)'; c.lineWidth = 1.5;
    for (let i = 0; i < t.length; i += 4) { c.beginPath(); c.arc(t[i] + Math.sin(i) * 3, t[i + 1], 2 + i * 0.15, 0, 6.283); c.stroke(); }
    c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx));
    c.fillStyle = S.orange; rr(c, -10, -4, 20, 8, 4); c.fill(); c.fillStyle = S.glow; c.fillRect(-12, -6, 4, 12);
    c.restore();
  },
  drawLaser(c, l, g) { // sonic beam
    const a = l.life / l.max, len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1), amp = l.big ? 10 : 4;
    c.save(); c.translate(l.x1, l.y1); c.rotate(Math.atan2(l.y2 - l.y1, l.x2 - l.x1)); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
    c.strokeStyle = 'rgba(95,242,214,.55)'; c.lineWidth = l.big ? 16 : 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, 0); c.stroke();
    c.strokeStyle = '#eafffb'; c.lineWidth = 2;
    for (const ph of [0, Math.PI]) { c.beginPath(); for (let x = 0; x <= len; x += 10) c.lineTo(x, Math.sin(x * 0.06 - g.t * 30 + ph) * amp); c.stroke(); }
    c.restore();
  },
  drawCannon(c, g) {
    c.save(); c.translate(CANNON.x, CANNON.y);
    c.save(); c.rotate(g.angle); c.fillStyle = '#2f8f9d'; rr(c, 4 - g.recoil * 10, -9, BARREL, 18, 7); c.fill();
    c.fillStyle = S.glow; c.fillRect(BARREL - 6 - g.recoil * 10, -9, 4, 18); c.restore();
    c.fillStyle = S.orange; c.beginPath(); c.ellipse(0, 6, 34, 28, 0, Math.PI, 0); c.closePath(); c.fill();
    c.fillStyle = '#e8963a'; rr(c, -42, 4, 84, 24, 10); c.fill();
    c.fillStyle = g.jam > 0 ? '#ff5a5a' : S.port; c.beginPath(); c.arc(0, -6, 8, 0, 6.283); c.fill(); c.strokeStyle = '#a0612a'; c.lineWidth = 3; c.stroke();
    c.restore();
  },
  drawParticle(c, p) {
    const a = p.life / p.max;
    c.save(); c.globalAlpha = Math.min(1, a * 1.8);
    if (p.kind === 'ring') { c.strokeStyle = p.col || S.white; c.lineWidth = 3 * a + 1; c.beginPath(); c.arc(p.x, p.y, lerp(p.r1, p.r0, a), 0, 6.283); c.stroke(); }
    else if (p.kind === 'flash') { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(160,255,240,.6)'; c.beginPath(); c.arc(p.x, p.y, p.s * (1.5 - a * 0.5), 0, 6.283); c.fill(); }
    else { c.strokeStyle = 'rgba(234,252,255,.9)'; c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(p.x - p.s * 0.45, p.y - p.s * 0.45, 2, 2); }
    c.restore();
  },
  bubbles(g, x, y, n, v0, v1, s0 = 3, s1 = 8) {
    for (let i = 0; i < n; i++) { const a = rand(0, 6.283), v = rand(v0, v1); g.p({ kind: 'bub', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -160, drag: 2.4, life: rand(0.6, 1.2), s: rand(s0, s1) }); }
  },
  explode(g, b) {
    g.p({ kind: 'flash', x: b.x, y: b.y, life: 0.25, s: 28 + b.w * 0.2 });
    g.p({ kind: 'ring', x: b.x, y: b.y, life: 0.5, r0: 10, r1: b.w * 0.5 + 50 });
    this.bubbles(g, b.x, b.y, 16, 80, 260);
  },
  chip(g, b, at) { this.bubbles(g, at.x, at.y, 3, 40, 100, 2, 4); },
  misfire(g, tip) { this.bubbles(g, tip.x, tip.y, 6, 20, 60, 2, 5); g.say('blubb', tip.x + 55, tip.y - 36, { size: 26, life: 0.7, vy: -30, col: S.white }); },
  shieldHit(g, b) { g.p({ kind: 'ring', x: b.x, y: b.y + b.h / 2, life: 0.7, r0: 16, r1: 220, col: '#ff9ff3' }); this.bubbles(g, b.x, b.y + b.h / 2, 14, 60, 220); },
  cityHit(g, b) { g.p({ kind: 'ring', x: b.x, y: IMPACT, life: 0.9, r0: 20, r1: 320 }); this.bubbles(g, b.x, IMPACT, 30, 100, 360, 3, 10); }
});
})();
