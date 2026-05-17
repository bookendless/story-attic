interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  disabled?: boolean;
  width?: number;
}

export function Slider({ value, onChange, min, max, step = 1, format, disabled, width = 160 }: SliderProps) {
  const display = format ? format(value) : String(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: `${width}px`, accentColor: 'var(--accent)', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <span
        style={{
          fontSize: '12px',
          color: 'var(--text-mid)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: '40px',
          textAlign: 'right',
        }}
      >
        {display}
      </span>
    </div>
  );
}
