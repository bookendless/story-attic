/**
 * AIパネル — フローティングウィンドウ / サイドバー固定
 *
 * aiPanelMode === 'float'   : 従来のドラッグ可能フローティングウィンドウ
 * aiPanelMode === 'sidebar' : ワークスペース右端に固定されたサイドバー
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useAiStore } from '@/shared/stores/aiStore';
import { AiChat, type AiChatHandle } from './AiChat';
import { AiQuickActions } from './AiQuickActions';
import { CreatorTypeSelector } from './CreatorTypeSelector';
import { CreativePhaseSelector } from './CreativePhaseSelector';
import { CreativeCoreEditor } from './CreativeCoreEditor';
import { AiContextBar } from './AiContextBar';
import { useStagnationDetector } from './useStagnationDetector';
import { PHASE_COLORS } from './phaseColors';

const FLOAT_DEFAULT_W = 380;
const FLOAT_DEFAULT_H = 560;
const FLOAT_MIN_W = 300;
const FLOAT_MIN_H = 380;
const SIDEBAR_DEFAULT_W = 360;
const SIDEBAR_MIN_W = 280;
const SIDEBAR_MAX_W = 520;

function loadSidebarWidth(): number {
  try {
    const v = Number(localStorage.getItem('story-attic-ai-sidebar-width'));
    if (v >= SIDEBAR_MIN_W && v <= SIDEBAR_MAX_W) return v;
  } catch { /* 無視 */ }
  return SIDEBAR_DEFAULT_W;
}

export function AiPanel() {
  const chatRef = useRef<AiChatHandle | null>(null);
  const { toggleAiPanel, aiPanelMode, toggleAiPanelMode, toggleAiManual } = useUIStore();
  const phase = useAiStore((s) => s.phase);
  const isWritePhase = phase === 'write';
  const phaseColor = PHASE_COLORS[phase];
  const isSidebar = aiPanelMode === 'sidebar';

  useStagnationDetector();

  // ── Float モード: ドラッグ ──────────────────────────
  const [pos, setPos] = useState({ x: window.innerWidth - FLOAT_DEFAULT_W - 24, y: 56 });
  const [size, setSize] = useState({ w: FLOAT_DEFAULT_W, h: FLOAT_DEFAULT_H });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (isSidebar) return;
    if ((e.target as HTMLElement).dataset.resize) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos, isSidebar]);

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

  // ── Float モード: リサイズ ─────────────────────────
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

  // ── Sidebar モード: 幅リサイズ ────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const sideResizing = useRef(false);
  const sideResizeStart = useRef({ x: 0, w: 0 });

  const onSideResizeStart = useCallback((e: React.MouseEvent) => {
    sideResizing.current = true;
    sideResizeStart.current = { x: e.clientX, w: sidebarWidth };
    e.preventDefault();
    e.stopPropagation();
  }, [sidebarWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sideResizing.current) return;
      const dx = sideResizeStart.current.x - e.clientX; // 左ドラッグで広がる
      const next = Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, sideResizeStart.current.w + dx));
      setSidebarWidth(next);
    };
    const onUp = () => {
      if (sideResizing.current) {
        sideResizing.current = false;
        try { localStorage.setItem('story-attic-ai-sidebar-width', String(sidebarWidth)); } catch { /* 無視 */ }
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [sidebarWidth]);

  // ── 共通UI ────────────────────────────────────────
  const titleBar = (
    <div
      onMouseDown={isSidebar ? undefined : onDragStart}
      className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
      style={{
        borderBottom: `1px solid ${phaseColor.border}`,
        cursor: isSidebar ? 'default' : 'grab',
        userSelect: 'none',
        background: phaseColor.bg,
        transition: 'background 300ms, border-color 300ms',
      }}
    >
      <span
        className="text-xs font-medium"
        style={{
          color: isWritePhase ? phaseColor.accent : 'var(--text)',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.05em',
          transition: 'color 300ms',
        }}
      >
        {isWritePhase ? '静かに見守り中...' : 'AI 思考パートナー'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span
          style={{
            fontSize: '9px',
            padding: '1px 6px',
            borderRadius: '6px',
            background: phaseColor.bg,
            color: phaseColor.accent,
            border: `1px solid ${phaseColor.border}`,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          {phase === 'explore' ? '探索' : phase === 'structure' ? '構造' : phase === 'write' ? '執筆' : '改稿'}
        </span>
        {/* マニュアル */}
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
            fontSize: '11px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          onClick={toggleAiManual}
          title="AI マニュアルを開く"
        >
          ?
        </button>
        {/* ピン留めトグル */}
        <button
          className="text-xs"
          style={{
            color: isSidebar ? phaseColor.accent : 'var(--text-muted)',
            background: isSidebar ? phaseColor.bg : 'none',
            border: isSidebar ? `1px solid ${phaseColor.border}` : 'none',
            cursor: 'pointer',
            padding: '2px 5px',
            borderRadius: '4px',
            lineHeight: 1,
            fontSize: '11px',
          }}
          onClick={toggleAiPanelMode}
          title={isSidebar ? 'フローティングに切替' : 'サイドバーに固定'}
        >
          {isSidebar ? '📌' : '⊞'}
        </button>
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
    </div>
  );

  const innerContent = (
    <>
      {titleBar}
      <CreativePhaseSelector />
      <CreatorTypeSelector />
      <AiContextBar />
      <CreativeCoreEditor />
      <AiQuickActions chatRef={chatRef} />
      <AiChat chatRef={chatRef} />
    </>
  );

  // ── Sidebar レンダリング ──────────────────────────
  if (isSidebar) {
    return (
      <div
        style={{
          position: 'relative',
          width: sidebarWidth,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-deep)',
          borderLeft: `1px solid ${phaseColor.border}`,
          transition: 'border-color 300ms',
          overflow: 'hidden',
        }}
      >
        {/* 左端リサイズハンドル */}
        <div
          onMouseDown={onSideResizeStart}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '4px',
            height: '100%',
            cursor: 'ew-resize',
            zIndex: 10,
          }}
        />
        {innerContent}
      </div>
    );
  }

  // ── Float レンダリング ────────────────────────────
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
        border: `1px solid ${phaseColor.border}`,
        borderRadius: '10px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${phaseColor.bg}`,
        overflow: 'hidden',
        transition: 'border-color 300ms, box-shadow 300ms',
      }}
    >
      {innerContent}
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
          background: `linear-gradient(135deg, transparent 50%, ${phaseColor.accent} 50%)`,
          opacity: 0.35,
          borderRadius: '0 0 9px 0',
        }}
      />
    </div>
  );
}
