-- v5: 章にノードツリー（中プロット）カラムを追加
ALTER TABLE chapters ADD COLUMN nodes TEXT NOT NULL DEFAULT '{}';
