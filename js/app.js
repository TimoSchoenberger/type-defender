/* App wiring: one full-screen stage that shows the style picker, the start menu or the game. */
(() => {
'use strict';
const { Game, Sfx, Music, Menu, Keys, Room, Race, store } = TD;
const byId = Object.fromEntries(TD.styles.map(s => [s.id, s]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

const appEl = $('app'), arenaCanvas = $('arena-canvas'), pickEl = $('pick');
const styleBtn = $('to-style'), soundBtn = $('sound'), musicBtn = $('music'), splashBtn = $('splash'), menuBtn = $('to-menu'), fullBtn = $('full');
const helpEl = $('help'), capsEl = $('capswarn');
// mode is what the stage shows; back is where the picker returns to (null before the first pick).
// racing names the race this device is playing (seed and start), null otherwise.
let mode = 'pick', back = null, caps = false, racing = null;

const saved = byId[store.get('td-style', '')];
const arena = new Game(arenaCanvas, saved || byId.comic, 'play');
arena.onMenu = true;
arena.fill = true;
arena.splash = store.get('td-splash', true);

// Renders outside the animation loop get the same guard: one bad frame must not break the page.
function safeRender(g) { try { g.render(); } catch (err) { console.error(err); } }

// Picker tiles: each one runs its style in attract mode.
const tiles = [...pickEl.querySelectorAll('.tile')];
const previews = tiles.map(tile => {
  const canvas = tile.querySelector('canvas');
  const g = new Game(canvas, byId[tile.dataset.style], 'auto');
  for (let i = 0; i < 90; i++) g.update(1 / 30); // start mid-action so the still frame already shows a lock-on
  const p = { tile, canvas, g, visible: true, hover: false };
  tile.addEventListener('pointerenter', () => { p.hover = true; });
  tile.addEventListener('pointerleave', () => { p.hover = false; });
  tile.addEventListener('focus', () => { p.hover = true; });
  tile.addEventListener('blur', () => { p.hover = false; });
  tile.addEventListener('click', () => pick(tile.dataset.style));
  return p;
});
const NAMES = Object.fromEntries(tiles.map(t => [t.dataset.style, t.querySelector('.tile-name').textContent]));

// Canvas text needs the web fonts loaded; re-measure labels once they arrive.
const fontSpecs = new Set();
for (const s of TD.styles) for (const f of [s.font, s.hud.font, s.overOpts.font, s.text.font]) fontSpecs.add(f.replace('{s}', '24'));
if (document.fonts && document.fonts.load) {
  Promise.all([...fontSpecs].map(f => document.fonts.load(f).catch(() => null))).then(() => {
    for (const g of [...previews.map(p => p.g), arena]) { g.bombs.forEach(b => g.measure(b)); safeRender(g); }
  });
}

const io = new IntersectionObserver(entries => {
  for (const e of entries) { const p = previews.find(q => q.canvas === e.target); if (p) p.visible = e.isIntersecting; }
}, { root: pickEl, rootMargin: '120px' });
previews.forEach(p => io.observe(p.canvas));

const ro = new ResizeObserver(entries => {
  TD.clearLayers();
  for (const e of entries) {
    const p = previews.find(q => q.canvas === e.target);
    if (p) { p.g.resize(); safeRender(p.g); } else if (e.target === arenaCanvas) { arena.resize(); safeRender(arena); }
  }
});
previews.forEach(p => ro.observe(p.canvas));
ro.observe(arenaCanvas);

function paintSound() {
  soundBtn.textContent = Sfx.enabled ? 'Ton: an' : 'Ton: aus'; soundBtn.setAttribute('aria-pressed', String(Sfx.enabled));
  musicBtn.textContent = Music.enabled ? 'Musik: an' : 'Musik: aus'; musicBtn.setAttribute('aria-pressed', String(Music.enabled));
  splashBtn.textContent = arena.splash ? 'Stufen: an' : 'Stufen: aus'; splashBtn.setAttribute('aria-pressed', String(arena.splash));
}
const HELP = {
  pick: 'Klick auf einen Stil oder drück 1 bis 6 · Pfeiltasten: wählen · Enter: los',
  home: 'Klick auf eine Karte oder drück Enter · ← →: Tempo · Esc: Stil wählen',
  edit: 'Tippe Tasten zum An- und Ausschalten · ⇧ halten: Großbuchstaben und Zeichen · Enter: fertig · Esc: zurück',
  game: 'Tippe die Zeichen auf den Bomben · Rücktaste: Ziel lösen · Esc: Pause',
  pause: 'Enter oder Klick: weiterspielen · Esc: zur Tastenauswahl',
  over: 'Enter: nochmal · Esc: Tastenauswahl',
  race: 'Wettrennen: Tippe die Zeichen auf den Bomben · Hier gibt es keine Pause',
  raceOut: 'Esc: zurück ins Menü',
  raceDone: 'Enter: zur Lobby · Esc: zurück ins Menü'
};
// While a run is on, the game has the whole screen; the bar and help line come back over it only when paused or over.
const chrome = () => mode !== 'game' || arena.paused || arena.over;
function paint() {
  arenaCanvas.style.visibility = mode === 'game' ? '' : 'hidden';
  appEl.classList.toggle('in-game', mode === 'game');
  appEl.classList.toggle('chrome', chrome());
  menuBtn.hidden = mode !== 'game';
  styleBtn.hidden = mode === 'pick' || (mode === 'game' && !!racing);
  const raceDone = Race.state && Race.state.phase !== 'run';
  helpEl.textContent = mode === 'pick' ? HELP.pick + (back ? ' · Esc: zurück' : '') : mode === 'menu' ? HELP[Menu.screen] || HELP.home
    : racing ? (arena.over ? (raceDone ? HELP.raceDone : HELP.raceOut) : HELP.race)
    : arena.over ? HELP.over : arena.paused ? HELP.pause : HELP.game;
  capsEl.hidden = !(caps && mode === 'game' && arena.content.cased);
}

// ---------- style ----------
function setStyle(id) {
  arena.setStyle(byId[id]); Menu.setLook(id); store.set('td-style', id);
  styleBtn.textContent = 'Stil: ' + NAMES[id];
  tiles.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.style === id)));
}
// The picker lies over the menu or the paused game, so closing it returns to exactly where you were.
function showPick() {
  if (mode === 'game') arena.pause();
  if (mode !== 'pick') back = mode;
  mode = 'pick'; pickEl.hidden = false; pickEl.scrollTop = 0;
  paint();
  (tiles.find(t => t.getAttribute('aria-pressed') === 'true') || tiles[0]).focus({ preventScroll: true });
}
function closePick() {
  pickEl.hidden = true;
  const to = back || 'menu'; back = null;
  if (to === 'game') { mode = 'game'; arena.resume(); appEl.focus(); }
  else if (Menu.visible) { mode = 'menu'; Menu.refocus(); }
  else return showMenu();
  paint();
}
function pick(id) { Sfx.unlock(); setStyle(id); closePick(); }
function pickKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); if (back) closePick(); return; }
  const n = Number(e.key);
  if (n >= 1 && n <= tiles.length) { e.preventDefault(); pick(tiles[n - 1].dataset.style); return; }
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols(), ArrowDown: cols() }[e.key];
  if (!step) return;
  e.preventDefault();
  const i = Math.max(0, tiles.indexOf(document.activeElement));
  tiles[Math.min(tiles.length - 1, Math.max(0, i + step))].focus();
}
function cols() { const top = tiles[0].offsetTop; return tiles.filter(t => t.offsetTop === top).length; }

// ---------- menu and game ----------
function showMenu(screen = 'home') { leaveRace(); pickEl.hidden = true; mode = 'menu'; Menu.show(screen); paint(); }
// A key set from the menu becomes the game's content; records are kept per set and tempo.
function startGame(sel) {
  Menu.hide(); mode = 'game';
  const pace = Menu.paceInfo();
  arena.pace = pace.rate; arena.paceName = pace.name;
  arena.race = null; arena.raceView = null;
  arena.content = Keys.build(sel); arena.best = Menu.bestOf(sel.id); arena.reset();
  arena.onOver = g => {
    Menu.setBest(sel.id, g.best);
    Room.game();
    sendToRoom(sel, Menu.pace, g);
  };
  paint(); arena.resize();
  appEl.focus();
}
// In a class or family room, the run goes to the room's leaderboard and the game-over screen shows the rank.
function sendToRoom(sel, pace, g) {
  const room = Room.current;
  if (!room || !g.score) return;
  const run = g.runId = (g.runId || 0) + 1, still = () => g.over && g.runId === run;
  Room.submit(sel, pace, g.score).then(r => {
    if (still()) g.roomLine = r ? `Raum ${room.code}: Platz ${r.rank} von ${r.of}` : `Raum ${room.code}: wird gesendet, sobald du online bist`;
  }).catch(() => {});
}
// ---------- race: last one standing ----------
const raceId = m => m.seed + ':' + m.start;
// The race began and this device is in it: everyone builds the same content from the seed and counts down to the shared start.
function startRace(m) {
  const s = m.set, sel = s.chars ? { id: s.set, name: s.name, chars: s.chars, types: s.types } : Keys.PRESETS.find(p => p.id === s.set);
  if (!sel) return;
  racing = raceId(m);
  pickEl.hidden = true; Menu.hide(); mode = 'game';
  arena.pace = TD.PACE[m.pace - 1]; arena.paceName = '';
  arena.content = Keys.build(sel, TD.util.rng(m.seed));
  arena.race = { seed: m.seed, clock: () => (Race.now() - m.start) / 1000 };
  arena.best = 0; arena.reset();
  arena.countT = Math.max(0.001, -arena.race.clock());
  arena.raceView = Race.view();
  arena.onOver = g => { Room.game(); if (!g.won) Race.out(g.score); };
  paint(); arena.resize();
  appEl.focus();
}
// Leaving mid-race counts as being out.
function leaveRace() {
  if (!racing) return;
  if (!arena.over && Race.mine && Race.mine.status === 'in') Race.out(arena.score);
  racing = null; arena.race = null; arena.raceView = null; arena.over = true;
}
function toLobby() { racing = null; arena.race = null; mode = 'menu'; Menu.show('home', true); Menu.openRace(); paint(); }
Race.on(r => {
  const m = r.state, mine = r.mine;
  if (!m) return;
  if (m.phase === 'run' && mine && mine.status === 'in' && racing !== raceId(m) && Room.current) { startRace(m); return; }
  if (!racing) return;
  if (raceId(m) !== racing) { if (mode === 'game') toLobby(); return; } // called off by the host
  arena.raceView = r.view();
  if (arena.over && !arena.won && mine && mine.status === 'in') Race.out(arena.score); // the first report got lost in a reconnect
  if (m.phase === 'done' && !arena.over) arena.finish(!!mine && mine.status === 'won');
  paint();
});

Menu.init({ onStart: startGame, onScreen: () => paint() });

styleBtn.addEventListener('click', showPick);
menuBtn.addEventListener('click', () => showMenu());
soundBtn.addEventListener('click', () => { Sfx.enabled = !Sfx.enabled; store.set('td-sound', Sfx.enabled); if (Sfx.enabled) Sfx.unlock(); paintSound(); refocus(); });
musicBtn.addEventListener('click', () => { Music.setEnabled(!Music.enabled); Sfx.unlock(); paintSound(); refocus(); });
splashBtn.addEventListener('click', () => { arena.splash = !arena.splash; store.set('td-splash', arena.splash); paintSound(); refocus(); });
arenaCanvas.addEventListener('pointerdown', () => { appEl.focus(); if (arena.paused) { arena.resume(); paint(); } });
function refocus() { if (mode === 'game') appEl.focus(); }

// Browsers only start audio after a click or key press.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => Sfx.unlock(), { capture: true, passive: true });

// Full screen is offered in the browser; an installed app already has the whole screen. Older iPad Safari only knows the webkit names.
const installed = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
const root = document.documentElement, fullEl = () => document.fullscreenElement || document.webkitFullscreenElement;
if ((document.fullscreenEnabled || document.webkitFullscreenEnabled) && !installed) {
  fullBtn.hidden = false;
  fullBtn.addEventListener('click', () => {
    if (fullEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else Promise.resolve((root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' })).then(() => navigator.keyboard?.lock?.(['Escape'])).catch(() => {});
  });
  const changed = () => { fullBtn.textContent = fullEl() ? 'Vollbild aus' : 'Vollbild'; if (fullEl()) guard(); refocus(); };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);
}

// Android treats Esc on a hardware keyboard as Back, and Back closes an installed app that has no history.
// So the installed app (and full screen) keeps one spare history entry: Back lands on it and counts as Esc.
let escAt = 0;
function guard() { if (!history.state || !history.state.td) history.pushState({ td: 1 }, ''); }
window.addEventListener('popstate', () => {
  if (!installed && !fullEl()) return;
  guard();
  if (performance.now() - escAt > 250) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // Back without a key press
});
if (installed) guard();

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') escAt = performance.now();
  if (e.getModifierState) caps = e.getModifierState('CapsLock');
  if (mode === 'pick') { pickKey(e); paint(); return; }
  if (mode === 'menu') { if (Menu.keydown(e) === 'close') showPick(); paint(); return; }
  // Esc pauses a running game; only a second Esc (or Esc after the run) leaves for the key sets.
  if (e.key === 'Escape') {
    e.preventDefault();
    if (e.repeat) return;
    if (racing && !arena.over) return; // no pause in a race
    if (arena.over || arena.paused) showMenu(); else { arena.pause(); paint(); }
    return;
  }
  if (racing && arena.over && e.key === 'Enter' && Race.state && Race.state.phase !== 'run') { e.preventDefault(); toLobby(); return; }
  // AltGr (Ctrl+Alt on Windows) types @, € and friends, so only plain Ctrl and Cmd shortcuts are skipped.
  const altgr = e.getModifierState && e.getModifierState('AltGraph');
  if (e.metaKey || (e.ctrlKey && !altgr) || e.repeat || e.key === 'Tab') return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('button')) return;
  if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') { e.preventDefault(); arena.key(e.key); }
  paint();
});
window.addEventListener('keyup', e => { if (mode === 'menu') Menu.keyup(e); });
// Switching tabs or windows pauses the run instead of letting bombs fall unseen.
function away() { if (mode === 'game' && !arena.over) { arena.pause(); paint(); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { Music.stop(0.1); away(); } });
window.addEventListener('blur', away);

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop); // schedule first so one failing frame never freezes the page
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (mode === 'game') { arena.frame(dt); if (chrome() !== appEl.classList.contains('chrome')) paint(); arena.paused ? Music.calm(arena.style.music) : Music.follow(arena, arena.style.music); return; }
    if (mode === 'menu') { Music.calm(arena.style.music); return; }
    // Picker: animate the visible tiles; the hovered or focused one plays its song.
    let song = arena.style.music;
    for (const p of previews) {
      if (p.hover) song = p.g.style.music;
      if (p.visible && (!reduce || p.hover)) p.g.frame(dt);
    }
    if (back) Music.calm(song); // the first visit stays quiet until a style is chosen
  } catch (err) { console.error(err); }
}

paintSound();
Room.visit(); Room.flush();
if (saved) { setStyle(saved.id); showMenu(); } else { setStyle('comic'); showPick(); }
for (const p of previews) safeRender(p.g);
requestAnimationFrame(loop);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline mode unavailable:', err)));
}
})();
