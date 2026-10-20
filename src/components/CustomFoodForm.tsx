import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { LogItem } from "../db";
import { GOLD, INK, PAPER } from "../theme";

const EMPTY = { name: "", calories: "", protein: "", carbs: "", fat: "", sugars: "", saturatedFat: "" };
const MACRO_FIELDS = [
  { key: "protein", label: "Protein g" },
  { key: "carbs", label: "Carbs g" },
  { key: "fat", label: "Fat g" },
] as const;
// Optional "of which" lines; left blank they're recorded as unknown, not zero.
const DETAIL_FIELDS = [
  { key: "sugars", label: "Sugars g (optional)" },
  { key: "saturatedFat", label: "Saturates g (optional)" },
] as const;

interface Props {
  initialName?: string;
  onAdd: (item: LogItem) => void;
  onCancel: () => void;
}

export default function CustomFoodForm({ initialName = "", onAdd, onCancel }: Props) {
  const [form, setForm] = useState({ ...EMPTY, name: initialName });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.calories) return;
    const item: LogItem = {
      name: form.name.trim(),
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    };
    if (form.sugars.trim() !== "") item.sugars = Number(form.sugars) || 0;
    if (form.saturatedFat.trim() !== "") item.saturatedFat = Number(form.saturatedFat) || 0;
    onAdd(item);
  }

  return (
    <form onSubmit={submit} className="mt-4 border-2 p-3" style={{ borderColor: INK }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>
          Custom item
        </span>
        <button type="button" onClick={onCancel} className="opacity-70 hover:opacity-100" aria-label="Close custom item">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2 mb-2">
        <input
          placeholder="Food name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 min-w-0 px-2 py-2 border-2 bg-transparent outline-none text-sm"
          style={{ borderColor: INK }}
        />
        <input
          placeholder="Kcal"
          type="number"
          inputMode="decimal"
          value={form.calories}
          onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
          className="w-20 px-2 py-2 border-2 bg-transparent outline-none text-sm font-mono"
          style={{ borderColor: INK }}
        />
      </div>
      {[MACRO_FIELDS, DETAIL_FIELDS].map((row, i) => (
        <div key={i} className={`flex gap-2 ${i === 0 ? "mb-2" : "mb-3"}`}>
          {row.map(({ key, label }) => (
            <input
              key={key}
              placeholder={label}
              aria-label={label}
              type="number"
              inputMode="decimal"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="flex-1 min-w-0 px-2 py-2 border-2 bg-transparent outline-none text-xs font-mono"
              style={{ borderColor: INK }}
            />
          ))}
        </div>
      ))}
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-1 py-2 font-bold uppercase tracking-wide text-sm"
        style={{ background: INK, color: PAPER }}
      >
        <Plus size={16} /> Add to log
      </button>
    </form>
  );
}
