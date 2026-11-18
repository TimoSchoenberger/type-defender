/* Type Defender: shared game engine.
   Every style draws on a logical 960×600 stage; the engine owns rules, timing and input. */
(() => {
'use strict';

const W = 960, H = 600, GROUND = 560, IMPACT = 506;
const CANNON = { x: 480, y: 540 }, BARREL = 58;
const DOME = { cx: 480, cy: 600, rx: 620, ry: 150 };
const STREAK = 12;   // correct keys in a row that earn a power-up
const JAM = 0.5;     // seconds the cannon stays jammed after a wrong key
const POWERS = ['laser', 'shield', 'multi'];
const POWER_NAME = { laser: 'Laser!', shield: 'Schutzschild!', multi: 'Mehrfachschuss!' };
const POWER_T = 10;  // seconds a laser or multishot lasts
// Tempo levels: how fast a run heats up. Every level starts and tops out at the same speed;
// slower ones just take more hits to get there (1 = the original ramp, full speed after ~45 hits).
const PACE = [0.25, 0.4, 0.55, 0.75, 1];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const domeY = x => { const d = (x - DOME.cx) / DOME.rx; return DOME.cy - DOME.ry * Math.sqrt(Math.max(0, 1 - d * d)); };

// Demo content: home-row letters first, then syllables, then short German words (no umlauts).
// A key selection from the menu replaces it with the same shape (see keys.js).
const POOL = {
  start: [...'asdfjkl'],
  letters: [...'asdfjkleiruhgn'],
  syl: ['la', 'da', 'sa', 'fa', 'ka', 'ja', 'le', 'de', 'se', 'li', 'ri', 'ru', 'nu', 'ga', 'ha', 'he', 'hi',
    'al', 'as', 'an', 'en', 'er', 'ei', 'au', 'mo', 'to', 'bi', 'wu'],
  words: ['haus', 'hund', 'rad', 'eis', 'nase', 'segel', 'kind', 'engel', 'nadel', 'insel', 'regen', 'dach',
    'hand', 'sand', 'feld', 'ring', 'igel', 'kugel', 'fisch', 'ball', 'mond', 'sonne', 'baum', 'maus', 'stern',
    'wolke', 'blume', 'vogel', 'katze', 'apfel', 'brot', 'lampe', 'tiger', 'zebra', 'pizza', 'oma', 'opa'],
  cased: false
};
// What falls at each difficulty tier, as [pool, weight]; empty pools are skipped.
const TIERS = [[['start', 1]], [['letters', 0.55], ['syl', 0.45]], [['letters', 0.35], ['syl', 0.35], ['words', 0.3]]];

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};

// Tiny synth: every sound is a list of tones or filtered noise bursts.
const Sfx = {
  ac: null, noise: null, enabled: store.get('td-sound', true),
  unlock() {
    try {
      if (!this.ac) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return;
        this.ac = new A();
        const n = this.ac.sampleRate, b = this.ac.createBuffer(1, n, n), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      }
      if (this.ac.state === 'suspended') this.ac.resume();
    } catch (e) { this.ac = null; }
  },
  play(list) {
    const ac = this.ac;
    if (!ac || !this.enabled || !list) return;
    const t0 = ac.currentTime;
    for (const s of list) {
      const t = t0 + (s.at || 0), d = s.d || 0.1, g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(s.v || 0.1, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      let src;
      if (s.noise) {
        src = ac.createBufferSource(); src.buffer = this.noise;
        const f = ac.createBiquadFilter(); f.type = s.filter || 'lowpass';
        f.frequency.setValueAtTime(s.f || 1500, t);
        if (s.f2) f.frequency.exponentialRampToValueAtTime(s.f2, t + d);
        src.connect(f); f.connect(g);
      } else {
        src = ac.createOscillator(); src.type = s.type || 'square';
        src.frequency.setValueAtTime(s.f || 440, t);
        if (s.f2) src.frequency.exponentialRampToValueAtTime(s.f2, t + d);
        src.connect(g);
      }
      g.connect(ac.destination); src.start(t); src.stop(t + d + 0.03);
    }
  }
};

// ---------- drawing helpers shared by the styles ----------
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function star(c, x, y, n, r1, r2, rot = 0) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath();
}
// Deterministic row of buildings standing on GROUND; low near the cannon and the screen edges (under the dome).
function skyline(seed, o = {}) {
  const r = rng(seed), out = [], minW = o.minW ?? 48, maxW = o.maxW ?? 100, minH = o.minH ?? 34, maxH = o.maxH ?? 100, gap = o.gap ?? 4;
  let x = o.x0 ?? -10;
  while (x < W + 10) {
    const w = minW + r() * (maxW - minW), cx = x + w / 2, edge = Math.abs(cx - W / 2) / (W / 2);
    let h = (minH + r() * (maxH - minH)) * (1 - 0.5 * edge * edge);
    if (Math.abs(cx - CANNON.x) < 70) h = Math.min(h, 40);
    out.push({ x, w, h, top: GROUND - h, r: r(), r2: r(), r3: r() });
    x += w + gap;
  }
  return out;
}
// Label with the typed part, the next letter and the rest in their own colours.
function seg(c, text, typed, cx, cy, o) {
  c.font = o.font; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const full = c.measureText(text).width, parts = [text.slice(0, typed), text.slice(typed, typed + 1), text.slice(typed + 1)];
  let x = cx - full / 2;
  for (let i = 0; i < 3; i++) {
    const s = parts[i];
    if (!s) continue;
    const w = c.measureText(s).width, isNext = i === 1 && typed > 0;
    if (isNext && o.nextBox) o.nextBox(c, x, cy, w);
    if (o.stroke) { c.lineWidth = o.lw || 4; c.strokeStyle = o.stroke; c.strokeText(s, x, cy); }
    c.fillStyle = i === 0 ? o.done : isNext ? o.next : o.rest;
    c.fillText(s, x, cy);
    if (isNext && o.under) { c.fillStyle = o.under; c.fillRect(x, cy + (o.ul || 15), w, 3); }
    x += w;
  }
  return full;
}
// Floating text (power-up names, comic sounds), pops in and fades out.
function ftext(c, x, o) {
  const age = x.max - x.life, a = clamp((x.life / x.max) * 2.5, 0, 1), sc = 1 + Math.max(0, 0.15 - age) * 3;
  c.save(); c.globalAlpha = a; c.translate(x.x, x.y); c.rotate(x.rot || 0); c.scale(sc, sc);
  c.font = o.font.replace('{s}', x.size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (o.stroke) { c.lineWidth = o.lw || 6; c.strokeStyle = o.stroke; c.strokeText(x.text, 0, 0); }
  c.fillStyle = x.col || o.fill; c.fillText(x.text, 0, 0);
  c.restore();
}
// Shared HUD: score (left), streak meter (centre), active power-ups (right).
function hud(c, g, o) {
  const f = s => o.font.replace('{s}', s);
  c.save(); c.textBaseline = 'middle'; c.textAlign = 'left';
  if (o.panel) o.panel(c, 16, 14, 214, g.mode === 'play' ? 66 : 44, 'score');
  c.font = f(14); c.fillStyle = o.dim; c.fillText('PUNKTE', 32, 37);
  const lx = 32 + c.measureText('PUNKTE').width + 12;
  c.font = f(25); c.fillStyle = o.color; c.fillText(String(g.score).padStart(5, '0'), lx, 37);
  if (g.mode === 'play') { c.font = f(13); c.fillStyle = o.dim; c.fillText('REKORD ' + String(g.best).padStart(5, '0'), 32, 63); }
  const n = STREAK, sw = 14, gap = 5, mw = n * sw + (n - 1) * gap, mx = W / 2 - mw / 2, fill = g.combo % n;
  if (o.panel) o.panel(c, mx - 16, 14, mw + 32, 44, 'meter');
  for (let i = 0; i < n; i++) {
    const x = mx + i * (sw + gap);
    if (o.seg) o.seg(c, x, 36, sw, i < fill, i);
    else { c.fillStyle = i < fill ? o.accent : o.track; c.fillRect(x, 30, sw, 12); }
  }
  // Power-up chips; a timed weapon drains a bar under its name and blinks near the end.
  const chips = [];
  if (g.weapon !== 'cannon') chips.push({ t: (g.weapon === 'laser' ? 'LASER ' : 'MULTI ') + Math.ceil(g.weaponT) + 's', f: g.weaponT / POWER_T });
  if (g.shield) chips.push({ t: 'SCHILD' });
  c.textAlign = 'right'; c.font = f(17);
  let x = W - 32;
  for (const ch of chips) {
    const w = Math.max(c.measureText(ch.t).width, 76) + 30, x0 = x - w + 15, timed = ch.f != null;
    if (o.panel) o.panel(c, x0, 14, w, 44, 'chip');
    c.globalAlpha = timed && g.weaponT < 2.5 && Math.sin(g.t * 16) < 0 ? 0.35 : 1;
    c.fillStyle = o.accent; c.fillText(ch.t, x, timed ? 32 : 37);
    if (timed) {
      const bw = w - 26;
      c.fillStyle = o.barTrack || "rgba(0,0,0,.18)"; c.fillRect(x0 + 13, 45, bw, 5);
      c.fillStyle = o.bar || o.accent; c.fillRect(x0 + 13, 45, bw * clamp(ch.f, 0, 1), 5);
    }
    c.globalAlpha = 1;
    x -= w + 12;
  }
  c.restore();
}
// Arc around the cannon that empties while a laser or multishot is active.
function gauge(c, g, o = {}) {
  if (g.weapon === 'cannon' || g.weaponT <= 0) return;
  const f = clamp(g.weaponT / POWER_T, 0, 1), r = o.r || 78, a0 = Math.PI + 0.22, span = Math.PI - 0.44;
  const col = (o[g.weapon] || '#ffd400'), lw = o.lw || 7;
  c.save(); c.lineCap = 'round';
  if (g.weaponT < 2.5 && Math.sin(g.t * 16) < 0) c.globalAlpha = 0.4;
  if (o.ink) { c.beginPath(); c.arc(CANNON.x, CANNON.y, r, a0, a0 + span); c.strokeStyle = o.ink; c.lineWidth = lw + 5; c.stroke(); }
  c.beginPath(); c.arc(CANNON.x, CANNON.y, r, a0, a0 + span); c.strokeStyle = o.track || 'rgba(0,0,0,.2)'; c.lineWidth = lw; c.stroke();
  c.beginPath(); c.arc(CANNON.x, CANNON.y, r, a0, a0 + span * f);
  if (o.glow) { c.shadowColor = col; c.shadowBlur = o.glow * TD.k; }
  c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  c.restore();
}
function over(c, g, o) {
  const a = clamp(g.overT * 2.5, 0, 1), f = s => o.font.replace('{s}', s);
  const acc = g.hits + g.errors ? Math.round((100 * g.hits) / (g.hits + g.errors)) : 100;
  c.save(); c.globalAlpha = a; c.fillStyle = o.dim; c.fillRect(0, 0, W, H);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const T = (txt, size, y, col) => {
    c.font = f(size);
    if (o.stroke) { c.lineWidth = Math.max(4, size / 6); c.strokeStyle = o.stroke; c.strokeText(txt, W / 2, y); }
    c.fillStyle = col; c.fillText(txt, W / 2, y);
  };
  T(o.title, o.titleSize || 64, 222, o.accent);
  T(`${g.score} Punkte`, 32, 300, o.color);
  T(`Genauigkeit ${acc} % · Rekord ${g.best}`, 20, 342, o.color);
  if (g.paceName) T(`Tempo: ${g.paceName}`, 17, 374, o.color);
  if (g.overT > 0.6) { c.globalAlpha = a * (0.6 + 0.4 * Math.sin(g.t * 5)); T(g.onMenu ? 'Enter: nochmal · Esc: Menü' : 'Enter oder Leertaste: nochmal', 22, 418, o.color); }
  c.restore();
}

const LAYERS = new Map();

class Game {
  constructor(canvas, style, mode = 'auto') {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.mode = mode; this.style = style; this.content = POOL;
    this.pace = 1; this.paceName = '';  // set from the menu's tempo slider
    this.best = mode === 'play' ? store.get('td-best', 0) : 0;
    this.onOver = null;  // called with the game when a play-mode run ends
    this.resize(); this.reset();
  }
  setStyle(style) { this.style = style; for (const b of this.bombs) this.measure(b); }
  reset() {
    Object.assign(this, {
      t: 0, bombs: [], shots: [], lasers: [], parts: [], texts: [],
      target: null, hint: null, score: 0, combo: 0, kills: 0, hits: 0, errors: 0,
      jam: 0, recoil: 0, shake: 0, flash: 0, angle: -Math.PI / 2,
      weapon: 'cannon', weaponT: 0, powerIdx: 0, shield: false, shieldVis: 0, shieldT: 0,
      letThrough: null, over: false, overT: 0, spawnT: 0.6, aiT: 0.8, nid: 1
    });
    if (this.mode === 'auto') for (const y of [80, 190, 290, 380]) { const b = this.spawn(); if (b) b.y = y; }
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(96, Math.round((r.width || 480) * dpr)), ch = Math.round((cw * H) / W);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.cw = cw; this.ch = ch; this.k = cw / W;
  }
  // Static art cached per style and resolution.
  layer(name, draw, pw = this.cw, ph = this.ch, k = this.k) {
    const key = `${this.style.id}:${name}:${pw}`;
    let c = LAYERS.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const x = c.getContext('2d'); x.setTransform(k, 0, 0, k, 0, 0);
      draw(x, this); LAYERS.set(key, c);
    }
    return c;
  }
  measure(b) {
    const s = this.style, c = this.ctx;
    c.font = s.font; b.tw = c.measureText(b.text).width;
    b.h = s.bombH || 52; b.w = Math.max(b.h, b.tw + (s.padX ?? 30));
  }
  // How far the run has heated up, in "hits at full pace". All difficulty ramps read this.
  heat() { return this.kills * this.pace; }
  tier() { const h = this.heat(); return this.mode === 'auto' ? 2 : h < 6 ? 0 : h < 14 ? 1 : 2; }
  pickText() {
    const C = this.content, has = k => C[k] && C[k].length;
    let opts = TIERS[this.tier()].filter(([k]) => has(k));
    if (!opts.length) opts = ['letters', 'syl', 'words'].filter(has).map(k => [k, 1]);
    let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    for (const [k, w] of opts) if ((r -= w) <= 0) return pick(C[k]);
    return pick(C[opts[0][0]]);
  }
  spawnEvery() { return this.mode === 'auto' ? rand(1.5, 2.2) : Math.max(0.95, 2.4 - this.heat() * 0.035) * rand(0.85, 1.15); }
  maxBombs() { return this.mode === 'auto' ? 7 : Math.min(8, 3 + Math.floor(this.heat() / 7)); }
  spawn() {
    const live = this.bombs.filter(b => !b.doomed);
    let text = null;
    // No two bombs share a first letter (repeated single letters are fine),
    // so the first key always names exactly one target. Small key sets can run out: skip this spawn then.
    for (let i = 0; i < 24 && !text; i++) {
      const t = this.pickText(), solo = t.length === 1;
      if (!live.some(b => b.text[0] === t[0] && !(solo && b.text.length === 1))) text = t;
    }
    if (!text) return null;
    const b = { id: this.nid++, text, typed: 0, age: rand(0, 5), kick: 0, doomed: false, dead: false,
      phase: rand(0, 6.28), sway: rand(4, 10), swayF: rand(0.6, 1.2), rot: rand(-0.3, 0.3), vr: rand(-0.6, 0.6),
      seed: (Math.random() * 1e9) | 0, tint: (Math.random() * 6) | 0 };
    this.measure(b);
    let x = W / 2;
    for (let i = 0; i < 12; i++) {
      x = rand(50 + b.w / 2, W - 50 - b.w / 2);
      if (!live.some(o => o.y < 220 && Math.abs(o.x - x) < (o.w + b.w) / 2 + 30)) break;
    }
    b.x = b.baseX = x; b.y = -b.h / 2 - 8;
    b.vy = this.mode === 'auto' ? rand(30, 40) : (24 + Math.min(36, this.heat() * 0.7)) * rand(0.9, 1.1);
    this.bombs.push(b);
    return b;
  }
  tip() { return { x: CANNON.x + Math.cos(this.angle) * BARREL, y: CANNON.y + Math.sin(this.angle) * BARREL }; }
  p(o) { if (this.parts.length < 420) this.parts.push(Object.assign({ vx: 0, vy: 0, rot: 0, vr: 0, g: 0, drag: 0 }, o, { max: o.life })); }
  say(text, x, y, o = {}) { this.texts.push(Object.assign({ text, x, y, size: 30, vy: -30, rot: 0 }, o, { life: o.life || 1, max: o.life || 1 })); }
  sfx(name) {
    if (this.mode !== 'play' || !this.style.sfx) return;
    let s = this.style.sfx[name];
    // Power-up ending: the power-up jingle played backwards and softer, unless the style has its own.
    if (!s && name === 'end' && this.style.sfx.power) {
      const p = this.style.sfx.power, last = Math.max(...p.map(x => x.at || 0));
      s = p.map(x => ({ ...x, at: last - (x.at || 0), v: (x.v || 0.1) * 0.7, f: x.f * 0.75 }));
    }
    Sfx.play(s);
  }

  // ---------- input ----------
  key(k) {
    if (this.over) { if ((k === 'Enter' || k === ' ') && this.overT > 0.6) this.reset(); return; }
    if (k === 'Backspace') { if (this.target) { this.target.typed = 0; this.target = null; } return; }
    if (!k || k.length !== 1 || this.jam > 0) return;
    if (!this.content.cased) k = k.toLowerCase(); // without capitals in the set, Caps Lock should not hurt
    const t = this.target;
    if (t) { if (t.text[t.typed] === k) this.hitKey(t); else this.misfire(); return; }
    // Lock on: the lowest (most dangerous) bomb whose word starts with this letter.
    let best = null;
    for (const b of this.bombs) if (!b.doomed && b.y > -b.h * 0.25 && b.text[0] === k && (!best || b.y > best.y)) best = b;
    if (!best) { this.misfire(); return; }
    this.target = best; this.hitKey(best);
  }
  hitKey(b) {
    b.typed++; this.combo++; this.hits++;
    const final = b.typed >= b.text.length;
    if (final) { b.doomed = true; this.target = null; }
    this.fire(b, final);
    this.checkPower();
  }
  misfire() {
    this.jam = JAM; this.combo = 0; this.errors++; this.shake = Math.max(this.shake, 4);
    this.style.misfire?.(this, this.tip()); this.sfx('miss');
  }
  checkPower() {
    if (!this.combo || this.combo % STREAK) return;
    let kind = POWERS[this.powerIdx++ % POWERS.length];
    if (kind === 'shield' && this.shield) kind = 'multi';
    if (kind === 'shield') { this.shield = true; this.shieldT = this.t; } else { this.weapon = kind; this.weaponT = POWER_T; }
    this.say(POWER_NAME[kind], W / 2, 140, { size: 40, life: 1.4, vy: -12, kind: 'power' });
    this.style.announce?.(this, kind); this.sfx('power');
  }

  // ---------- weapons ----------
  shotTo(tip, b, final) {
    const a = Math.atan2(b.y - tip.y, b.x - tip.x);
    return { x: tip.x, y: tip.y, vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500, spd: 1500, target: b, final, trail: [], dead: false };
  }
  fire(b, final) {
    this.angle = clamp(Math.atan2(b.y - CANNON.y, b.x - CANNON.x), -Math.PI + 0.12, -0.12);
    this.recoil = 1;
    const tip = this.tip();
    this.style.muzzle?.(this, tip);
    if (this.weapon === 'laser') {
      if (final) {
        // Piercing beam: everything on the line behind the target goes too.
        const dx = b.x - tip.x, dy = b.y - tip.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const hit = this.bombs.filter(o => {
          if (o.dead) return false;
          const vx = o.x - tip.x, vy = o.y - tip.y;
          return vx * ux + vy * uy > 0 && Math.abs(vx * uy - vy * ux) < Math.max(o.w, o.h) * 0.5 + 6;
        });
        if (!hit.includes(b)) hit.push(b);
        hit.forEach(o => this.destroy(o));
        this.lasers.push({ x1: tip.x, y1: tip.y, x2: tip.x + ux * 1400, y2: tip.y + uy * 1400, life: 0.4, max: 0.4, big: true });
        this.sfx('laser');
      } else {
        this.lasers.push({ x1: tip.x, y1: tip.y, x2: b.x, y2: b.y, life: 0.12, max: 0.12, big: false });
        b.kick = 1; this.style.chip?.(this, b, { x: b.x, y: b.y + b.h * 0.3 }); this.sfx('chip');
      }
      return;
    }
    this.shots.push(this.shotTo(tip, b, final));
    if (final && this.weapon === 'multi') {
      const dist = o => Math.hypot(o.x - b.x, o.y - b.y);
      const near = this.bombs.filter(o => o !== b && !o.doomed && dist(o) < 320).sort((p, q) => dist(p) - dist(q)).slice(0, 2);
      for (const o of near) { const kill = o.text.length <= 3; if (kill) o.doomed = true; this.shots.push(this.shotTo(tip, o, kill)); }
    }
    this.sfx('shoot');
  }
  onHit(sh) {
    const b = sh.target;
    if (sh.final) this.destroy(b);
    else { b.kick = 1; this.style.chip?.(this, b, sh); this.sfx('chip'); }
  }
  destroy(b, scored = true) {
    if (b.dead) return;
    b.dead = b.doomed = true;
    if (this.target === b) this.target = null;
    if (scored) { this.kills++; this.score += 10 * b.text.length; }
    this.style.explode(this, b); this.sfx('boom');
  }
  impact(b) {
    if (this.shield) {
      this.shield = false; this.letThrough = null;
      this.style.shieldHit?.(this, b); this.destroy(b, false); this.shake = 10; this.sfx('shield');
      return;
    }
    this.destroy(b, false); this.style.cityHit?.(this, b); this.shake = 14; this.flash = 1;
    if (this.mode === 'play') {
      this.over = true; this.overT = 0; this.target = null;
      if (this.score > this.best) { this.best = this.score; if (!this.onOver) store.set('td-best', this.best); }
      this.onOver?.(this);
      this.sfx('over');
    } else this.score = 0;
  }

  // ---------- attract-mode player ----------
  ai(dt) {
    if ((this.aiT -= dt) > 0 || this.jam > 0) return;
    if (this.letThrough && this.letThrough.dead) this.letThrough = null;
    // With the shield up, let one bomb through so the preview shows the shield doing its job.
    if (this.shield && !this.letThrough && this.t - this.shieldT > 2.5) {
      let low = null;
      for (const b of this.bombs) if (!b.doomed && b !== this.target && (!low || b.y > low.y)) low = b;
      if (low && low.y > 260) this.letThrough = low;
    }
    let b = this.target;
    if (!b) for (const o of this.bombs) if (!o.doomed && o !== this.letThrough && o.y > 100 && (!b || o.y > b.y)) b = o;
    if (!b) { this.aiT = 0.15; return; }
    const fresh = !this.target;
    this.key(Math.random() < 0.045 ? 'q' : b.text[b.typed]);
    this.aiT = rand(0.17, 0.3) + (fresh ? 0.12 : 0) + (this.target ? 0 : rand(0.15, 0.4));
  }

  // ---------- simulation ----------
  update(dt) {
    this.t += dt;
    const s = this.style;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.jam = Math.max(0, this.jam - dt);
    this.shieldVis = lerp(this.shieldVis, this.shield ? 1 : 0, Math.min(1, dt * 6));
    if (this.weaponT > 0 && (this.weaponT -= dt) <= 0) { this.weapon = 'cannon'; this.sfx('end'); }
    if (this.over) this.overT += dt;
    else {
      if ((this.spawnT -= dt) <= 0) {
        if (this.bombs.filter(b => !b.doomed).length < this.maxBombs()) this.spawn();
        this.spawnT = this.spawnEvery();
      }
      for (const b of this.bombs) {
        b.age += dt; b.kick = Math.max(0, b.kick - dt * 5); b.rot += b.vr * dt;
        if (!b.doomed) b.y += b.vy * dt;
        b.x = b.baseX + Math.sin(b.age * b.swayF + b.phase) * b.sway * (s.sway ?? 1);
        const line = this.shield ? Math.min(IMPACT, domeY(b.x)) : IMPACT;
        if (!b.doomed && b.y + b.h / 2 >= line) { this.impact(b); if (this.over) break; }
      }
      if (this.mode === 'auto') this.ai(dt);
    }
    for (const sh of this.shots) {
      const tb = sh.target;
      if (tb && !tb.dead) {
        const dx = tb.x - sh.x, dy = tb.y - sh.y, d = Math.hypot(dx, dy);
        if (d < 24) { sh.dead = true; this.onHit(sh); continue; }
        sh.vx = (dx / d) * sh.spd; sh.vy = (dy / d) * sh.spd;
      }
      sh.trail.push(sh.x, sh.y); if (sh.trail.length > 12) sh.trail.splice(0, 2);
      sh.x += sh.vx * dt; sh.y += sh.vy * dt;
      if (sh.y < -60 || sh.x < -60 || sh.x > W + 60 || sh.y > H + 60) sh.dead = true;
    }
    for (const l of this.lasers) l.life -= dt;
    for (const p of this.parts) {
      p.life -= dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (const x of this.texts) { x.life -= dt; x.y += x.vy * dt; }
    this.bombs = this.bombs.filter(b => !b.dead);
    this.shots = this.shots.filter(x => !x.dead);
    this.lasers = this.lasers.filter(l => l.life > 0);
    this.parts = this.parts.filter(p => p.life > 0);
    this.texts = this.texts.filter(x => x.life > 0);
    // Aim at the locked bomb, or hint at the most dangerous one.
    this.hint = null;
    if (!this.target && !this.over) for (const b of this.bombs) if (!b.doomed && b.y > 20 && (!this.hint || b.y > this.hint.y)) this.hint = b;
    const tb = this.target || this.hint;
    const want = tb ? clamp(Math.atan2(tb.y - CANNON.y, tb.x - CANNON.x), -Math.PI + 0.12, -0.12) : -Math.PI / 2;
    this.angle = lerp(this.angle, want, Math.min(1, dt * 10));
  }
  render() {
    const c = this.ctx, s = this.style;
    TD.k = this.k; // shadows ignore the canvas transform, so styles scale them by this
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.save();
    if (this.shake > 0) c.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    const w = s.beginWorld ? s.beginWorld(this) : c;
    s.drawBackground(w, this);
    s.drawCity(w, this);
    if (this.shieldVis > 0.02) s.drawShield(w, this);
    for (const b of this.bombs) s.drawBomb(w, b, this);
    for (const l of this.lasers) s.drawLaser(w, l, this);
    for (const sh of this.shots) s.drawShot(w, sh, this);
    s.drawCannon(w, this);
    if (this.weapon !== 'cannon') s.drawGauge ? s.drawGauge(w, this) : gauge(w, this, s.gauge);
    for (const p of this.parts) s.drawParticle(w, p, this);
    if (s.endWorld) s.endWorld(this, c);
    for (const b of this.bombs) s.drawLabel(c, b, this);
    const tb = this.target || this.hint;
    if (tb) s.drawReticle(c, tb, this, tb === this.target);
    for (const x of this.texts) s.drawText ? s.drawText(c, x, this) : ftext(c, x, s.text);
    c.restore();
    if (this.flash > 0) { c.globalAlpha = this.flash * 0.5; c.fillStyle = s.flashColor || '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    s.drawHUD ? s.drawHUD(c, this) : hud(c, this, s.hud);
    if (this.over) s.drawOver ? s.drawOver(c, this) : over(c, this, s.overOpts);
  }
  frame(dt) { this.update(dt); this.render(); }
}

window.TD = {
  W, H, GROUND, IMPACT, CANNON, BARREL, DOME, STREAK, POWER_T, PACE, POOL, domeY,
  util: { rand, pick, clamp, lerp, rng }, store, Sfx, Game, styles: [],
  rr, star, skyline, seg, ftext, hud, gauge, over,
  clearLayers: () => LAYERS.clear()
};
})();
