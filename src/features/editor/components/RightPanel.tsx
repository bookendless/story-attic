/**
 * 右パネル — タブ切替で各機能パネルを表示する基盤コンポーネント
 *
 * タブ: プロット / 人物 / 用語 / 資料 / メモ / AI
 * 左端にドラッグリサイズハンドルを配置。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore, type RightPanelTab, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH } from '@/shared/stores/uiStore';
import {
  IconPlot,
  IconCharacter,
  IconGlossary,
  IconMaterial,
  IconMemo,
  IconAi,
  IconClose,
} from '@/shared/components/Icons';
import { AiChat, type AiChatHandle } from '@/features/ai/AiChat';
import { AiQuickActions } from '@/features/ai/AiQuickActions';
import { CharacterPanel } from '@/features/characters/CharacterPanel';
import { GlossaryPanel } from '@/features/glossary/GlossaryPanel';
import { MemoPanel } from '@/features/memo/MemoPanel';
import { MaterialPanel } from '@/features/material/MaterialPanel';
import { PlotPanel } from '@/features/plot/PlotPanel';

// =========================================
// タブ定義
// =========================================

interface TabDef {
  key: RightPanelTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabDef[] = [
  { key: 'plot',      label: 'プロット', icon: IconPlot },
  { key: 'character', label: '人物',     icon: IconCharacter },
  { key: 'glossary',  label: '用語',     icon: IconGlossary },
  { key: 'material',  label: '資料',     icon: IconMaterial },
  { key: 'memo',      label: 'メモ',     icon: IconMemo },
  { key: 'ai',        label: 'AI',       icon: IconAi },
];

// =========================================
// メインコンポーネント
// =========================================

export function RightPanel() {
  const {
    activeRightTab,
    setActiveRightTab,
    rightPanelWidth,
    setRightPanelWidth,
    toggleRightPanel,
  } = useUIStore();

  // AI チャット用 ref（AI タブで共有）
  const chatRef = useRef<AiChatHandle | null>(null);

  // lazy mount: 一度でもアクティブになったタブを記録
  const [mountedTabs, setMountedTabs] = useState<Set<RightPanelTab>>(
    () => new Set([activeRightTab]),
  );

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeRightTab)) return prev;
      const next = new Set(prev);
      next.add(activeRightTab);
      return next;
    });
  }, [activeRightTab]);

  return (
    <div
      className="flex h-full relative"
      style={{ background: 'var(--bg-deep)', borderLeft: '1px solid var(--border)' }}
    >
      {/* リサイズハンドル */}
      <ResizeHandle width={rightPanelWidth} onWidthChange={setRightPanelWidth} />

      {/* パネル本体 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* タブバー */}
        <TabBar
          activeTab={activeRightTab}
          onTabChange={setActiveRightTab}
          onClose={toggleRightPanel}
        />

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-hidden relative">
          {TABS.map((tab) => {
            if (!mountedTabs.has(tab.key)) return null;
            return (
              <div
                key={tab.key}
                className="absolute inset-0 overflow-auto"
                style={{ display: activeRightTab === tab.key ? 'flex' : 'none', flexDirection: 'column' }}
              >
                <TabContent tabKey={tab.key} chatRef={chatRef} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =========================================
// タブバー
// =========================================

function TabBar({
  activeTab,
  onTabChange,
  onClose,
}: {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex flex-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className="flex items-center gap-1 px-2 py-1.5 text-xs whitespace-nowrap transition-colors"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                background: isActive ? 'var(--bg)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
              onClick={() => onTabChange(tab.key)}
              title={tab.label}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <button
        className="flex-shrink-0 p-1.5 mr-1"
        style={{
          color: 'var(--text-muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '4px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
        onClick={onClose}
        title="パネルを閉じる"
      >
        <IconClose size={12} />
      </button>
    </div>
  );
}

// =========================================
// タブコンテンツ
// =========================================

function TabContent({
  tabKey,
  chatRef,
}: {
  tabKey: RightPanelTab;
  chatRef: React.RefObject<AiChatHandle | null>;
}) {
  switch (tabKey) {
    case 'ai':
      return <AiTabContent chatRef={chatRef} />;
    case 'plot':
      return <PlotPanel />;
    case 'character':
      return <CharacterPanel />;
    case 'glossary':
      return <GlossaryPanel />;
    case 'material':
      return <MaterialPanel />;
    case 'memo':
      return <MemoPanel />;
  }
}

/** AI タブ — 既存の AiChat + AiQuickActions を直接利用 */
function AiTabContent({ chatRef }: { chatRef: React.RefObject<AiChatHandle | null> }) {
  const setAiPanelMode = useUIStore((s) => s.setAiPanelMode);

  return (
    <div className="flex flex-col h-full">
      {/* フローティング切替ボタン */}
      <div
        className="flex items-center justify-between px-3 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
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
          onClick={() => setAiPanelMode('floating')}
          title="フローティングに切り替え"
        >
          ⇱
        </button>
      </div>
      <AiQuickActions chatRef={chatRef} />
      <AiChat chatRef={chatRef} />
    </div>
  );
}

// =========================================
// リサイズハンドル
// =========================================

function ResizeHandle({
  width,
  onWidthChange,
}: {
  width: number;
  onWidthChange: (w: number) => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      e.preventDefault();
    },
    [width],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      // ハンドルを左に動かす → 幅が増える
      const delta = startX.current - e.clientX;
      const newWidth = Math.max(
        RIGHT_PANEL_MIN_WIDTH,
        Math.min(RIGHT_PANEL_MAX_WIDTH, startWidth.current + delta),
      );
      onWidthChange(newWidth);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onWidthChange]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: '4px',
        cursor: 'col-resize',
        flexShrink: 0,
        background: 'transparent',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.opacity = '0.4'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '1'; }}
    />
  );
}
