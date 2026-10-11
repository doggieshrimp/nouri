import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import {
  applyAppearance,
  BACKGROUNDS,
  DEFAULT_APPEARANCE,
  FONTS,
  loadAppearance,
  saveAppearance,
  TEXT_SIZES,
  type Appearance,
  type Background,
  type Font,
} from "../lib/appearance";
import { GOLD, INK, RULE } from "../theme";
import Segmented from "./Segmented";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wide font-bold opacity-70 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer" style={{ borderBottom: `1px solid ${RULE}` }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-current" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs opacity-70">{detail}</span>
      </span>
    </label>
  );
}

/** Reading-comfort settings. Changes apply instantly and are remembered on this device. */
export default function DisplaySettings({ onClose }: { onClose: () => void }) {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);

  function update(patch: Partial<Appearance>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    applyAppearance(next);
    saveAppearance(next);
  }

  return (
    <div className="mt-3 border-2 p-3" style={{ borderColor: INK }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>
          Display &amp; reading
        </span>
        <button type="button" onClick={onClose} className="opacity-70 hover:opacity-100 p-1 -m-1" aria-label="Close display settings">
          <X size={16} />
        </button>
      </div>

      <Section title="Background">
        <div role="radiogroup" aria-label="Background colour" className="grid grid-cols-3 gap-2">
          {(Object.keys(BACKGROUNDS) as Background[]).map((key) => {
            const bg = BACKGROUNDS[key];
            const selected = appearance.background === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ background: key })}
                className="flex flex-col items-center gap-1 py-2 text-xs"
                style={{ outline: selected ? `2px solid ${INK}` : "none", outlineOffset: -2 }}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center border"
                  style={{ background: bg.paper, borderColor: INK, color: bg.dark ? "#EEEAE2" : "#1A1A1A" }}
                >
                  {selected && <Check size={16} />}
                </span>
                {bg.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Font">
        <div role="radiogroup" aria-label="Font">
          {(Object.keys(FONTS) as Font[]).map((key) => (
            <label key={key} className="flex items-center gap-3 py-2 cursor-pointer" style={{ borderBottom: `1px solid ${RULE}` }}>
              <input
                type="radio"
                name="font"
                checked={appearance.font === key}
                onChange={() => update({ font: key })}
                className="w-4 h-4 accent-current"
              />
              <span style={{ fontFamily: FONTS[key].stack }}>
                <span className="block text-sm font-medium">{FONTS[key].label}</span>
                <span className="block text-xs opacity-70">Greek yogurt, 150 g: 89 kcal</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Text size">
        <Segmented
          label="Text size"
          value={appearance.textSize}
          onChange={(textSize) => update({ textSize })}
          options={TEXT_SIZES.map((s, i) => ({
            value: s.value,
            ariaLabel: `${Math.round(s.value * 100)}%`,
            label: <span style={{ fontSize: `${0.75 + i * 0.15}rem`, textTransform: "none" }}>Aa</span>,
          }))}
        />
      </Section>

      <Section title="Reading comfort">
        <Toggle
          label="Extra spacing"
          detail="More space between letters, words and lines"
          checked={appearance.extraSpacing}
          onChange={(extraSpacing) => update({ extraSpacing })}
        />
        <Toggle
          label="Avoid capitals and italics"
          detail="Shows labels in normal case and removes slanted text"
          checked={appearance.plainText}
          onChange={(plainText) => update({ plainText })}
        />
      </Section>

      <button type="button" onClick={() => update(DEFAULT_APPEARANCE)} className="text-xs underline opacity-70">
        Reset to default look
      </button>
    </div>
  );
}
