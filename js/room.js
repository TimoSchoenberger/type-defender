/* Rooms: class or family leaderboards on the Type Defender server (server/worker.js), plus the anonymous daily visit count.
   All of it is optional. Without a server address (js/config.js) or without a connection, the game works as before;
   scores played offline wait in a queue and are sent later. */
(() => {
'use strict';
const { store } = TD;
// A td-api entry in localStorage points the game at another server, e.g. a local `wrangler dev`.
const API = String(store.get('td-api', '') || window.TD_API || '').replace(/\/+$/, '');

class ApiError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
// Bodies go out as text/plain so simple requests skip the CORS preflight; the server parses them as JSON anyway.
async function call(method, path, body, auth) {
  const headers = auth ? { Authorization: 'Bearer ' + auth } : {};
  let res;
  try { res = await fetch(API + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, keepalive: method === 'POST' }); }
  catch (err) { throw new ApiError('offline', 0); }
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'http-' + res.status, res.status);
  return data;
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// "tiger 482", "Tiger482" and "TIGER-482" all mean the same room.
// Scores the server will never take: drop them from the queue instead of retrying.
const DROP = ['bad-set', 'bad-score', 'too-many-boards', 'not-allowed'];
const normCode = s => { const m = String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]{2,8})(\d{3})$/); return m ? m[1] + '-' + m[2] : ''; };

const Room = {
  enabled: !!API,
  get current() { return store.get('td-room', null); },
  get isAdmin() { return !!(this.current && this.current.admin); },
  auth() { const r = this.current; return r && r.player + '.' + r.token; },
  normCode,

  async create() {
    const made = await call('POST', '/rooms');
    await this.join(made.code, made.admin);
    return this.current;
  },
  async join(input, admin) {
    const code = normCode(input);
    if (!code) throw new ApiError('no-room', 404);
    const r = await call('POST', `/rooms/${code}/join`);
    store.set('td-room', { code: r.code, player: r.player, token: r.token, nick: r.nick, sets: r.sets || null, expires: r.expires || 0, ...(admin ? { admin } : {}) });
    store.set('td-room-queue', []);
    return this.current;
  },
  // Key sets the room prescribes (null: every set counts). Cached, so they also apply offline.
  get sets() { const r = this.current; return (r && r.sets) || null; },
  // Fetch the room's current settings; opening the room also keeps it alive on the server.
  // Resolves true when the prescribed sets or the expiry date changed.
  async refresh() {
    const r = this.current;
    if (!r) return false;
    let info;
    try { info = await call('GET', `/rooms/${r.code}`, null, this.auth()); }
    catch (err) { this.gone(err); return err.code === 'no-room' || err.code === 'no-player'; }
    const now = this.current, sets = info.sets || null, expires = info.expires || 0;
    if (!now || (JSON.stringify(now.sets || null) === JSON.stringify(sets) && now.expires === expires)) return false;
    store.set('td-room', { ...now, sets, expires });
    return true;
  },
  // Admin: prescribe these key sets (menu records: presets or custom sets), or null for all.
  async setSets(list) {
    const r = this.current;
    const body = { sets: list && list.map(s => s.builtin ? { set: s.id } : { name: s.name, chars: s.chars, types: s.types }) };
    const res = await call('PUT', `/rooms/${r.code}/sets`, body, r.admin);
    store.set('td-room', { ...this.current, sets: res.sets || null });
    return res.sets;
  },
  async rename() {
    const r = this.current, res = await call('POST', `/rooms/${r.code}/rename`, null, this.auth());
    store.set('td-room', { ...r, nick: res.nick });
    return res.nick;
  },
  async leave() {
    const r = this.current;
    if (!r) return;
    try { await call('POST', `/rooms/${r.code}/leave`, null, this.auth()); } catch (err) { if (err.code === 'offline') throw err; }
    this.forget();
  },
  forget() { store.set('td-room', null); store.set('td-room-queue', []); },
  async destroy() { const r = this.current; await call('DELETE', `/rooms/${r.code}`, null, r.admin); this.forget(); },
  async kick(id) { const r = this.current; await call('DELETE', `/rooms/${r.code}/players/${encodeURIComponent(id)}`, null, r.admin); },
  async board(pace) {
    const r = this.current;
    try { return await call('GET', `/rooms/${r.code}/scores?pace=${pace}`, null, this.auth()); }
    catch (err) { this.gone(err); throw err; }
  },
  // The room was deleted or this player removed: drop the local membership.
  gone(err) { if (err.code === 'no-room' || err.code === 'no-player') this.forget(); },

  // Leaderboards compare the same key set: presets by id, custom sets by their keys and what falls.
  async setKey(sel) {
    if (sel.builtin) return { set: sel.id, label: '' };
    const chars = [...sel.chars].sort().join(''), t = sel.types || {};
    return { set: 'c-' + (await sha(chars + '|' + ['letters', 'syl', 'words'].map(k => +(t[k] !== false)).join(''))).slice(0, 16), label: sel.chars.join('') };
  },
  // Queue the score (keeping the best per board), then try to send everything. Resolves with the server's answer for this one.
  async submit(sel, pace, score) {
    if (!this.current || !score) return null;
    const { set, label } = await this.setKey(sel), code = this.current.code;
    const q = store.get('td-room-queue', []).filter(e => e.code === code);
    const same = q.find(e => e.set === set && e.pace === pace);
    if (same) same.score = Math.max(same.score, score); else q.push({ code, set, label, pace, score });
    store.set('td-room-queue', q);
    return (await this.flush()).find(r => r.set === set && r.pace === pace) || null;
  },
  async flush() {
    const out = [];
    if (!this.current) return out;
    for (const e of store.get('td-room-queue', [])) {
      try {
        const res = await call('POST', `/rooms/${e.code}/scores`, { set: e.set, label: e.label, pace: e.pace, score: e.score }, this.auth());
        out.push({ ...res, set: e.set, pace: e.pace });
        store.set('td-room-queue', store.get('td-room-queue', []).filter(x => !(x.set === e.set && x.pace === e.pace && x.score <= e.score)));
      } catch (err) {
        this.gone(err);
        if (err.code === 'slow-down') setTimeout(() => this.flush(), 5000);
        if (DROP.includes(err.code)) store.set('td-room-queue', store.get('td-room-queue', []).filter(x => !(x.set === e.set && x.pace === e.pace)));
        if (!DROP.includes(err.code)) break;
      }
    }
    return out;
  },

  // One "visit" per device and day, plus "app" when it runs installed. No id, no cookie: just a daily count.
  visit() {
    if (!API) return;
    const today = new Date().toISOString().slice(0, 10);
    if (store.get('td-hit-day', '') === today) return;
    store.set('td-hit-day', today);
    call('POST', '/hit', { kind: 'visit' }).catch(() => store.set('td-hit-day', ''));
    if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) call('POST', '/hit', { kind: 'app' }).catch(() => {});
  },
  game() { if (API) call('POST', '/hit', { kind: 'game' }).catch(() => {}); }
};

if (API) window.addEventListener('online', () => Room.flush());
TD.Room = Room;
})();
