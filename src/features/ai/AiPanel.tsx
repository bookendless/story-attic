/**
 * AIパネル — フェーズ駆動レイアウト（Plan B）
 *
 * aiPanelMode === 'float'   : ドラッグ可能フローティングウィンドウ
 * aiPanelMode === 'sidebar' : ワークスペース右端に固定されたサイドバー
 *
 * シェル構成: PhaseRail（左端）+ [ PhaseHeader / PhaseBody / AiChat ]
 */

import { useRef, useState, useCallback, useEffect, type ComponentType } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useAiStore } from '@/shared/stores/aiStore';
import { AiChat, type AiChatHandle } from './AiChat';
import { useStagnationDetector } from './useStagnationDetector';
import { PHASE_COLORS } from './phaseColors';
import { PhaseHeader } from './PhaseHeader';
import { PhaseRail } from './PhaseRail';
import { ExplorePhase } from './phases/ExplorePhase';
import { StructurePhase } from './phases/StructurePhase';
import { WritePhase } from './phases/WritePhase';
import { RevisePhase } from './phases/RevisePhase';
import type { WriteLevel, PhaseBodyProps } from './types';

const FLOAT_DEFAULT_W = 420;
const FLOAT_DEFAULT_H = 560;
const FLOAT_MIN_W = 340;
const FLOAT_MIN_H = 380;
const SIDEBAR_DEFAULT_W = 380;
const SIDEBAR_MIN_W = 320;
const SIDEBAR_MAX_W = 520;

const WRITE_LEVEL_KEY = 'story-attic-ai-write-level';

function loadSidebarWidth(): number {
  try {
    const v = Number(localStorage.getItem('story-attic-ai-sidebar-width'));
    if (v >= SIDEBAR_MIN_W && v <= SIDEBAR_MAX_W) return v;
  } catch { /* 無視 */ }
  return SIDEBAR_DEFAULT_W;
}

function loadWriteLevel(): WriteLevel {
  try {
    const v = localStorage.getItem(WRITE_LEVEL_KEY) as WriteLevel;
    if (v === 'silent' || v === 'mini' || v === 'open') return v;
  } catch { /* 無視 */ }
  return 'silent'; // デフォルトは「静寂」
}

const PHASE_BODIES: Record<string, ComponentType<PhaseBodyProps>> = {
  explore: ExplorePhase,
  structure: StructurePhase,
  write: WritePhase,
  revise: RevisePhase,
};

export function AiPanel() {
  const chatRef = useRef<AiChatHandle | null>(null);
  const { toggleAiPanel, aiPanelMode, toggleAiPanelMode, toggleAiManual } = useUIStore();
  const phase = useAiStore((s) => s.phase);
  const isStreaming = useAiStore((s) => s.isStreaming);
  const phaseColor = PHASE_COLORS[phase];
  const isSidebar = aiPanelMode === 'sidebar';

  useStagnationDetector();

  // 執筆フェーズの呼び出しレベル（localStorage 永続化）
  const [writeLevel, setWriteLevelState] = useState<WriteLevel>(loadWriteLevel);
  const setWriteLevel = useCallback((lv: WriteLevel) => {
    setWriteLevelState(lv);
    try { localStorage.setItem(WRITE_LEVEL_KEY, lv); } catch { /* 無視 */ }
  }, []);

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

  // ── パネル本体（PhaseRail + フェーズ層）───────────
  const PhaseBody = PHASE_BODIES[phase] ?? ExplorePhase;
  const isSilent = phase === 'write' && writeLevel === 'silent';

  const panelBody = (
    <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minWidth: 0, minHeight: 0 }}>
      <PhaseRail />
      <div
        onMouseDown={isSidebar ? undefined : onDragStart}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          cursor: isSidebar ? 'default' : 'grab',
        }}
      >
        <PhaseHeader
          phase={phase}
          pinned={isSidebar}
          writeLevel={writeLevel}
          onTogglePin={toggleAiPanelMode}
          onManual={toggleAiManual}
          onClose={toggleAiPanel}
          onCycleWriteLevel={setWriteLevel}
        />
        <div
          style={{
            flex: isSilent ? 1 : '0 0 auto',
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PhaseBody chatRef={chatRef} isStreaming={isStreaming} writeLevel={writeLevel} />
        </div>
        <AiChat chatRef={chatRef} writeLevel={writeLevel} />
      </div>
    </div>
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
          transition: 'border-color 320ms',
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
        {panelBody}
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
        transition: 'border-color 320ms, box-shadow 320ms',
      }}
    >
      {panelBody}
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
