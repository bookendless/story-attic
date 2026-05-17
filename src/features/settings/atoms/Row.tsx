interface RowProps {
  label: string;
  desc?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  indent?: boolean;
}

export function Row({ label, desc, children, disabled, indent }: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: desc ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '16px',
        paddingLeft: indent ? '16px' : undefined,
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? 'none' : undefined,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '13px', color: 'var(--text-mid)', lineHeight: '1.4' }}>{label}</span>
        {desc && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{desc}</span>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
