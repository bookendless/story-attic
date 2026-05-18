/**
 * PromptCard — フェーズに紐づくクイックアクションのカード
 */
import { useState } from 'react';

interface PromptCardProps {
  title: string;
  sub?: string;
  accent: string;
  onClick?: () => void;
  large?: boolean;
  disabled?: boolean;
}

export function PromptCard({ title, sub, accent, onClick, large, disabled }: PromptCardProps) {
  const [hover, setHover] = useState(false);
  const active = hover && !disabled;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: large ? '12px 14px' : '10px 12px',
        textAlign: 'left',
        background: active ? `color-mix(in srgb, ${accent} 8%, var(--bg-surface))` : 'var(--bg-surface)',
        border: `1px solid ${active ? accent : 'var(--border)'}`,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 180ms ease-out',
        fontFamily: 'inherit',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: large ? 13 : 12,
          fontWeight: 500,
          color: active ? accent : 'var(--text)',
          transition: 'color 180ms',
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {sub}
        </div>
      )}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 2,
          background: accent,
          opacity: active ? 1 : 0,
          transition: 'opacity 180ms',
          borderRadius: 2,
        }}
      />
    </button>
  );
}
