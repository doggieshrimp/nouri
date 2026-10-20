import { plausibleKcalPer100g, round1, type Food, type Unit } from "./nutrition";
import { cleanQuery } from "./searchQuery";

// USDA FoodData Central: https://fdc.nal.usda.gov/api-guide
const SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const GENERIC_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
const BRANDED_TYPES = ["Branded"];

const NUTRIENT = { protein: 1003, fat: 1004, carbs: 1005, saturatedFat: 1258 } as const;
// "Sugars, total including NLEA" is the usual one; some newer entries use "Sugars, Total".
const SUGAR_IDS = [2000, 1063];
// Most foods report energy as 1008; some Foundation foods only have the Atwater variants.
const ENERGY_IDS = [1008, 2047, 2048];

export interface UsdaNutrient {
  nutrientId?: number;
  unitName?: string;
  value?: number;
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandName?: string | null;
  brandOwner?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  householdServingFullText?: string | null;
  foodCategory?: string | null;
  foodNutrients?: UsdaNutrient[];
}

const ML_UNITS = new Set(["ml", "mlt"]);
// Categories (from SR Legacy and FNDDS) whose foods are drinks.
const DRINK_CATEGORY = /juice|soft drink|coffee|\btea\b|beer|wine|liquor|cocktail|water|energy drink|nutritional beverage|smoothie|fruit drink|milk|beverage/i;
// Broad categories that mix drinks and solid food, where the name has to say it's a drink.
const MIXED_CATEGORY = /^(beverages|dairy and egg products|fruits and fruit juices|baby foods)$/i;
const DRINK_NAME = /\b(juice|milk|drink|beverage|soda|cola|coffee|tea|beer|wine|smoothie|water|lemonade|nectar|shake)\b/i;
const NOT_A_DRINK = /\b(powder|dry|dried|dehydrated|concentrate|instant|frozen|cheese|candy|cake|cookie|bread|cereal|ice cream|yogurt|chocolate)\b/i;

/**
 * Branded drinks are already reported per 100ml. Generic drinks are reported per 100g;
 * for watery drinks 1 g is within a few percent of 1 ml, so they're shown in ml too.
 */
export function usdaUnit(f: UsdaFood): Unit {
  if (f.dataType === "Branded") return ML_UNITS.has(f.servingSizeUnit?.toLowerCase() ?? "") ? "ml" : "g";
  const category = f.foodCategory?.trim() ?? "";
  if (!category || NOT_A_DRINK.test(f.description)) return "g";
  if (MIXED_CATEGORY.test(category)) return DRINK_NAME.test(f.description) ? "ml" : "g";
  return DRINK_CATEGORY.test(category) ? "ml" : "g";
}

/** The key from .env.local, or USDA's rate-limited DEMO_KEY during development. */
export function usdaApiKey(): string | undefined {
  const key = import.meta.env.VITE_USDA_API_KEY as string | undefined;
  if (key) return key;
  return import.meta.env.DEV ? "DEMO_KEY" : undefined;
}

function isAllCaps(s: string): boolean {
  return /[A-Z]/.test(s) && s === s.toUpperCase();
}

function sentenceCase(s: string): string {
  if (!isAllCaps(s)) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCase(s: string): string {
  if (!isAllCaps(s)) return s;
  return s.toLowerCase().replace(/(^|[\s\-&./])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function servingFrom(f: UsdaFood, foodUnit: Unit): Food["serving"] {
  const unit = f.servingSizeUnit?.toLowerCase() ?? "";
  const matchesFood = foodUnit === "ml" ? ML_UNITS.has(unit) : unit === "g" || unit === "grm";
  if (!f.servingSize || f.servingSize <= 0 || !matchesFood) return undefined;
  const amount = round1(f.servingSize);
  const household = f.householdServingFullText?.trim().toLowerCase();
  // Some products only repeat the amount here ("45 grm", "355 ml"), which says nothing new.
  const isJustAmount = household && /^[\d.,]+\s*(g|grm|gram|grams|ml|mlt)$/.test(household);
  return { grams: amount, label: household && !isJustAmount ? household : "1 serving" };
}

/** Converts a USDA search result into a per-100g Food. Returns null if it has no calorie data. */
export function parseUsdaFood(f: UsdaFood): Food | null {
  const nutrients = f.foodNutrients ?? [];
  const find = (id: number) => nutrients.find((n) => n.nutrientId === id && typeof n.value === "number");

  const energy = ENERGY_IDS.map((id) =>
    nutrients.find((n) => n.nutrientId === id && n.unitName?.toUpperCase() === "KCAL" && typeof n.value === "number"),
  ).find(Boolean);
  if (!energy) return null;
  const kcal = plausibleKcalPer100g(energy.value!);
  if (kcal === null) return null;

  const brandRaw = f.brandName || f.brandOwner;
  const unit = usdaUnit(f);
  return {
    name: sentenceCase(f.description.trim()),
    brand: brandRaw ? titleCase(brandRaw.trim()) : undefined,
    fdcId: f.fdcId,
    calories: Math.round(kcal),
    protein: round1(find(NUTRIENT.protein)?.value ?? 0),
    carbs: round1(find(NUTRIENT.carbs)?.value ?? 0),
    fat: round1(find(NUTRIENT.fat)?.value ?? 0),
    ...optional("sugars", SUGAR_IDS.map(find).find(Boolean)?.value),
    ...optional("saturatedFat", find(NUTRIENT.saturatedFat)?.value),
    ...(unit === "ml" ? { unit } : {}),
    serving: servingFrom(f, unit),
  };
}

/** Includes a nutrient only when the source reports it, so "unknown" isn't shown as 0. */
function optional<K extends "sugars" | "saturatedFat">(key: K, value: number | undefined): { [P in K]?: number } {
  return value === undefined ? {} : ({ [key]: round1(value) } as { [P in K]: number });
}

export class UsdaError extends Error {}

async function searchType(query: string, dataType: string[], pageSize: number, apiKey: string, signal?: AbortSignal) {
  // POST with a JSON body: the GET form, with "Survey (FNDDS)" in the URL, is rejected by
  // USDA's gateway (HTTP 400) for most queries, which hid basics like tortillas and rolls.
  const url = `${SEARCH_URL}?${new URLSearchParams({ api_key: apiKey })}`;
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: cleanQuery(query), dataType, pageSize }),
    signal,
  };
  let res = await fetch(url, init);
  // The API occasionally fails a valid request; one retry usually succeeds.
  if (!res.ok && res.status !== 429) res = await fetch(url, init);
  if (res.status === 429) throw new UsdaError("Too many searches for now. Try again in a little while.");
  if (!res.ok) throw new UsdaError(`The food database returned an error (${res.status}).`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  return (data.foods ?? []).map(parseUsdaFood).filter((f): f is Food => f !== null);
}

export interface UsdaResults {
  /** Generic foods, e.g. "Tortilla, flour". */
  generic: Food[];
  /** Branded (mostly US) products. */
  branded: Food[];
}

/** Searches USDA FoodData Central. Values are per 100g. */
export async function searchUsda(query: string, signal?: AbortSignal): Promise<UsdaResults> {
  const apiKey = usdaApiKey();
  if (!apiKey) throw new UsdaError("Online food search isn't set up (missing API key).");

  const [generic, branded] = await Promise.all([
    searchType(query, GENERIC_TYPES, 8, apiKey, signal),
    searchType(query, BRANDED_TYPES, 10, apiKey, signal),
  ]);

  // Drop repeats: the same fdcId, or the same food listed in two USDA datasets.
  const seen = new Set<string>();
  const unique = (f: Food) => {
    const keys = [`id:${f.fdcId}`, `food:${f.name.toLowerCase()}|${f.brand ?? ""}|${f.calories}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  };
  return { generic: generic.filter(unique), branded: branded.filter(unique) };
}
