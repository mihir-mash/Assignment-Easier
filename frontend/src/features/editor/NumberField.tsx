type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1000,
  step = 0.5,
}: Props) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) =>
          onChange(event.target.value === "" ? 0 : Number(event.target.value))
        }
      />
    </label>
  );
}
