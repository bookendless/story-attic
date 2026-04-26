import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import DiffMatchPatch from 'diff-match-patch';
import { useEditor, EditorContent } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { StarterKit } from '@tiptap/starter-kit';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { toCamelCase } from '@/shared/hooks/useTauriCommand';
import { RubyNode } from '@/features/editor/extensions/RubyNode';
import { DotenMark } from '@/features/editor/extensions/DotenMark';
import type { SnapshotSummary, Snapshot } from '@/shared/types';

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const dmp = new DiffMatchPatch();

/** HTMLタグを除去してプレーンテキストを返す（段落は改行に変換） */
function stripHtml(html: string): string {
  const withBreaks = html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

/** 日時を読みやすい形式に変換 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DiffView() {
  const currentEpisode = useEditorStore((s) => s.currentEpisode);
  const { editorViewMode, settings, setEditorViewMode } = useUIStore();
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
          変更履歴
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

        <button
          className="btn btn-ghost text-xs"
          style={{ padding: '3px 10px' }}
          onClick={() => setEditorViewMode('editor')}
        >
          ← 戻る
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
            <DiffEmptyState onSave={handleSaveSnapshot} saving={saving} />
          ) : (
            <DiffContent diffs={diffs} side="old" font={settings.editor_font} fontSize={settings.editor_font_size} />
          )}
        </div>

        {/* 右: 現在のテキスト（編集可能） */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-2 py-1 text-xs flex-shrink-0" style={{ background: 'var(--bg-deep)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            現在（編集可能）
          </div>
          <div className="flex-1 overflow-auto">
            <DiffEditorPane />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================
// 差分ビュー空状態コンポーネント
// =========================================

function DiffEmptyState({
  onSave,
  saving,
}: {
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 32px',
      height: '100%',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.6 }}>⇄</div>
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '15px',
        color: 'var(--text)',
        marginBottom: '10px',
      }}>
        変更履歴を比較しよう
      </div>
      <p style={{
        fontSize: '12px',
        color: 'var(--text-mid)',
        lineHeight: '1.9',
        maxWidth: '320px',
        marginBottom: '20px',
      }}>
        「現在を保存」でこの瞬間のスナップショットを作成できます。
        保存後、いつでも過去の状態と現在を左右に並べて比較できます。
        <br />
        <span style={{ color: 'var(--accent)' }}>5分ごとに自動保存</span>もされます。
      </p>
      <button
        className="btn btn-primary"
        onClick={onSave}
        disabled={saving}
        style={{ fontSize: '13px' }}
      >
        {saving ? '保存中...' : '今すぐスナップショットを保存'}
      </button>
      <p style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginTop: '14px',
        lineHeight: '1.6',
      }}>
        ヒント: 執筆前に保存しておくと、大幅な書き直しの前後を比較できます
      </p>
    </div>
  );
}

// =========================================
// 差分ビュー用インラインエディタ
// =========================================

function DiffEditorPane() {
  const { currentEpisode, updateBody } = useEditorStore();
  const { settings } = useUIStore();
  const lastIdRef = useRef<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdate = useCallback(
    debounce((html: string) => updateBody(html), 300),
    [updateBody],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      RubyNode,
      DotenMark,
    ],
    content: currentEpisode?.body ?? '',
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'false',
        style: [
          `font-family: ${settings.editor_font}, serif`,
          `font-size: ${settings.editor_font_size}px`,
          'padding: 24px',
        ].join('; ') + ';',
      },
    },
    onUpdate: ({ editor: ed }) => debouncedUpdate(ed.getHTML()),
  });

  // エピソード切替時のみコンテンツをリセット
  useEffect(() => {
    if (!editor) return;
    if (currentEpisode?.id === lastIdRef.current) return;
    lastIdRef.current = currentEpisode?.id ?? null;
    editor.commands.setContent(currentEpisode?.body ?? '', false);
    const freshState = EditorState.create({
      doc: editor.state.doc,
      plugins: editor.state.plugins,
    });
    editor.view.updateState(freshState);
  }, [editor, currentEpisode?.id, currentEpisode?.body]);

  return <EditorContent editor={editor} className="h-full" />;
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
