import type { ReactNode } from "react";
import { INK, PAPER } from "../theme";

interface Props<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  onChange: (v: T) => void;
}

/** A row of mutually exclusive buttons, e.g. units or text size. */
export default function Segmented<T extends string | number>({ label, value, options, onChange }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex border-2" style={{ borderColor: INK }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
          className="flex-1 py-1.5 px-1 text-xs font-bold uppercase tracking-wide"
          style={{ background: value === o.value ? INK : "transparent", color: value === o.value ? PAPER : INK }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
