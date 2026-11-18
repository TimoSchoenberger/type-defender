/* Background music: a small step sequencer that plays each style's song on the shared audio context.
   Songs are data (see `music` in the style files). Tracks join in as the run heats up (`lvl`),
   `boost` tracks also play while a laser or multishot is active, and the tempo creeps up as the run heats up. */
(() => {
'use strict';
const { Sfx, store } = TD;

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14], sus2: [0, 2, 7], sus4: [0, 5, 7] };
const chord = s => { const m = /^([A-G])([#b]?)(.*)$/.exec(s); return { pc: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12, tones: QUAL[m[3]] }; };

// Melodic voices: one or two oscillators, an envelope and an optional filter sweep.
//   a attack · d decay to sustain level s · r release · lp/lpEnv filter cutoff · det detuned twin (cents) · vib vibrato (cents) · h bell partial [ratio, level]
const VOICE = {
  bass: { w: 'sawtooth', a: 0.004, d: 0.16, s: 0.35, r: 0.05, lp: 320, lpEnv: 1700, q: 5 },
  pluckbass: { w: 'triangle', w2: 'sawtooth', a: 0.003, d: 0.2, s: 0.25, r: 0.05, lp: 900, lpEnv: 2200, q: 2 },
  sub: { w: 'sine', a: 0.03, r: 0.25 },
  tri: { w: 'triangle', a: 0.002, r: 0.03 },
  pulse: { w: 'pulse25', a: 0.002, d: 0.12, s: 0.7, r: 0.04 },
  pulse12: { w: 'pulse12', a: 0.002, d: 0.06, s: 0.5, r: 0.02 },
  pad: { w: 'sawtooth', det: 10, a: 0.5, r: 1.1, lp: 900, q: 0.5 },
  glasspad: { w: 'triangle', det: 7, a: 1.2, r: 2, lp: 1600 },
  pluck: { w: 'triangle', a: 0.002, d: 0.22, s: 0.001, r: 0.05 },
  marimba: { w: 'sine', a: 0.002, d: 0.32, s: 0.001, r: 0.05, h: [4, 0.22] },
  musicbox: { w: 'sine', a: 0.002, d: 1.1, s: 0.001, r: 0.1, h: [3, 0.18] },
  bell: { w: 'sine', a: 0.002, d: 1.5, s: 0.001, r: 0.2, h: [2.76, 0.28] },
  glass: { w: 'sine', a: 0.003, d: 0.7, s: 0.001, r: 0.15, h: [2, 0.2] },
  ping: { w: 'sine', a: 0.004, d: 2.2, s: 0.001, r: 0.2 },
  whistle: { w: 'sine', a: 0.045, r: 0.08, vib: 22 },
  pizz: { w: 'triangle', a: 0.002, d: 0.18, s: 0.001, r: 0.04, lp: 1500 },
  brass: { w: 'sawtooth', det: 8, a: 0.018, d: 0.12, s: 0.55, r: 0.07, lp: 700, lpEnv: 2800, q: 1.2 },
  lead: { w: 'square', det: 6, a: 0.01, r: 0.08, lp: 2400, vib: 12 },
  synlead: { w: 'sawtooth', det: 12, a: 0.01, d: 0.3, s: 0.7, r: 0.12, lp: 2600, q: 1 },
  arp: { w: 'sawtooth', a: 0.002, d: 0.12, s: 0.001, r: 0.04, lp: 1800, lpEnv: 4200, q: 3 },
  twang: { w: 'sawtooth', a: 0.002, d: 0.1, s: 0.25, r: 0.03, lp: 1100, lpEnv: 3400, q: 7 }
};

const Music = {
  enabled: store.get('td-music', true), volume: 0.32,
  cur: null, level: 0, power: false, tempo: 1, held: false,
  ac: null, master: null, delay: null, fb: null, rev: null, waves: {}, timer: null, marks: [],

  setup() {
    const ac = Sfx.ac;
    if (!ac || this.ac === ac) return !!ac;
    this.ac = ac;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ac.destination);
    this.master = ac.createGain(); this.master.gain.value = this.volume; this.master.connect(comp);
    // Shared echo and room, fed by per-track sends.
    this.delay = ac.createDelay(1.5); this.fb = ac.createGain(); this.fb.gain.value = 0.35;
    const dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    this.delay.connect(dlp); dlp.connect(this.fb); this.fb.connect(this.delay); dlp.connect(this.master);
    const len = Math.round(ac.sampleRate * 2.2), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = ac.createConvolver(); this.rev.buffer = ir; this.rev.connect(this.master);
    // Pulse waves for the chiptune voices.
    for (const [name, duty] of [['pulse25', 0.25], ['pulse12', 0.125]]) {
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
      this.waves[name] = ac.createPeriodicWave(re, im);
    }
    return true;
  },

  // Start a song (no-op if it is already playing). The old one fades out under the new one.
  play(song) {
    if (!song || !this.enabled || !this.setup()) return;
    if (this.cur && this.cur.def === song) return;
    this.fade(0.5);
    const ac = this.ac, out = ac.createGain();
    out.gain.setValueAtTime(0.0001, ac.currentTime); out.gain.exponentialRampToValueAtTime(1, ac.currentTime + 0.4);
    out.connect(this.master);
    const tracks = song.tracks.map(def => {
      const node = ac.createGain(); node.gain.value = def.v ?? 0.3; node.connect(out);
      if (def.dly) { const s = ac.createGain(); s.gain.value = def.dly; node.connect(s); s.connect(this.delay); }
      if (def.rev) { const s = ac.createGain(); s.gain.value = def.rev; node.connect(s); s.connect(this.rev); }
      const seq = def.notes ? def.notes.trim().split(/\s+/) : [...def.pat];
      return { def, node, seq };
    });
    this.cur = { def: song, out, tracks, chords: song.chords.map(chord), step: 0, next: ac.currentTime + 0.08 };
    this.delay.delayTime.setValueAtTime(this.stepDur() * (song.echo || 3), ac.currentTime);
    this.marks = [];
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },
  fade(sec = 0.6) {
    const c = this.cur;
    if (!c) return;
    const t = this.ac.currentTime;
    c.out.gain.cancelScheduledValues(t); c.out.gain.setValueAtTime(Math.max(0.0001, c.out.gain.value), t);
    c.out.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    setTimeout(() => c.out.disconnect(), sec * 1000 + 3000);
    this.cur = null; this.marks = [];
  },
  stop(sec) { this.fade(sec); if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  setEnabled(on) { this.enabled = on; store.set('td-music', on); if (!on) this.stop(0.3); },

  // Drive intensity from the game: called every frame while the arena is open.
  follow(g, song) {
    if (!g || g.over) {
      if (g && g.over && this.cur && !this.held) { this.fade(1.2); this.held = true; }
      return;
    }
    this.held = false;
    const h = g.heat();
    this.level = h >= 26 ? 2 : h >= 10 ? 1 : 0;
    this.power = g.weapon !== 'cannon';
    this.tempo = 1 + Math.min(0.1, h * 0.002);
    this.play(song);
  },
  calm(song) { this.level = 0; this.power = false; this.tempo = 1; this.held = false; this.play(song); },

  stepDur() { return 60 / (this.cur.def.bpm * this.tempo) / 4; },
  // Beat position (in quarter notes) of what is audible right now, or null when nothing plays.
  beatPos() {
    if (!this.cur || !this.marks.length || !this.enabled) return null;
    const now = this.ac.currentTime - (this.ac.outputLatency || 0);
    while (this.marks.length > 1 && this.marks[1].t <= now) this.marks.shift();
    const m = this.marks[0];
    return now < m.t ? null : (m.step + (now - m.t) / m.sd) / 4;
  },

  tick() {
    const c = this.cur, ac = this.ac;
    if (!c) return;
    if (c.next < ac.currentTime - 0.25) c.next = ac.currentTime + 0.05; // tab was asleep: skip ahead instead of bursting
    while (c.next < ac.currentTime + 0.15) {
      const sd = this.stepDur(), sw = c.def.swing || 0, len = sd * (c.step % 2 ? 1 - sw : 1 + sw);
      this.playStep(c, c.step, c.next, sd);
      this.marks.push({ t: c.next, step: c.step, sd });
      if (this.marks.length > 64) this.marks.shift();
      c.next += len; c.step++;
    }
  },
  playStep(c, step, t, sd) {
    const per = c.def.chordLen || 16, ch = c.chords[Math.floor(step / per) % c.chords.length];
    for (const tr of c.tracks) {
      const d = tr.def;
      if ((d.lvl || 0) > this.level && !(d.boost && this.power)) continue;
      const seq = tr.seq, i = step % seq.length, tok = seq[i];
      if (tok === '.' || tok === '-') continue;
      let n = 1; while (n < seq.length && seq[(i + n) % seq.length] === '-') n++;
      const dur = n * sd;
      if (d.drum) { DRUM[d.drum](this, tr.node, t, tok === 'o' ? 0.5 : tok === 'X' ? 1.25 : 1); continue; }
      let notes;
      if (d.notes) notes = [midi(tok)];
      else {
        const base = 12 * ((d.oct ?? 3) + 1) + ch.pc, tn = ch.tones, at = k => base + tn[k % tn.length] + 12 * Math.floor(k / tn.length);
        notes = tok === 'C' ? tn.slice(0, 4).map((_, k) => at(k)) : tok === 'o' ? [base + 12] : [at(+tok)];
      }
      const v = 1 / Math.sqrt(notes.length);
      for (const m of notes) this.voice(tr.node, VOICE[d.i], t, hz(m), d.len ? d.len * sd : dur, v);
    }
  },
  voice(out, p, t, f, dur, v) {
    const ac = this.ac, g = ac.createGain(), a = p.a || 0.005, s = p.s ?? 1, perc = s < 0.01;
    // Plucked and struck voices ring for their decay; held voices follow the note length.
    const end = perc ? t + a + (p.d || 0.1) : t + Math.max(dur, a + 0.01), stop = end + (perc ? 0 : p.r || 0.05) + 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (perc) g.gain.exponentialRampToValueAtTime(0.0001, end);
    else {
      const dEnd = Math.min(t + a + (p.d || 0.1), end);
      if (s < 1 && dEnd > t + a) g.gain.exponentialRampToValueAtTime(v * s, dEnd);
      g.gain.setValueAtTime(v * s, end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + (p.r || 0.05));
    }
    let dest = g;
    if (p.lp) {
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = p.q || 0.7;
      fl.frequency.setValueAtTime(p.lpEnv || p.lp, t);
      if (p.lpEnv) fl.frequency.exponentialRampToValueAtTime(p.lp, t + (p.d || 0.15) + a);
      fl.connect(g); dest = fl;
    }
    const osc = (type, fr, det = 0, lvl = 1) => {
      const o = ac.createOscillator();
      if (this.waves[type]) o.setPeriodicWave(this.waves[type]); else o.type = type;
      o.frequency.setValueAtTime(fr, t); o.detune.setValueAtTime(det, t);
      if (p.vib) { // delayed vibrato, like a singer
        const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5;
        lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(p.vib, t + Math.min(0.25, dur));
        l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(stop);
      }
      let n = o;
      if (lvl !== 1) { const lg = ac.createGain(); lg.gain.value = lvl; o.connect(lg); n = lg; }
      n.connect(dest); o.start(t); o.stop(stop);
    };
    osc(p.w, f, p.det ? -p.det : 0, p.det || p.w2 ? 0.6 : 1);
    if (p.det) osc(p.w, f, p.det, 0.6);
    if (p.w2) osc(p.w2, f, 0, 0.5);
    if (p.h) { // bell partial that dies faster than the fundamental
      const hg = ac.createGain(), o = ac.createOscillator(); o.frequency.value = f * p.h[0];
      hg.gain.setValueAtTime(p.h[1], t); hg.gain.exponentialRampToValueAtTime(0.001, t + (p.d || 0.5) * 0.4);
      o.connect(hg); hg.connect(g); o.start(t); o.stop(stop);
    }
    g.connect(out);
  }
};

// Drums from oscillators and the shared noise buffer.
function noiseHit(M, out, t, v, { type = 'highpass', f = 6000, q = 0.7, d = 0.05, a = 0.001 }) {
  const ac = M.ac, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = Sfx.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  src.connect(fl); fl.connect(g); g.connect(out); src.start(t, Math.random() * 0.5); src.stop(t + a + d + 0.05);
}
function thump(M, out, t, v, { f0 = 150, f1 = 42, d = 0.28, sweep = 0.11, type = 'sine' }) {
  const ac = M.ac, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
}
const DRUM = {
  kick: (M, o, t, v) => thump(M, o, t, v, {}),
  softkick: (M, o, t, v) => thump(M, o, t, v * 0.8, { f0: 100, f1: 45, d: 0.22, sweep: 0.08 }),
  snare: (M, o, t, v) => { noiseHit(M, o, t, v * 0.6, { type: 'bandpass', f: 1900, q: 0.6, d: 0.14 }); thump(M, o, t, v * 0.35, { f0: 210, f1: 160, d: 0.08, sweep: 0.05, type: 'triangle' }); },
  clap: (M, o, t, v) => { for (const dt of [0, 0.011, 0.022]) noiseHit(M, o, t + dt, v * 0.5, { type: 'bandpass', f: 1300, q: 1.2, d: dt === 0.022 ? 0.13 : 0.01 }); },
  hat: (M, o, t, v) => noiseHit(M, o, t, v * 0.3, { f: 7800, d: 0.035 }),
  ohat: (M, o, t, v) => noiseHit(M, o, t, v * 0.22, { f: 6800, d: 0.2 }),
  shaker: (M, o, t, v) => noiseHit(M, o, t, v * 0.22, { f: 5200, d: 0.05, a: 0.018 }),
  snap: (M, o, t, v) => { noiseHit(M, o, t, v * 0.45, { type: 'bandpass', f: 2600, q: 2.5, d: 0.05 }); },
  wood: (M, o, t, v) => thump(M, o, t, v * 0.5, { f0: 950, f1: 820, d: 0.07, sweep: 0.03 }),
  tap: (M, o, t, v) => noiseHit(M, o, t, v * 0.35, { type: 'bandpass', f: 3200, q: 0.8, d: 0.03 }),
  nkick: (M, o, t, v) => thump(M, o, t, v * 0.6, { f0: 120, f1: 30, d: 0.1, sweep: 0.07, type: 'square' }),
  nsnare: (M, o, t, v) => noiseHit(M, o, t, v * 0.45, { type: 'lowpass', f: 6000, d: 0.12 }),
  nhat: (M, o, t, v) => noiseHit(M, o, t, v * 0.25, { f: 9000, d: 0.025 }),
  heart: (M, o, t, v) => thump(M, o, t, v * 0.7, { f0: 70, f1: 40, d: 0.3, sweep: 0.12 })
};

TD.Music = Music;
})();
