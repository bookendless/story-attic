-- =========================================
-- StoryAttic 初期スキーマ v001
-- =========================================

-- プロジェクト（1つの「作品」に対応）
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  settings    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- エピソード（「話」に対応）
CREATE TABLE IF NOT EXISTS episodes (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 章
CREATE TABLE IF NOT EXISTS chapters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- 章とエピソードの紐づけ
CREATE TABLE IF NOT EXISTS chapter_episodes (
  chapter_id  TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  episode_id  TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chapter_id, episode_id)
);

-- キャラクター
CREATE TABLE IF NOT EXISTS characters (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 用語集
CREATE TABLE IF NOT EXISTS glossary (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '',
  term        TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- メモ
CREATE TABLE IF NOT EXISTS memos (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 資料（3階層: ブック → カテゴリ → アイテム）
CREATE TABLE IF NOT EXISTS materials (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  book        TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- タグ（全エンティティ共通・ポリモーフィック設計）
CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  tag         TEXT NOT NULL,
  UNIQUE (project_id, entity_type, entity_id, tag)
);

-- プロット
CREATE TABLE IF NOT EXISTS plots (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  plot_type   TEXT NOT NULL DEFAULT '起承転結',
  theme       TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL DEFAULT '{}',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- プロット構造（プロジェクトと1対1）
CREATE TABLE IF NOT EXISTS plot_structure (
  project_id  TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  data        TEXT NOT NULL DEFAULT '{}'
);

-- タイムライン
CREATE TABLE IF NOT EXISTS timelines (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id  TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  data        TEXT NOT NULL DEFAULT '{}'
);

-- マインドマップ
CREATE TABLE IF NOT EXISTS mindmaps (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}'
);

-- 相関図
CREATE TABLE IF NOT EXISTS correlations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  data        TEXT NOT NULL DEFAULT '{}'
);

-- 執筆履歴スナップショット
CREATE TABLE IF NOT EXISTS history_snapshots (
  id          TEXT PRIMARY KEY,
  episode_id  TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  char_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- 執筆日記
CREATE TABLE IF NOT EXISTS diary_entries (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  char_count  INTEGER NOT NULL DEFAULT 0,
  session_sec INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date)
);

-- AI設定
CREATE TABLE IF NOT EXISTS ai_settings (
  project_id    TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT '',
  model         TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  data          TEXT NOT NULL DEFAULT '{}'
);

-- AI会話履歴
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id  TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- インデックス（検索・ソート高速化）
CREATE INDEX IF NOT EXISTS idx_episodes_project_id ON episodes(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapter_episodes_chapter ON chapter_episodes(chapter_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_chapter_episodes_episode ON chapter_episodes(episode_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_glossary_project_id ON glossary(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_memos_project_id ON memos(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_materials_project_id ON materials(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tags_entity ON tags(project_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_history_episode ON history_snapshots(episode_id, created_at);
CREATE INDEX IF NOT EXISTS idx_diary_project ON diary_entries(project_id, date);
CREATE INDEX IF NOT EXISTS idx_ai_conv_project ON ai_conversations(project_id, created_at);
