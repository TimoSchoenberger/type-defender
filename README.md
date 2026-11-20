# Type Defender

A free 10-finger typing game for kids. Bombs carrying letters, syllables or words fall on a city; typing the text fires the cannon and shoots them down.

**Play now: https://timoschoenberger.github.io/type-defender/**

No account, no ads, no tracking. Works in any modern browser, can be installed as an app, and keeps working offline.

> **Deutsch:** Type Defender ist ein kostenloses Tippspiel für Kinder, die das 10-Finger-Schreiben lernen. Es läuft direkt im Browser, lässt sich als App installieren und funktioniert auch offline. Schulen, Lehrkräfte und Familien dürfen es frei nutzen. Alle Daten (eigene Tastenauswahlen und Rekorde) bleiben auf dem Gerät.

## How it plays

- Pick a style, a tempo and a key set (presets follow the German home-row progression, or build your own on the on-screen keyboard).
- The first key locks the cannon onto the lowest bomb that starts with it. Backspace lets go.
- A wrong key jams the cannon for a moment. Twelve correct keys in a row earn a power-up: laser, shield or multishot.
- The run ends when the first bomb hits the city. Esc pauses; Enter continues after a 3-2-1 countdown.
- The game never stops getting harder: every few hits a new stage (*Stufe*) begins, with faster and more bombs and longer words. Each new stage shows its number big in the background; the *Stufen* button turns that off for players it distracts. Every tempo starts at the same speed and climbs the same ramp. Slower tempos take more hits per stage, so younger kids and fast adults can play the same game.
- **Class and family rooms:** create a room, share its code (such as `TIGER-482`) and compare records on a shared leaderboard. Everyone gets a generated nickname, so nobody has to type a name. A teacher can prescribe which key sets everyone in the room practises.
- **Races (last one standing):** in a room, everyone opens *Wettrennen*, the room's creator picks the keys and starts. All devices get the same bombs and the same rising difficulty; a list shows who is still in and who is out after how long. The last one left wins.
- A single capital letter gets a small ⇧ arrow, so C and c, O and o or I and l can be told apart.

There are six styles (Neon, Pixel, Doodle, Paper, Comic, Deep Sea), each with its own art, sounds and live-synthesised music. You can switch styles at any time, even mid-game.

A physical keyboard is needed. On tablets a Bluetooth keyboard works. Both German QWERTZ and English QWERTY layouts are supported.

## Install as an app

- **Chrome, Edge (Windows, macOS, Linux, Chromebook):** open the game and click the install icon in the address bar.
- **Safari on iPad / Mac:** Share → *Add to Home Screen* (iPad) or File → *Add to Dock* (Mac).

The installed app starts full screen and works without an internet connection. On Android, Esc on a hardware keyboard counts as the Back key; the game catches it, so Esc (or a Back gesture) pauses instead of closing the app. While a game runs, the playing field fills the whole screen; the buttons and help line only come back during a pause or after the game. On screens taller than 16:10 (such as a 4:3 iPad), the sky and ground stretch to the edges.

## Privacy

- Custom key sets and personal records are stored in the browser (IndexedDB). There are no cookies, no ads and no third-party trackers, and fonts are bundled with the app.
- The game counts visits anonymously: one count per device and day, plus one per finished run. Only the daily totals are stored, with nothing about who played.
- Class and family rooms store generated nicknames and scores, and only for players who join a room. Races keep only the current race (who is in, who is out and when) and store no results. Rooms nobody opens or plays in for 90 days are deleted. [server/README.md](server/README.md) has the details.
- The site is hosted on GitHub Pages and the server runs on Cloudflare Workers. Both receive the usual request data, such as IP addresses, when the game loads or talks to the server. See the [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) and [Cloudflare](https://www.cloudflare.com/privacypolicy/) privacy policies.

## Development

Plain HTML, CSS and JavaScript. There is no build step and there are no dependencies, so there is nothing to install or keep updated. The optional server in `server/` is a single Cloudflare Worker without npm dependencies.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Any static file server works. Pushing to `main` publishes the site through GitHub Pages.

| Path | What it does |
| --- | --- |
| `index.html` | The page: top bar, style picker, start menu and key editor markup, game canvas. |
| `css/app.css` | App shell and style picker. |
| `css/menu.css` | Start menu and key editor. One layout; each style's look is a set of CSS tokens under `.mn[data-look=…]`. |
| `js/engine.js` | Game rules, timing, input, power-ups and the shared HUD, drawn on a logical 960×600 stage. Difficulty ramps read `heat()` = hits × tempo factor (`PACE`); past `RAMP` they keep rising without a cap. |
| `js/s-*.js` | The six art styles: drawing code, sounds and song for each. |
| `js/music.js` | Step sequencer that synthesises each style's song live. It gets busier as a run heats up and adds a layer during power-ups. |
| `js/keys.js` | QWERTZ and QWERTY layouts, preset key sets, the German word list, and the code that turns a key selection into letters, syllables and words. |
| `js/db.js` | Browser storage for custom key sets and records (IndexedDB, with a localStorage fallback). |
| `js/menu.js` | Start menu (tempo slider, room panel and leaderboard, key sets, records per set and tempo) and the on-screen keyboard editor. |
| `js/room.js` | Client for class and family rooms and the anonymous visit count. Scores played offline are queued and sent later. |
| `js/race.js` | Client for races: the WebSocket to the room's race, the shared clock and the standings. |
| `js/config.js` | The server address. Leave it empty to turn rooms and counting off. |
| `js/app.js` | Wiring: style picker, menu, game, keyboard routing, music and the service worker. |
| `sw.js` | Offline support. Network first, cache as the fallback, so updates arrive on the next load. |
| `manifest.webmanifest`, `icons/` | Install metadata and app icons. |
| `fonts/` | Self-hosted fonts (SIL Open Font License). |
| `stats.html` | Visitor counts for the maintainer (needs the server's `STATS_KEY`). |
| `server/` | Cloudflare Worker and database schema for rooms and counts. See [server/README.md](server/README.md). |

Ideas and bug reports are welcome as issues. Pull requests are welcome too; by contributing you agree that your contribution is published under the same license.

## License

Type Defender is free for any **noncommercial** use under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Schools, universities, charities and public institutions may use it regardless of how they are funded. You may share and modify it, but you may not sell it or use it to make money.

Because it restricts commercial use, this is a *source-available* license rather than an OSI-approved open-source license.

The bundled fonts are © their authors and licensed under the SIL Open Font License 1.1; see [fonts/LICENSE.md](fonts/LICENSE.md).
