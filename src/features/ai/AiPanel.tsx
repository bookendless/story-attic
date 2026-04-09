/**
 * AIパネル — フローティングウィンドウ
 *
 * 右パネルから独立したドラッグ可能なフローティングウィンドウとして描画する。
 * ヘッダーのAI専用ボタンで開閉を制御する。
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { AiChat, type AiChatHandle } from './AiChat';
import { AiQuickActions } from './AiQuickActions';
import { AiPersonaSelector } from './AiPersonaSelector';
import { AiContextBar } from './AiContextBar';

// =========================================
// フローティング時のデフォルトサイズ・位置
// =========================================
const FLOAT_DEFAULT_W = 380;
const FLOAT_DEFAULT_H = 520;
const FLOAT_MIN_W = 300;
const FLOAT_MIN_H = 360;

export function AiPanel() {
  const chatRef = useRef<AiChatHandle | null>(null);
  const toggleAiPanel = useUIStore((s) => s.toggleAiPanel);

  // 位置・サイズ
  const [pos, setPos] = useState({ x: window.innerWidth - FLOAT_DEFAULT_W - 24, y: 56 });
  const [size, setSize] = useState({ w: FLOAT_DEFAULT_W, h: FLOAT_DEFAULT_H });

  // ドラッグ
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onDragStart = useCallback((e: React.MouseEvent) => {
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
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', cursor: 'grab', userSelect: 'none' }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}
        >
          AI アシスタント
        </span>
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
          onClick={toggleAiPanel}
          title="閉じる"
        >
          ✕
        </button>
      </div>

      <AiPersonaSelector />
      <AiContextBar />
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
          background: 'linear-gradient(135deg, transparent 50%, var(--text-muted) 50%)',
          opacity: 0.4,
          borderRadius: '0 0 9px 0',
        }}
      />
    </div>
  );
}
