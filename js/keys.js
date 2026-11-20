/* Keyboard layouts, preset key sets and the word list; turns a key selection into what falls from the sky. */
(() => {
'use strict';

// Rows of [code, unshifted, shifted, width in key units]. Function keys have no characters.
// Dead keys (they only combine with the next key) are marked with `dead` per layer.
const fn = (code, label, w, extra) => ({ code, label, w, fn: true, ...extra });
const k = (code, lo, up, extra) => ({ code, ch: [lo, up ?? lo.toUpperCase()], w: 1, ...extra });
const row = (s, codes) => [...s].map((c, i) => k(codes[i], c));
const LETTER_CODES = {
  top: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  home: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  bottom: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM']
};
const digits = shifted => [...'1234567890'].map((d, i) => k('Digit' + d, d, shifted[i]));
const bumps = r => r.map(x => (x.code === 'KeyF' || x.code === 'KeyJ' ? { ...x, bump: true } : x));

const LAYOUTS = {
  de: {
    name: 'QWERTZ (Deutsch)',
    rows: [
      [k('Backquote', '^', '°', { dead: [true, false] }), ...digits('!"§$%&/()='), k('Minus', 'ß', '?'), k('Equal', '´', '`', { dead: [true, true] }), fn('Backspace', '⟵', 2)],
      [fn('Tab', 'Tab', 1.5), ...row('qwertzuiop', LETTER_CODES.top), k('BracketLeft', 'ü'), k('BracketRight', '+', '*'), fn('Enter', 'Enter', 1.25, { at: 13.75, tall: true })],
      [fn('CapsLock', 'Feststell', 1.75), ...bumps(row('asdfghjkl', LETTER_CODES.home)), k('Semicolon', 'ö'), k('Quote', 'ä'), k('Backslash', '#', "'")],
      [fn('ShiftLeft', '⇧', 1.25, { shift: true }), k('IntlBackslash', '<', '>'), ...row('yxcvbnm', LETTER_CODES.bottom), k('Comma', ',', ';'), k('Period', '.', ':'), k('Slash', '-', '_'), fn('ShiftRight', '⇧ Umschalt', 2.75, { shift: true })],
      [fn('Space', 'Leertaste', 6.25, { at: 3.75 })]
    ]
  },
  us: {
    name: 'QWERTY (English)',
    rows: [
      [k('Backquote', '`', '~'), ...digits('!@#$%^&*()'), k('Minus', '-', '_'), k('Equal', '=', '+'), fn('Backspace', '⟵', 2)],
      [fn('Tab', 'Tab', 1.5), ...row('qwertyuiop', LETTER_CODES.top), k('BracketLeft', '[', '{'), k('BracketRight', ']', '}'), k('Backslash', '\\', '|', { w: 1.5 })],
      [fn('CapsLock', 'Caps', 1.75), ...bumps(row('asdfghjkl', LETTER_CODES.home)), k('Semicolon', ';', ':'), k('Quote', "'", '"'), fn('Enter', 'Enter', 2.25)],
      [fn('ShiftLeft', '⇧ Shift', 2.25, { shift: true }), ...row('zxcvbnm', LETTER_CODES.bottom), k('Comma', ',', '<'), k('Period', '.', '>'), k('Slash', '/', '?'), fn('ShiftRight', '⇧ Shift', 2.75, { shift: true })],
      [fn('Space', 'Space', 6.25, { at: 3.75 })]
    ]
  }
};
// Grid placement: 4 columns per key unit, 15 units per row.
for (const L of Object.values(LAYOUTS)) {
  L.keys = []; L.where = new Map();
  L.rows.forEach((r, ri) => {
    let x = 0;
    for (const key of r) {
      if (key.at != null) x = key.at;
      Object.assign(key, { row: ri, col: Math.round(x * 4) + 1, span: Math.round(key.w * 4) });
      x += key.w;
      L.keys.push(key);
      if (key.ch) key.ch.forEach((c, layer) => { if (!(key.dead && key.dead[layer])) L.where.set(c, { key, layer }); });
    }
  });
}

const LOWER = 'abcdefghijklmnopqrstuvwxyzäöüß', UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ';
const PRESETS = [
  { id: 'p-home1', name: 'Grundreihe 1', note: 'Die Startposition', chars: 'asdfjklö' },
  { id: 'p-home2', name: 'Grundreihe 2', note: 'Dazu g, h und ä', chars: 'asdfghjklöä' },
  { id: 'p-top1', name: 'Obere Reihe 1', note: 'Ohne die Mitte', chars: 'qweruiop' },
  { id: 'p-top2', name: 'Obere Reihe 2', note: 'Dazu t, z und ü', chars: 'qwertzuiopü' },
  { id: 'p-two', name: 'Grund + Oben', note: 'Zwei Reihen zusammen', chars: 'asdfghjklöäqwertzuiopü' },
  { id: 'p-bottom', name: 'Untere Reihe', note: 'Mit Komma, Punkt, Strich', chars: 'yxcvbnm,.-' },
  { id: 'p-all', name: 'Alle Buchstaben', note: 'a bis z, ä ö ü ß', chars: LOWER },
  { id: 'p-caps', name: 'Groß und klein', note: 'Mit der Umschalttaste', chars: LOWER + UPPER },
  { id: 'p-digits', name: 'Zahlen', note: '1 bis 0', chars: '1234567890' },
  { id: 'p-signs', name: 'Zeichen', note: 'Umschalt + Zahlenreihe', chars: '!"§$%&/()=?' }
].map(p => ({ ...p, builtin: true, types: { letters: true, syl: true, words: true } }));

// Common German words for kids. Nouns are capitalised; they fall in lower case unless the capital is selected.
const WORDS = `
der die das ein eine und oder aber als also ja nein nur noch schon sehr hier da dort wer wie was wo wann weil
wenn dann denn doch mal man mit nach von vor bei bis aus auf unter um zu zum zur im in an am es er sie wir ihr
ich du sein mein dein kein alle alles viel viele gut neu alt lang kurz hoch tief warm kalt nass laut leise
heute gestern immer nie oft gern bald jetzt kann muss will soll hat sind war dass falls all sag lag
gehen laufen rennen springen fallen fliegen singen tanzen lachen weinen essen trinken schlafen spielen lesen
malen rechnen lernen sagen fragen rufen hören sehen fühlen kochen backen waschen putzen bauen holen geben
nehmen haben machen tun legen sitzen stehen liegen ziehen werfen fangen kicken rollen drehen suchen finden
zeigen helfen danken kaufen zahlen fahren reiten warten hoffen wissen denken raten zählen teilen tragen heben
halten lassen kommen bleiben wohnen leben lieben mögen wollen dürfen können müssen hüpfen grüßen klettern
rot blau grün gelb weiß schwarz rosa lila braun grau bunt hell dunkel klar rund weich hart dick dünn voll leer
fein lieb nett frech wild zahm müde wach froh sauer süß satt arm reich klug stark mutig toll super echt fest
frei groß klein heiß schnell früh spät leicht schwer lustig
Haus Hund Katze Maus Pferd Kuh Schaf Ziege Huhn Hahn Ente Gans Fisch Vogel Igel Hase Fuchs Wolf Bär Löwe Tiger
Zebra Affe Esel Giraffe Robbe Wal Hai Krake Biene Ameise Spinne Käfer Raupe Frosch Eule Adler Rabe Taube Spatz
Floh Laus Wurm Pinguin Pony Lama Dachs Reh Hirsch Elch Luchs Otter Biber Panda Koala Kamel Delfin Qualle Möwe
Mama Papa Oma Opa Kind Baby Junge Frau Mann Tante Onkel Bruder Freund Freundin Lehrer
Kopf Haar Auge Ohr Nase Mund Zahn Hals Arm Hand Bein Fuß Knie Bauch Rücken Finger Daumen Zeh Herz Haut
Tür Fenster Dach Wand Bett Tisch Stuhl Sofa Lampe Uhr Bad Küche Keller Garten Zaun Treppe Schrank Regal Teller
Tasse Glas Gabel Messer Löffel Topf Pfanne Ofen Bild Kissen Decke Kerze Vase Fass Ass Saal Kalk Salsa Skala
Brot Butter Käse Wurst Milch Saft Wasser Tee Kakao Apfel Birne Banane Kirsche Pflaume Traube Zitrone Melone
Nuss Ei Eier Mehl Zucker Salz Reis Nudel Suppe Kuchen Keks Eis Honig Pizza Salat Möhre Gurke Tomate Bohne
Erbse Pilz Sahne Quark Öl Gas
Baum Blatt Blume Gras Wald Wiese Feld Berg Tal Fluss See Meer Strand Sand Stein Fels Insel Himmel Sonne Mond
Stern Wolke Regen Schnee Wind Sturm Blitz Donner Nebel Luft Erde Feuer Rose Tulpe Moos Ast Wurzel Busch Hügel
Höhle Quelle Bach Teich Welle Ufer Euro Pier
Buch Heft Stift Tafel Kreide Schule Klasse Pause Ranzen Lineal Farbe Pinsel Kleber Schere Ball Puppe Rad Auto
Bus Zug Boot Schiff Rakete Roller Drache Kran Taxi Lok Tor Turm Burg Schloss Brücke Straße Weg Stadt Dorf Hof
Park Zoo Kino Markt Laden Post Bank Geld Brief Karte Spiel Lied Musik Trommel Flöte Geige Gitarre Klavier Film
Foto Handy Radio Hose Rock Kleid Hemd Jacke Mantel Mütze Hut Schal Socke Schuh Stiefel Tasche Kappe
Tag Nacht Woche Monat Jahr Zeit Stunde Minute Abend Morgen Mittag Sommer Winter Herbst Ferien Fest Party
Spaß Glück Traum Witz Rätsel Idee Ziel Sieg Punkt Kraft Mut Angst Wut Freude Liebe Hilfe Frage Name Wort Satz
Zahl Ding Teil Seite Ende Anfang Fehler Ritter Hexe Riese Zwerg König Prinz Pirat Monster Roboter Zauber Schatz
Krone Gold Silber Kiste Pfeil Bogen Schild Helm Kanone Bombe Laser Alaska Lasso Jagd Glas Hall Hass Gag
`.trim().split(/\s+/).filter(w => w.length <= 9);

const VOWELS = 'aeiouäöü';
const isLower = c => c !== c.toUpperCase();
const isUpper = c => c !== c.toLowerCase();

function wordsFor(set) {
  const out = new Set(), all = w => [...w].every(c => set.has(c));
  for (const w of WORDS) {
    const low = w.toLowerCase();
    if (isUpper(w[0]) && all(w)) out.add(w);
    else if (all(low)) out.add(low);
  }
  return [...out];
}
function syllablesFor(set, R = Math.random) {
  const chars = [...set], low = chars.filter(isLower), out = new Set();
  const V = low.filter(c => VOWELS.includes(c)), K = low.filter(c => !VOWELS.includes(c));
  for (const c of K) for (const v of V) {
    if (c !== 'ß' && c !== 'q') out.add(c + v);
    out.add(v + c);
    if (c !== 'ß' && c !== 'q' && set.has(c.toUpperCase())) out.add(c.toUpperCase() + v);
  }
  // Too few for syllables (no vowels, digits or signs): typing-course pairs like "fj" or "12".
  if (out.size < 6 && chars.length > 1) {
    if (chars.length <= 8) { for (const a of chars) for (const b of chars) out.add(a + b); }
    else for (let i = 0; i < 64; i++) out.add(chars[(R() * chars.length) | 0] + chars[(R() * chars.length) | 0]);
  }
  return [...out];
}

// Selection → the content shape the game expects (see POOL in engine.js).
// A race passes a seeded R, so every device builds exactly the same content.
function build(sel, R) {
  const set = new Set(sel.chars), t = sel.types || {};
  let letters = t.letters !== false ? [...set] : [];
  const syl = t.syl !== false ? syllablesFor(set, R) : [];
  const words = t.words !== false ? wordsFor(set) : [];
  const ok = words.length >= 3 ? words : [];
  if (!letters.length && !syl.length && !ok.length) letters = [...set];
  return {
    id: sel.id, name: sel.name, letters, syl, words: ok,
    start: letters.length ? letters : syl.length ? syl : ok,
    cased: [...set].some(isUpper)
  };
}

// Show the chars in keyboard order; anything not on this layout goes last.
function ordered(chars, layout = 'de') {
  const L = LAYOUTS[layout], rank = c => { const w = L.where.get(c); return w ? w.key.row * 1000 + w.key.col * 2 + w.layer : 1e6 + c.charCodeAt(0); };
  return [...new Set(chars)].sort((a, b) => rank(a) - rank(b));
}

function detectLayout() {
  const saved = TD.store.get('td-layout', null);
  if (saved && LAYOUTS[saved]) return Promise.resolve(saved);
  const guess = /^de|^at|^ch/i.test(navigator.language || 'de') ? 'de' : 'us';
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      return navigator.keyboard.getLayoutMap().then(m => (m.get('KeyY') === 'z' ? 'de' : m.get('KeyY') === 'y' ? 'us' : guess)).catch(() => guess);
    }
  } catch (e) { /* not available */ }
  return Promise.resolve(guess);
}

TD.Keys = { LAYOUTS, PRESETS, WORDS, build, wordsFor, syllablesFor, ordered, detectLayout, isUpper };
})();
