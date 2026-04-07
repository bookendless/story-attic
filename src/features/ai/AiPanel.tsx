/**
 * AIパネル — コンテナシェル
 *
 * レイアウトモード（sidebar / floating）に応じた外枠を提供し、
 * 内部コンテンツ（AiChat + AiQuickActions）は共通で利用する。
 *
 * sidebar : WorkspacePage の右カラム内に描画（従来動作）
 * floating: position:fixed のドラッグ可能なフローティングウィンドウ
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { AiChat, type AiChatHandle } from './AiChat';
import { AiQuickActions } from './AiQuickActions';

// =========================================
// フローティング時のデフォルトサイズ・位置
// =========================================
const FLOAT_DEFAULT_W = 380;
const FLOAT_DEFAULT_H = 520;
const FLOAT_MIN_W = 300;
const FLOAT_MIN_H = 360;

export function AiPanel() {
  const aiPanelMode = useUIStore((s) => s.aiPanelMode);
  const chatRef = useRef<AiChatHandle | null>(null);

  if (aiPanelMode === 'floating') {
    return <FloatingShell chatRef={chatRef} />;
  }

  return <SidebarShell chatRef={chatRef} />;
}

// =========================================
// サイドバーモード（従来）
// =========================================

function SidebarShell({ chatRef }: { chatRef: React.RefObject<AiChatHandle | null> }) {
  const setAiPanelMode = useUIStore((s) => s.setAiPanelMode);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-deep)', borderLeft: '1px solid var(--border)' }}
    >
      <PanelToolbar onSwitchMode={() => setAiPanelMode('floating')} modeIcon="⇱" modeTitle="フローティングに切り替え" />
      <AiQuickActions chatRef={chatRef} />
      <AiChat chatRef={chatRef} />
    </div>
  );
}

// =========================================
// フローティングモード
// =========================================

function FloatingShell({ chatRef }: { chatRef: React.RefObject<AiChatHandle | null> }) {
  const { toggleAiPanel, setAiPanelMode } = useUIStore();

  // 位置・サイズ
  const [pos, setPos] = useState({ x: window.innerWidth - FLOAT_DEFAULT_W - 24, y: 56 });
  const [size, setSize] = useState({ w: FLOAT_DEFAULT_W, h: FLOAT_DEFAULT_H });

  // ドラッグ
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onDragStart = useCallback((e: React.MouseEvent) => {
    // リサイズハンドル上では発火させない
    if ((e.target as HTMLElement).dataset.resize) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 80)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 80)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // リサイズ
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    e.preventDefault();
    e.stopPropagation();
  }, [size]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      setSize({
        w: Math.max(FLOAT_MIN_W, resizeStart.current.w + dx),
        h: Math.max(FLOAT_MIN_H, resizeStart.current.h + dy),
      });
    };
    const onUp = () => { resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}
    >
      {/* ドラッグ用タイトルバー */}
      <div
        onMouseDown={onDragStart}
        style={{ cursor: 'grab', userSelect: 'none' }}
      >
        <PanelToolbar
          onSwitchMode={() => setAiPanelMode('sidebar')}
          onClose={toggleAiPanel}
          modeIcon="⇲"
          modeTitle="サイドバーに切り替え"
        />
      </div>

      <AiQuickActions chatRef={chatRef} />
      <AiChat chatRef={chatRef} />

      {/* リサイズハンドル（右下） */}
      <div
        data-resize="true"
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '16px',
          height: '16px',
          cursor: 'nwse-resize',
          // 小さな三角マーク
          background: 'linear-gradient(135deg, transparent 50%, var(--text-muted) 50%)',
          opacity: 0.4,
          borderRadius: '0 0 9px 0',
        }}
      />
    </div>
  );
}

// =========================================
// 共通ツールバー
// =========================================

function PanelToolbar({
  onSwitchMode,
  onClose,
  modeIcon,
  modeTitle,
}: {
  onSwitchMode: () => void;
  onClose?: () => void;
  modeIcon: string;
  modeTitle: string;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span
        className="text-xs font-medium"
        style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
      >
        AI アシスタント
      </span>
      <div className="flex items-center gap-1">
        <ToolbarButton onClick={onSwitchMode} title={modeTitle}>{modeIcon}</ToolbarButton>
        {onClose && <ToolbarButton onClick={onClose} title="閉じる">✕</ToolbarButton>}
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, title, children }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className="text-xs"
      style={{
        color: 'var(--text-muted)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 5px',
        borderRadius: '4px',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
