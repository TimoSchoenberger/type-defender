/* Start menu and key picker, drawn in the look of the active style (CSS tokens per [data-look]).
   Home: pick a tempo and a key set (presets and your own). Editor: type keys to switch them on or off on an on-screen keyboard;
   holding Shift (or clicking it) shows the shifted layer, so capitals and signs like ! § $ % & get their own switch. */
(() => {
'use strict';
const { Keys, DB, store, Room, Race } = TD;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nope = el => { if (!el) return; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };
const press = el => { if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); };
// Tempo levels, matching TD.PACE (how many hits it takes to reach full speed).
const PACES = [
  { name: 'Schnecke', desc: 'Wird ganz, ganz langsam schwerer.' },
  { name: 'Schildkröte', desc: 'Wird langsam schwerer.' },
  { name: 'Hase', desc: 'Wird nach und nach schwerer.' },
  { name: 'Gepard', desc: 'Wird flott schwerer.' },
  { name: 'Rakete', desc: 'Wird schnell schwerer.' }
];
const ROOM_ERRORS = {
  offline: 'Keine Verbindung. Versuch es gleich nochmal.',
  'no-room': 'Diesen Raum gibt es nicht (mehr). Stimmt der Code?',
  'no-player': 'Du bist nicht mehr in diesem Raum.',
  full: 'Der Raum ist voll.',
  busy: 'Gerade geht das nicht. Versuch es später nochmal.',
  'not-admin': 'Das darf nur, wer den Raum erstellt hat.',
  'slow-down': 'Zu viele Versuche auf einmal. Warte kurz und versuch es dann nochmal.'
};
const roomError = err => ROOM_ERRORS[err && err.code] || 'Das hat nicht geklappt. Versuch es nochmal.';
const typesKey = (sel, types) => [...sel].sort().join('') + '|' + ['letters', 'syl', 'words'].map(t => +!!types[t]).join('');

const M = {
  screen: null, look: 'comic', layout: 'de', pace: 3, sets: [], best: {}, fresh: null, onStart: null, onScreen: null,
  sel: new Set(), types: {}, record: null, title: '', nameHint: '', base: '', sticky: false, held: false, caps: false,

  init(o) {
    this.onStart = o.onStart; this.onScreen = o.onScreen;
    this.layout = TD.store.get('td-layout', 'de');
    this.pace = Math.min(5, Math.max(1, TD.store.get('td-pace', 3) | 0));
    $('m-ticks').innerHTML = PACES.map((p, i) => `<button type="button" tabindex="-1" data-pace="${i + 1}">${p.name}</button>`).join('');
    $('m-ticks').addEventListener('click', e => { const b = e.target.closest('[data-pace]'); if (b) this.setPace(+b.dataset.pace); });
    $('m-pace').addEventListener('input', e => this.setPace(+e.target.value));
    Keys.detectLayout().then(l => { this.layout = l; this.render(); this.keepFocus(); });
    $('m-home').addEventListener('click', e => this.homeClick(e));
    $('m-kb').addEventListener('click', e => this.kbClick(e));
    $('m-chips').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) { this.toggle(b.dataset.ch); } });
    for (const b of document.querySelectorAll('#m-edit [data-layer]')) b.addEventListener('click', () => { this.sticky = b.dataset.layer === '1'; this.renderEditor(); });
    for (const b of document.querySelectorAll('#m-edit [data-layout]')) b.addEventListener('click', () => { this.layout = b.dataset.layout; store.set('td-layout', this.layout); this.renderEditor(); });
    for (const c of document.querySelectorAll('#m-edit [data-type]')) c.addEventListener('change', () => {
      this.types[c.dataset.type] = c.checked;
      if (!this.types.letters && !this.types.syl && !this.types.words) { this.types[c.dataset.type] = true; c.checked = true; nope(c.closest('label')); }
      this.renderInfo();
    });
    $('m-cancel').addEventListener('click', () => this.back());
    $('m-clear').addEventListener('click', () => { this.sel.clear(); this.renderEditor(); });
    $('m-upper').addEventListener('click', () => this.toggleUpper());
    $('m-done').addEventListener('click', () => this.done());
    $('m-name-form').addEventListener('submit', e => { e.preventDefault(); this.save(); });
    $('m-name-cancel').addEventListener('click', () => this.closeModal());
    $('m-discard-no').addEventListener('click', () => this.closeModal());
    $('m-discard-yes').addEventListener('click', () => { this.closeModal(); this.show('home'); });
    $('m-room').addEventListener('click', e => this.roomClick(e));
    $('m-join-form').addEventListener('submit', e => { e.preventDefault(); this.joinRoom(); });
    $('m-join-cancel').addEventListener('click', () => this.closeModal());
    $('m-board').addEventListener('click', e => this.boardClick(e));
    $('m-board-close').addEventListener('click', () => this.closeModal());
    $('m-sets-form').addEventListener('submit', e => { e.preventDefault(); this.saveSets(); });
    $('m-sets-cancel').addEventListener('click', () => this.closeModal());
    $('m-race-close').addEventListener('click', () => this.closeModal());
    $('m-race').addEventListener('click', e => this.raceClick(e));
    Race.on(() => { if (this.modal === 'm-race') this.renderRace(); });
    // Ticking a set switches to "only these"; choosing "all" leaves the ticks for later.
    $('m-sets-list').addEventListener('change', () => { document.querySelector('[name="m-sets-mode"][value="some"]').checked = true; $('m-sets-err').textContent = ''; });
    window.addEventListener('blur', () => { if (this.held) { this.held = false; this.renderEditor(); } });
    this.load();
  },
  async load() {
    const [sets, best] = await Promise.all([DB.all('sets'), DB.all('best')]);
    this.sets = sets.sort((a, b) => (a.created || 0) - (b.created || 0));
    // Records are kept per set and tempo ("set@3"); older ones without a tempo were played at full pace.
    this.best = {};
    for (const b of best) { const id = b.id.includes('@') ? b.id : b.id + '@5'; this.best[id] = Math.max(this.best[id] || 0, b.score); }
    if (this.screen === 'home') { this.renderHome(); this.keepFocus(); }
  },
  // A re-render after an async load replaces the focused card; put focus back unless the player moved it elsewhere.
  keepFocus() { if (this.visible && (!document.activeElement || document.activeElement === document.body)) this.refocus(); },
  find(id) { return Keys.PRESETS.find(p => p.id === id) || this.sets.find(s => s.id === id) || (this.roomRecs() || []).find(s => s.id === id); },
  // The key sets a room prescribes, as menu records; null when the player is in no room or the room allows everything.
  roomRecs() {
    const list = Room.enabled && Room.sets;
    if (!list) return null;
    return list.map(e => e.chars ? { id: e.set, name: e.name, chars: e.chars, types: e.types, room: true, note: 'Vom Raum vorgegeben' } : Keys.PRESETS.find(p => p.id === e.set)).filter(Boolean);
  },
  bestOf(id) { return this.best[id + '@' + this.pace] || 0; },
  setBest(id, score) { const k = id + '@' + this.pace; if (score > (this.best[k] || 0)) { this.best[k] = score; DB.put('best', { id: k, score }); } },
  paceInfo() { return { rate: TD.PACE[this.pace - 1], name: PACES[this.pace - 1].name }; },

  // Display text: Bangers (the comic face) is all capitals and has no proper ß; GROSS is the right capital spelling anyway.
  label(s) { return this.look === 'comic' ? String(s).replace(/ß/g, 'ss') : String(s); },
  setLook(id) { this.look = id; $('menu').dataset.look = id; this.render(); },
  setPace(n) {
    this.pace = Math.min(5, Math.max(1, n)); store.set('td-pace', this.pace);
    this.renderPace();
    if (this.screen === 'home') for (const el of document.querySelectorAll('#m-home .mn-card[data-id]')) {
      const best = this.bestOf(el.dataset.id), tag = el.querySelector('.mn-best');
      if (tag) tag.textContent = best ? 'Rekord ' + best : 'Kein Rekord';
    }
  },
  renderPace() {
    const p = PACES[this.pace - 1], input = $('m-pace');
    input.value = this.pace; input.style.setProperty('--fill', ((this.pace - 1) / 4) * 100 + '%');
    input.setAttribute('aria-valuetext', `${p.name}: ${p.desc}`);
    $('m-pace-name').textContent = this.label(p.name); $('m-pace-desc').textContent = p.desc;
    for (const b of $('m-ticks').children) b.setAttribute('aria-current', String(+b.dataset.pace === this.pace));
    // Speed over hits: every line climbs the same ramp, slower tempos just take more hits for it.
    // The main ramp ends after about 52 hits at rate 1, then it keeps rising more slowly; the x axis shows 0 to 220 hits.
    const knee = 30, low = 64, lines = TD.PACE.map((r, i) => {
      const x = 4 + (Math.min(220, 52 / r) * 192) / 220, end = knee - ((196 - x) / 192) * 16;
      return `<polyline class="${i + 1 === this.pace ? 'cur' : ''}" points="4,${low} ${x.toFixed(1)},${knee} 196,${end.toFixed(1)}"/>`;
    });
    const cur = lines.splice(this.pace - 1, 1);
    $('m-graph').innerHTML = `<text x="4" y="11">Schwer</text><text x="196" y="82" text-anchor="end">Treffer →</text>` +
      `<text x="4" y="82">Start</text>${lines.join('')}${cur}`;
  },

  get visible() { return !$('menu').hidden; },
  get editing() { return this.visible && this.screen === 'edit'; },
  // keepRace: coming back from a race to its lobby, so the race connection stays open.
  show(screen = 'home', keepRace = false) {
    $('menu').hidden = false;
    this.screen = screen;
    $('m-home').hidden = screen !== 'home'; $('m-edit').hidden = screen !== 'edit';
    this.closeModal(true, keepRace);
    this.render();
    $('menu').scrollTop = 0;
    this.refocus(!this.fresh);
    this.onScreen?.(screen);
    if (screen === 'home' && Room.current) this.syncRoom();
  },
  // The room's creator may have changed the prescribed key sets (or removed this player) since the last look.
  async syncRoom() {
    if (!(await Room.refresh()) || this.screen !== 'home' || this.modal) return;
    if (!Room.current) this.roomMsg = 'Du bist nicht mehr in diesem Raum.';
    this.renderHome(); this.keepFocus();
  },
  // Home: focus the card Enter should start (the new or last one). Editor: the menu itself, so typing goes to the keys.
  refocus(preventScroll = true) {
    if (this.screen !== 'home') { $('menu').focus(); return; }
    const id = this.fresh || store.get('td-last', 'p-home1');
    const btn = document.querySelector(`#m-home .mn-card[data-id="${CSS.escape(id)}"] .mn-main`) || document.querySelector('#m-home .mn-main');
    if (btn) btn.focus({ preventScroll });
  },
  hide() { $('menu').hidden = true; this.screen = null; },
  render() {
    $('m-layer-up').textContent = this.label('A ⇧ groß');
    $('m-name-title').textContent = this.label('Wie soll deine Auswahl heißen?');
    $('m-board-close').textContent = $('m-race-close').textContent = this.label('Schließen');
    if (this.screen === 'home') this.renderHome(); else if (this.screen === 'edit') this.renderEditor();
  },

  // ---------- home ----------
  mini(chars) {
    const L = Keys.LAYOUTS[this.layout], set = new Set(chars);
    const shift = [...set].some(c => { const w = L.where.get(c); return w && w.layer === 1; });
    return '<span class="mkw" aria-hidden="true"><span class="mk">' + L.keys.map(key => {
      let cls = key.fn ? 'fn' : '';
      if (key.ch) { const a = L.where.get(key.ch[0])?.key === key && set.has(key.ch[0]), b = L.where.get(key.ch[1])?.key === key && set.has(key.ch[1]); if (a || b) cls = 'on'; }
      if (key.shift && shift) cls = 'fn on';
      return `<i class="${cls}" style="grid-area:${key.row + 1} / ${key.col} / span ${key.tall ? 2 : 1} / span ${key.span}"></i>`;
    }).join('') + '</span></span>';
  },
  card(s, last) {
    const chars = Keys.ordered([...s.chars], this.layout), best = this.bestOf(s.id);
    const keys = chars.length <= 14 ? chars.join(' ') : `${chars.length} Tasten`;
    const badge = s.id === this.fresh ? '<span class="mn-badge new">Neu!</span>' : s.id === last ? '<span class="mn-badge">Zuletzt</span>' : '';
    const tools = this.roomRecs() ? '' : s.builtin
      ? '<button type="button" class="mn-tool" data-act="copy">✎ Anpassen</button>'
      : '<button type="button" class="mn-tool" data-act="edit">✎ Bearbeiten</button><button type="button" class="mn-tool" data-act="del">Löschen</button>';
    return `<article class="mn-card${s.builtin ? '' : ' own'}" data-id="${esc(s.id)}">${badge}
      <button type="button" class="mn-main" data-act="play" aria-label="${esc(s.name)} spielen">
        <span class="mn-name">${esc(this.label(s.name))}</span>
        <span class="mn-note">${esc(s.note || `${chars.length} Tasten, selbst gemacht`)}</span>
        ${this.mini(chars)}
        <span class="mn-keys">${esc(keys)}</span>
        <span class="mn-row2"><span class="mn-best">${best ? 'Rekord ' + best : 'Kein Rekord'}</span><span class="mn-los">Los!</span></span>
      </button>
      <div class="mn-tools">${tools}</div>
    </article>`;
  },
  renderHome() {
    const last = store.get('td-last', 'p-home1');
    this.renderPace();
    this.renderRoom();
    // A room with prescribed key sets shows only those; your own sets come back when you leave the room.
    const rs = this.roomRecs();
    $('m-sec-presets').textContent = this.label(rs ? 'Tasten für Raum ' + Room.current.code : 'Vorlagen');
    $('m-sec-own').hidden = $('m-custom').hidden = !!rs;
    $('m-presets').innerHTML = (rs || Keys.PRESETS).map(p => this.card(p, last)).join('');
    if (rs) return;
    $('m-custom').innerHTML = this.sets.map(s => this.card(s, last)).join('') +
      '<article class="mn-card mn-new"><button type="button" class="mn-main" data-act="new"><span class="mn-plus" aria-hidden="true">+</span><span class="mn-name">Neue Auswahl</span><span class="mn-note">Deine eigenen Tasten</span></button></article>';
  },
  homeClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('.mn-card'), rec = card && card.dataset.id ? this.find(card.dataset.id) : null, act = b.dataset.act;
    if (act === 'new') this.openEditor(null);
    else if (act === 'play' && rec) { store.set('td-last', rec.id); this.fresh = null; this.onStart(rec); }
    else if (act === 'copy') this.openEditor(rec, true);
    else if (act === 'edit') this.openEditor(rec);
    else if (act === 'del') {
      card.querySelector('.mn-tools').innerHTML = '<span class="mn-ask">Wirklich löschen?</span><button type="button" class="mn-tool danger" data-act="del-yes">Ja, weg damit</button><button type="button" class="mn-tool" data-act="del-no">Nein</button>';
      card.querySelector('[data-act="del-no"]').focus();
    } else if (act === 'del-no') this.renderHome();
    else if (act === 'del-yes' && rec) {
      DB.del('sets', rec.id); DB.del('best', rec.id);
      this.sets = this.sets.filter(s => s.id !== rec.id);
      this.renderHome(); const n = document.querySelector('#m-custom .mn-main'); if (n) n.focus();
    }
  },

  // ---------- class or family room ----------
  // One panel under the tempo slider: join or create a room, or (inside one) your nickname, the leaderboard and leaving.
  roomMsg: '', roomAsk: false, busy: false, boardPace: 3, boardData: null, boardAsk: null, boardErr: '',
  renderRoom() {
    const el = $('m-room');
    el.hidden = !Room.enabled;
    if (!Room.enabled) return;
    const r = Room.current, dis = this.busy ? ' disabled' : '';
    const msg = this.roomMsg ? `<p class="mn-room-msg">${this.roomMsg}</p>` : '';
    if (!r) {
      el.innerHTML = `<div class="mn-room-who"><span class="mn-pace-label">Klasse &amp; Familie</span><span class="mn-room-name">${esc(this.label('Zusammen spielen'))}</span>` +
        `<p class="mn-pace-desc">Spielt in einem gemeinsamen Raum und vergleicht eure Rekorde.</p></div>` +
        `<div class="mn-room-act"><button type="button" class="mn-tool" data-room="join"${dis}>Raum beitreten</button><button type="button" class="mn-tool" data-room="create"${dis}>Raum erstellen</button></div>${msg}`;
      return;
    }
    const acts = this.roomAsk
      ? `<span class="mn-ask">${r.admin ? 'Du verwaltest diesen Raum; danach kann ihn niemand mehr löschen. ' : ''}Wirklich verlassen? Deine Rekorde im Raum sind dann weg.</span>` +
        '<button type="button" class="mn-tool danger" data-room="leave-yes">Ja, verlassen</button><button type="button" class="mn-tool" data-room="leave-no">Nein</button>'
      : `<button type="button" class="mn-tool" data-room="board"${dis}>🏆 Bestenliste</button>${Race.enabled ? `<button type="button" class="mn-tool" data-room="race"${dis}>🏁 Wettrennen</button>` : ''}${r.admin ? `<button type="button" class="mn-tool" data-room="sets"${dis}>⌨ Tasten festlegen</button>` : ''}` +
        `<button type="button" class="mn-tool" data-room="rename"${dis}>Anderer Name</button><button type="button" class="mn-tool" data-room="leave"${dis}>Verlassen</button>`;
    const n = r.sets ? r.sets.length : 0, rule = n ? ` Der Raum gibt ${n === 1 ? 'eine Tastenauswahl' : n + ' Tastenauswahlen'} vor.` : '';
    // Only the creator needs to know when an unused room would be deleted.
    const until = r.admin && r.expires ? ` Er bleibt bis ${new Date(r.expires).toLocaleDateString('de-DE')} und verlängert sich, sobald jemand im Raum spielt.` : '';
    el.innerHTML = `<div class="mn-room-who"><span class="mn-pace-label">Raum <b class="mn-code">${esc(r.code)}</b></span><span class="mn-room-name">${esc(this.label(r.nick))}</span>` +
      `<p class="mn-pace-desc">So heißt du in diesem Raum.${r.admin ? ' Du hast ihn erstellt.' + until : ''}${rule}</p></div><div class="mn-room-act">${acts}</div>${msg}`;
  },
  focusRoom(act) { const b = $('m-room').querySelector(`[data-room="${act}"]`) || $('m-room').querySelector('[data-room]'); if (b) b.focus(); },
  async roomClick(e) {
    const b = e.target.closest('[data-room]');
    if (!b || this.busy) return;
    const act = b.dataset.room;
    if (act === 'join') { $('m-join-input').value = ''; $('m-join-err').textContent = ''; this.openModal('m-join', 'm-join-input'); return; }
    if (act === 'board') { this.openBoard(); return; }
    if (act === 'sets') { this.openSets(); return; }
    if (act === 'race') { this.openRace(); return; }
    if (act === 'leave' || act === 'leave-no') { this.roomAsk = act === 'leave'; this.renderRoom(); this.focusRoom(this.roomAsk ? 'leave-no' : 'leave'); return; }
    const run = {
      create: async () => { const r = await Room.create(); this.roomMsg = `Neuer Raum! Gib den Code <b class="mn-code">${esc(r.code)}</b> allen, die mitspielen.`; return 'board'; },
      rename: async () => { await Room.rename(); return 'rename'; },
      'leave-yes': async () => { await Room.leave(); this.roomAsk = false; this.roomMsg = 'Du hast den Raum verlassen.'; return 'join'; }
    }[act];
    if (!run) return;
    this.busy = true; this.roomMsg = ''; this.renderRoom();
    let focus;
    try { focus = await run(); }
    catch (err) { Room.gone(err); this.roomMsg = esc(roomError(err)); this.roomAsk = false; focus = Room.current ? act : 'join'; }
    this.busy = false; this.renderHome(); this.focusRoom(focus); // joining or leaving can change which cards show
  },
  async joinRoom() {
    const code = Room.normCode($('m-join-input').value);
    if (!code) { $('m-join-err').textContent = 'Ein Code sieht so aus: TIGER-482'; nope($('m-join-input')); return; }
    $('m-join-go').disabled = true;
    try {
      const r = await Room.join(code);
      this.roomMsg = `Willkommen im Raum <b class="mn-code">${esc(r.code)}</b>!`;
      this.closeModal(true); this.renderHome(); this.focusRoom('board');
    } catch (err) { $('m-join-err').textContent = roomError(err); nope($('m-join-input')); $('m-join-input').focus(); }
    $('m-join-go').disabled = false;
  },
  openBoard() { this.boardPace = this.pace; this.boardAsk = null; this.boardErr = ''; this.boardData = null; this.openModal('m-board', 'm-board-close'); this.loadBoard(); },
  boardStep(d) { const n = Math.min(5, Math.max(1, this.boardPace + d)); if (n !== this.boardPace) { this.boardPace = n; this.boardAsk = null; this.loadBoard(); } },
  async loadBoard() {
    const pace = this.boardPace;
    $('m-board-title').textContent = this.label('Bestenliste · Raum ' + Room.current.code);
    $('m-board-pace').textContent = 'Tempo: ' + this.label(PACES[pace - 1].name);
    for (const b of $('m-board').querySelectorAll('[data-bp]')) b.disabled = pace + +b.dataset.bp < 1 || pace + +b.dataset.bp > 5;
    $('m-board-list').innerHTML = '<p class="mn-empty">Lädt …</p>'; $('m-board-admin').innerHTML = '';
    try { const d = await Room.board(pace); if (pace === this.boardPace) { this.boardData = d; this.renderBoard(); } }
    catch (err) {
      if (!Room.current) { this.closeModal(true); this.roomMsg = esc(roomError(err)); this.renderHome(); this.focusRoom('join'); return; }
      $('m-board-list').innerHTML = `<p class="mn-empty">${esc(roomError(err))}</p>`;
    }
  },
  renderBoard() {
    const d = this.boardData, me = Room.current.player, admin = Room.isAdmin;
    const order = b => { const i = Keys.PRESETS.findIndex(x => x.id === b.set); return i < 0 ? 99 : i; };
    const nameOf = b => {
      if (b.name) return b.name;
      const p = Keys.PRESETS.find(x => x.id === b.set);
      if (p) return p.name;
      const keys = Keys.ordered([...b.label], this.layout);
      return keys.length && keys.length <= 14 ? 'Eigene: ' + keys.join(' ') : `Eigene Auswahl (${keys.length} Tasten)`;
    };
    // Equal scores share a place.
    const row = (r, i, rows) => `<li class="${r.player === me ? 'me' : ''}"><span class="mn-rank">${rows.findIndex(x => x.score === r.score) + 1}.</span><span class="mn-nick">${esc(this.label(r.nick))}${r.player === me ? ' (du)' : ''}</span><span class="mn-score">${r.score}</span></li>`;
    // With prescribed sets the board follows the room's list, including sets nobody has played yet.
    const list = d.sets ? d.sets.map(e => ({ rows: [], label: (e.chars || []).join(''), ...d.boards.find(b => b.set === e.set), set: e.set, name: e.name }))
      : [...d.boards].sort((a, b) => order(a) - order(b));
    const boards = list.map(b => {
      if (!b.rows.length) return `<section class="mn-bd"><h4>${esc(this.label(nameOf(b)))}</h4><ol><li class="gap">Noch niemand. Du kannst die erste Runde spielen!</li></ol></section>`;
      const mine = b.rows.findIndex(r => r.player === me);
      const rows = b.rows.slice(0, 10).map((r, i) => row(r, i, b.rows)).join('') + (mine >= 10 ? '<li class="gap">…</li>' + row(b.rows[mine], mine, b.rows) : '');
      return `<section class="mn-bd"><h4>${esc(this.label(nameOf(b)))}</h4><ol>${rows}</ol></section>`;
    }).join('');
    const players = !admin ? '' : '<section class="mn-bd mn-players"><h4>Mitspieler</h4><div class="mn-who">' + d.players.map(p =>
      p.id === me ? `<span class="mn-tool mn-self">${esc(this.label(p.nick))} (du)</span>`
      : this.boardAsk === p.id ? `<span class="mn-ask">${esc(this.label(p.nick))} entfernen?</span><button type="button" class="mn-tool danger" data-kick-yes="${esc(p.id)}">Ja</button><button type="button" class="mn-tool" data-kick-no>Nein</button>`
      : `<button type="button" class="mn-tool" data-kick="${esc(p.id)}" title="Aus dem Raum entfernen">${esc(this.label(p.nick))} ✕</button>`).join('') + '</div></section>';
    $('m-board-list').innerHTML = (this.boardErr ? `<p class="mn-err">${esc(this.boardErr)}</p>` : '') +
      (boards || '<p class="mn-empty">Bei diesem Tempo hat im Raum noch niemand gespielt. Spiel eine Runde, dann stehst du hier!</p>') + players;
    $('m-board-admin').innerHTML = !admin ? ''
      : this.boardAsk === 'room' ? '<span class="mn-ask">Raum für alle löschen?</span><button type="button" class="mn-tool danger" data-del-room-yes>Ja, löschen</button><button type="button" class="mn-tool" data-del-room-no>Nein</button>'
      : '<button type="button" class="mn-tool danger" data-del-room>Raum löschen</button>';
  },
  async boardClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset, ask = (v, focus) => { this.boardAsk = v; this.boardErr = ''; this.renderBoard(); ($('m-board').querySelector(focus) || $('m-board-close')).focus(); };
    if (ds.bp) { this.boardStep(+ds.bp); return; }
    if ('kick' in ds) { ask(ds.kick, '[data-kick-no]'); return; }
    if ('delRoom' in ds) { ask('room', '[data-del-room-no]'); return; }
    if ('kickNo' in ds || 'delRoomNo' in ds) { ask(null, '#m-board-close'); return; }
    try {
      if ('kickYes' in ds) { await Room.kick(ds.kickYes); this.boardAsk = null; await this.loadBoard(); $('m-board-close').focus(); }
      if ('delRoomYes' in ds) {
        const code = Room.current.code;
        await Room.destroy();
        this.closeModal(true); this.roomMsg = `Raum <b class="mn-code">${esc(code)}</b> ist gelöscht.`; this.renderHome(); this.focusRoom('create');
      }
    } catch (err) { this.boardErr = roomError(err); ask(null, '#m-board-close'); }
  },

  // Admin: choose which key sets the room prescribes. Offers the presets, your own sets and any custom set the room already has.
  async openSets() {
    const cur = Room.sets, opts = Keys.PRESETS.map(p => ({ key: p.id, rec: p }));
    for (const s of this.sets) opts.push({ key: (await Room.setKey(s)).set, rec: s });
    for (const e of cur || []) if (e.chars && !opts.some(o => o.key === e.set)) opts.push({ key: e.set, rec: { name: e.name, chars: e.chars, types: e.types } });
    this.setOpts = opts.filter((o, i) => opts.findIndex(x => x.key === o.key) === i);
    $('m-sets-title').textContent = this.label('Tasten für Raum ' + Room.current.code);
    document.querySelector(`[name="m-sets-mode"][value="${cur ? 'some' : 'all'}"]`).checked = true;
    $('m-sets-list').innerHTML = this.setOpts.map((o, i) => {
      const keys = Keys.ordered([...o.rec.chars], this.layout), on = cur && cur.some(e => e.set === o.key);
      return `<label class="mn-opt"><input type="checkbox" data-i="${i}"${on ? ' checked' : ''}><span class="mn-opt-name">${esc(this.label(o.rec.name))}${o.rec.builtin ? '' : ' <small>(eigene)</small>'}</span>` +
        `<span class="mn-opt-keys">${esc(keys.length <= 14 ? keys.join(' ') : keys.length + ' Tasten')}</span></label>`;
    }).join('');
    $('m-sets-err').textContent = '';
    this.openModal('m-sets', 'm-sets-go');
  },
  async saveSets() {
    const all = document.querySelector('[name="m-sets-mode"][value="all"]').checked;
    const picked = [...$('m-sets-list').querySelectorAll('input:checked')].map(c => this.setOpts[+c.dataset.i].rec);
    if (!all && !picked.length) { $('m-sets-err').textContent = 'Wähle mindestens eine Tastenauswahl, oder erlaube alle.'; return; }
    if (!all && picked.length > 12) { $('m-sets-err').textContent = 'Höchstens 12 Tastenauswahlen gehen.'; return; }
    $('m-sets-go').disabled = true;
    try {
      await Room.setSets(all ? null : picked);
      this.roomMsg = all ? 'Gespeichert. Im Raum sind wieder alle Tasten erlaubt.' : 'Gespeichert. Alle im Raum sehen jetzt nur noch diese Tasten.';
      this.closeModal(true); this.renderHome(); this.focusRoom('sets');
    } catch (err) { Room.gone(err); $('m-sets-err').textContent = roomError(err); }
    $('m-sets-go').disabled = false;
  },

  // ---------- race: last one standing ----------
  // Everyone with this dialog open is in the lobby; the room's creator picks the keys and starts.
  // The game itself is started by the app when the race begins (see app.js).
  raceOpts: [],
  openRace() {
    Race.open();
    this.raceOpts = this.roomRecs() || [...Keys.PRESETS, ...this.sets];
    $('m-race-title').textContent = this.label('Wettrennen · Raum ' + Room.current.code);
    $('m-race-err').textContent = '';
    this.openModal('m-race', 'm-race-close');
    this.renderRace();
  },
  renderRace() {
    const m = Race.state, admin = Race.admin, me = Race.me, phase = m ? m.phase : 'lobby';
    const info = $('m-race-info'), list = $('m-race-list'), host = $('m-race-host'), act = $('m-race-act');
    if (!m) {
      info.textContent = Race.status === 'error' || Race.error ? 'Keine Verbindung zum Wettrennen. Versuch es gleich nochmal.' : 'Verbinde …';
      list.innerHTML = host.innerHTML = act.innerHTML = '';
      return;
    }
    const nick = p => esc(this.label(p.nick)) + (p.id === me ? ' (du)' : '');
    const keys = m.set ? (m.set.name || (Keys.PRESETS.find(p => p.id === m.set.set) || {}).name || '') : '';
    if (phase === 'lobby') {
      info.textContent = admin ? 'Alle, die dieses Fenster offen haben, sind dabei. Wähle die Tasten und starte das Rennen.'
        : 'Du bist dabei! Lass dieses Fenster offen. Das Rennen startet, wenn die Person, die den Raum erstellt hat, auf Los drückt.';
      list.innerHTML = `<section class="mn-bd"><h4>In der Lobby (${m.lobby.length})</h4><div class="mn-who">` +
        m.lobby.map(p => `<span class="mn-tool mn-self">${nick(p)}${p.admin ? ' ★' : ''}</span>`).join('') + '</div></section>';
    } else {
      const v = Race.view(), left = v.left;
      info.textContent = phase === 'run' ? `Das Rennen läuft (${this.label(keys)}): noch ${left} von ${v.total} dabei.`
        : m.winner ? `Das Rennen ist vorbei. ${this.label(m.players.find(p => p.id === m.winner).nick)} hat gewonnen!` : 'Das Rennen ist vorbei.';
      const t = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
      list.innerHTML = '<section class="mn-bd"><h4>Rangliste</h4><ol>' + m.players.slice().sort((a, b) => (a.status === 'in' ? 0 : a.place) - (b.status === 'in' ? 0 : b.place))
        .map(p => `<li class="${p.id === me ? 'me' : ''}"><span class="mn-rank">${p.status === 'in' ? '•' : p.place + '.'}</span><span class="mn-nick">${nick(p)}</span>` +
          `<span class="mn-score">${p.status === 'in' ? 'fährt noch' : p.status === 'won' ? '🏆 ' + t(p.time) : t(p.time)}</span></li>`).join('') + '</ol></section>';
    }
    // Host controls: keys, tempo (from the start menu) and whether the host plays too.
    const keep = $('m-race-set') ? { set: $('m-race-set').value, play: $('m-race-play').checked } : null;
    if (admin && phase !== 'run') {
      const play = keep ? keep.play : store.get('td-race-play', true), cur = keep ? keep.set : store.get('td-race-set', store.get('td-last', 'p-home1'));
      host.innerHTML = `<label class="mn-race-field">Tasten <select id="m-race-set">${this.raceOpts.map(s => `<option value="${esc(s.id)}"${s.id === cur ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` +
        `<span class="mn-race-field">Tempo: ${esc(this.label(PACES[this.pace - 1].name))} <small>(im Startmenü einstellbar)</small></span>` +
        `<label class="mn-race-field"><input type="checkbox" id="m-race-play"${play ? ' checked' : ''}> Ich spiele selbst mit</label>`;
    } else host.innerHTML = '';
    act.innerHTML = !admin ? '' : phase === 'run' ? '<button type="button" class="mn-tool danger" data-race="stop">Rennen abbrechen</button>'
      : `<button type="button" class="mn-btn mn-go" data-race="go">${phase === 'done' ? 'Neues Rennen' : 'Los!'}</button>`;
  },
  raceClick(e) {
    const b = e.target.closest('[data-race]');
    if (!b) return;
    if (b.dataset.race === 'stop') { Race.stop(); return; }
    const sel = this.raceOpts.find(s => s.id === $('m-race-set').value), play = $('m-race-play').checked, m = Race.state;
    const racers = m.lobby.filter(p => play || !p.admin).length;
    if (!sel) return;
    if (!racers) { $('m-race-err').textContent = 'Noch niemand in der Lobby. Gib den anderen den Raum-Code, und sie sollen auf „Wettrennen“ drücken.'; return; }
    $('m-race-err').textContent = '';
    store.set('td-race-set', sel.id); store.set('td-race-play', play);
    Race.start(sel, this.pace, play);
  },

  // ---------- editor ----------
  openEditor(rec, copy = false) {
    this.record = rec && !copy ? rec : null;
    this.nameHint = rec ? (copy ? rec.name + ' (eigene)' : rec.name) : '';
    this.sel = new Set(rec ? rec.chars : []);
    this.types = { letters: true, syl: true, words: true, ...(rec && rec.types) };
    this.base = typesKey(this.sel, this.types);
    this.sticky = false; this.held = false;
    for (const c of document.querySelectorAll('#m-edit [data-type]')) c.checked = !!this.types[c.dataset.type];
    this.title = this.record ? this.record.name : copy ? rec.name + ' anpassen' : 'Neue Auswahl';
    this.show('edit');
  },
  layer() { return this.held !== this.sticky ? 1 : 0; },
  renderEditor() {
    const L = Keys.LAYOUTS[this.layout], layer = this.layer();
    $('m-edit-title').textContent = this.label(this.title);
    const shift = [...this.sel].some(c => { const w = L.where.get(c); return w && w.layer === 1; });
    $('m-kb').innerHTML = L.keys.map(key => {
      const pos = `grid-area:${key.row + 1} / ${key.col} / span ${key.tall ? 2 : 1} / span ${key.span}`;
      if (key.fn) {
        if (!key.shift) return `<span class="k fn" style="${pos}">${esc(key.label)}</span>`;
        return `<button type="button" tabindex="-1" class="k fn shift${layer ? ' lit' : ''}" style="${pos}" data-code="${key.code}" aria-pressed="${!!layer}" title="Umschalten: große Buchstaben und Zeichen">${esc(key.label)}${shift ? '<span class="need">an</span>' : ''}</button>`;
      }
      const main = key.ch[layer], alt = key.ch[1 - layer], dead = key.dead && key.dead[layer], deadAlt = key.dead && key.dead[1 - layer];
      const on = !dead && this.sel.has(main), altOn = !deadAlt && this.sel.has(alt);
      return `<button type="button" tabindex="-1" class="k${on ? ' on' : ''}${altOn ? ' alt-on' : ''}${dead ? ' dead' : ''}${key.bump ? ' bump' : ''}" style="${pos}" data-code="${key.code}"` +
        ` aria-pressed="${on}" aria-label="${esc(main)}"${dead ? ' title="Tottaste: geht nur zusammen mit der nächsten Taste"' : ''}>` +
        `<span class="km">${esc(main)}</span>${alt !== main ? `<span class="ka">${esc(alt)}</span>` : ''}</button>`;
    }).join('');
    for (const b of document.querySelectorAll('#m-edit [data-layer]')) b.setAttribute('aria-pressed', String(+b.dataset.layer === layer));
    for (const b of document.querySelectorAll('#m-edit [data-layout]')) b.setAttribute('aria-pressed', String(b.dataset.layout === this.layout));
    $('m-kb').classList.toggle('upper', !!layer);
    this.renderInfo();
  },
  renderInfo() {
    const L = Keys.LAYOUTS[this.layout], chars = Keys.ordered([...this.sel], this.layout);
    $('m-count').textContent = chars.length === 1 ? '1 Taste an' : `${chars.length} Tasten an`;
    $('m-chips').innerHTML = chars.length
      ? chars.map(c => `<button type="button" class="mn-chip${L.where.has(c) ? '' : ' extra'}" data-ch="${esc(c)}" title="${esc(c)} ausschalten">${esc(c)}</button>`).join('')
      : '<span class="mn-empty">Noch keine Taste an. Tippe einfach los!</span>';
    const words = Keys.wordsFor(this.sel), wbox = document.querySelector('#m-edit [data-type="words"]');
    wbox.disabled = words.length < 3; wbox.closest('label').title = wbox.disabled ? 'Mit diesen Tasten gibt es zu wenige Wörter' : '';
    const sorted = words.sort((a, b) => a.length - b.length || a.localeCompare(b, 'de')), step = Math.max(1, Math.floor(sorted.length / 10));
    const sample = sorted.filter((_, i) => i % step === 0).slice(0, 10);
    $('m-words').innerHTML = !chars.length ? ''
      : words.length >= 3 ? `<b>${words.length} Wörter</b> passen, zum Beispiel: ${sample.map(esc).join(' · ')}`
      : 'Mit diesen Tasten gibt es kaum Wörter. Es fallen Buchstaben und Silben.';
    const lows = [...this.sel].filter(c => c !== c.toUpperCase() && c.toUpperCase().length === 1 && L.where.has(c.toUpperCase()));
    const allUp = lows.length && lows.every(c => this.sel.has(c.toUpperCase()));
    $('m-upper').textContent = this.label(allUp ? 'Großbuchstaben weg' : 'Großbuchstaben dazu');
    $('m-upper').disabled = !lows.length;
    $('m-done').disabled = !chars.length;
    $('m-caps').hidden = !this.caps;
  },
  keyEl(c) { const w = Keys.LAYOUTS[this.layout].where.get(c); return w && $('m-kb').querySelector(`[data-code="${w.key.code}"]`); },
  toggle(c) {
    if (this.sel.has(c)) this.sel.delete(c); else this.sel.add(c);
    this.renderEditor();
    press(this.keyEl(c) || $('m-chips').querySelector(`[data-ch="${CSS.escape(c)}"]`));
  },
  toggleUpper() {
    const L = Keys.LAYOUTS[this.layout];
    const lows = [...this.sel].filter(c => c !== c.toUpperCase() && c.toUpperCase().length === 1 && L.where.has(c.toUpperCase()));
    const allUp = lows.every(c => this.sel.has(c.toUpperCase()));
    for (const c of lows) if (allUp) this.sel.delete(c.toUpperCase()); else this.sel.add(c.toUpperCase());
    if (!allUp) this.sticky = true; // show what was just switched on
    this.renderEditor();
  },
  kbClick(e) {
    const b = e.target.closest('button.k');
    if (!b) return;
    const key = Keys.LAYOUTS[this.layout].keys.find(k => k.code === b.dataset.code);
    if (key.shift) { this.sticky = !this.sticky; this.renderEditor(); return; }
    const layer = this.layer();
    if (key.dead && key.dead[layer]) { nope(b); return; }
    this.toggle(key.ch[layer]);
  },
  dirty() { return typesKey(this.sel, this.types) !== this.base; },
  back() { if (this.dirty() && this.sel.size) this.openModal('m-discard', 'm-discard-no'); else this.show('home'); },
  done() {
    if (!this.sel.size) { nope($('m-chips')); return; }
    $('m-name-input').value = this.nameHint || '';
    this.openModal('m-name', 'm-name-input');
    $('m-name-input').select();
  },
  async save() {
    const name = $('m-name-input').value.trim();
    if (!name) { nope($('m-name-input')); $('m-name-input').focus(); return; }
    const now = Date.now(), rec = {
      id: this.record ? this.record.id : 'u-' + now.toString(36),
      name, chars: Keys.ordered([...this.sel], this.layout), types: { ...this.types }, layout: this.layout,
      created: this.record ? this.record.created : now, updated: now
    };
    await DB.put('sets', rec);
    const i = this.sets.findIndex(s => s.id === rec.id);
    if (i >= 0) this.sets[i] = rec; else this.sets.push(rec);
    this.fresh = rec.id;
    this.closeModal(true);
    this.show('home');
  },
  modal: null,
  openModal(id, focus) { this.modal = id; $(id).hidden = false; $(focus).focus(); },
  closeModal(quiet, keepRace) {
    for (const id of ['m-name', 'm-discard', 'm-join', 'm-board', 'm-sets', 'm-race']) $(id).hidden = true;
    const was = this.modal; this.modal = null;
    if (was === 'm-race' && !keepRace) Race.close();
    const back = { 'm-join': 'join', 'm-board': 'board', 'm-sets': 'sets', 'm-race': 'race' }[was];
    if (was && !quiet) { if (back) this.focusRoom(back); else $('menu').focus(); }
  },

  // ---------- keys ----------
  keydown(e) {
    if (e.getModifierState) { const caps = e.getModifierState('CapsLock'); if (caps !== this.caps) { this.caps = caps; if (this.screen === 'edit') $('m-caps').hidden = !caps; } }
    if (this.modal) {
      if (e.key === 'Escape') { e.preventDefault(); this.closeModal(); }
      else if (this.modal === 'm-board' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); this.boardStep(e.key === 'ArrowRight' ? 1 : -1); }
      return;
    }
    if (this.screen === 'home') {
      if (e.key === 'Escape') { e.preventDefault(); return 'close'; }
      if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); this.refocus(false); document.activeElement?.click?.(); }
      // Arrow keys change the tempo from anywhere on the home screen (the slider handles its own).
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target !== $('m-pace')) { e.preventDefault(); this.setPace(this.pace + (e.key === 'ArrowRight' ? 1 : -1)); }
      return;
    }
    // editor
    if (e.key === 'Escape') { e.preventDefault(); this.back(); return; }
    if (e.key === 'Shift') { if (!this.held) { this.held = true; this.renderEditor(); } return; }
    const onButton = e.target.closest && e.target.closest('button:not(.k), input, label');
    if (e.key === 'Enter') { if (!onButton) { e.preventDefault(); this.done(); } return; }
    if (e.key === 'Tab' || e.metaKey || (e.ctrlKey && !(e.getModifierState && e.getModifierState('AltGraph')))) return;
    if (e.key === 'Dead') { e.preventDefault(); nope($('m-kb').querySelector(`[data-code="${e.code}"]`)); return; }
    if (e.key.length !== 1) return;
    if (e.key === ' ') { if (!onButton) { e.preventDefault(); nope($('m-kb').querySelector('.k.fn:last-child')); } return; }
    e.preventDefault();
    if (!e.repeat) this.toggle(e.key);
  },
  keyup(e) { if (e.key === 'Shift' && this.held && this.screen === 'edit') { this.held = false; this.renderEditor(); } }
};

TD.Menu = M;
})();
