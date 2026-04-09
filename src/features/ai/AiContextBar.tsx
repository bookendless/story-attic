/**
 * コンテキスト選択バー
 * AIに送信するコンテキストデータのソースをトグルで選択する。
 */

import { useAiStore, CONTEXT_LABELS } from '@/shared/stores/aiStore';
import type { AiContextSource } from '@/shared/types';

const SOURCES: AiContextSource[] = ['body', 'characters', 'glossary', 'plot', 'worldbuilding'];

export function AiContextBar() {
  const { contextSources, toggleContextSource } = useAiStore();

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span className="text-xs" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', marginRight: '2px' }}>
        参照:
      </span>
      {SOURCES.map((source) => {
        const active = contextSources.includes(source);
        return (
          <button
            key={source}
            className="text-xs"
            style={{
              padding: '2px 7px',
              borderRadius: '8px',
              border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: active ? 'rgba(var(--accent-rgb, 100, 149, 237), 0.15)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 150ms',
              whiteSpace: 'nowrap',
            }}
            onClick={() => toggleContextSource(source)}
            title={`${CONTEXT_LABELS[source]}をコンテキストに${active ? '含めない' : '含める'}`}
          >
            {CONTEXT_LABELS[source]}
          </button>
        );
      })}
    </div>
  );
}
