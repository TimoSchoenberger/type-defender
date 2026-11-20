/* Type Defender API: class or family rooms with shared leaderboards, plus anonymous visitor counts.
   Kids never type names: each player gets a generated nickname, and custom key sets are shown by their keys.
   Secrets (player and admin tokens) are only stored as SHA-256 hashes. */

const DAY = 86400000;
const IDLE_DAYS = 90;          // rooms nobody opens or plays in for this long are deleted
const TOUCH_GAP = 3600000;     // opening a room counts as use, but writes that down at most once an hour
const KEEP_VISIT_DAYS = 400;
// Hard caps bound the database size whatever happens (about 3,000 rooms × 60 players × 20 boards at most),
// and per-IP rate limits (wrangler.toml) keep one visitor from using up the free tier's daily writes.
const MAX_PLAYERS = 60;
const MAX_ROOMS = 3000;
const MAX_ROOMS_PER_DAY = 200;
const MAX_BOARDS = 20;         // distinct key set and tempo pairs per player
const MAX_SCORE = 5000000;
const SCORE_GAP = 4000;        // minimum time between two score posts from one player
const MAX_ROOM_SETS = 12;      // key sets a room's creator can prescribe

const ROOM_WORDS = ['TIGER', 'PANDA', 'KOALA', 'OTTER', 'ADLER', 'DACHS', 'HAI', 'WAL', 'LUCHS', 'IGEL', 'BIBER', 'ROBBE', 'ZEBRA', 'LAMA', 'EULE', 'GECKO', 'FALKE', 'MAUS', 'BIENE', 'KRAKE'];
// Adjective stems take -er/-e/-es to match the animal: Blauer Fuchs, Blaue Eule, Blaues Pferd.
const ADJ = ['Blau', 'Rot', 'Grün', 'Gelb', 'Flink', 'Mutig', 'Schlau', 'Wild', 'Leis', 'Lustig', 'Stark', 'Schnell', 'Klug', 'Fröhlich', 'Tapfer', 'Wach', 'Kühn', 'Munter', 'Sanft', 'Bunt', 'Golden', 'Fix', 'Heiter', 'Cool'];
const ANIMALS = [
  ['Fuchs', 'er'], ['Bär', 'er'], ['Wolf', 'er'], ['Tiger', 'er'], ['Panda', 'er'], ['Adler', 'er'], ['Dachs', 'er'], ['Hai', 'er'],
  ['Wal', 'er'], ['Luchs', 'er'], ['Igel', 'er'], ['Biber', 'er'], ['Gecko', 'er'], ['Falke', 'er'], ['Delfin', 'er'], ['Pinguin', 'er'],
  ['Eule', 'e'], ['Katze', 'e'], ['Robbe', 'e'], ['Biene', 'e'], ['Krake', 'e'], ['Maus', 'e'], ['Ente', 'e'], ['Giraffe', 'e'],
  ['Schildkröte', 'e'], ['Libelle', 'e'], ['Möwe', 'e'], ['Hummel', 'e'],
  ['Pferd', 'es'], ['Zebra', 'es'], ['Lama', 'es'], ['Känguru', 'es'], ['Erdmännchen', 'es'], ['Eichhörnchen', 'es'], ['Nashorn', 'es'], ['Faultier', 'es']
];

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = env.ORIGINS.split(',').map(s => s.trim()).includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } });
    }
    try {
      const res = await route(req, env, new URL(req.url));
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status, cors);
      console.error(err);
      return json({ error: 'server' }, 500, cors);
    }
  },
  async scheduled(_event, env) {
    const cutoff = Date.now() - IDLE_DAYS * DAY;
    const old = (await env.DB.prepare('SELECT code FROM rooms WHERE active < ?').bind(cutoff).all()).results;
    for (const r of old) await dropRoom(env, r.code);
    await env.DB.prepare('DELETE FROM visits WHERE day < ?').bind(dayOf(Date.now() - KEEP_VISIT_DAYS * DAY)).run();
  }
};

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const dayOf = t => new Date(t).toISOString().slice(0, 10);
const pickOne = list => list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];
const token = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hash(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function body(req) {
  if ((req.headers.get('Content-Length') | 0) > 4096) fail(413, 'too-large');
  try { return await req.json(); } catch { return {}; }
}
const bearer = req => (req.headers.get('Authorization') || '').replace(/^Bearer /, '');

// Cloudflare's rate limiter counts in memory per IP address; nothing about the visitor is stored.
// Limits are generous because a whole school class usually shares one address.
async function limit(env, name, req) {
  const rl = env[name];
  if (!rl) return;
  const { success } = await rl.limit({ key: req.headers.get('CF-Connecting-IP') || 'local' });
  if (!success) fail(429, 'slow-down');
}

async function route(req, env, url) {
  const p = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api', 'rooms', CODE, ...]
  const m = req.method;
  if (p[0] !== 'api') fail(404, 'not-found');
  await limit(env, m === 'GET' ? 'LIMIT_READ' : p[1] === 'hit' ? 'LIMIT_HIT' : p.length === 2 && p[1] === 'rooms' ? 'LIMIT_CREATE' : 'LIMIT_WRITE', req);
  if (p[1] === 'hit' && m === 'POST') return hit(req, env);
  if (p[1] === 'stats' && m === 'GET') return stats(req, env, url);
  if (p[1] !== 'rooms') fail(404, 'not-found');
  if (p.length === 2 && m === 'POST') return createRoom(env);
  const code = String(p[2] || '').toUpperCase();
  if (!/^[A-Z]{2,8}-\d{3}$/.test(code)) fail(404, 'no-room');
  const room = await env.DB.prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first();
  if (!room) fail(404, 'no-room');
  const tail = p.slice(3).join('/');
  if (tail === '' && m === 'GET') { await player(req, env, room); await touch(env, room); return roomInfo(env, room); } // members only
  if (tail === 'sets' && m === 'PUT') { await isAdmin(req, room); return putSets(req, env, room); }
  if (tail === '' && m === 'DELETE') { await isAdmin(req, room); await dropRoom(env, code); return json({ ok: true }); }
  if (tail === 'join' && m === 'POST') return join(env, room);
  if (tail === 'rename' && m === 'POST') return rename(env, room, await player(req, env, room));
  if (tail === 'leave' && m === 'POST') { const pl = await player(req, env, room); await dropPlayer(env, code, pl.id); return json({ ok: true }); }
  if (tail === 'scores' && m === 'POST') return postScore(req, env, room, await player(req, env, room));
  if (tail === 'scores' && m === 'GET') { await player(req, env, room); await touch(env, room); return board(env, room, url); } // members only
  if (p[3] === 'players' && p[4] && m === 'DELETE') { await isAdmin(req, room); await dropPlayer(env, code, p[4]); return json({ ok: true }); }
  fail(404, 'not-found');
}

// ---------- rooms and players ----------
async function createRoom(env) {
  const today = dayOf(Date.now());
  const made = await env.DB.prepare("SELECT n FROM visits WHERE day = ? AND kind = 'room'").bind(today).first();
  const all = await env.DB.prepare('SELECT COUNT(*) AS n FROM rooms').first();
  if ((made && made.n >= MAX_ROOMS_PER_DAY) || all.n >= MAX_ROOMS) fail(503, 'busy');
  for (let i = 0; i < 20; i++) {
    const code = pickOne(ROOM_WORDS) + '-' + String(100 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900));
    const admin = token(), now = Date.now();
    const r = await env.DB.prepare('INSERT OR IGNORE INTO rooms (code, admin, created, active) VALUES (?, ?, ?, ?)').bind(code, await hash(admin), now, now).run();
    if (r.meta.changes) {
      await count(env, 'room');
      return json({ code, admin }, 201);
    }
  }
  fail(503, 'busy');
}
async function roomInfo(env, room) {
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE room = ?').bind(room.code).first();
  return json({ code: room.code, players: n.n, created: room.created, expires: room.active + IDLE_DAYS * DAY, sets: roomSets(room) });
}
// Every join, run and visit by a member keeps the room alive for another IDLE_DAYS.
async function touch(env, room) {
  const now = Date.now();
  if (now - room.active < TOUCH_GAP) return;
  await env.DB.prepare('UPDATE rooms SET active = ? WHERE code = ?').bind(now, room.code).run();
  room.active = now;
}

// ---------- prescribed key sets ----------
// null means every key set counts. Otherwise a list of presets ({ set: 'p-home1' }) and custom sets
// ({ set: 'c-…', name, chars, types }); the server derives each custom key itself, exactly like js/room.js does.
const roomSets = room => (room.sets ? JSON.parse(room.sets) : null);
const customKey = async (chars, types) => 'c-' + (await hash([...chars].sort().join('') + '|' + ['letters', 'syl', 'words'].map(k => +(types[k] !== false)).join(''))).slice(0, 16);
async function putSets(req, env, room) {
  const b = await body(req);
  let sets = null;
  if (b.sets != null) {
    if (!Array.isArray(b.sets) || !b.sets.length || b.sets.length > MAX_ROOM_SETS) fail(400, 'bad-sets');
    sets = [];
    for (const e of b.sets) {
      if (e && /^p-[a-z0-9]{1,16}$/.test(e.set)) { sets.push({ set: e.set }); continue; }
      const chars = Array.isArray(e && e.chars) ? [...new Set(e.chars.map(String).filter(c => [...c].length === 1))] : [];
      const name = [...String((e && e.name) || '').trim()].slice(0, 24).join('');
      if (!chars.length || chars.length > 100 || !name) fail(400, 'bad-sets');
      const types = { letters: e.types?.letters !== false, syl: e.types?.syl !== false, words: e.types?.words !== false };
      sets.push({ set: await customKey(chars, types), name, chars, types });
    }
    sets = sets.filter((e, i) => sets.findIndex(x => x.set === e.set) === i);
  }
  await env.DB.prepare('UPDATE rooms SET sets = ?, active = ? WHERE code = ?').bind(sets && JSON.stringify(sets), Date.now(), room.code).run();
  return json({ sets });
}
async function freeNick(env, code) {
  const taken = new Set((await env.DB.prepare('SELECT nick FROM players WHERE room = ?').bind(code).all()).results.map(r => r.nick));
  for (let i = 0; i < 200; i++) {
    const [animal, end] = pickOne(ANIMALS), nick = pickOne(ADJ) + end + ' ' + animal;
    if (!taken.has(nick)) return nick;
  }
  fail(409, 'full');
}
async function join(env, room) {
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM players WHERE room = ?').bind(room.code).first();
  if (n.n >= MAX_PLAYERS) fail(409, 'full');
  const id = token().slice(0, 12), secret = token(), nick = await freeNick(env, room.code), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO players (id, room, nick, token, created) VALUES (?, ?, ?, ?, ?)').bind(id, room.code, nick, await hash(secret), now),
    env.DB.prepare('UPDATE rooms SET active = ? WHERE code = ?').bind(now, room.code)
  ]);
  return json({ code: room.code, player: id, token: secret, nick, expires: now + IDLE_DAYS * DAY, sets: roomSets(room) }, 201);
}
async function rename(env, room, pl) {
  const nick = await freeNick(env, room.code);
  await env.DB.prepare('UPDATE players SET nick = ? WHERE id = ?').bind(nick, pl.id).run();
  return json({ nick });
}
async function player(req, env, room) {
  const [id, secret] = bearer(req).split('.');
  const pl = id && secret ? await env.DB.prepare('SELECT * FROM players WHERE id = ? AND room = ?').bind(id, room.code).first() : null;
  if (!pl || pl.token !== await hash(secret)) fail(401, 'no-player');
  return pl;
}
async function isAdmin(req, room) { if (room.admin !== await hash(bearer(req))) fail(403, 'not-admin'); }
async function dropPlayer(env, code, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM scores WHERE room = ? AND player = ?').bind(code, id),
    env.DB.prepare('DELETE FROM players WHERE room = ? AND id = ?').bind(code, id)
  ]);
}
async function dropRoom(env, code) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM scores WHERE room = ?').bind(code),
    env.DB.prepare('DELETE FROM players WHERE room = ?').bind(code),
    env.DB.prepare('DELETE FROM rooms WHERE code = ?').bind(code)
  ]);
}

// ---------- scores ----------
async function postScore(req, env, room, pl) {
  const b = await body(req);
  const setkey = String(b.set || ''), pace = b.pace | 0, score = Math.floor(Number(b.score));
  if (!/^(p-[a-z0-9]{1,16}|c-[0-9a-f]{16})$/.test(setkey)) fail(400, 'bad-set');
  if (pace < 1 || pace > 5 || !(score > 0 && score <= MAX_SCORE)) fail(400, 'bad-score');
  const allowed = roomSets(room);
  if (allowed && !allowed.some(e => e.set === setkey)) fail(409, 'not-allowed');
  const label = setkey.startsWith('c-') ? [...String(b.label || '')].slice(0, 60).join('') : '';
  const now = Date.now();
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(setkey = ? AND pace = ?) AS here FROM scores WHERE room = ? AND player = ?').bind(setkey, pace, room.code, pl.id).first();
  if (!mine.here && mine.n >= MAX_BOARDS) fail(409, 'too-many-boards');
  const last = await env.DB.prepare('SELECT MAX(at) AS at FROM scores WHERE room = ? AND player = ?').bind(room.code, pl.id).first();
  if (last.at && now - last.at < SCORE_GAP) fail(429, 'slow-down');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO scores (room, player, setkey, label, pace, score, at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (room, player, setkey, pace) DO UPDATE SET score = MAX(score, excluded.score), label = excluded.label, at = excluded.at`)
      .bind(room.code, pl.id, setkey, label, pace, score, now),
    env.DB.prepare('UPDATE rooms SET active = ? WHERE code = ?').bind(now, room.code)
  ]);
  const best = await env.DB.prepare('SELECT score FROM scores WHERE room = ? AND player = ? AND setkey = ? AND pace = ?').bind(room.code, pl.id, setkey, pace).first();
  const rank = await env.DB.prepare('SELECT COUNT(*) + 1 AS rank FROM scores WHERE room = ? AND setkey = ? AND pace = ? AND score > ?').bind(room.code, setkey, pace, best.score).first();
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE room = ? AND setkey = ? AND pace = ?').bind(room.code, setkey, pace).first();
  return json({ best: best.score, rank: rank.rank, of: total.n });
}
// Every board of one tempo, best first. Rooms are small, so this is one query.
async function board(env, room, url) {
  const pace = Math.min(5, Math.max(1, Number(url.searchParams.get('pace')) | 0 || 3));
  const rows = (await env.DB.prepare(`SELECT s.setkey, s.label, s.score, s.player, p.nick FROM scores s JOIN players p ON p.id = s.player
    WHERE s.room = ? AND s.pace = ? ORDER BY s.setkey, s.score DESC LIMIT 2000`).bind(room.code, pace).all()).results;
  const sets = new Map();
  for (const r of rows) {
    if (!sets.has(r.setkey)) sets.set(r.setkey, { set: r.setkey, label: r.label, rows: [] });
    sets.get(r.setkey).rows.push({ player: r.player, nick: r.nick, score: r.score });
  }
  const players = (await env.DB.prepare('SELECT id, nick FROM players WHERE room = ? ORDER BY created').bind(room.code).all()).results;
  return json({ code: room.code, pace, boards: [...sets.values()], players, sets: roomSets(room) });
}

// ---------- visitor counts ----------
async function count(env, kind) {
  await env.DB.prepare('INSERT INTO visits (day, kind, n) VALUES (?, ?, 1) ON CONFLICT (day, kind) DO UPDATE SET n = n + 1').bind(dayOf(Date.now()), kind).run();
}
// The game sends one "visit" per device and day (and "app" when it runs installed) and one "game" per finished run.
// Nothing about the visitor is stored.
async function hit(req, env) {
  const b = await body(req);
  if (b.kind === 'visit' || b.kind === 'app' || b.kind === 'game') await count(env, b.kind);
  return new Response(null, { status: 204 });
}
async function stats(req, env, url) {
  if (!env.STATS_KEY || bearer(req) !== env.STATS_KEY) fail(401, 'no-key');
  const days = Math.min(400, Math.max(1, Number(url.searchParams.get('days')) | 0 || 90));
  const rows = (await env.DB.prepare('SELECT day, kind, n FROM visits WHERE day >= ? ORDER BY day').bind(dayOf(Date.now() - (days - 1) * DAY)).all()).results;
  const totals = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM rooms) AS rooms, (SELECT COUNT(*) FROM players) AS players').first();
  return json({ days: rows, ...totals });
}
