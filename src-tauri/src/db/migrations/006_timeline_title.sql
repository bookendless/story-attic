-- v6: タイムラインに名称カラムを追加
ALTER TABLE timelines ADD COLUMN title TEXT NOT NULL DEFAULT '';
