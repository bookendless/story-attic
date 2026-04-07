/**
 * キャラクター一覧 — カテゴリ別グルーピング表示
 */

import { useMemo } from 'react';
import type { Character } from '@/shared/types';

interface CharacterListProps {
  characters: Character[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onReload: () => void;
}

export function CharacterList({ characters, onSelect, onCreate, onDelete }: CharacterListProps) {
  // カテゴリ別にグルーピング
  const grouped = useMemo(() => {
    const map = new Map<string, Character[]>();
    for (const c of characters) {
      const cat = c.category || '未分類';
      const list = map.get(cat) ?? [];
      list.push(c);
      map.set(cat, list);
    }
    return map;
  }, [characters]);

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          登場人物 ({characters.length})
        </span>
        <button
          className="text-xs px-2 py-0.5 rounded"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-deep)',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={onCreate}
          title="キャラクターを追加"
        >
          + 追加
        </button>
      </div>

      {/* リスト */}
      <div className="flex-1 overflow-y-auto">
        {characters.length === 0 && (
          <div className="px-3 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            キャラクターがありません
          </div>
        )}
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            {/* カテゴリヘッダー */}
            <div
              className="px-3 py-1 text-xs font-medium"
              style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}
            >
              {category}
            </div>
            {items.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={() => onSelect(c.id)}
              >
                <span className="text-xs truncate" style={{ color: 'var(--text)' }}>
                  {c.name}
                </span>
                <button
                  className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100"
                  style={{
                    color: 'var(--danger)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  title="削除"
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
