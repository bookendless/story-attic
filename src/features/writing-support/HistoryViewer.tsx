/**
 * 執筆履歴ビューア — スナップショット一覧 + diff表示
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { diffChars } from 'diff';
import type { SnapshotSummary } from '@/shared/types';

interface HistoryViewerProps {
  episodeId: string | null;
}

export function HistoryViewer({ episodeId }: HistoryViewerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [diffResult, setDiffResult] = useState<{ added?: boolean; removed?: boolean; value: string }[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const loadSnapshots = useCallback(async () => {
    if (!episodeId) { setSnapshots([]); return; }
    try {
      const result = await invoke<unknown[]>('list_snapshots', { episodeId });
      setSnapshots(toCamelCase<SnapshotSummary[]>(result));
    } catch { /* 無視 */ }
  }, [episodeId]);

  useEffect(() => {
    loadSnapshots();
    setDiffResult(null);
    setSelectedIdx(null);
  }, [loadSnapshots]);

  const showDiff = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= snapshots.length) return;
    setSelectedIdx(idx);

    try {
      const current = await invoke<{ body: string }>('get_snapshot', { id: snapshots[idx].id });
      const currentBody = (current as { body: string }).body ?? '';

      // 前のスナップショットがあればdiff、なければ全文表示
      if (idx + 1 < snapshots.length) {
        const prev = await invoke<{ body: string }>('get_snapshot', { id: snapshots[idx + 1].id });
        const prevBody = (prev as { body: string }).body ?? '';
        setDiffResult(diffChars(prevBody, currentBody));
      } else {
        setDiffResult([{ value: currentBody }]);
      }
    } catch {
      setDiffResult(null);
    }
  }, [snapshots]);

  if (!episodeId) {
    return (
      <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        話を選択するとスナップショット履歴が表示されます
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>
        執筆履歴 ({snapshots.length} スナップショット)
      </h3>

      {snapshots.length === 0 && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>スナップショットがありません</div>
      )}

      <div className="flex flex-col gap-0.5" style={{ maxHeight: '120px', overflowY: 'auto' }}>
        {snapshots.map((s, i) => (
          <button
            key={s.id}
            className="flex items-center justify-between text-xs px-2 py-1 rounded"
            style={{
              color: 'var(--text)',
              background: selectedIdx === i ? 'var(--bg)' : 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onClick={() => showDiff(i)}
          >
            <span>{new Date(s.createdAt).toLocaleString('ja-JP')}</span>
            <span style={{ color: 'var(--text-muted)' }}>{s.charCount}字</span>
          </button>
        ))}
      </div>

      {diffResult && (
        <div
          className="text-xs p-2 rounded overflow-auto"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            maxHeight: '200px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.6,
          }}
        >
          {diffResult.map((part, i) => (
            <span
              key={i}
              style={{
                background: part.added ? 'rgba(122,173,138,0.3)' : part.removed ? 'rgba(176,112,112,0.3)' : 'transparent',
                textDecoration: part.removed ? 'line-through' : 'none',
                color: part.added ? 'var(--success)' : part.removed ? 'var(--danger)' : 'var(--text)',
              }}
            >
              {part.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
