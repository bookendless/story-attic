-- v7: プロットにピン留めフラグを追加（決定稿マーク・AI読み込み対象）
ALTER TABLE plots ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
