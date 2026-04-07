/**
 * 資料ツリー — 3階層表示（ブック → カテゴリ → アイテム）
 * book と category カラムの値でグルーピング。
 */

import { useMemo, useState } from 'react';
import type { Material } from '@/shared/types';

interface MaterialTreeProps {
  items: Material[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

interface BookGroup {
  book: string;
  categories: Map<string, Material[]>;
}

export function MaterialTree({ items, onSelect, onCreate, onDelete }: MaterialTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => {
    const bookMap = new Map<string, Map<string, Material[]>>();
    for (const item of items) {
      const b = item.book || '未分類';
      const c = item.category || '未分類';
      if (!bookMap.has(b)) bookMap.set(b, new Map());
      const catMap = bookMap.get(b)!;
      if (!catMap.has(c)) catMap.set(c, []);
      catMap.get(c)!.push(item);
    }
    const result: BookGroup[] = [];
    for (const [book, categories] of bookMap) {
      result.push({ book, categories });
    }
    return result;
  }, [items]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>資料 ({items.length})</span>
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
          <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>資料がありません</div>
        )}
        {tree.map((bookGroup) => {
          const bookKey = `book:${bookGroup.book}`;
          const bookCollapsed = collapsed.has(bookKey);
          return (
            <div key={bookKey}>
              {/* ブックレベル */}
              <div
                className="flex items-center gap-1 px-2 py-1 cursor-pointer text-xs font-medium"
                style={{ color: 'var(--text)', background: 'var(--bg)' }}
                onClick={() => toggleCollapse(bookKey)}
              >
                <span style={{ fontSize: '10px' }}>{bookCollapsed ? '▶' : '▼'}</span>
                <span>📁 {bookGroup.book}</span>
              </div>
              {!bookCollapsed && Array.from(bookGroup.categories.entries()).map(([cat, catItems]) => {
                const catKey = `${bookKey}:${cat}`;
                const catCollapsed = collapsed.has(catKey);
                return (
                  <div key={catKey}>
                    {/* カテゴリレベル */}
                    <div
                      className="flex items-center gap-1 px-4 py-0.5 cursor-pointer text-xs"
                      style={{ color: 'var(--text-mid)' }}
                      onClick={() => toggleCollapse(catKey)}
                    >
                      <span style={{ fontSize: '9px' }}>{catCollapsed ? '▶' : '▼'}</span>
                      <span>{cat}</span>
                    </div>
                    {!catCollapsed && catItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-6 py-1 cursor-pointer"
                        style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => onSelect(item.id)}
                      >
                        <span className="text-xs truncate" style={{ color: 'var(--text)' }}>{item.title}</span>
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
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
