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
  IconClose,
  IconSettings,
} from '@/shared/components/Icons';
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
];

// =========================================
// メインコンポーネント
// =========================================

export function RightPanel() {
  const {
    activeRightTab,
    setActiveRightTab,
    visibleRightTabs,
    setVisibleRightTabs,
    rightPanelWidth,
    setRightPanelWidth,
    toggleRightPanel,
  } = useUIStore();

  // 表示タブのみをフィルタ
  const visibleTabs = TABS.filter((t) => visibleRightTabs.includes(t.key));

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
          tabs={visibleTabs}
          allTabs={TABS}
          visibleKeys={visibleRightTabs}
          activeTab={activeRightTab}
          onTabChange={setActiveRightTab}
          onVisibilityChange={setVisibleRightTabs}
          onClose={toggleRightPanel}
        />

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-hidden relative">
          {visibleTabs.map((tab) => {
            if (!mountedTabs.has(tab.key)) return null;
            return (
              <div
                key={tab.key}
                className="absolute inset-0 overflow-auto"
                style={{ display: activeRightTab === tab.key ? 'flex' : 'none', flexDirection: 'column' }}
              >
                <TabContent tabKey={tab.key} />
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
  tabs,
  allTabs,
  visibleKeys,
  activeTab,
  onTabChange,
  onVisibilityChange,
  onClose,
}: {
  tabs: TabDef[];
  allTabs: TabDef[];
  visibleKeys: RightPanelTab[];
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  onVisibilityChange: (tabs: RightPanelTab[]) => void;
  onClose: () => void;
}) {
  const [showConfig, setShowConfig] = useState(false);

  const toggleTabVisibility = (key: RightPanelTab) => {
    if (visibleKeys.includes(key)) {
      // 最低1つは残す
      if (visibleKeys.length <= 1) return;
      onVisibilityChange(visibleKeys.filter((k) => k !== key));
    } else {
      onVisibilityChange([...visibleKeys, key]);
    }
  };

  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab) => {
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

      {/* タブ設定ボタン */}
      <div className="relative flex-shrink-0">
        <button
          className="p-1.5 mr-0.5"
          style={{
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          onClick={() => setShowConfig((v) => !v)}
          title="タブの表示設定"
        >
          <IconSettings size={11} />
        </button>

        {/* タブ設定ポップオーバー */}
        {showConfig && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowConfig(false)} />
            <div
              className="absolute right-0 top-full z-50 py-1 rounded-lg shadow-lg"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                minWidth: '140px',
              }}
            >
              {allTabs.map((tab) => {
                const checked = visibleKeys.includes(tab.key);
                return (
                  <label
                    key={tab.key}
                    className="flex items-center gap-2 px-3 py-1 text-xs cursor-pointer"
                    style={{ color: 'var(--text)' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTabVisibility(tab.key)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {tab.label}
                  </label>
                );
              })}
            </div>
          </>
        )}
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

function TabContent({ tabKey }: { tabKey: RightPanelTab }) {
  switch (tabKey) {
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
