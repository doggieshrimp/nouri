export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Carbohydrate "of which sugars", in grams. Absent when the source doesn't say. */
  sugars?: number;
  /** Fat "of which saturates", in grams. Absent when the source doesn't say. */
  saturatedFat?: number;
}

/** Foods are measured in grams; drinks in millilitres. */
export type Unit = "g" | "ml";

/** A food's nutrition values per 100g (or per 100ml for drinks). */
export interface Food extends Macros {
  name: string;
  brand?: string;
  /** USDA FoodData Central id, for foods from the online database. */
  fdcId?: number;
  /** Retail barcode, for foods found by scanning. */
  barcode?: string;
  /** "ml" for drinks. Defaults to grams. */
  unit?: Unit;
  /**
   * Typical serving from the label, e.g. { grams: 150, label: "1 container" }.
   * `grams` is the amount in the food's unit, so millilitres for drinks.
   */
  serving?: { grams: number; label: string };
}

export function unitOf(food: Food): Unit {
  return food.unit ?? "g";
}

/** Daily totals. Sugars and saturates only count foods that report them. */
export interface Totals extends Required<Macros> {
  /** At least one item had no sugar figure, so `sugars` may be an undercount. */
  sugarsIncomplete: boolean;
  /** At least one item had no saturated fat figure. */
  saturatedFatIncomplete: boolean;
}

export interface Entry extends Macros {
  id: string;
  name: string;
}

export const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Rounds to one decimal place, avoiding float artifacts like 33.700000000000003. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scales a per-100 food to an amount in its unit (grams, or ml for drinks). */
export function scaleFood(food: Food, amount: number): Macros {
  const factor = amount / 100;
  const scaled: Macros = {
    calories: Math.round(food.calories * factor),
    protein: round1(food.protein * factor),
    carbs: round1(food.carbs * factor),
    fat: round1(food.fat * factor),
  };
  if (food.sugars !== undefined) scaled.sugars = round1(food.sugars * factor);
  if (food.saturatedFat !== undefined) scaled.saturatedFat = round1(food.saturatedFat * factor);
  return scaled;
}

export function sumMacros(items: Macros[]): Totals {
  const raw = { ...EMPTY_MACROS, sugars: 0, saturatedFat: 0 };
  let sugarsIncomplete = false;
  let saturatedFatIncomplete = false;
  for (const m of items) {
    raw.calories += m.calories;
    raw.protein += m.protein;
    raw.carbs += m.carbs;
    raw.fat += m.fat;
    if (m.sugars === undefined) sugarsIncomplete = true;
    else raw.sugars += m.sugars;
    if (m.saturatedFat === undefined) saturatedFatIncomplete = true;
    else raw.saturatedFat += m.saturatedFat;
  }
  return {
    calories: Math.round(raw.calories),
    protein: round1(raw.protein),
    carbs: round1(raw.carbs),
    fat: round1(raw.fat),
    sugars: round1(raw.sugars),
    saturatedFat: round1(raw.saturatedFat),
    sugarsIncomplete,
    saturatedFatIncomplete,
  };
}

/** Percent of the calorie goal eaten, clamped to 0–100. A goal of 0 or less yields 0. */
export function goalPercent(calories: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((calories / goal) * 100)));
}

/** Log entry name for an amount of a food, e.g. "Chobani Greek yogurt (150g)" or "Coca-Cola (330ml)". */
export function entryName(food: Food, amount: number): string {
  const hasBrand = food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase());
  return `${hasBrand ? `${food.brand} ` : ""}${food.name} (${amount}${unitOf(food)})`;
}

/** Nothing has more than ~900 kcal per 100g (pure fat). */
const MAX_KCAL_PER_100G = 900;

/**
 * Sanity-checks a per-100g calorie value from a food database. Some entries record
 * kilojoules in the calorie field (e.g. 1580 for oats, ~378 kcal), so impossible
 * values are converted from kJ. Returns null if even that isn't plausible.
 */
export function plausibleKcalPer100g(kcal: number): number | null {
  if (kcal < 0) return null;
  if (kcal <= MAX_KCAL_PER_100G) return kcal;
  const fromKj = kcal / 4.184;
  return fromKj <= MAX_KCAL_PER_100G ? fromKj : null;
}
