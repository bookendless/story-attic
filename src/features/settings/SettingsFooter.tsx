import { useRef, useEffect, useState } from 'react';
import type { SettingsCategoryKey } from './types';
import { CATEGORIES } from './types';

interface SettingsFooterProps {
  isDirty: boolean;
  saving: boolean;
  changedCount: number;
  activeCategory: SettingsCategoryKey;
  saveToast: string | null;
  onSave: () => void;
  onCancel: () => void;
  onResetTab: () => void;
  onResetAll: () => void;
}

export function SettingsFooter({
  isDirty, saving, changedCount, activeCategory, saveToast,
  onSave, onCancel, onResetTab, onResetAll,
}: SettingsFooterProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeCategoryLabel = CATEGORIES.find((c) => c.key === activeCategory)?.label ?? '';

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-deep)',
        flexShrink: 0,
        gap: '12px',
      }}
    >
      {/* 左: リセットメニュー */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => setMenuOpen((o) => !o)}
          style={{ padding: '4px 10px' }}
        >
          ↺ 初期値に戻す ▾
        </button>
        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '4px 0',
              minWidth: '200px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={() => { onResetTab(); setMenuOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 14px',
                fontSize: '12px',
                color: 'var(--text-mid)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              このタブだけ戻す
              <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({activeCategoryLabel})</span>
            </button>
            <button
              type="button"
              onClick={() => { onResetAll(); setMenuOpen(false); }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 14px',
                fontSize: '12px',
                color: 'var(--danger)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              すべての設定を戻す
            </button>
          </div>
        )}
      </div>

      {/* 右: トースト + 破棄 + 保存 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {saveToast && (
          <span style={{ fontSize: '12px', color: 'var(--success)' }}>✓ {saveToast}</span>
        )}
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={onCancel}
          disabled={!isDirty}
          style={{ padding: '4px 10px' }}
        >
          変更を破棄
        </button>
        <button
          type="button"
          className="btn btn-primary text-xs"
          onClick={onSave}
          disabled={!isDirty || saving}
          style={{ padding: '4px 12px' }}
        >
          {saving ? '保存中...' : isDirty ? `保存（${changedCount}件）` : '保存'}
        </button>
      </div>
    </div>
  );
}
