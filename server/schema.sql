-- Type Defender rooms: class or family leaderboards. No names, emails or IP addresses are stored.
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,          -- e.g. TIGER-482, what kids type to join
  admin TEXT NOT NULL,            -- SHA-256 of the creator's admin token
  created INTEGER NOT NULL,
  active INTEGER NOT NULL,        -- last join or score; rooms idle for 90 days are deleted
  sets TEXT                       -- JSON list of prescribed key sets; NULL means every set counts
);
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  nick TEXT NOT NULL,             -- generated, e.g. "Blauer Fuchs"; never free text
  token TEXT NOT NULL,            -- SHA-256 of the player's secret token
  created INTEGER NOT NULL,
  UNIQUE (room, nick)
);
CREATE TABLE IF NOT EXISTS scores (
  room TEXT NOT NULL,
  player TEXT NOT NULL,
  setkey TEXT NOT NULL,           -- preset id (p-home1) or c-<hash> for a custom key set
  label TEXT NOT NULL,            -- the keys of a custom set, shown instead of its name
  pace INTEGER NOT NULL,
  score INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (room, player, setkey, pace)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores (room, pace, setkey, score DESC);
-- Visitor counts: one row per day and kind, nothing per person.
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,              -- YYYY-MM-DD (UTC)
  kind TEXT NOT NULL,             -- visit, app, game
  n INTEGER NOT NULL,
  PRIMARY KEY (day, kind)
);
