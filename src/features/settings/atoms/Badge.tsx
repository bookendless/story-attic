type BadgeColor = 'muted' | 'accent' | 'success' | 'warning' | 'danger';

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string }> = {
  muted:   { bg: 'var(--bg-deep)',    text: 'var(--text-muted)' },
  accent:  { bg: 'var(--accent)',     text: 'white' },
  success: { bg: 'var(--success)',    text: 'white' },
  warning: { bg: 'var(--warning)',    text: 'white' },
  danger:  { bg: 'var(--danger)',     text: 'white' },
};

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
}

export function Badge({ children, color = 'muted' }: BadgeProps) {
  const { bg, text } = COLOR_MAP[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: '10px',
        fontSize: '11px',
        fontWeight: 500,
        background: bg,
        color: text,
        lineHeight: '1.4',
      }}
    >
      {children}
    </span>
  );
}
