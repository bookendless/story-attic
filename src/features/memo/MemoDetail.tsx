/**
 * メモ詳細 — タイトル・カテゴリ・テキスト内容・タグ
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Memo, MemoData, Tag } from '@/shared/types';
import { DEFAULT_MEMO_DATA } from '@/shared/types';
import { TagPicker } from '@/shared/components/TagPicker';

interface MemoDetailProps {
  item: Memo;
  tags: Tag[];
  projectId: string;
  onBack: () => void;
  onUpdate: () => void;
  onTagsChange: () => void;
}

function parseData(raw: string): MemoData {
  try {
    return { ...DEFAULT_MEMO_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MEMO_DATA };
  }
}

export function MemoDetail({ item, tags, projectId, onBack, onUpdate, onTagsChange }: MemoDetailProps) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [data, setData] = useState<MemoData>(() => parseData(item.data));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(item.title);
    setCategory(item.category);
    setData(parseData(item.data));
  }, [item.id, item.title, item.category, item.data]);

  const save = useCallback(
    (t: string, c: string, d: MemoData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await invoke('update_memo', { id: item.id, title: t, category: c, data: JSON.stringify(d) });
          onUpdate();
        } catch { /* 無視 */ }
      }, 500);
    },
    [item.id, onUpdate],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button className="text-xs" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={onBack}>←</button>
        <input
          className="flex-1 text-sm font-medium bg-transparent outline-none"
          style={{ color: 'var(--text)', border: 'none' }}
          value={title}
          onChange={(e) => { setTitle(e.target.value); save(e.target.value, category, data); }}
          placeholder="メモのタイトル"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        <div>
          <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>カテゴリ</span>
          <input
            className="w-full text-xs bg-transparent outline-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}
            value={category}
            onChange={(e) => { setCategory(e.target.value); save(title, e.target.value, data); }}
            placeholder="分類"
          />
        </div>
        <div className="flex-1">
          <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>内容</span>
          <textarea
            className="w-full text-xs bg-transparent outline-none resize-none"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px', minHeight: '160px' }}
            value={data.content}
            onChange={(e) => { const d = { content: e.target.value }; setData(d); save(title, category, d); }}
            placeholder="メモの内容..."
          />
        </div>
        <div>
          <span className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>タグ</span>
          <TagPicker projectId={projectId} entityType="memo" entityId={item.id} tags={tags} onTagsChange={onTagsChange} />
        </div>
      </div>
    </div>
  );
}
