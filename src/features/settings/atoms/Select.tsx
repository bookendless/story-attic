export type SelectFlatOption  = { kind?: 'flat'; value: string; label: string };
export type SelectGroupOption = { kind: 'group'; group: string; items: { value: string; label: string }[] };
export type SelectOption = SelectFlatOption | SelectGroupOption;

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  width?: number;
  disabled?: boolean;
}

export function Select({ value, onChange, options, width = 180, disabled }: SelectProps) {
  return (
    <select
      className="input text-sm"
      style={{ width: `${width}px`, padding: '4px 8px' }}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => {
        if (opt.kind === 'group') {
          return (
            <optgroup key={opt.group} label={opt.group}>
              {opt.items.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </optgroup>
          );
        }
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  );
}
