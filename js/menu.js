/* Start menu and key picker, drawn in the look of the active style (CSS tokens per [data-look]).
   Home: pick a tempo and a key set (presets and your own). Editor: type keys to switch them on or off on an on-screen keyboard;
   holding Shift (or clicking it) shows the shifted layer, so capitals and signs like ! § $ % & get their own switch. */
(() => {
'use strict';
const { Keys, DB, store } = TD;
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
  find(id) { return Keys.PRESETS.find(p => p.id === id) || this.sets.find(s => s.id === id); },
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
    // Speed over hits: every line starts low and ends at the same top speed, slower tempos just get there later.
    // The engine reaches full speed after about 52 hits at rate 1; the x axis shows 0 to 220 hits.
    const top = 18, low = 64, lines = TD.PACE.map((r, i) => {
      const x = 4 + (Math.min(220, 52 / r) * 192) / 220;
      return `<polyline class="${i + 1 === this.pace ? 'cur' : ''}" points="4,${low} ${x.toFixed(1)},${top} 196,${top}"/>`;
    });
    const cur = lines.splice(this.pace - 1, 1);
    $('m-graph').innerHTML = `<text x="4" y="11">Vollgas</text><text x="196" y="82" text-anchor="end">Treffer →</text>` +
      `<text x="4" y="82">Start</text>${lines.join('')}${cur}`;
  },

  get visible() { return !$('menu').hidden; },
  get editing() { return this.visible && this.screen === 'edit'; },
  show(screen = 'home') {
    $('menu').hidden = false;
    this.screen = screen;
    $('m-home').hidden = screen !== 'home'; $('m-edit').hidden = screen !== 'edit';
    this.closeModal(true);
    this.render();
    $('menu').scrollTop = 0;
    this.refocus(!this.fresh);
    this.onScreen?.(screen);
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
    const tools = s.builtin
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
    $('m-presets').innerHTML = Keys.PRESETS.map(p => this.card(p, last)).join('');
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
  closeModal(quiet) {
    for (const id of ['m-name', 'm-discard']) $(id).hidden = true;
    const was = this.modal; this.modal = null;
    if (was && !quiet) $('menu').focus();
  },

  // ---------- keys ----------
  keydown(e) {
    if (e.getModifierState) { const caps = e.getModifierState('CapsLock'); if (caps !== this.caps) { this.caps = caps; if (this.screen === 'edit') $('m-caps').hidden = !caps; } }
    if (this.modal) { if (e.key === 'Escape') { e.preventDefault(); this.closeModal(); } return; }
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
