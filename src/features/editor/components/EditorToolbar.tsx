import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useUIStore } from '@/shared/stores/uiStore';
import {
  IconUndo, IconRedo, IconRuby, IconDoten,
  IconFontMinus, IconFontPlus, IconEditorWidth,
  IconFocus, IconPanelShow,
} from '@/shared/components/Icons';

interface Props {
  editor: Editor;
}

// =========================================
// ルビ入力ダイアログ
// =========================================
interface RubyDialogProps {
  selectedText: string;
  onConfirm: (ruby: string) => void;
  onClose: () => void;
}

function RubyDialog({ selectedText, onConfirm, onClose }: RubyDialogProps) {
  const [ruby, setRuby] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ minWidth: '320px' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
          ルビを設定
        </h3>
        <div className="mb-3">
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>対象テキスト</p>
          <div
            className="px-3 py-2 rounded text-sm"
            style={{
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontFamily: 'var(--font-editor)',
            }}
          >
            {selectedText || '（テキストが選択されていません）'}
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
            読み（ふりがな）
          </label>
          <input
            ref={inputRef}
            className="input text-sm"
            placeholder="例：かんじ"
            value={ruby}
            onChange={(e) => setRuby(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ruby.trim() && selectedText) onConfirm(ruby.trim());
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost text-xs" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn-primary text-xs"
            onClick={() => ruby.trim() && selectedText && onConfirm(ruby.trim())}
            disabled={!ruby.trim() || !selectedText}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================
// ツールバー本体
// =========================================
export function EditorToolbar({ editor }: Props) {
  const { settings, setSettings, leftPanelVisible, toggleLeftPanel } = useUIStore();
  const [showRubyDialog, setShowRubyDialog] = useState(false);
  const [selectedTextForRuby, setSelectedTextForRuby] = useState('');

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isDoten = editor.isActive('doten');

  const handleRuby = () => {
    const { from, to, empty } = editor.state.selection;
    if (empty) return;
    const text = editor.state.doc.textBetween(from, to, '');
    setSelectedTextForRuby(text);
    setShowRubyDialog(true);
  };

  const handleRubyConfirm = (ruby: string) => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '');
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: 'ruby',
        attrs: { text, ruby },
      })
      .run();
    setShowRubyDialog(false);
  };

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
          onClick={handleRuby}
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

        {/* 集中モード */}
        <button
          style={btn(!leftPanelVisible)}
          onClick={toggleLeftPanel}
          title={leftPanelVisible ? '左パネルを隠す（集中モード）' : '左パネルを表示'}
        >
          {leftPanelVisible ? <IconFocus size={14} /> : <IconPanelShow size={14} />}
        </button>
      </div>

      {/* ルビ入力ダイアログ */}
      {showRubyDialog && (
        <RubyDialog
          selectedText={selectedTextForRuby}
          onConfirm={handleRubyConfirm}
          onClose={() => setShowRubyDialog(false)}
        />
      )}
    </>
  );
}
