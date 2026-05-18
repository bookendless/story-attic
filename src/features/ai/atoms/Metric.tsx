/**
 * Metric — 改稿フェーズのメトリクスカード
 */
interface MetricProps {
  label: string;
  value: string;
  accent?: string;
  hint?: string;
}

export function Metric({ label, value, accent, hint }: MetricProps) {
  return (
    <div
      style={{
        flex: 1,
        padding: '8px 10px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: accent || 'var(--text)',
          fontWeight: 600,
          fontFamily: 'var(--font-heading)',
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  );
}
