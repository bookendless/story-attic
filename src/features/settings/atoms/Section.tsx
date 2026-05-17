interface SectionProps {
  title?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  collapsed?: boolean;
}

export function Section({ title, hint, children, collapsed }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {(title || hint) && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          {title && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {title}
            </span>
          )}
          {hint && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</span>
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          opacity: collapsed ? 0.35 : 1,
          pointerEvents: collapsed ? 'none' : undefined,
          transition: 'opacity 200ms',
        }}
      >
        {children}
      </div>
    </div>
  );
}
