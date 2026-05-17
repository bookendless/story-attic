interface ThemePalette {
  bg: string;
  text: string;
  textMid: string;
  accent: string;
}

interface ThemeCardProps {
  name: string;
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
  palette: ThemePalette;
}

export function ThemeCard({ label, sub, active, onClick, palette }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px',
        borderRadius: '8px',
        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--bg-elevated)' : 'var(--bg-deep)',
        cursor: 'pointer',
        width: '120px',
        transition: 'border-color 150ms, background 150ms',
        textAlign: 'left',
      }}
    >
      {/* ミニエディタモック */}
      <div
        style={{
          borderRadius: '4px',
          padding: '6px 8px',
          background: palette.bg,
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        {[70, 90, 55, 80].map((w, i) => (
          <div
            key={i}
            style={{
              height: '3px',
              borderRadius: '2px',
              background: i === 0 ? palette.accent : palette.textMid,
              width: `${w}%`,
              opacity: i === 0 ? 1 : 0.5,
            }}
          />
        ))}
      </div>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </button>
  );
}
