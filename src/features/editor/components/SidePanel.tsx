/**
 * 統合サイドパネル
 *
 * 左側の垂直アクティビティバー (ActivityBar) と、選択中タブの
 * コンテンツ領域を組み合わせた統合ナビゲーションパネル。
 * 旧 LeftPanel (目次) と RightPanel (プロット/人物等) を一本化する。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useUIStore,
  type SideTab,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
} from '@/shared/stores/uiStore';
import {
  IconMemo,
  IconPlot,
  IconCharacter,
  IconGlossary,
  IconPanelShow,
  IconAnalysis,
  IconSettings,
  IconChapter,
  IconRelationship,
  IconWorld,
  IconForeshadowing,
  IconSynopsis,
} from '@/shared/components/Icons';
import { LeftPanel } from './LeftPanel';
import { CharacterPanel } from '@/features/characters/CharacterPanel';
import { GlossaryPanel } from '@/features/glossary/GlossaryPanel';
import { MemoPanel } from '@/features/memo/MemoPanel';
import { PlotPanel } from '@/features/plot/PlotPanel';
import { SynopsisPanel } from '@/features/synopsis/SynopsisPanel';
import { PlotThreadPanel } from '@/features/plot-threads/PlotThreadPanel';
import { ChapterPanel } from '@/features/chapters/ChapterPanel';
import { RelationshipPanel } from '@/features/relationship/RelationshipPanel';
import { WorldSettingPanel } from '@/features/world/WorldSettingPanel';

interface TabDef {
  key: SideTab;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: TabDef[] = [
  { key: 'toc',           label: '目次',       shortcut: 'Ctrl+1', icon: IconPanelShow },
  { key: 'chapter',       label: '章立て',     shortcut: 'Ctrl+2', icon: IconChapter },
  { key: 'character',     label: '人物',       shortcut: 'Ctrl+3', icon: IconCharacter },
  { key: 'plot',          label: 'プロット',   shortcut: 'Ctrl+4', icon: IconPlot },
  { key: 'synopsis',      label: 'あらすじ',   shortcut: 'Ctrl+5', icon: IconSynopsis },
  { key: 'relationship',  label: '相関図',     shortcut: 'Ctrl+6', icon: IconRelationship },
  { key: 'glossary',      label: '用語',       shortcut: 'Ctrl+7', icon: IconGlossary },
  { key: 'world',         label: '世界観',     shortcut: 'Ctrl+8', icon: IconWorld },
  { key: 'foreshadowing', label: '伏線',       shortcut: 'Ctrl+9', icon: IconForeshadowing },
  { key: 'memo',          label: 'メモ',       shortcut: 'Ctrl+0', icon: IconMemo },
];

export function SidePanel() {
  const {
    sidePanelVisible,
    activeSideTab,
    setActiveSideTab,
    rightPanelWidth,
    setRightPanelWidth,
  } = useUIStore();

  // lazy mount
  const [mountedTabs, setMountedTabs] = useState<Set<SideTab>>(
    () => new Set([activeSideTab]),
  );
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeSideTab)) return prev;
      const next = new Set(prev);
      next.add(activeSideTab);
      return next;
    });
  }, [activeSideTab]);

  if (!sidePanelVisible) {
    return <ActivityBar tabs={TABS} activeTab={activeSideTab} onTabChange={setActiveSideTab} collapsed />;
  }

  return (
    <div className="flex h-full flex-shrink-0" style={{ background: 'var(--bg-deep)' }}>
      <ActivityBar tabs={TABS} activeTab={activeSideTab} onTabChange={setActiveSideTab} />

      {/* パネルコンテンツ */}
      <div
        className="flex flex-col relative"
        style={{
          width: `${rightPanelWidth}px`,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-deep)',
        }}
      >
        {TABS.map((tab) => {
          if (!mountedTabs.has(tab.key)) return null;
          return (
            <div
              key={tab.key}
              className="absolute inset-0 overflow-hidden"
              style={{ display: activeSideTab === tab.key ? 'flex' : 'none', flexDirection: 'column' }}
            >
              <TabContent tabKey={tab.key} />
            </div>
          );
        })}
        {/* 右端リサイズハンドル */}
        <ResizeHandle width={rightPanelWidth} onWidthChange={setRightPanelWidth} />
      </div>
    </div>
  );
}

// =========================================
// 垂直アクティビティバー
// =========================================

function ActivityBar({
  tabs,
  activeTab,
  onTabChange,
  collapsed = false,
}: {
  tabs: TabDef[];
  activeTab: SideTab;
  onTabChange: (t: SideTab) => void;
  collapsed?: boolean;
}) {
  const toggleSidePanel = useUIStore((s) => s.toggleSidePanel);
  const toggleAnalysisModal = useUIStore((s) => s.toggleAnalysisModal);
  const toggleWritingSupportModal = useUIStore((s) => s.toggleWritingSupportModal);
  const toggleSettingsModal = useUIStore((s) => s.toggleSettingsModal);

  return (
    <div
      className="flex flex-col flex-shrink-0 py-2"
      style={{
        width: '48px',
        background: 'var(--bg-deep)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key && !collapsed;
        return (
          <button
            key={tab.key}
            onClick={() => {
              if (collapsed) {
                // 折りたたみ中にクリックされたら開いて切替
                onTabChange(tab.key);
                toggleSidePanel();
              } else if (activeTab === tab.key) {
                // アクティブタブを再クリック → 閉じる
                toggleSidePanel();
              } else {
                onTabChange(tab.key);
              }
            }}
            title={`${tab.label} (${tab.shortcut})`}
            style={{
              width: '100%',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              borderLeftWidth: '2px',
              borderLeftStyle: 'solid',
              borderLeftColor: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <Icon size={18} />
          </button>
        );
      })}

      {/* スペーサー: アクションボタンを下部に押し出す */}
      <div style={{ flex: 1 }} />

      {/* 下部アクションボタン群 (モーダル起動) */}
      <ActionButton
        title="文章分析"
        onClick={toggleAnalysisModal}
      >
        <IconAnalysis size={18} />
      </ActionButton>
      <ActionButton
        title="執筆支援"
        onClick={toggleWritingSupportModal}
      >
        <span style={{ fontSize: '16px' }}>✎</span>
      </ActionButton>
      <ActionButton
        title="設定"
        onClick={toggleSettingsModal}
      >
        <IconSettings size={18} />
      </ActionButton>
    </div>
  );
}

/** ActivityBar 下部のアクションボタン (タブ切替ではなくモーダル起動用) */
function ActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '100%',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderLeftWidth: '2px',
        borderLeftStyle: 'solid',
        borderLeftColor: 'transparent',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
        (e.currentTarget as HTMLElement).style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
      }}
    >
      {children}
    </button>
  );
}

// =========================================
// タブコンテンツ
// =========================================

function TabContent({ tabKey }: { tabKey: SideTab }) {
  switch (tabKey) {
    case 'toc':
      return <LeftPanel />;
    case 'chapter':
      return <ChapterPanel />;
    case 'character':
      return <CharacterPanel />;
    case 'plot':
      return <PlotPanel />;
    case 'synopsis':
      return <SynopsisPanel />;
    case 'relationship':
      return <RelationshipPanel />;
    case 'glossary':
      return <GlossaryPanel />;
    case 'world':
      return <WorldSettingPanel />;
    case 'foreshadowing':
      return <PlotThreadPanel />;
    case 'memo':
      return <MemoPanel />;
  }
}

// =========================================
// リサイズハンドル (右端)
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
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(
        RIGHT_PANEL_MIN_WIDTH,
        Math.min(RIGHT_PANEL_MAX_WIDTH, startWidth.current + delta),
      );
      onWidthChange(newWidth);
    };
    const onUp = () => { dragging.current = false; };
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
        position: 'absolute',
        top: 0,
        right: 0,
        width: '4px',
        height: '100%',
        cursor: 'col-resize',
        background: 'transparent',
        zIndex: 10,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.opacity = '0.4'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
    />
  );
}
