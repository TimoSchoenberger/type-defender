/* Races ("last one standing") in a class or family room, over a WebSocket to the room's Match (server/worker.js).
   The server only keeps the lobby and who is out when; every device plays the race itself from the shared seed. */
(() => {
'use strict';
const { store, Room } = TD;
const API = String(store.get('td-api', '') || window.TD_API || '').replace(/\/+$/, '');
const STOP = ['no-player', 'no-room'];

const Race = {
  enabled: !!API,
  ws: null, want: false, state: null, me: null, admin: false, offset: 0, status: 'off', error: '', subs: new Set(),

  // Open the room's race connection (and keep it open, reconnecting after a dropped Wi-Fi) until close().
  open() {
    this.want = true;
    if (this.ws || !Room.current) return;
    const r = Room.current;
    let ws;
    try { ws = this.ws = new WebSocket(API.replace(/^http/, 'ws') + `/api/rooms/${r.code}/race`); }
    catch (err) { this.ws = null; this.set('error', 'offline'); return; }
    this.set(this.status === 'open' ? 'open' : 'connecting');
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', auth: Room.auth(), admin: r.admin || undefined }));
      clearInterval(this.ping);
      this.ping = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 4000);
    };
    ws.onmessage = e => {
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.now) this.offset = m.now - Date.now();
      if (m.t === 'error') { this.error = m.e; if (STOP.includes(m.e)) { this.want = false; Room.gone({ code: m.e }); } }
      if (m.t === 'state') { this.state = m.m; this.me = m.you; this.admin = !!m.admin; this.error = ''; this.set('open'); }
      else this.emit();
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.ws === ws) this.ws = null;
      if (this.want) { this.set(this.error ? 'error' : 'connecting'); setTimeout(() => { if (this.want && !this.ws) this.open(); }, 2000); }
      else this.set('off');
    };
  },
  close() { this.want = false; this.state = null; if (this.ws) this.ws.close(); this.ws = null; this.set('off'); },
  set(status) { this.status = status; this.emit(); },
  emit() { for (const f of this.subs) f(this); },
  on(f) { this.subs.add(f); },
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); },
  // Milliseconds on the server's clock, so every device counts down to the same start.
  now() { return Date.now() + this.offset; },

  start(sel, pace, play) { this.send({ t: 'start', set: sel.builtin ? { set: sel.id } : { name: sel.name, chars: sel.chars, types: sel.types }, pace, play }); },
  stop() { this.send({ t: 'stop' }); },
  out(score) { this.send({ t: 'out', score }); },

  // The racer record of this device, if it takes part in the current race.
  get mine() { return this.state && this.state.players.find(p => p.id === this.me) || null; },
  // Standings for the game's overlay: still racing first, then everyone else by place (best first).
  view() {
    const m = this.state;
    if (!m) return null;
    const rank = p => (p.status === 'in' ? 0 : p.place);
    const rows = m.players.map(p => ({ nick: p.nick, status: p.status, place: p.status === 'in' ? 0 : p.place, time: p.time, me: p.id === this.me }))
      .sort((a, b) => rank(a) - rank(b) || a.nick.localeCompare(b.nick, 'de'));
    return { total: m.players.length, left: m.players.filter(p => p.status === 'in').length, done: m.phase === 'done', rows };
  }
};

TD.Race = Race;
})();
