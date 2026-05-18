/**
 * RefRow — 参照ソースのチェックリスト行
 */
interface RefRowProps {
  label: string;
  active?: boolean;
  accent: string;
  onToggle?: () => void;
  /** ロック時はトグル不可（常時送信される必須ソース） */
  locked?: boolean;
  hint?: string;
}

export function RefRow({ label, active, accent, onToggle, locked, hint }: RefRowProps) {
  return (
    <button
      type="button"
      onClick={locked ? undefined : onToggle}
      disabled={locked}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        background: active ? `color-mix(in srgb, ${accent} 8%, var(--bg-surface))` : 'var(--bg-surface)',
        border: `1px solid ${active ? `color-mix(in srgb, ${accent} 40%, transparent)` : 'var(--border)'}`,
        borderRadius: 6,
        cursor: locked ? 'default' : 'pointer',
        transition: 'all 160ms',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${active ? accent : 'var(--border-light)'}`,
          background: active ? accent : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bg-deep)',
          fontSize: 9,
          flexShrink: 0,
          transition: 'all 160ms',
        }}
      >
        {active ? '✓' : locked ? '🔒' : ''}
      </span>
      <span style={{ fontSize: 12, color: active ? 'var(--text)' : 'var(--text-mid)', flex: 1 }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</span>}
    </button>
  );
}
