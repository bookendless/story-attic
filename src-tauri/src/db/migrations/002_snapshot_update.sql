-- =========================================
-- StoryAttic スキーマ v002
-- 履歴スナップショット: 圧縮フラグ・ラベル追加
-- =========================================

ALTER TABLE history_snapshots ADD COLUMN is_compressed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE history_snapshots ADD COLUMN label TEXT NOT NULL DEFAULT '';
