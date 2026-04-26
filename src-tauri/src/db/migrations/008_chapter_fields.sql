-- v8: 章に設定・場所、雰囲気・ムード、重要な出来事カラムを追加
ALTER TABLE chapters ADD COLUMN setting TEXT NOT NULL DEFAULT '';
ALTER TABLE chapters ADD COLUMN mood TEXT NOT NULL DEFAULT '';
ALTER TABLE chapters ADD COLUMN important_events TEXT NOT NULL DEFAULT '';
