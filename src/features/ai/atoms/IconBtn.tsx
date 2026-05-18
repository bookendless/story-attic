/**
 * IconBtn — ヘッダー用アイコンボタン
 */
import { useState, type ReactNode } from 'react';

interface IconBtnProps {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  accent?: string;
}

export function IconBtn({ children, onClick, title, active, accent }: IconBtnProps) {
  const [hover, setHover] = useState(false);
  const ac = accent || 'var(--accent)';
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active
          ? `color-mix(in srgb, ${ac} 14%, transparent)`
          : hover ? 'var(--bg-elevated)' : 'transparent',
        color: active ? ac : hover ? 'var(--text)' : 'var(--text-muted)',
        border: active ? `1px solid ${ac}` : '1px solid transparent',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13,
        transition: 'all 160ms ease-out',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
