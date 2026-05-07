import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { StarterKit } from '@tiptap/starter-kit';
import { SearchAndReplace } from '@sereneinserenade/tiptap-search-and-replace';
import { useEditorStore } from '@/shared/stores/editorStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { RubyNode } from '../extensions/RubyNode';
import { DotenMark } from '../extensions/DotenMark';
import { AutoIndent } from '../extensions/AutoIndent';
import { DashRule } from '../extensions/DashRule';
import { StatusBar } from './StatusBar';
import { SearchBar } from './SearchBar';
import { EditorToolbar } from './EditorToolbar';
import { ProofreadPanel } from '@/features/analysis/ProofreadPanel';
import { DiffView } from '@/features/analysis/DiffView';
import { DialogueView } from './DialogueView';
import { PreviewView } from './PreviewView';
import { DualEditorView } from './DualEditorView';
import { soundManager } from '@/features/ambience/SoundManager';
import { notifyActivity } from '@/shared/utils/idleTracker';
import { SelectionPopup } from './SelectionPopup';
import { EditorEmptyState } from './EditorEmptyState';

// debounce ユーティリティ
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function EditorArea() {
  const { currentEpisode, updateBody, save } = useEditorStore();
  const { searchBarVisible, isTategaki, settings, editorViewMode } = useUIStore();
  const lastEpisodeIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 縦書きモード時: マウスホイール縦スクロール → 横スクロールに変換
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isTategaki) return;
    const handler = (e: WheelEvent) => {
      const content = container.querySelector<HTMLElement>('.editor-content');
      if (!content) return;
      e.preventDefault();
      content.scrollLeft -= e.deltaY;
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [isTategaki, editorViewMode]);

  // debounce済みの本文更新（300ms）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdate = useCallback(
    debounce((html: string) => updateBody(html), 300),
    [updateBody],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 不要な拡張を無効化（日本語小説用）
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      SearchAndReplace.configure({
        searchResultClass: 'search-result',
      }),
      RubyNode,
      DotenMark,
      DashRule,
      ...(settings.auto_indent ? [AutoIndent] : []),
    ],
    content: currentEpisode?.body ?? '',
    editorProps: {
      attributes: {
        class: 'editor-content',
        spellcheck: 'false',
        style: [
          `font-family: ${settings.editor_font}, serif`,
          `font-size: ${settings.editor_font_size}px`,
          `max-width: ${settings.editor_max_width > 0 ? `${settings.editor_max_width}px` : '100%'}`,
          settings.editor_max_width > 0 ? 'margin: 0 auto' : '',
        ].filter(Boolean).join('; ') + ';',
      },
    },
    onUpdate: ({ editor, transaction }) => {
      debouncedUpdate(editor.getHTML());
      // テキスト入力時にタイピング音を再生 + アイドルタイマーをリセット
      if (transaction.docChanged) {
        soundManager.playTyping();
        notifyActivity();
      }
    },
  });

  // 設定変更時にエディタのスタイル（フォント・サイズ・最大幅）をリアルタイム反映
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: 'editor-content',
          spellcheck: 'false',
          style: [
            `font-family: ${settings.editor_font}, serif`,
            `font-size: ${settings.editor_font_size}px`,
            `max-width: ${settings.editor_max_width > 0 ? `${settings.editor_max_width}px` : '100%'}`,
            settings.editor_max_width > 0 ? 'margin: 0 auto' : '',
          ].filter(Boolean).join('; ') + ';',
        },
      },
    });
  }, [editor, settings.editor_font, settings.editor_font_size, settings.editor_max_width, isTategaki]);

  // エピソードが切り替わったらエディタの内容を更新し、Undo履歴をリセット
  useEffect(() => {
    if (!editor) return;
    if (currentEpisode?.id === lastEpisodeIdRef.current) return;

    lastEpisodeIdRef.current = currentEpisode?.id ?? null;
    editor.commands.setContent(currentEpisode?.body ?? '', false);

    // エピソード切替時にUndo/Redo履歴をクリアする
    // 新しいEditorStateを生成することでプラグイン状態（History含む）をリセット
    const freshState = EditorState.create({
      doc: editor.state.doc,
      plugins: editor.state.plugins,
    });
    editor.view.updateState(freshState);
  }, [editor, currentEpisode?.id, currentEpisode?.body]);

  // Ctrl+S で保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  // 自動保存
  useEffect(() => {
    if (!settings.auto_save) return;
    const interval = setInterval(() => save(), settings.auto_save_interval_sec * 1000);
    return () => clearInterval(interval);
  }, [save, settings.auto_save, settings.auto_save_interval_sec]);

  if (!currentEpisode) {
    return <EditorEmptyState />;
  }

  // 差分ビューモード
  if (editorViewMode === 'diff') {
    return <DiffView />;
  }

  // 台詞ビューモード
  if (editorViewMode === 'dialogue') {
    return <DialogueView />;
  }

  // プレビューモード
  if (editorViewMode === 'preview') {
    return <PreviewView />;
  }

  // デュアルビューモード
  if (editorViewMode === 'dual') {
    return <DualEditorView />;
  }

  // 校正ビューモード: エディタ + 校正パネルの横並び
  if (editorViewMode === 'proofread') {
    return (
      <div className="h-full flex">
        {/* エディタ部分 */}
        <div className={`flex-1 flex flex-col ${isTategaki ? 'editor-tategaki' : ''}`} style={{ background: 'var(--bg)' }}>
          {editor && <EditorToolbar editor={editor} />}
          {searchBarVisible && editor && <SearchBar editor={editor} />}
          <div ref={scrollContainerRef} className="flex-1 overflow-auto">
            <EditorContent editor={editor} className="h-full" />
          </div>
          {settings.show_char_count && editor && <StatusBar editor={editor} />}
        </div>
        {/* 校正パネル（右側 320px） */}
        <div className="flex-shrink-0" style={{ width: '320px' }}>
          <ProofreadPanel editor={editor} />
        </div>
      </div>
    );
  }

  // 通常エディタモード
  return (
    <div className={`h-full flex flex-col ${isTategaki ? 'editor-tategaki' : ''}`} style={{ background: 'var(--bg)' }}>
      {/* ツールバー */}
      {editor && <EditorToolbar editor={editor} />}

      {/* 検索・置換バー */}
      {searchBarVisible && editor && <SearchBar editor={editor} />}

      {/* エディタ本体 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* ステータスバー */}
      {settings.show_char_count && editor && (
        <StatusBar editor={editor} />
      )}

      {/* 選択語句ポップアップ */}
      {editor && <SelectionPopup editor={editor} />}
    </div>
  );
}
