import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import DiffMatchPatch from 'diff-match-patch';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import type { SnapshotSummary, Snapshot } from '@/shared/types';

const dmp = new DiffMatchPatch();

/** HTMLタグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}

/** 日時を読みやすい形式に変換 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DiffView() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { editorViewMode, settings } = useUIStore();
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshotBody, setSnapshotBody] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // スナップショット一覧を取得
  useEffect(() => {
    if (editorViewMode !== 'diff' || !currentEpisode) return;
    invoke<unknown[]>('list_snapshots', { episodeId: currentEpisode.id })
      .then((raw) => {
        const list = raw.map((r) => toCamelCase<SnapshotSummary>(r));
        setSnapshots(list);
        // 最新のスナップショットを自動選択
        if (list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      })
      .catch((e) => console.error('スナップショット一覧取得エラー:', e));
  }, [editorViewMode, currentEpisode, selectedId]);

  // 選択されたスナップショットの本文を取得
  useEffect(() => {
    if (!selectedId) {
      setSnapshotBody('');
      return;
    }
    setLoading(true);
    invoke<unknown>('get_snapshot', { id: selectedId })
      .then((raw) => {
        const snap = toCamelCase<Snapshot>(raw);
        setSnapshotBody(snap.body);
      })
      .catch((e) => console.error('スナップショット取得エラー:', e))
      .finally(() => setLoading(false));
  }, [selectedId]);

  // スナップショット保存
  const handleSaveSnapshot = useCallback(async () => {
    if (!currentEpisode) return;
    setSaving(true);
    try {
      const raw = await invoke<unknown>('save_snapshot', { episodeId: currentEpisode.id });
      const newSnap = toCamelCase<SnapshotSummary>(raw);
      setSnapshots((prev) => [newSnap, ...prev]);
      setSelectedId(newSnap.id);
    } catch (e) {
      console.error('スナップショット保存エラー:', e);
    } finally {
      setSaving(false);
    }
  }, [currentEpisode]);

  // 差分計算
  const diffs = useMemo(() => {
    if (!currentEpisode) return [];
    const oldText = stripHtml(snapshotBody);
    const newText = stripHtml(currentEpisode.body);
    const result = dmp.diff_main(oldText, newText);
    dmp.diff_cleanupSemantic(result);
    return result;
  }, [snapshotBody, currentEpisode]);

  // 統計情報
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const [op, text] of diffs) {
      if (op === 1) added += text.length;
      if (op === -1) removed += text.length;
    }
    return { added, removed };
  }, [diffs]);

  if (editorViewMode !== 'diff' || !currentEpisode) return null;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* ツールバー */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          差分ビュー
        </span>

        {/* スナップショット選択 */}
        <select
          className="input text-xs"
          style={{ width: '240px', padding: '3px 8px', height: '28px' }}
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
        >
          {snapshots.length === 0 ? (
            <option value="">スナップショットなし</option>
          ) : (
            snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDate(s.createdAt)} ({s.charCount.toLocaleString()}字)
              </option>
            ))
          )}
        </select>

        <button
          className="btn btn-ghost text-xs"
          style={{ padding: '3px 10px' }}
          onClick={handleSaveSnapshot}
          disabled={saving}
        >
          {saving ? '保存中...' : '現在を保存'}
        </button>

        {/* 差分統計 */}
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span style={{ color: 'var(--success)' }}>+{stats.added}字</span>
          <span style={{ color: 'var(--danger)' }}>-{stats.removed}字</span>
        </div>
      </div>

      {/* 差分表示エリア */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左: スナップショット（過去） */}
        <div className="flex-1 overflow-auto" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="px-2 py-1 text-xs" style={{ background: 'var(--bg-deep)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            過去（{selectedId ? formatDate(snapshots.find((s) => s.id === selectedId)?.createdAt ?? '') : '未選択'}）
          </div>
          {loading ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>読み込み中...</div>
          ) : !selectedId ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              スナップショットを保存して差分を確認できます
            </div>
          ) : (
            <DiffContent diffs={diffs} side="old" font={settings.editor_font} fontSize={settings.editor_font_size} />
          )}
        </div>

        {/* 右: 現在のテキスト */}
        <div className="flex-1 overflow-auto">
          <div className="px-2 py-1 text-xs" style={{ background: 'var(--bg-deep)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            現在
          </div>
          {!selectedId ? (
            <div className="p-6" style={{ fontFamily: `${settings.editor_font}, serif`, fontSize: `${settings.editor_font_size}px`, lineHeight: 2.2, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
              {stripHtml(currentEpisode.body)}
            </div>
          ) : (
            <DiffContent diffs={diffs} side="new" font={settings.editor_font} fontSize={settings.editor_font_size} />
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================
// 差分表示コンポーネント
// =========================================

interface DiffContentProps {
  diffs: [number, string][];
  side: 'old' | 'new';
  font: string;
  fontSize: number;
}

function DiffContent({ diffs, side, font, fontSize }: DiffContentProps) {
  return (
    <div
      className="p-6"
      style={{
        fontFamily: `${font}, serif`,
        fontSize: `${fontSize}px`,
        lineHeight: 2.2,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {diffs.map(([op, text], i) => {
        // 左パネル（old）: 削除(-1)はハイライト、追加(+1)は非表示
        // 右パネル（new）: 追加(+1)はハイライト、削除(-1)は非表示
        if (side === 'old') {
          if (op === 1) return null; // 追加は左には表示しない
          if (op === -1) {
            return (
              <span
                key={i}
                style={{
                  background: 'color-mix(in srgb, var(--danger) 25%, transparent)',
                  textDecoration: 'line-through',
                  textDecorationColor: 'var(--danger)',
                }}
              >
                {text}
              </span>
            );
          }
          return <span key={i}>{text}</span>;
        }

        // 右パネル（new）
        if (op === -1) return null; // 削除は右には表示しない
        if (op === 1) {
          return (
            <span
              key={i}
              style={{
                background: 'color-mix(in srgb, var(--success) 25%, transparent)',
              }}
            >
              {text}
            </span>
          );
        }
        return <span key={i}>{text}</span>;
      })}
    </div>
  );
}
