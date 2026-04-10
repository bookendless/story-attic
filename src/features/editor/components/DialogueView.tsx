import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '@/shared/stores/editorStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { DialogueItem } from '@/shared/types';

/** 括弧タイプのラベル */
const BRACKET_LABELS: Record<string, string> = {
  normal: '「」',
  double: '『』',
  paren: '（）',
};

/** 括弧タイプの色 */
const BRACKET_COLORS: Record<string, string> = {
  normal: 'var(--accent)',
  double: 'var(--warning)',
  paren: 'var(--text-mid)',
};

export function DialogueView() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const [dialogues, setDialogues] = useState<DialogueItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentEpisode?.body) {
      setDialogues([]);
      return;
    }
    setLoading(true);
    invoke<unknown>('extract_dialogues', { text: currentEpisode.body })
      .then((raw) => {
        setDialogues(toCamelCase<DialogueItem[]>(raw));
      })
      .catch(() => setDialogues([]))
      .finally(() => setLoading(false));
  }, [currentEpisode?.body]);

  const filtered = filter === 'all'
    ? dialogues
    : dialogues.filter((d) => d.bracketType === filter);

  // 統計
  const totalCount = dialogues.length;
  const normalCount = dialogues.filter((d) => d.bracketType === 'normal').length;
  const doubleCount = dialogues.filter((d) => d.bracketType === 'double').length;
  const parenCount = dialogues.filter((d) => d.bracketType === 'paren').length;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* ヘッダー */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
      >
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
        >
          台詞一覧
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {totalCount}件
        </span>

        {/* フィルタ */}
        <div className="flex items-center gap-1 ml-auto">
          {[
            { key: 'all', label: 'すべて', count: totalCount },
            { key: 'normal', label: '「」', count: normalCount },
            { key: 'double', label: '『』', count: doubleCount },
            { key: 'paren', label: '（）', count: parenCount },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: filter === key ? 'var(--accent-soft)' : 'transparent',
                color: filter === key ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${filter === key ? 'var(--accent)' : 'var(--border)'}`,
              }}
              onClick={() => setFilter(key)}
            >
              {label} {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 台詞リスト */}
      <div className="flex-1 overflow-auto p-3">
        {loading && (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            解析中...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            台詞が見つかりません
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {filtered.map((d, i) => (
              <div
                key={`${d.paragraphIndex}-${d.offset}-${i}`}
                className="dialogue-item rounded px-3 py-2 transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  borderLeft: `3px solid ${BRACKET_COLORS[d.bracketType] ?? 'var(--border)'}`,
                  cursor: 'default',
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="flex-shrink-0 text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)', minWidth: '32px' }}
                  >
                    ¶{d.paragraphIndex + 1}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                    {d.text}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-10">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: 'var(--bg-elevated)',
                      color: BRACKET_COLORS[d.bracketType] ?? 'var(--text-muted)',
                    }}
                  >
                    {BRACKET_LABELS[d.bracketType] ?? d.bracketType}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {d.text.length - 2}字
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
