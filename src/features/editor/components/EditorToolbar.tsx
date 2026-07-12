import { useUIStore } from '@/shared/stores/uiStore';
import { useRubyDialog } from '../hooks/useRubyDialog';
import {
  IconUndo, IconRedo, IconRuby, IconDoten,
  IconFontMinus, IconFontPlus, IconEditorWidth,
  IconFocus, IconPanelShow,
  IconTategaki, IconProofread, IconDiff, IconBook,
} from '@/shared/components/Icons';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor;
}

// =========================================
// ツールバー本体
// =========================================
export function EditorToolbar({ editor }: Props) {
  const settings = useUIStore((s) => s.settings);
  const setSettings = useUIStore((s) => s.setSettings);
  const sidePanelVisible = useUIStore((s) => s.sidePanelVisible);
  const toggleSidePanel = useUIStore((s) => s.toggleSidePanel);
  const isTategaki = useUIStore((s) => s.isTategaki);
  const toggleTategaki = useUIStore((s) => s.toggleTategaki);
  const editorViewMode = useUIStore((s) => s.editorViewMode);
  const setEditorViewMode = useUIStore((s) => s.setEditorViewMode);
  const toggleReadingMode = useUIStore((s) => s.toggleReadingMode);
  const { openRubyDialog, dialog: rubyDialog } = useRubyDialog(editor);

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isDoten = editor.isActive('doten');

  const changeFontSize = (delta: number) => {
    const next = Math.max(10, Math.min(32, settings.editor_font_size + delta));
    setSettings({ ...settings, editor_font_size: next });
    // エディタのスタイルを即時更新
    const el = document.querySelector('.editor-content') as HTMLElement | null;
    if (el) el.style.fontSize = `${next}px`;
  };

  // エディタ幅の選択肢: 860（標準）→ 1200（ワイド）→ 0（制限なし）→ 860
  const widthCycle = [860, 1200, 0] as const;
  const widthLabels: Record<number, string> = { 860: '標準幅', 1200: 'ワイド', 0: '全幅' };
  const cycleEditorWidth = () => {
    const idx = widthCycle.indexOf(settings.editor_max_width as (typeof widthCycle)[number]);
    const next = widthCycle[(idx + 1) % widthCycle.length];
    setSettings({ ...settings, editor_max_width: next });
    // エディタのスタイルを即時更新
    const el = document.querySelector('.editor-content') as HTMLElement | null;
    if (el) {
      el.style.maxWidth = next > 0 ? `${next}px` : 'none';
      el.style.margin = next > 0 ? '0 auto' : '';
    }
  };

  // ツールバーボタンの共通スタイル
  const btn = (active = false, disabled = false) => ({
    padding: '3px 8px',
    borderRadius: '4px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: disabled
      ? 'var(--text-muted)'
      : active
      ? 'var(--accent)'
      : 'var(--text-mid)',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 150ms ease-out, color 150ms ease-out',
  });

  const sep = (
    <span
      style={{
        display: 'inline-block',
        width: '1px',
        height: '16px',
        background: 'var(--border)',
        margin: '0 4px',
        alignSelf: 'center',
      }}
    />
  );

  return (
    <>
      <div
        className="flex items-center gap-1 px-3 py-1 flex-shrink-0 border-b select-none"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          height: '34px',
        }}
      >
        {/* Undo / Redo */}
        <button
          style={btn(false, !canUndo)}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!canUndo}
          title="元に戻す (Ctrl+Z)"
        >
          <IconUndo size={14} />
        </button>
        <button
          style={btn(false, !canRedo)}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!canRedo}
          title="やり直し (Ctrl+Y)"
        >
          <IconRedo size={14} />
        </button>

        {sep}

        {/* テキスト装飾 */}
        <button
          style={btn(isBold)}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="太字 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          style={btn(isItalic)}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <em>I</em>
        </button>

        {sep}

        {/* 日本語小説専用 */}
        <button
          style={btn(false, editor.state.selection.empty)}
          onClick={openRubyDialog}
          disabled={editor.state.selection.empty}
          title="ルビを設定"
        >
          <IconRuby size={14} />
        </button>
        <button
          style={btn(isDoten, editor.state.selection.empty)}
          onClick={() => editor.chain().focus().toggleDoten().run()}
          disabled={editor.state.selection.empty}
          title="傍点を付ける"
        >
          <IconDoten size={14} />
        </button>

        {sep}

        {/* フォントサイズ */}
        <button
          style={btn()}
          onClick={() => changeFontSize(-1)}
          title="文字を小さく"
        >
          <IconFontMinus size={14} />
        </button>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            minWidth: '26px',
            textAlign: 'center',
          }}
        >
          {settings.editor_font_size}
        </span>
        <button
          style={btn()}
          onClick={() => changeFontSize(1)}
          title="文字を大きく"
        >
          <IconFontPlus size={14} />
        </button>

        {sep}

        {/* エディタ幅 */}
        <button
          style={btn()}
          onClick={cycleEditorWidth}
          title={`エディタ幅: ${widthLabels[settings.editor_max_width] ?? '標準幅'}（クリックで切替）`}
        >
          <IconEditorWidth size={14} />
        </button>

        {sep}

        {/* 縦書き切替 */}
        <button
          style={btn(isTategaki)}
          onClick={toggleTategaki}
          title="縦書き ON/OFF"
        >
          <IconTategaki size={14} />
        </button>

        {/* 校正ビュー */}
        <button
          style={btn(editorViewMode === 'proofread')}
          onClick={() => setEditorViewMode(editorViewMode === 'proofread' ? 'editor' : 'proofread')}
          title="校正ビュー"
        >
          <IconProofread size={14} />
        </button>

        {/* 差分ビュー */}
        <button
          style={btn(editorViewMode === 'diff')}
          onClick={() => setEditorViewMode(editorViewMode === 'diff' ? 'editor' : 'diff')}
          title="差分ビュー"
        >
          <IconDiff size={14} />
        </button>

        {/* 読書モード（通し読み） */}
        <button
          style={btn()}
          onClick={toggleReadingMode}
          title="読書モード（通し読み） (Ctrl+Shift+B)"
        >
          <IconBook size={14} />
        </button>

        {sep}

        {/* 集中モード: サイドパネル開閉 */}
        <button
          style={btn(!sidePanelVisible)}
          onClick={toggleSidePanel}
          title={sidePanelVisible ? 'サイドパネルを隠す（集中モード）' : 'サイドパネルを表示'}
        >
          {sidePanelVisible ? <IconFocus size={14} /> : <IconPanelShow size={14} />}
        </button>
      </div>

      {/* ルビ入力ダイアログ */}
      {rubyDialog}
    </>
  );
}
