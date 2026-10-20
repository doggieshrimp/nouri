import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { scaleFood, unitOf, type Food } from "../lib/nutrition";
import { INK, PAPER } from "../theme";

interface Props {
  food: Food;
  initialAmount?: number;
  onAdd: (amount: number) => void;
  onCancel: () => void;
}

/** "–" for nutrients the source doesn't report, so unknown isn't shown as zero. */
function grams(value: number | undefined): string {
  return value === undefined ? "–" : `${value}g`;
}

/** Pick an amount of a per-100g (or per-100ml) food and preview its nutrition before logging. */
export default function FoodEditor({ food, initialAmount, onAdd, onCancel }: Props) {
  const unit = unitOf(food);
  const [amount, setAmount] = useState(String(initialAmount ?? food.serving?.grams ?? 100));
  const amountNum = Number(amount) || 0;
  const preview = scaleFood(food, amountNum);

  const presets = [
    ...(food.serving ? [{ label: `${food.serving.label} · ${food.serving.grams} ${unit}`, amount: food.serving.grams }] : []),
    { label: `100 ${unit}`, amount: 100 },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amountNum > 0) onAdd(amountNum);
  }

  return (
    <form onSubmit={submit} className="border-2 p-3" style={{ borderColor: INK }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-bold">{food.name}</div>
          {food.brand && <div className="text-xs opacity-70">{food.brand}</div>}
        </div>
        <button type="button" onClick={onCancel} className="opacity-70 hover:opacity-100 p-1 -m-1" aria-label="Clear selection">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label htmlFor="amount" className="text-xs uppercase tracking-wide opacity-70">
          Amount
        </label>
        <span className="flex items-center gap-1">
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 px-2 py-1 border-2 bg-transparent outline-none text-sm font-mono"
            style={{ borderColor: INK }}
            aria-label={`Amount in ${unit === "ml" ? "millilitres" : "grams"}`}
          />
          <span className="text-sm opacity-70">{unit}</span>
        </span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setAmount(String(p.amount))}
            className="text-xs px-2 py-1 border rounded-full"
            style={{ borderColor: INK, background: amountNum === p.amount ? INK : "transparent", color: amountNum === p.amount ? PAPER : INK }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-x-2 gap-y-2 mb-3 text-center">
        {[
          { label: "Kcal", value: preview.calories },
          { label: "Protein", value: `${preview.protein}g` },
          { label: "Carbs", value: `${preview.carbs}g` },
          { label: "Fat", value: `${preview.fat}g` },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-xs opacity-70">{m.label}</div>
            <div className="font-mono font-bold">{m.value}</div>
          </div>
        ))}
        {/* Under Carbs and Fat, like a nutrition label's "of which" lines. */}
        <div className="col-start-3">
          <div className="text-xs opacity-70">Sugars</div>
          <div className="font-mono text-sm">{grams(preview.sugars)}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Saturates</div>
          <div className="font-mono text-sm">{grams(preview.saturatedFat)}</div>
        </div>
      </div>

      <button
        type="submit"
        disabled={amountNum <= 0}
        className="w-full flex items-center justify-center gap-1 py-2 font-bold uppercase tracking-wide text-sm disabled:opacity-40"
        style={{ background: INK, color: PAPER }}
      >
        <Plus size={16} /> Add to log
      </button>
    </form>
  );
}
