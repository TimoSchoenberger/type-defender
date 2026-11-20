# Type Defender server

A single Cloudflare Worker with a D1 (SQLite) database and one Durable Object class. It does three things:

- **Rooms:** class or family leaderboards. Someone creates a room and shares its code (such as `TIGER-482`); everyone who joins gets a generated nickname like "Blauer Fuchs" and their runs go onto the room's leaderboard.
- **Races (last one standing):** members of a room race live with the same bombs. Each room has one `Match` Durable Object that keeps the lobby and the race in memory and talks to the players over WebSockets.
- **Visitor counts:** the game reports one visit per device and day, one extra count when it runs as an installed app, and one per finished run. The server keeps only those daily totals.

The game works without the server. With no address in `js/config.js`, rooms and counts are simply turned off.

## Privacy by design

- Kids never type names. Nicknames are generated, and custom key sets are shown by their keys rather than their names.
- No emails, IP addresses, cookies or device ids are stored. Player and admin tokens are stored only as SHA-256 hashes.
- A room's leaderboard is only visible to its members. Its creator can remove players or delete the room.
- The creator can also prescribe the key sets everyone in the room practises: up to 12 presets or their own sets. Members then see only those cards, and the server accepts room scores only for them.
- Rooms nobody opens or plays in for 90 days are deleted automatically (daily cron at 03:17 UTC), along with their players and scores. Every join, run or visit by a member pushes that date back, and the creator sees it in the room panel. Visitor counts are kept for 400 days.

## Races

- Everyone who opens *Wettrennen* in the room joins the lobby. The room's creator picks the key set (and the tempo from the start menu), decides whether to play along, and starts.
- The `Match` sends the start time and a random seed. Every device builds the same content and the same bombs from the seed and counts down to the same moment; difficulty follows the shared clock instead of each player's hits, so everyone faces the same game.
- A device reports only "I'm out" (with its score). The `Match` notes the time and place and sends the standings to everyone. The last one left wins; racers out at the same moment share a place.
- A racer whose connection is gone or silent (no ping) for 12 seconds is out. Short Wi-Fi drops are forgiven, and the page reconnects on its own.
- Pings are answered by Cloudflare without waking the object (WebSocket hibernation), so an open lobby costs next to nothing. A race uses a few messages per player and no D1 writes; only the current race is kept, in the object's own storage.

## Abuse protection

On the free plan Cloudflare never bills. If a daily limit is used up, the server answers with errors until midnight UTC. The game itself keeps working; rooms and counts pause, and runs played meanwhile wait in the queue.

To keep that from happening:

- **Per-IP rate limits** (`wrangler.toml`, per 60 seconds): 4 new rooms, 90 other writes, 120 visit counts and 240 reads. Cloudflare counts these in memory, and IP addresses are never stored. The limits are generous because a whole school class usually shares one address.
- **Hard caps** bound the database size whatever happens:
  - 3,000 rooms in total, and 200 new rooms per day
  - 60 players per room
  - 20 leaderboards per player (key set and tempo pairs)
  - one score post every 4 seconds per player
  - request bodies of at most 4 KB

  The worst case is a few hundred megabytes, well under the free 5 GB.

An attack spread across many IP addresses could still use up the 100,000 daily writes. That only pauses rooms for the rest of the day, without data loss or cost.

## Setup

You need a Cloudflare account. The free plan is plenty: it includes 100,000 Worker requests and 100,000 database writes per day.

All commands run in this folder and use a pinned wrangler version through `npx`, so nothing needs to be installed permanently.

```sh
cd server
npx wrangler@4.157.0 login                                    # opens the browser once
npx wrangler@4.157.0 d1 create type-defender                  # prints a database_id
# put that database_id into wrangler.toml
npx wrangler@4.157.0 d1 execute type-defender --remote --file schema.sql
openssl rand -base64 24 | npx wrangler@4.157.0 secret put STATS_KEY   # keep a copy, the stats page asks for it
npx wrangler@4.157.0 deploy                                   # prints https://type-defender.<you>.workers.dev
```

The first deploy on a new account asks for a `workers.dev` subdomain; register one in the Cloudflare dashboard (Workers & Pages) and deploy again. A brand-new subdomain can take a few minutes until HTTPS works.

Then put the printed address into `js/config.js` (`window.TD_API = 'https://…'`) and push.

To see the visitor counts, open `stats.html` on the site (for example https://timoschoenberger.github.io/type-defender/stats.html) and enter the `STATS_KEY`.

If the game is served from another address, add it to `ORIGINS` in `wrangler.toml` and deploy again.

## Database changes

`schema.sql` always describes the current tables. A database created with an older version needs the files in `migrations/` that came after it, for example:

```sh
npx wrangler@4.157.0 d1 execute type-defender --remote --file migrations/0002-room-sets.sql
```

## Local development

```sh
cd server
echo 'STATS_KEY="dev-key"' > .dev.vars
npx wrangler@4.157.0 d1 execute type-defender --local --file schema.sql
npx wrangler@4.157.0 dev --port 8787
```

Serve the game on port 8000 (`python3 -m http.server 8000` in the repository root). Then point it at the local server by running this once in the browser console:

```js
localStorage.setItem('td-api', '"http://127.0.0.1:8787"')
```

Remove that entry again to go back to the address in `js/config.js`.

## API

All routes are under `/api`. Player requests send `Authorization: Bearer <player>.<token>`, and admin requests send `Authorization: Bearer <admin token>`.

| Route | What it does |
| --- | --- |
| `POST /rooms` | Create a room. Returns `{ code, admin }`. |
| `GET /rooms/:code` | Room settings for members. Returns `{ code, players, created, expires, sets }` (player). Counts as use of the room. |
| `PUT /rooms/:code/sets` | `{ sets: null }` allows every key set. `{ sets: [{ set: "p-home1" }, { name, chars, types }] }` prescribes up to 12 (admin). |
| `DELETE /rooms/:code` | Delete the room (admin). |
| `POST /rooms/:code/join` | Join. Returns `{ player, token, nick, expires, sets }`. |
| `POST /rooms/:code/rename` | New generated nickname (player). |
| `POST /rooms/:code/leave` | Leave and delete your scores (player). |
| `DELETE /rooms/:code/players/:id` | Remove a player (admin). |
| `POST /rooms/:code/scores` | `{ set, label, pace, score }`. Keeps the best per player, set and tempo; refuses sets the room doesn't prescribe. Returns `{ best, rank, of }` (player). |
| `GET /rooms/:code/scores?pace=3` | All leaderboards of one tempo, plus the player list (player). |
| `GET /rooms/:code/race` | WebSocket to the room's race. First message `{ t: "hello", auth: "<player>.<token>", admin? }`; then `start` (admin: `{ set, pace, play }`), `stop` (admin) and `out` (`{ score }`). The server answers with `{ t: "state", now, you, admin, m }` after every change. |
| `POST /hit` | `{ kind: "visit" \| "app" \| "game" }`. Adds one to today's count. |
| `GET /stats?days=90` | Daily counts and totals (`Authorization: Bearer <STATS_KEY>`). |
