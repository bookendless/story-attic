import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor;
  x: number;
  y: number;
  onClose: () => void;
  /** ルビダイアログを開く（メニュー自体はクローズされて消えるため、呼び出し元で状態を保持する必要がある） */
  onOpenRuby: () => void;
}

/**
 * エディタ本文用の右クリックメニュー。
 * 標準のコピー/切り取り/貼り付けに加え、太字・斜体・ルビ・傍点など執筆向け操作をまとめる。
 */
export function EditorContextMenu({ editor, x, y, onClose, onOpenRuby }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 画面端のクリップ処理（LeftPanel の EpisodeContextMenu と同じパターン）
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({
      x: x + rect.width > vw ? x - rect.width : x,
      y: y + rect.height > vh ? y - rect.height : y,
    });
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const hasSelection = !editor.state.selection.empty;
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isDoten = editor.isActive('doten');

  const menuItemStyle = {
    width: '100%',
    textAlign: 'left' as const,
    padding: '6px 14px',
    fontSize: '12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-mid)',
    transition: 'background 100ms',
  };

  const MenuItem = ({
    label,
    active = false,
    disabled = false,
    onClick,
  }: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) => (
    <button
      style={{
        ...menuItemStyle,
        color: disabled ? 'var(--text-muted)' : active ? 'var(--accent)' : 'var(--text-mid)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
        (e.currentTarget as HTMLElement).style.color = active ? 'var(--accent)' : 'var(--text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = disabled
          ? 'var(--text-muted)'
          : active
          ? 'var(--accent)'
          : 'var(--text-mid)';
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
    >
      {label}
    </button>
  );

  const separator = (
    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
  );

  const handleCut = () => {
    editor.chain().focus().run();
    document.execCommand('cut');
    onClose();
  };

  const handleCopy = () => {
    editor.chain().focus().run();
    document.execCommand('copy');
    onClose();
  };

  const handlePaste = () => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) editor.chain().focus().insertContent(text).run();
      })
      .catch(() => { /* クリップボード読み取り不可: 無視 */ })
      .finally(onClose);
  };

  return (
    <div
      ref={menuRef}
      // mousedown の既定動作（フォーカス移動）を抑止する。
      // これがないと項目クリック時にエディタがフォーカス（＝選択範囲）を失い、
      // 初回クリックはフォーカス移動だけで消費されてしまう（＝二度押ししないと発火しない）。
      // preventDefault は onClick を妨げず、外側クリック判定（mousedown）にも影響しない。
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 100,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-light)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(20,16,12,0.5)',
        minWidth: '170px',
        padding: '4px 0',
      }}
    >
      <MenuItem label="切り取り" disabled={!hasSelection} onClick={handleCut} />
      <MenuItem label="コピー" disabled={!hasSelection} onClick={handleCopy} />
      <MenuItem label="貼り付け" onClick={handlePaste} />

      {separator}

      <MenuItem
        label="太字"
        active={isBold}
        onClick={() => { editor.chain().focus().toggleBold().run(); onClose(); }}
      />
      <MenuItem
        label="斜体"
        active={isItalic}
        onClick={() => { editor.chain().focus().toggleItalic().run(); onClose(); }}
      />

      {separator}

      <MenuItem
        label="ルビを設定…"
        disabled={!hasSelection}
        onClick={() => { onClose(); onOpenRuby(); }}
      />
      <MenuItem
        label={isDoten ? '傍点をはずす' : '傍点をつける'}
        active={isDoten}
        disabled={!hasSelection}
        onClick={() => { editor.chain().focus().toggleDoten().run(); onClose(); }}
      />
    </div>
  );
}
