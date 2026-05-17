interface ChipsOption<T> {
  value: T;
  label: string;
}

interface ChipsProps<T extends string | number> {
  options: ChipsOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

export function Chips<T extends string | number>({ options, value, onChange, disabled }: ChipsProps<T>) {
  return (
    <div
      style={{
        display: 'flex',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : undefined,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              background: active ? 'var(--accent)' : 'var(--bg-deep)',
              color: active ? 'white' : 'var(--text-mid)',
              border: 'none',
              borderRight: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'background 150ms, color 150ms',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
