interface DangerZoneProps {
  title: string;
  children: React.ReactNode;
}

export function DangerZone({ title, children }: DangerZoneProps) {
  return (
    <div
      style={{
        border: '1px solid var(--danger)',
        borderRadius: '8px',
        padding: '14px 16px',
        background: 'rgba(180,60,60,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--danger)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}
