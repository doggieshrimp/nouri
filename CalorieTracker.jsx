import { useState, useMemo } from "react";
import { Plus, Trash2, Flame, Search, X } from "lucide-react";

// ---- Design tokens ----
// Paper:      #FAF8F3   Ink: #1A1A1A
// Over/alert: #C1440E   Under/good: #4A7A4E   Divider gold: #B8935B

const INK = "#1A1A1A";
const PAPER = "#FAF8F3";
const ALERT = "#C1440E";
const GOOD = "#4A7A4E";
const GOLD = "#B8935B";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ---- Local food database ----
// Values are per 100g, sourced from typical USDA-style reference values.
// This is a starter set — extend it, or swap in a live API (e.g. USDA
// FoodData Central) for foods that aren't in here.
const FOOD_DB = [
  { name: "Chicken breast, raw", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "Chicken thigh, raw", calories: 209, protein: 26, carbs: 0, fat: 10.9 },
  { name: "Ground beef, 85% lean", calories: 250, protein: 26, carbs: 0, fat: 17 },
  { name: "Salmon, raw", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "Tuna, canned in water", calories: 116, protein: 26, carbs: 0, fat: 1 },
  { name: "Egg, whole", calories: 155, protein: 13, carbs: 1.1, fat: 11 },
  { name: "Egg white", calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { name: "Tofu, firm", calories: 144, protein: 15.5, carbs: 3, fat: 8.7 },
  { name: "Greek yogurt, plain nonfat", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { name: "Cottage cheese, low fat", calories: 72, protein: 12, carbs: 3, fat: 1 },
  { name: "Milk, whole", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { name: "Cheddar cheese", calories: 403, protein: 25, carbs: 1.3, fat: 33 },
  { name: "White rice, cooked", calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { name: "Brown rice, cooked", calories: 123, protein: 2.7, carbs: 26, fat: 1 },
  { name: "Oats, dry", calories: 389, protein: 17, carbs: 66, fat: 7 },
  { name: "Quinoa, cooked", calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  { name: "Pasta, cooked", calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  { name: "Bread, white", calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  { name: "Bread, whole wheat", calories: 247, protein: 13, carbs: 41, fat: 4.2 },
  { name: "Potato, baked", calories: 93, protein: 2.5, carbs: 21, fat: 0.1 },
  { name: "Sweet potato, baked", calories: 90, protein: 2, carbs: 21, fat: 0.2 },
  { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name: "Apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: "Avocado", calories: 160, protein: 2, carbs: 8.5, fat: 15 },
  { name: "Broccoli, raw", calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: "Spinach, raw", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: "Carrot, raw", calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name: "Almonds", calories: 579, protein: 21, carbs: 22, fat: 50 },
  { name: "Peanut butter", calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name: "Olive oil", calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name: "Butter", calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { name: "Black beans, cooked", calories: 132, protein: 8.9, carbs: 24, fat: 0.5 },
  { name: "Chickpeas, cooked", calories: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  { name: "Lentils, cooked", calories: 116, protein: 9, carbs: 20, fat: 0.4 },
  { name: "Shrimp, cooked", calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { name: "Pork chop, raw", calories: 231, protein: 22, carbs: 0, fat: 15 },
];

function scaleFood(food, grams) {
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}

export default function CalorieTracker() {
  const [goal, setGoal] = useState(2000);
  const [entries, setEntries] = useState([
    { id: uid(), name: "Oatmeal, 1 cup", calories: 300, protein: 10, carbs: 54, fat: 6 },
    { id: uid(), name: "Coffee, black", calories: 5, protein: 0, carbs: 0, fat: 0 },
  ]);

  const [editingGoal, setEditingGoal] = useState(false);

  // Database lookup state
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [grams, setGrams] = useState(100);

  // Manual/custom entry state
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });

  const matches = useMemo(() => {
    if (!query.trim() || selectedFood) return [];
    const q = query.trim().toLowerCase();
    return FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, selectedFood]);

  const preview = selectedFood ? scaleFood(selectedFood, Number(grams) || 0) : null;

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + Number(e.calories || 0),
        protein: acc.protein + Number(e.protein || 0),
        carbs: acc.carbs + Number(e.carbs || 0),
        fat: acc.fat + Number(e.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [entries]);

  const remaining = goal - totals.calories;
  const pctOfGoal = Math.min(100, Math.round((totals.calories / goal) * 100));
  const over = remaining < 0;

  function addFromDatabase(e) {
    e.preventDefault();
    if (!selectedFood || !grams) return;
    const scaled = scaleFood(selectedFood, Number(grams));
    setEntries((prev) => [
      ...prev,
      { id: uid(), name: `${selectedFood.name} (${grams}g)`, ...scaled },
    ]);
    setQuery("");
    setSelectedFood(null);
    setGrams(100);
  }

  function addCustom(e) {
    e.preventDefault();
    if (!custom.name.trim() || !custom.calories) return;
    setEntries((prev) => [
      ...prev,
      {
        id: uid(),
        name: custom.name.trim(),
        calories: Number(custom.calories) || 0,
        protein: Number(custom.protein) || 0,
        carbs: Number(custom.carbs) || 0,
        fat: Number(custom.fat) || 0,
      },
    ]);
    setCustom({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    setShowCustom(false);
  }

  function removeEntry(id) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-full w-full flex items-start justify-center p-4 sm:p-8"
      style={{ background: PAPER, color: INK, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md">
        {/* Masthead */}
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-2xl font-black tracking-tight uppercase">Daily Log</h1>
          <span className="text-xs font-mono uppercase tracking-wide opacity-70">{today}</span>
        </div>
        <div style={{ height: 6, background: INK }} />

        {/* Nutrition-facts-style summary panel */}
        <div className="mt-3 border-2 px-4 pt-3 pb-4" style={{ borderColor: INK }}>
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: `8px solid ${INK}` }}>
            <span className="text-lg font-black uppercase tracking-tight">Calories</span>
            <span className="text-4xl font-black font-mono tabular-nums">{totals.calories}</span>
          </div>

          <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${INK}` }}>
            <button
              className="text-xs uppercase tracking-wide font-bold underline decoration-dotted"
              onClick={() => setEditingGoal((v) => !v)}
            >
              Daily goal
            </button>
            {editingGoal ? (
              <input
                autoFocus
                type="number"
                value={goal}
                onChange={(ev) => setGoal(Number(ev.target.value) || 0)}
                onBlur={() => setEditingGoal(false)}
                className="w-24 text-right font-mono font-bold bg-transparent border-b outline-none"
                style={{ borderColor: INK }}
              />
            ) : (
              <span className="font-mono font-bold">{goal}</span>
            )}
          </div>

          <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${INK}` }}>
            <span className="text-xs uppercase tracking-wide font-bold flex items-center gap-1">
              <Flame size={14} /> {over ? "Over goal" : "Remaining"}
            </span>
            <span className="font-mono font-bold text-lg" style={{ color: over ? ALERT : GOOD }}>
              {over ? `+${Math.abs(remaining)}` : remaining}
            </span>
          </div>

          <div className="mt-3 h-2 w-full" style={{ background: "#E7E2D6" }}>
            <div
              className="h-2"
              style={{ width: `${pctOfGoal}%`, background: over ? ALERT : INK, transition: "width 300ms ease" }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3" style={{ borderTop: `8px solid ${INK}` }}>
            {[
              { label: "Protein", value: totals.protein },
              { label: "Carbs", value: totals.carbs },
              { label: "Fat", value: totals.fat },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-xs uppercase tracking-wide opacity-70">{m.label}</div>
                <div className="font-mono font-bold text-lg">{m.value}g</div>
              </div>
            ))}
          </div>
        </div>

        {/* Database lookup */}
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: GOLD }}>
            Look up an ingredient
          </div>

          {!selectedFood ? (
            <div className="relative">
              <div className="flex items-center gap-2 border-2 px-2" style={{ borderColor: INK }}>
                <Search size={16} className="opacity-60" />
                <input
                  placeholder="e.g. chicken breast"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 py-2 bg-transparent outline-none text-sm"
                />
              </div>
              {matches.length > 0 && (
                <ul className="border-2 border-t-0" style={{ borderColor: INK, background: PAPER }}>
                  {matches.map((f) => (
                    <li key={f.name}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFood(f);
                          setQuery(f.name);
                        }}
                        className="w-full text-left px-3 py-2 text-sm flex justify-between items-center hover:bg-black/5"
                      >
                        <span>{f.name}</span>
                        <span className="text-xs font-mono opacity-60">{f.calories} kcal/100g</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && matches.length === 0 && (
                <div className="text-xs opacity-60 italic mt-2">
                  Not in the database yet.{" "}
                  <button type="button" className="underline" onClick={() => setShowCustom(true)}>
                    Add it manually instead.
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={addFromDatabase} className="border-2 p-3" style={{ borderColor: INK }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold">{selectedFood.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFood(null);
                    setQuery("");
                  }}
                  className="opacity-50 hover:opacity-100"
                  aria-label="Clear selection"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-xs uppercase tracking-wide opacity-70">Grams</label>
                <input
                  type="number"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-24 px-2 py-1 border-2 bg-transparent outline-none text-sm font-mono"
                  style={{ borderColor: INK }}
                />
              </div>
              {preview && (
                <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                  <div>
                    <div className="text-xs opacity-60">Kcal</div>
                    <div className="font-mono font-bold">{preview.calories}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60">Protein</div>
                    <div className="font-mono font-bold">{preview.protein}g</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60">Carbs</div>
                    <div className="font-mono font-bold">{preview.carbs}g</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-60">Fat</div>
                    <div className="font-mono font-bold">{preview.fat}g</div>
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1 py-2 font-bold uppercase tracking-wide text-sm"
                style={{ background: INK, color: PAPER }}
              >
                <Plus size={16} /> Add to log
              </button>
            </form>
          )}

          {!showCustom && !selectedFood && (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="text-xs underline opacity-70 mt-2"
            >
              Can't find it? Add a custom item
            </button>
          )}
        </div>

        {/* Custom entry form */}
        {showCustom && (
          <form onSubmit={addCustom} className="mt-4 border-2 p-3" style={{ borderColor: INK }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                Custom item
              </span>
              <button type="button" onClick={() => setShowCustom(false)} className="opacity-50 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                placeholder="Food name"
                value={custom.name}
                onChange={(e) => setCustom((f) => ({ ...f, name: e.target.value }))}
                className="flex-1 px-2 py-2 border-2 bg-transparent outline-none text-sm"
                style={{ borderColor: INK }}
              />
              <input
                placeholder="Kcal"
                type="number"
                value={custom.calories}
                onChange={(e) => setCustom((f) => ({ ...f, calories: e.target.value }))}
                className="w-20 px-2 py-2 border-2 bg-transparent outline-none text-sm font-mono"
                style={{ borderColor: INK }}
              />
            </div>
            <div className="flex gap-2 mb-3">
              {["protein", "carbs", "fat"].map((k) => (
                <input
                  key={k}
                  placeholder={`${k[0].toUpperCase()}${k.slice(1)} g`}
                  type="number"
                  value={custom[k]}
                  onChange={(e) => setCustom((f) => ({ ...f, [k]: e.target.value }))}
                  className="flex-1 px-2 py-2 border-2 bg-transparent outline-none text-xs font-mono"
                  style={{ borderColor: INK }}
                />
              ))}
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1 py-2 font-bold uppercase tracking-wide text-sm"
              style={{ background: INK, color: PAPER }}
            >
              <Plus size={16} /> Add to log
            </button>
          </form>
        )}

        {/* Entry list */}
        <div className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: GOLD }}>
            Today&rsquo;s entries
          </div>
          {entries.length === 0 && (
            <div className="text-sm opacity-60 italic py-4 text-center">
              Nothing logged yet. Add your first item above.
            </div>
          )}
          <ul>
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid #DDD6C4" }}
              >
                <div>
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-xs font-mono opacity-60">
                    P{e.protein} · C{e.carbs} · F{e.fat}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm">{e.calories}</span>
                  <button
                    onClick={() => removeEntry(e.id)}
                    aria-label={`Remove ${e.name}`}
                    className="opacity-50 hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
