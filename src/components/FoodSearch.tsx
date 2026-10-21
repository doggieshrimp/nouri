import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, ScanBarcode, Search, X } from "lucide-react";
import { FOOD_DB } from "../data/foods";
import { addEntry, addMealToDay, deleteMeal, getMeals, getRecentItems, type LogItem, type Meal } from "../db";
import type { DateKey } from "../lib/dates";
import { entryName, scaleFood, sumMacros, unitOf, type Food } from "../lib/nutrition";
import { canScan, scanBarcode } from "../lib/scanner";
import { canSearchOpenFoodFacts, searchOpenFoodFacts } from "../lib/offSearch";
import { lookupBarcode } from "../lib/openFoodFacts";
import { findStore } from "../lib/stores";
import { searchUsda, UsdaError } from "../lib/usda";
import { useDebounced } from "../lib/useDebounced";
import { ALERT, GOLD, INK, PAPER, RULE } from "../theme";
import { BarcodeEntry, BarcodeResult } from "./BarcodeLookup";
import CustomFoodForm from "./CustomFoodForm";
import FoodEditor from "./FoodEditor";

interface UsdaResult {
  query: string;
  generic: Food[];
  branded: Food[];
  error: string | null;
}

interface OffResult {
  query: string;
  foods: Food[];
}

const NO_ITEMS: LogItem[] = [];
const NO_MEALS: Meal[] = [];

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[0.6875rem] font-bold uppercase tracking-widest opacity-70 px-3 pt-3 pb-1">{children}</div>
  );
}

function FoodRows({ label, foods, onPick }: { label: string; foods: Food[]; onPick: (food: Food) => void }) {
  if (foods.length === 0) return null;
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      <ul>
        {foods.map((f) => (
          <Row
            key={`${label}-${f.fdcId ?? f.barcode ?? f.name}`}
            title={f.name}
            subtitle={[f.brand, f.serving && `${f.serving.label} = ${f.serving.grams} ${unitOf(f)}`].filter(Boolean).join(" · ")}
            right={`${f.calories} kcal/100${unitOf(f)}`}
            onClick={() => onPick(f)}
          />
        ))}
      </ul>
    </>
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
          {subtitle && <span className="block text-xs opacity-70 truncate">{subtitle}</span>}
        </span>
        <span className="text-xs font-mono opacity-70 shrink-0">{right}</span>
      </button>
    </li>
  );
}

export default function FoodSearch({ date }: { date: DateKey }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ food: Food; grams?: number } | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [typingBarcode, setTypingBarcode] = useState(false);

  const recent = useLiveQuery(() => getRecentItems(8)) ?? NO_ITEMS;
  const meals = useLiveQuery(getMeals) ?? NO_MEALS;

  const trimmed = query.trim();
  const q = trimmed.toLowerCase();
  const debounced = useDebounced(trimmed, 400);
  const [usda, setUsda] = useState<UsdaResult>({ query: "", generic: [], branded: [], error: null });
  const [off, setOff] = useState<OffResult>({ query: "", foods: [] });

  // Naming a supermarket ("pork tesco") searches only its own-brand products, which the
  // US database doesn't have. Needs Open Food Facts, so the web version ignores store names.
  const store = useMemo(() => (canSearchOpenFoodFacts ? findStore(trimmed)?.store ?? null : null), [trimmed]);

  useEffect(() => {
    if (debounced.length < 2 || (canSearchOpenFoodFacts && findStore(debounced))) return;
    const ctrl = new AbortController();
    searchUsda(debounced, ctrl.signal).then(
      ({ generic, branded }) => setUsda({ query: debounced, generic, branded, error: null }),
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        const error =
          err instanceof UsdaError ? err.message : "Couldn't reach the food database. Check your internet connection.";
        setUsda({ query: debounced, generic: [], branded: [], error });
      },
    );
    return () => ctrl.abort();
  }, [debounced]);

  // Open Food Facts adds local supermarket products (Android app only). Failures just
  // leave its section empty, since USDA results still show.
  useEffect(() => {
    if (!canSearchOpenFoodFacts || debounced.length < 2) return;
    let cancelled = false;
    searchOpenFoodFacts(debounced).then(
      (foods) => !cancelled && setOff({ query: debounced, foods }),
      () => !cancelled && setOff({ query: debounced, foods: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Search results don't include serving sizes, so fetch the full product once it's picked.
  const pendingBarcode = selected && selected.food.barcode && !selected.food.serving ? selected.food.barcode : null;
  useEffect(() => {
    if (!pendingBarcode) return;
    const ctrl = new AbortController();
    lookupBarcode(pendingBarcode, ctrl.signal).then(
      (result) => {
        const serving = result.status === "found" ? result.food.serving : undefined;
        if (!serving) return;
        setSelected((s) => (s && s.food.barcode === pendingBarcode ? { ...s, food: { ...s.food, serving } } : s));
      },
      () => {}, // Optional extra; the food can be logged by weight without it.
    );
    return () => ctrl.abort();
  }, [pendingBarcode]);

  const recentMatches = useMemo(
    () => (q ? recent.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 3) : []),
    [recent, q],
  );
  const commonMatches = useMemo(
    () => (q ? FOOD_DB.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 4) : []),
    [q],
  );
  const usdaCurrent = !store && usda.query === trimmed;
  const offCurrent = !canSearchOpenFoodFacts || off.query === trimmed;
  const offFoods = canSearchOpenFoodFacts && off.query === trimmed ? off.foods : [];
  const searching = trimmed.length >= 2 && ((!store && !usdaCurrent) || !offCurrent);

  function flash(message: string) {
    setStatus(message);
    setTimeout(() => setStatus((s) => (s === message ? null : s)), 2500);
  }

  function reset() {
    setQuery("");
    setSelected(null);
    setShowCustom(false);
    setCustomName("");
    setBarcode(null);
    setTypingBarcode(false);
  }

  function openCustom(name: string) {
    setCustomName(name);
    setShowCustom(true);
    setBarcode(null);
  }

  async function startScan() {
    if (!canScan) {
      setTypingBarcode(true);
      return;
    }
    try {
      const code = await scanBarcode(flash);
      if (code) {
        setTypingBarcode(false);
        setBarcode(code);
      }
    } catch (err) {
      flash((err as Error).message || "The barcode scanner couldn't start.");
    }
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
          key={selected.food.fdcId ?? selected.food.barcode ?? selected.food.name}
          food={selected.food}
          initialAmount={selected.grams}
          onAdd={(grams) => addFood(selected.food, grams)}
          onCancel={() => setSelected(null)}
        />
      </div>
    );
  }

  const onlineCount = (usdaCurrent ? usda.generic.length + usda.branded.length : 0) + offFoods.length;
  const hasTypedResults = recentMatches.length + commonMatches.length + onlineCount > 0;
  const pick = (food: Food) => setSelected({ food });

  return (
    <div className="mt-6">
      <Heading />
      <div className="flex gap-2">
      <div className="flex-1 min-w-0 flex items-center gap-2 border-2 px-2" style={{ borderColor: INK }}>
        <Search size={16} className="opacity-70 shrink-0" />
        <input
          // Plain text with a search keyboard key: type="search" adds a second, native clear button.
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search foods"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-0 py-2 bg-transparent outline-none text-sm"
          aria-label="Search foods"
        />
        {searching && <Loader2 size={16} className="animate-spin opacity-70 shrink-0" aria-label="Searching" />}
        {query && (
          <button type="button" onClick={() => setQuery("")} className="opacity-70 p-1" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>
        <button
          type="button"
          onClick={startScan}
          className="shrink-0 px-3 flex items-center justify-center"
          style={{ background: INK, color: PAPER }}
          aria-label={canScan ? "Scan a barcode" : "Enter a barcode"}
        >
          <ScanBarcode size={20} />
        </button>
      </div>

      {typingBarcode && !barcode && (
        <BarcodeEntry onSubmit={(code) => setBarcode(code)} onClose={() => setTypingBarcode(false)} />
      )}
      {barcode && (
        <BarcodeResult
          key={barcode}
          code={barcode}
          onFound={(food) => {
            setBarcode(null);
            setTypingBarcode(false);
            setSelected({ food });
          }}
          onAddCustom={openCustom}
          onClose={() => setBarcode(null)}
        />
      )}

      {status && (
        <div role="status" className="text-xs mt-2 opacity-70">
          {status}
        </div>
      )}

      {/* Typing: recent + built-in matches instantly, then basic foods (USDA), local
          products (Open Food Facts) and US branded products as each search returns */}
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
                  <Row key={`c-${f.name}`} title={f.name} right={`${f.calories} kcal/100${unitOf(f)}`} onClick={() => setSelected({ food: f })} />
                ))}
              </ul>
            </>
          )}
          {usdaCurrent && <FoodRows label="Basic foods" foods={usda.generic} onPick={pick} />}
          <FoodRows label={store ? `${store.name} products` : "Products"} foods={offFoods} onPick={pick} />
          {usdaCurrent && (
            <FoodRows label={canSearchOpenFoodFacts ? "US products" : "Branded products"} foods={usda.branded} onPick={pick} />
          )}
          {usdaCurrent && usda.error && offFoods.length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: ALERT }}>{usda.error}</div>
          )}
          {searching && !hasTypedResults && <div className="px-3 py-2 text-xs opacity-70 italic">Searching…</div>}
          {!searching && !hasTypedResults && !usda.error && (
            <div className="px-3 py-2 text-xs opacity-70 italic">
              {store ? `No ${store.name} products found.` : "No matches."}
            </div>
          )}
          <div className="px-3 py-2" style={{ borderTop: `1px solid ${RULE}` }}>
            <button type="button" className="text-xs underline opacity-70" onClick={() => openCustom(trimmed)}>
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
                        <span className="block text-xs opacity-70">{m.items.length} items</span>
                      </span>
                      <span className="text-xs font-mono opacity-70 shrink-0">{sumMacros(m.items).calories} kcal</span>
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
          <div className="flex gap-4 mt-3">
            <button type="button" onClick={() => openCustom("")} className="text-xs underline opacity-70">
              Add a custom item
            </button>
            {canScan && (
              <button type="button" onClick={() => setTypingBarcode(true)} className="text-xs underline opacity-70">
                Type a barcode
              </button>
            )}
          </div>
        </>
      )}

      {showCustom && (
        <CustomFoodForm
          initialName={customName}
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
