/**
 * CoreField — 作品の Core（テーマ・中心感情・問い）入力フィールド
 */
import { useState } from 'react';

interface CoreFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
  large?: boolean;
}

export function CoreField({ label, placeholder, value, onChange, accent, large }: CoreFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      style={{
        padding: large ? '10px 12px' : '7px 10px',
        background: 'var(--bg-deep)',
        border: `1px solid ${focused ? accent : 'var(--border)'}`,
        borderRadius: 6,
        transition: 'border-color 160ms',
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text)',
          fontSize: large ? 13 : 12,
          fontFamily: 'inherit',
          padding: 0,
          lineHeight: 1.6,
        }}
      />
    </div>
  );
}
