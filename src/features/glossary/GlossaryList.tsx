/**
 * 用語一覧 — カテゴリ分け + 検索フィルタ
 */

import { useState, useMemo } from 'react';
import type { GlossaryItem } from '@/shared/types';
import {
  GLOSSARY_CATEGORY_LABELS,
} from '@/shared/constants/asbEnums';
import type { GlossaryCategory } from '@/shared/constants/asbEnums';

interface GlossaryListProps {
  items: GlossaryItem[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function GlossaryList({ items, onSelect, onCreate, onDelete }: GlossaryListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.term.toLowerCase().includes(q));
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, GlossaryItem[]>();
    for (const item of filtered) {
      const cat = item.category || '未分類';
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          用語集 ({items.length})
        </span>
        <button
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--accent)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer' }}
          onClick={onCreate}
        >
          + 追加
        </button>
      </div>

      {/* 検索 */}
      <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <input
          className="w-full text-xs px-2 py-1 rounded"
          style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="用語を検索..."
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            {search ? '該当する用語がありません' : '用語がありません'}
          </div>
        )}
        {Array.from(grouped.entries()).map(([category, list]) => (
          <div key={category}>
            <div className="px-3 py-1 text-xs font-medium" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>
              {GLOSSARY_CATEGORY_LABELS[category as GlossaryCategory] ?? category}
            </div>
            {list.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => onSelect(item.id)}
              >
                <span className="text-xs truncate" style={{ color: 'var(--text)' }}>{item.term}</span>
                <button
                  className="text-xs flex-shrink-0"
                  style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
