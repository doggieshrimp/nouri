import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  ACTIVITY_LEVELS,
  ftInToCm,
  lbToKg,
  RATES,
  suggestGoal,
  validateInputs,
  type ActivityLevel,
  type Rate,
  type Sex,
} from "../lib/calorieGoal";
import { ALERT, GOLD, INK, PAPER, RULE } from "../theme";

interface Props {
  onUse: (goal: number) => void;
  onClose: () => void;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex border-2" style={{ borderColor: INK }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
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

function Field({ label, children, grow }: { label: string; children: ReactNode; grow?: boolean }) {
  return (
    <div className={`mb-3 ${grow ? "flex-1 min-w-0" : ""}`}>
      <div className="text-xs uppercase tracking-wide opacity-70 mb-1">{label}</div>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, unit, label }: { value: string; onChange: (v: string) => void; unit: string; label: string }) {
  return (
    <label className="flex items-center gap-1 flex-1 min-w-0">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 px-2 py-2 border-2 bg-transparent outline-none text-sm font-mono"
        style={{ borderColor: INK }}
      />
      <span className="text-xs opacity-60 shrink-0">{unit}</span>
    </label>
  );
}

/**
 * Suggests a daily calorie goal. Everything typed here lives only in this component's
 * state and disappears when it closes; only the chosen goal is saved.
 */
export default function GoalCalculator({ onUse, onClose }: Props) {
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [sex, setSex] = useState<Sex>("unspecified");
  const [age, setAge] = useState("");
  const [cm, setCm] = useState("");
  const [ft, setFt] = useState("");
  const [inches, setInches] = useState("");
  const [kg, setKg] = useState("");
  const [lb, setLb] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [rate, setRate] = useState<Rate>("lose");

  const heightCm = units === "metric" ? Number(cm) : ftInToCm(Number(ft) || 0, Number(inches) || 0);
  const weightKg = units === "metric" ? Number(kg) : lbToKg(Number(lb));
  const inputs = { sex, age: Number(age), heightCm, weightKg, activity, rate };

  const filledIn = age !== "" && (units === "metric" ? cm !== "" && kg !== "" : ft !== "" && lb !== "");
  const problem = filledIn ? validateInputs(inputs) : null;
  const suggestion = filledIn && !problem ? suggestGoal(inputs) : null;

  return (
    <div className="mt-3 border-2 p-3" style={{ borderColor: INK }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>
          Calculate a daily goal
        </span>
        <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100 p-1 -m-1" aria-label="Close calculator">
          <X size={16} />
        </button>
      </div>

      <div className="mb-3">
        <Segmented
          label="Units"
          value={units}
          onChange={setUnits}
          options={[
            { value: "metric", label: "kg · cm" },
            { value: "imperial", label: "lb · ft" },
          ]}
        />
      </div>

      <Field label="Sex (the formula differs slightly)">
        <Segmented
          label="Sex"
          value={sex}
          onChange={setSex}
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "unspecified", label: "Rather not say" },
          ]}
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Age" grow>
          <NumberInput label="Age" value={age} onChange={setAge} unit="yrs" />
        </Field>
        <Field label="Weight" grow>
          {units === "metric" ? (
            <NumberInput label="Weight in kilograms" value={kg} onChange={setKg} unit="kg" />
          ) : (
            <NumberInput label="Weight in pounds" value={lb} onChange={setLb} unit="lb" />
          )}
        </Field>
      </div>

      <Field label="Height">
        {units === "metric" ? (
          <div className="flex w-1/2 pr-1.5">
            <NumberInput label="Height in centimetres" value={cm} onChange={setCm} unit="cm" />
          </div>
        ) : (
          <div className="flex gap-3">
            <NumberInput label="Height, feet" value={ft} onChange={setFt} unit="ft" />
            <NumberInput label="Height, inches" value={inches} onChange={setInches} unit="in" />
          </div>
        )}
      </Field>

      <Field label="Activity">
        <div role="radiogroup" aria-label="Activity">
          {ACTIVITY_LEVELS.map((a) => (
            <label
              key={a.id}
              className="flex items-start gap-2 py-1.5 text-sm cursor-pointer"
              style={{ borderBottom: `1px solid ${RULE}` }}
            >
              <input
                type="radio"
                name="activity"
                checked={activity === a.id}
                onChange={() => setActivity(a.id)}
                className="mt-1 accent-black"
              />
              <span>
                <span className="font-medium">{a.label}</span>
                <span className="block text-xs opacity-60">{a.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Goal">
        <select
          aria-label="Goal"
          value={rate}
          onChange={(e) => setRate(e.target.value as Rate)}
          className="w-full px-2 py-2 border-2 bg-transparent outline-none text-sm"
          style={{ borderColor: INK }}
        >
          {RATES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      {problem && <div className="text-xs mb-3" style={{ color: ALERT }}>{problem}</div>}

      {suggestion && (
        <div className="mb-3 pt-3" style={{ borderTop: `4px solid ${INK}` }} role="status">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide font-bold">Suggested goal</span>
            <span className="text-3xl font-black font-mono tabular-nums">{suggestion.goal}</span>
          </div>
          <div className="text-xs opacity-60 mt-1">
            About {suggestion.maintenance} kcal/day maintains your weight ({suggestion.bmr} at rest).
          </div>
          {suggestion.raisedToFloor && (
            <div className="text-xs mt-2" style={{ color: ALERT }}>
              Raised to {suggestion.goal}: going lower isn&rsquo;t recommended without medical supervision. Try a slower
              rate or more activity instead.
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!suggestion}
        onClick={() => suggestion && onUse(suggestion.goal)}
        className="w-full py-2 font-bold uppercase tracking-wide text-sm disabled:opacity-40"
        style={{ background: INK, color: PAPER }}
      >
        {suggestion ? `Use ${suggestion.goal} as my goal` : "Fill in your details"}
      </button>
      <p className="text-xs opacity-50 mt-2">
        Estimate from the Mifflin-St Jeor equation, not medical advice. Nothing you enter here is saved, only the goal
        you choose.
      </p>
    </div>
  );
}
