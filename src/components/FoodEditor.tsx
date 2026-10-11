import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { scaleFood, type Food } from "../lib/nutrition";
import { INK, PAPER } from "../theme";

interface Props {
  food: Food;
  initialGrams?: number;
  onAdd: (grams: number) => void;
  onCancel: () => void;
}

/** Pick an amount of a per-100g food and preview its macros before logging. */
export default function FoodEditor({ food, initialGrams, onAdd, onCancel }: Props) {
  const [grams, setGrams] = useState(String(initialGrams ?? food.serving?.grams ?? 100));
  const gramsNum = Number(grams) || 0;
  const preview = scaleFood(food, gramsNum);

  const presets = [
    ...(food.serving ? [{ label: `${food.serving.label} · ${food.serving.grams} g`, grams: food.serving.grams }] : []),
    { label: "100 g", grams: 100 },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (gramsNum > 0) onAdd(gramsNum);
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
        <label htmlFor="grams" className="text-xs uppercase tracking-wide opacity-70">
          Grams
        </label>
        <input
          id="grams"
          type="number"
          inputMode="decimal"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="w-24 px-2 py-1 border-2 bg-transparent outline-none text-sm font-mono"
          style={{ borderColor: INK }}
        />
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setGrams(String(p.grams))}
            className="text-xs px-2 py-1 border rounded-full"
            style={{ borderColor: INK, background: gramsNum === p.grams ? INK : "transparent", color: gramsNum === p.grams ? PAPER : INK }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
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
      </div>

      <button
        type="submit"
        disabled={gramsNum <= 0}
        className="w-full flex items-center justify-center gap-1 py-2 font-bold uppercase tracking-wide text-sm disabled:opacity-40"
        style={{ background: INK, color: PAPER }}
      >
        <Plus size={16} /> Add to log
      </button>
    </form>
  );
}
