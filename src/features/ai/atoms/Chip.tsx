/**
 * Chip — pill 形状のセッション設定トグル
 */
import type { ReactNode } from 'react';

interface ChipProps {
  active?: boolean;
  accent?: string;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Chip({ active, accent, children, onClick, title, disabled, size = 'md' }: ChipProps) {
  const ac = accent || 'var(--accent)';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        fontSize: size === 'sm' ? 11 : 12,
        borderRadius: 999,
        border: `1px solid ${active ? ac : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${ac} 12%, transparent)` : 'transparent',
        color: active ? ac : 'var(--text-mid)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        fontWeight: active ? 600 : 400,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        transition: 'all 160ms ease-out',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
