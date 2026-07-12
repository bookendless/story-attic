import { useState, useRef, useEffect } from 'react';
import { useUIStore, type EditorViewMode } from '@/shared/stores/uiStore';
import { useEditorStore } from '@/shared/stores/editorStore';

interface MainItem {
  key: EditorViewMode;
  label: string;
  shortcut?: string;
}

interface SubItem {
  key: EditorViewMode;
  icon: string;
  label: string;
  desc: string;
}

const MAIN_ITEMS: MainItem[] = [
  { key: 'editor',   label: 'エディタ' },
  { key: 'dialogue', label: '台詞',      shortcut: 'Ctrl+Shift+L' },
  { key: 'preview',  label: 'プレビュー', shortcut: 'Ctrl+Shift+P' },
  { key: 'dual',     label: 'デュアル',   shortcut: 'Ctrl+Shift+D' },
];

const SUB_ITEMS: SubItem[] = [
  {
    key: 'proofread',
    icon: '✎',
    label: '校正チェック',
    desc: '文法・表記ゆれ・可読性を検査します',
  },
  {
    key: 'reactions',
    icon: '👀',
    label: '読者の反応',
    desc: 'AI読者たちが本文を読んでコメントします',
  },
  {
    key: 'diff',
    icon: '⇄',
    label: '変更履歴',
    desc: '過去のスナップショットと現在を比較します',
  },
];

export function ViewModeSegmented() {
  const { editorViewMode, setEditorViewMode } = useUIStore();
  const hasEpisode = useEditorStore((s) => !!s.currentEpisode);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  const isSubMode = editorViewMode === 'proofread' || editorViewMode === 'reactions' || editorViewMode === 'diff';
  const activeSubItem = SUB_ITEMS.find((s) => s.key === editorViewMode);
  const displayMode = isSubMode ? null : editorViewMode;

  return (
    <div
      data-tour="view-mode-segmented"
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: '6px',
        overflow: 'visible',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        height: '30px',
        position: 'relative',
      }}
    >
      {MAIN_ITEMS.map((item) => {
        const isActive = displayMode === item.key;
        const disabled = !hasEpisode && item.key !== 'editor';
        return (
          <button
            key={item.key}
            disabled={disabled}
            onClick={() => setEditorViewMode(item.key)}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            style={{
              padding: '0 12px',
              height: '100%',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-mid)',
              border: 'none',
              borderRight: '1px solid var(--border)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontFamily: 'var(--font-ui)',
              opacity: disabled ? 0.4 : 1,
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => {
              if (!isActive && !disabled)
                (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              if (!isActive)
                (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {item.label}
          </button>
        );
      })}

      {/* 分析ドロップダウン */}
      <div ref={dropRef} style={{ position: 'relative', height: '100%' }}>
        <button
          disabled={!hasEpisode}
          onClick={() => setDropOpen((v) => !v)}
          style={{
            padding: '0 10px',
            height: '100%',
            background: isSubMode
              ? 'var(--accent-soft)'
              : dropOpen
              ? 'var(--bg-surface)'
              : 'transparent',
            color: isSubMode ? 'var(--accent)' : dropOpen ? 'var(--text)' : 'var(--text-mid)',
            border: 'none',
            borderRadius: '0 5px 5px 0',
            cursor: hasEpisode ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)',
            opacity: hasEpisode ? 1 : 0.4,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'background 120ms',
            whiteSpace: 'nowrap',
          }}
        >
          {isSubMode && activeSubItem ? `${activeSubItem.label}中` : '分析'}
          <span style={{ fontSize: '9px', opacity: 0.7 }}>▾</span>
        </button>

        {dropOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: '0',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            minWidth: '210px',
            boxShadow: '0 8px 24px rgba(20,16,12,0.5)',
            zIndex: 60,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px 6px',
              fontSize: '10px',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border)',
            }}>
              分析モード
            </div>

            {SUB_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setEditorViewMode(editorViewMode === item.key ? 'editor' : item.key);
                  setDropOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 100ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span style={{
                  fontSize: '16px',
                  width: '24px',
                  textAlign: 'center',
                  color: 'var(--accent)',
                  flexShrink: 0,
                }}>
                  {item.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                    {item.desc}
                  </div>
                </div>
                {editorViewMode === item.key && (
                  <span style={{ color: 'var(--accent)', fontSize: '11px', flexShrink: 0 }}>●</span>
                )}
              </button>
            ))}

            <div style={{
              padding: '8px 14px',
              fontSize: '10px',
              color: 'var(--text-muted)',
              lineHeight: '1.5',
            }}>
              Ctrl+P → 「校正」または「差分」で検索でもアクセスできます
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
