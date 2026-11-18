# Type Defender server

A single Cloudflare Worker with a D1 (SQLite) database. It does two things:

- **Rooms:** class or family leaderboards. Someone creates a room and shares its code (such as `TIGER-482`); everyone who joins gets a generated nickname like "Blauer Fuchs" and their runs go onto the room's leaderboard.
- **Visitor counts:** the game reports one visit per device and day, one extra count when it runs as an installed app, and one per finished run. The server keeps only those daily totals.

The game works without the server. With no address in `js/config.js`, rooms and counts are simply turned off.

## Privacy by design

- Kids never type names. Nicknames are generated, and custom key sets are shown by their keys rather than their names.
- No emails, IP addresses, cookies or device ids are stored. Player and admin tokens are stored only as SHA-256 hashes.
- A room's leaderboard is only visible to its members. Its creator can remove players or delete the room.
- Rooms with no joins or runs for 90 days are deleted automatically (daily cron at 03:17 UTC), along with their players and scores. Visitor counts are kept for 400 days.

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

Then put the printed address into `js/config.js` (`window.TD_API = 'https://…'`) and push.

To see the visitor counts, open `stats.html` on the site (for example https://timoschoenberger.github.io/type-defender/stats.html) and enter the `STATS_KEY`.

If the game is served from another address, add it to `ORIGINS` in `wrangler.toml` and deploy again.

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
| `GET /rooms/:code` | Room exists? Returns `{ code, players, created }`. |
| `DELETE /rooms/:code` | Delete the room (admin). |
| `POST /rooms/:code/join` | Join. Returns `{ player, token, nick }`. |
| `POST /rooms/:code/rename` | New generated nickname (player). |
| `POST /rooms/:code/leave` | Leave and delete your scores (player). |
| `DELETE /rooms/:code/players/:id` | Remove a player (admin). |
| `POST /rooms/:code/scores` | `{ set, label, pace, score }`. Keeps the best per player, set and tempo. Returns `{ best, rank, of }` (player). |
| `GET /rooms/:code/scores?pace=3` | All leaderboards of one tempo, plus the player list (player). |
| `POST /hit` | `{ kind: "visit" \| "app" \| "game" }`. Adds one to today's count. |
| `GET /stats?days=90` | Daily counts and totals (`Authorization: Bearer <STATS_KEY>`). |
