import { useRef } from 'react';
import { CATEGORIES, type SettingsCategoryKey } from './types';

interface SettingsNavProps {
  activeCategory: SettingsCategoryKey;
  onCategoryChange: (key: SettingsCategoryKey) => void;
  dirtyMap: Record<SettingsCategoryKey, boolean>;
  currentProjectTitle?: string;
}

export function SettingsNav({ activeCategory, onCategoryChange, dirtyMap, currentProjectTitle }: SettingsNavProps) {
  const navRef = useRef<HTMLElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const idx = CATEGORIES.findIndex((c) => c.key === activeCategory);
    if (e.key === 'ArrowDown' && idx < CATEGORIES.length - 1) {
      e.preventDefault();
      onCategoryChange(CATEGORIES[idx + 1].key);
    }
    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      onCategoryChange(CATEGORIES[idx - 1].key);
    }
  };

  return (
    <nav
      ref={navRef}
      onKeyDown={handleKeyDown}
      style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--bg-deep)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div style={{ flex: 1, padding: '8px 0' }}>
        {CATEGORIES.map((cat) => {
          const active = cat.key === activeCategory;
          return (
            <button
              key={cat.key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onCategoryChange(cat.key)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: active ? 'var(--bg-elevated)' : 'none',
                border: 'none',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'background 150ms, border-color 150ms',
              }}
            >
              {/* アイコン */}
              <span
                style={{
                  fontSize: '18px',
                  lineHeight: '1',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  width: '22px',
                  flexShrink: 0,
                  textAlign: 'center',
                }}
              >
                {cat.icon}
              </span>

              {/* ラベル + サブ */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--text)' : 'var(--text-mid)',
                    lineHeight: '1.3',
                  }}
                >
                  {cat.label}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat.sub}
                </div>
              </div>

              {/* 未保存ドット */}
              {dirtyMap[cat.key] && (
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'var(--warning)',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* プロジェクト情報 */}
      {currentProjectTitle && (
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', letterSpacing: '0.05em' }}>
            PROJECT
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-mid)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentProjectTitle}
          </div>
        </div>
      )}
    </nav>
  );
}
