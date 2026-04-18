-- =========================================
-- StoryAttic スキーマ v004
-- 章に概要カラム追加 (ASB ParsedChapter.summary 受け入れ)
-- =========================================

ALTER TABLE chapters ADD COLUMN summary TEXT NOT NULL DEFAULT '';
