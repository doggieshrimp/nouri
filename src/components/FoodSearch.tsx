import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, Search, X } from "lucide-react";
import { FOOD_DB } from "../data/foods";
import { addEntry, addMealToDay, deleteMeal, getMeals, getRecentItems, type LogItem, type Meal } from "../db";
import type { DateKey } from "../lib/dates";
import { entryName, scaleFood, sumMacros, type Food } from "../lib/nutrition";
import { searchUsda, UsdaError } from "../lib/usda";
import { useDebounced } from "../lib/useDebounced";
import { ALERT, GOLD, INK, PAPER, RULE } from "../theme";
import CustomFoodForm from "./CustomFoodForm";
import FoodEditor from "./FoodEditor";

interface UsdaResult {
  query: string;
  foods: Food[];
  error: string | null;
}

const NO_ITEMS: LogItem[] = [];
const NO_MEALS: Meal[] = [];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 px-3 pt-3 pb-1">{children}</div>
  );
}

function Row({ title, subtitle, right, onClick }: { title: string; subtitle?: string; right: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left px-3 py-2 text-sm flex justify-between items-center gap-3 hover:bg-black/5 active:bg-black/10"
      >
        <span className="min-w-0">
          <span className="block truncate">{title}</span>
          {subtitle && <span className="block text-xs opacity-60 truncate">{subtitle}</span>}
        </span>
        <span className="text-xs font-mono opacity-60 shrink-0">{right}</span>
      </button>
    </li>
  );
}

export default function FoodSearch({ date }: { date: DateKey }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ food: Food; grams?: number } | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const recent = useLiveQuery(() => getRecentItems(8)) ?? NO_ITEMS;
  const meals = useLiveQuery(getMeals) ?? NO_MEALS;

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const debounced = useDebounced(trimmed, 400);
  const [usda, setUsda] = useState<UsdaResult>({ query: "", foods: [], error: null });

  useEffect(() => {
    if (debounced.length < 2) return;
    const ctrl = new AbortController();
    searchUsda(debounced, ctrl.signal).then(
      (foods) => setUsda({ query: debounced, foods, error: null }),
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error =
          err instanceof UsdaError ? err.message : "Couldn't reach the food database. Check your internet connection.";
        setUsda({ query: debounced, foods: [], error });
      },
    );
    return () => ctrl.abort();
  }, [debounced]);

  const recentMatches = useMemo(
    () => (q ? recent.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 3) : []),
    [recent, q],
  );
  const commonMatches = useMemo(
    () => (q ? FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 4) : []),
    [q],
  );
  const usdaCurrent = usda.query === trimmed;
  const usdaLoading = trimmed.length >= 2 && !usdaCurrent;

  function flash(message: string) {
    setStatus(message);
    setTimeout(() => setStatus((s) => (s === message ? null : s)), 2500);
  }

  function reset() {
    setQuery("");
    setSelected(null);
    setShowCustom(false);
  }

  async function addFood(food: Food, grams: number) {
    const name = entryName(food, grams);
    await addEntry(date, { name, ...scaleFood(food, grams), food, grams });
    reset();
    flash(`Added ${name}`);
  }

  async function addItem(item: LogItem) {
    await addEntry(date, item);
    reset();
    flash(`Added ${item.name}`);
  }

  function pickRecent(item: LogItem) {
    if (item.food) setSelected({ food: item.food, grams: item.grams });
    else void addItem(item);
  }

  async function logMeal(meal: Meal) {
    await addMealToDay(date, meal);
    flash(`Added ${meal.name} (${meal.items.length} items)`);
  }

  async function removeMeal(meal: Meal) {
    if (confirm(`Delete the saved meal "${meal.name}"?`)) await deleteMeal(meal.id);
  }

  if (selected) {
    return (
      <div className="mt-6">
        <Heading />
        <FoodEditor
          key={selected.food.fdcId ?? selected.food.name}
          food={selected.food}
          initialGrams={selected.grams}
          onAdd={(grams) => addFood(selected.food, grams)}
          onCancel={() => setSelected(null)}
        />
      </div>
    );
  }

  const hasTypedResults = recentMatches.length + commonMatches.length + (usdaCurrent ? usda.foods.length : 0) > 0;

  return (
    <div className="mt-6">
      <Heading />
      <div className="flex items-center gap-2 border-2 px-2" style={{ borderColor: INK }}>
        <Search size={16} className="opacity-60 shrink-0" />
        <input
          // Plain text with a search keyboard key: type="search" adds a second, native clear button.
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search foods, e.g. greek yogurt"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-0 py-2 bg-transparent outline-none text-sm"
          aria-label="Search foods"
        />
        {usdaLoading && <Loader2 size={16} className="animate-spin opacity-60 shrink-0" aria-label="Searching" />}
        {query && (
          <button type="button" onClick={() => setQuery("")} className="opacity-50 p-1" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {status && (
        <div role="status" className="text-xs mt-2 opacity-70">
          {status}
        </div>
      )}

      {/* Typing: recent + built-in matches instantly, USDA results once they arrive */}
      {trimmed && !showCustom && (
        <div className="border-2 border-t-0 max-h-96 overflow-y-auto" style={{ borderColor: INK, background: PAPER }}>
          {recentMatches.length > 0 && (
            <>
              <SectionLabel>Recent</SectionLabel>
              <ul>
                {recentMatches.map((r) => (
                  <Row key={`r-${r.name}`} title={r.name} right={`${r.calories} kcal`} onClick={() => pickRecent(r)} />
                ))}
              </ul>
            </>
          )}
          {commonMatches.length > 0 && (
            <>
              <SectionLabel>Common foods</SectionLabel>
              <ul>
                {commonMatches.map((f) => (
                  <Row key={`c-${f.name}`} title={f.name} right={`${f.calories} kcal/100g`} onClick={() => setSelected({ food: f })} />
                ))}
              </ul>
            </>
          )}
          {usdaCurrent && usda.foods.length > 0 && (
            <>
              <SectionLabel>USDA database</SectionLabel>
              <ul>
                {usda.foods.map((f) => (
                  <Row
                    key={`u-${f.fdcId}`}
                    title={f.name}
                    subtitle={[f.brand, f.serving && `${f.serving.label} = ${f.serving.grams} g`].filter(Boolean).join(" · ")}
                    right={`${f.calories} kcal/100g`}
                    onClick={() => setSelected({ food: f })}
                  />
                ))}
              </ul>
            </>
          )}
          {usdaCurrent && usda.error && <div className="px-3 py-2 text-xs" style={{ color: ALERT }}>{usda.error}</div>}
          {usdaLoading && !hasTypedResults && <div className="px-3 py-2 text-xs opacity-60 italic">Searching…</div>}
          {!usdaLoading && !hasTypedResults && !usda.error && (
            <div className="px-3 py-2 text-xs opacity-60 italic">No matches.</div>
          )}
          <div className="px-3 py-2" style={{ borderTop: `1px solid ${RULE}` }}>
            <button type="button" className="text-xs underline opacity-70" onClick={() => setShowCustom(true)}>
              Can&rsquo;t find it? Add &ldquo;{trimmed}&rdquo; as a custom item
            </button>
          </div>
        </div>
      )}

      {/* Empty search: quick picks */}
      {!trimmed && !showCustom && (
        <>
          {meals.length > 0 && (
            <div className="mt-3">
              <SectionLabel>Saved meals</SectionLabel>
              <ul>
                {meals.map((m) => (
                  <li key={m.id} className="flex items-center" style={{ borderBottom: `1px solid ${RULE}` }}>
                    <button
                      type="button"
                      onClick={() => logMeal(m)}
                      className="flex-1 min-w-0 text-left px-3 py-2 text-sm flex justify-between items-center gap-3 hover:bg-black/5 active:bg-black/10"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{m.name}</span>
                        <span className="block text-xs opacity-60">{m.items.length} items</span>
                      </span>
                      <span className="text-xs font-mono opacity-60 shrink-0">{sumMacros(m.items).calories} kcal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMeal(m)}
                      className="opacity-40 hover:opacity-100 p-2"
                      aria-label={`Delete meal ${m.name}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recent.length > 0 && (
            <div className="mt-3">
              <SectionLabel>Recent</SectionLabel>
              <ul>
                {recent.map((r) => (
                  <Row key={`r-${r.name}`} title={r.name} right={`${r.calories} kcal`} onClick={() => pickRecent(r)} />
                ))}
              </ul>
            </div>
          )}
          <button type="button" onClick={() => setShowCustom(true)} className="text-xs underline opacity-70 mt-3">
            Add a custom item
          </button>
        </>
      )}

      {showCustom && (
        <CustomFoodForm
          initialName={trimmed}
          onAdd={(item) => addItem(item)}
          onCancel={() => setShowCustom(false)}
        />
      )}
    </div>
  );
}

function Heading() {
  return (
    <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: GOLD }}>
      Add food
    </div>
  );
}
