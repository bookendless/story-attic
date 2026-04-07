import { useState, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';

interface Props {
  editor: Editor;
}

export function StatusBar({ editor }: Props) {
  const { settings, proofreadSettings, setEditorViewMode, editorViewMode } = useUIStore();
  const lastAutoSavedAt = useEditorStore((s) => s.lastAutoSavedAt);
  const [charCount, setCharCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [proofCount, setProofCount] = useState<number | null>(null);
  const [showAutoSaved, setShowAutoSaved] = useState(false);

  // エディタの更新イベントを直接サブスクライブしてリアルタイム更新
  useEffect(() => {
    const updateCounts = () => {
      const text = editor.getText();
      setCharCount(text.length);
      setLineCount(text.split('\n').length);
    };
    updateCounts();
    editor.on('update', updateCounts);
    return () => { editor.off('update', updateCounts); };
  }, [editor]);

  // 校正件数をバックグラウンドで定期チェック（debounce 2秒）
  const checkProofread = useCallback(() => {
    if (!proofreadSettings.enabled) {
      setProofCount(null);
      return;
    }
    const enabledCategories = Object.entries(proofreadSettings.categories)
      .filter(([, v]) => v)
      .map(([k]) => k);

    invoke<unknown[]>('run_proofread', {
      text: editor.getHTML(),
      categories: enabledCategories,
    })
      .then((result) => setProofCount(result.length))
      .catch(() => setProofCount(null));
  }, [editor, proofreadSettings]);

  useEffect(() => {
    if (!proofreadSettings.enabled) {
      setProofCount(null);
      return;
    }
    // 初回実行
    checkProofread();
    // エディタ更新時にdebounceでチェック
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(checkProofread, 2000);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      clearTimeout(timer);
    };
  }, [editor, proofreadSettings.enabled, checkProofread]);

  // 自動保存完了時に3秒間「自動保存済み」を表示
  useEffect(() => {
    if (!lastAutoSavedAt) return;
    setShowAutoSaved(true);
    const timer = setTimeout(() => setShowAutoSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [lastAutoSavedAt]);

  // 原稿換算ページ数
  const charsPerPage = settings.chars_per_line * settings.lines_per_page;
  const pageCount = charsPerPage > 0 ? Math.ceil(charCount / charsPerPage) : 0;

  return (
    <div
      className="flex items-center gap-4 px-4 py-1 flex-shrink-0 border-t text-xs"
      style={{
        background: 'var(--bg-deep)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      <span>{charCount.toLocaleString()} 字</span>
      <span>{lineCount.toLocaleString()} 行</span>
      <span>{pageCount} ページ</span>
      {showAutoSaved && (
        <span
          style={{
            color: 'var(--success)',
            transition: 'opacity 300ms',
          }}
        >
          自動保存済み
        </span>
      )}
      {proofCount !== null && proofCount > 0 && (
        <button
          className="hover:opacity-80 transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--warning)',
            fontSize: '12px',
          }}
          onClick={() => setEditorViewMode(editorViewMode === 'proofread' ? 'editor' : 'proofread')}
          title="校正パネルを開く"
        >
          校正: {proofCount}件
        </button>
      )}
    </div>
  );
}
