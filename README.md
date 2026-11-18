# Type Defender

A free 10-finger typing game for kids. Bombs carrying letters, syllables or words fall on a city; typing the text fires the cannon and shoots them down.

**Play now: https://timoschoenberger.github.io/type-defender/**

No account, no ads, no tracking. Works in any modern browser, can be installed as an app, and keeps working offline.

> **Deutsch:** Type Defender ist ein kostenloses Tippspiel für Kinder, die das 10-Finger-Schreiben lernen. Es läuft direkt im Browser, lässt sich als App installieren und funktioniert auch offline. Schulen, Lehrkräfte und Familien dürfen es frei nutzen. Alle Daten (eigene Tastenauswahlen und Rekorde) bleiben auf dem Gerät.

## How it plays

- Pick a style, a tempo and a key set (presets follow the German home-row progression, or build your own on the on-screen keyboard).
- The first key locks the cannon onto the lowest bomb that starts with it. Backspace lets go.
- A wrong key jams the cannon for a moment. Twelve correct keys in a row earn a power-up: laser, shield or multishot.
- The run ends when the first bomb hits the city.
- Every tempo starts at the same speed and tops out at the same speed. Slower tempos take more hits to get there, so younger kids and fast adults can play the same game.

There are six styles (Neon, Pixel, Doodle, Paper, Comic, Deep Sea), each with its own art, sounds and live-synthesised music. You can switch styles at any time, even mid-game.

A physical keyboard is needed. On tablets a Bluetooth keyboard works. Both German QWERTZ and English QWERTY layouts are supported.

## Install as an app

- **Chrome, Edge (Windows, macOS, Linux, Chromebook):** open the game and click the install icon in the address bar.
- **Safari on iPad / Mac:** Share → *Add to Home Screen* (iPad) or File → *Add to Dock* (Mac).

The installed app starts full screen and works without an internet connection.

## Privacy

Type Defender has no server. Custom key sets and records are stored in the browser (IndexedDB) and never leave the device. There are no cookies, no analytics and no third-party requests; fonts are bundled with the app. The site is hosted on GitHub Pages, so GitHub receives the usual request data (such as IP addresses) when the files are loaded; see the [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Development

Plain HTML, CSS and JavaScript. There is no build step and there are no dependencies, so there is nothing to install or keep updated.

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
| `js/engine.js` | Game rules, timing, input, power-ups and the shared HUD, drawn on a logical 960×600 stage. Difficulty ramps read `heat()` = hits × tempo factor (`PACE`). |
| `js/s-*.js` | The six art styles: drawing code, sounds and song for each. |
| `js/music.js` | Step sequencer that synthesises each style's song live. It gets busier as a run heats up and adds a layer during power-ups. |
| `js/keys.js` | QWERTZ and QWERTY layouts, preset key sets, the German word list, and the code that turns a key selection into letters, syllables and words. |
| `js/db.js` | Browser storage for custom key sets and records (IndexedDB, with a localStorage fallback). |
| `js/menu.js` | Start menu (tempo slider, key sets, records per set and tempo) and the on-screen keyboard editor. |
| `js/app.js` | Wiring: style picker, menu, game, keyboard routing, music and the service worker. |
| `sw.js` | Offline support. Network first, cache as the fallback, so updates arrive on the next load. |
| `manifest.webmanifest`, `icons/` | Install metadata and app icons. |
| `fonts/` | Self-hosted fonts (SIL Open Font License). |

Ideas and bug reports are welcome as issues. Pull requests are welcome too; by contributing you agree that your contribution is published under the same license.

## License

Type Defender is free for any **noncommercial** use under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Schools, universities, charities and public institutions may use it regardless of how they are funded. You may share and modify it, but you may not sell it or use it to make money.

Because it restricts commercial use, this is a *source-available* license rather than an OSI-approved open-source license.

The bundled fonts are © their authors and licensed under the SIL Open Font License 1.1; see [fonts/LICENSE.md](fonts/LICENSE.md).
