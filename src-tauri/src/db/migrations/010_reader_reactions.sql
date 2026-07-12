-- 読者反応（疑似連載モード「AI読者のライブ反応」）
CREATE TABLE IF NOT EXISTS reader_reactions (
  id          TEXT PRIMARY KEY,
  episode_id  TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  persona     TEXT NOT NULL,
  quote       TEXT NOT NULL,
  comment     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reader_reactions_episode ON reader_reactions(episode_id);
