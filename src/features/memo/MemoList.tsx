/**
 * メモ一覧
 */

import { useMemo } from 'react';
import type { Memo } from '@/shared/types';

interface MemoListProps {
  items: Memo[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function MemoList({ items, onSelect, onCreate, onDelete }: MemoListProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Memo[]>();
    for (const m of items) {
      const cat = m.category || '未分類';
      const list = map.get(cat) ?? [];
      list.push(m);
      map.set(cat, list);
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>メモ ({items.length})</span>
        <button
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--accent)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer' }}
          onClick={onCreate}
        >
          + 追加
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>メモがありません</div>
        )}
        {Array.from(grouped.entries()).map(([category, list]) => (
          <div key={category}>
            <div className="px-3 py-1 text-xs font-medium" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>{category}</div>
            {list.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-1.5 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => onSelect(m.id)}
              >
                <span className="text-xs truncate" style={{ color: 'var(--text)' }}>{m.title}</span>
                <button
                  className="text-xs flex-shrink-0"
                  style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
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
