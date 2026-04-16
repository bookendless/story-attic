/**
 * 執筆履歴ビューア — スナップショット一覧 + diff表示
 * 機能: 自動/手動スナップショット・ラベル編集・復元
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { diffChars } from 'diff';
import type { SnapshotSummary } from '@/shared/types';
import { useEditorStore } from '@/shared/stores/editorStore';

interface HistoryViewerProps {
  episodeId: string | null;
}

export function HistoryViewer({ episodeId }: HistoryViewerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [diffResult, setDiffResult] = useState<{ added?: boolean; removed?: boolean; value: string }[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [isTaking, setIsTaking] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const takeSnapshot = useEditorStore((s) => s.takeSnapshot);
  const switchEpisode = useEditorStore((s) => s.switchEpisode);

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

  const handleTakeSnapshot = useCallback(async () => {
    if (isTaking) return;
    setIsTaking(true);
    try {
      await takeSnapshot();
      await loadSnapshots();
    } finally {
      setIsTaking(false);
    }
  }, [isTaking, takeSnapshot, loadSnapshots]);

  const handleRestore = useCallback(async (snapshotId: string) => {
    if (!episodeId || restoring) return;
    setRestoring(snapshotId);
    try {
      await invoke('restore_snapshot', { id: snapshotId });
      // エピソードを再読み込みして本文を反映
      await switchEpisode(episodeId);
    } catch { /* 無視 */ } finally {
      setRestoring(null);
    }
  }, [episodeId, restoring, switchEpisode]);

  const startEditing = useCallback((s: SnapshotSummary) => {
    setEditingId(s.id);
    setEditingLabel(s.label);
  }, []);

  const commitLabel = useCallback(async (id: string) => {
    try {
      await invoke('label_snapshot', { id, label: editingLabel });
      setSnapshots((prev) =>
        prev.map((s) => s.id === id ? { ...s, label: editingLabel } : s)
      );
    } catch { /* 無視 */ } finally {
      setEditingId(null);
    }
  }, [editingLabel]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoke('delete_snapshot', { id });
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      setDiffResult(null);
      setSelectedIdx(null);
    } catch { /* 無視 */ }
  }, []);

  if (!episodeId) {
    return (
      <div className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        話を選択するとスナップショット履歴が表示されます
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          執筆履歴 ({snapshots.length}/10)
        </h3>
        <button
          className="text-xs px-2 py-0.5 rounded"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            opacity: isTaking ? 0.6 : 1,
            cursor: isTaking ? 'not-allowed' : 'pointer',
          }}
          onClick={handleTakeSnapshot}
          disabled={isTaking}
        >
          {isTaking ? '保存中…' : '今すぐ保存'}
        </button>
      </div>

      {snapshots.length === 0 && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>スナップショットがありません</div>
      )}

      <div className="flex flex-col gap-0.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
        {snapshots.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-col text-xs px-2 py-1 rounded"
            style={{
              background: selectedIdx === i ? 'var(--bg)' : 'transparent',
              border: '1px solid var(--border)',
            }}
          >
            {/* 上段: 日時・文字数 */}
            <button
              className="flex items-center justify-between w-full"
              style={{ color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => showDiff(i)}
            >
              <span>{new Date(s.createdAt).toLocaleString('ja-JP')}</span>
              <span style={{ color: 'var(--text-muted)' }}>{s.charCount}字</span>
            </button>

            {/* ラベル行 */}
            {editingId === s.id ? (
              <div className="flex gap-1 mt-0.5">
                <input
                  className="flex-1 text-xs px-1 rounded"
                  style={{
                    background: 'var(--input-bg, var(--bg))',
                    border: '1px solid var(--accent)',
                    color: 'var(--text)',
                  }}
                  value={editingLabel}
                  placeholder="ラベルを入力"
                  autoFocus
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitLabel(s.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => commitLabel(s.id)}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  style={{
                    color: s.label ? 'var(--text)' : 'var(--text-muted)',
                    fontStyle: s.label ? 'normal' : 'italic',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label || 'ラベルなし'}
                </span>
                {/* ラベル編集ボタン */}
                <button
                  title="ラベルを編集"
                  style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => startEditing(s)}
                >
                  ✏
                </button>
                {/* 復元ボタン */}
                <button
                  title="この時点に復元"
                  style={{
                    color: 'var(--accent)',
                    cursor: restoring === s.id ? 'not-allowed' : 'pointer',
                    opacity: restoring === s.id ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                  onClick={() => handleRestore(s.id)}
                  disabled={restoring === s.id}
                >
                  ↩
                </button>
                {/* 削除ボタン */}
                <button
                  title="削除"
                  style={{ color: 'var(--danger)', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => handleDelete(s.id)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
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
