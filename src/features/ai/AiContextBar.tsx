/**
 * コンテキスト選択バー
 * AIに送信するコンテキストデータのソースをトグルで選択する。
 * 折りたたみ式: 閉じているときはアクティブソースの要約を表示。
 * アクティブ色は現在のフェーズに連動する。
 */

import { useState } from 'react';
import { useAiStore, CONTEXT_LABELS } from '@/shared/stores/aiStore';
import type { AiContextSource } from '@/shared/types';
import { PHASE_COLORS } from './phaseColors';

const SOURCES: AiContextSource[] = ['body', 'characters', 'glossary', 'plot', 'worldbuilding', 'synopsis', 'foreshadowing'];

export function AiContextBar() {
  const { contextSources, toggleContextSource, phase } = useAiStore();
  const [isOpen, setIsOpen] = useState(false);
  const color = PHASE_COLORS[phase];

  const activeSources = SOURCES.filter((s) => contextSources.includes(s));
  const summaryText = activeSources.length === 0
    ? 'なし'
    : activeSources.length <= 2
      ? activeSources.map((s) => CONTEXT_LABELS[s]).join(' · ')
      : `${activeSources.slice(0, 2).map((s) => CONTEXT_LABELS[s]).join(' · ')} +${activeSources.length - 2}`;

  return (
    <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
      {/* ヘッダー（常時表示） */}
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs"
        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        onClick={() => setIsOpen((v) => !v)}
        title={isOpen ? '参照ソースを折りたたむ' : '参照ソースを展開する'}
      >
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '10px' }}>
          {isOpen ? '▼' : '▶'}
        </span>
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>参照:</span>
        {!isOpen && (
          <span style={{ color: activeSources.length > 0 ? color.accent : 'var(--text-muted)', fontSize: '11px' }}>
            {summaryText}
          </span>
        )}
      </button>

      {/* 展開時のトグル一覧 */}
      {isOpen && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {SOURCES.map((source) => {
            const active = contextSources.includes(source);
            return (
              <button
                key={source}
                className="text-xs"
                style={{
                  padding: '2px 7px',
                  borderRadius: '8px',
                  border: active ? `1px solid ${color.accent}` : '1px solid var(--border)',
                  background: active ? color.bg : 'transparent',
                  color: active ? color.accent : 'var(--text-muted)',
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
      )}
    </div>
  );
}
