import { round1, type Food } from "./nutrition";

// USDA FoodData Central: https://fdc.nal.usda.gov/api-guide
const SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const GENERIC_TYPES = "Foundation,SR Legacy,Survey (FNDDS)";
const BRANDED_TYPES = "Branded";

const NUTRIENT = { protein: 1003, fat: 1004, carbs: 1005 } as const;
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
  foodNutrients?: UsdaNutrient[];
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

function servingFrom(f: UsdaFood): Food["serving"] {
  const unit = f.servingSizeUnit?.toLowerCase();
  if (!f.servingSize || f.servingSize <= 0 || (unit !== "g" && unit !== "grm")) return undefined;
  const grams = round1(f.servingSize);
  const household = f.householdServingFullText?.trim();
  return { grams, label: household ? household.toLowerCase() : "1 serving" };
}

/** Converts a USDA search result into a per-100g Food. Returns null if it has no calorie data. */
export function parseUsdaFood(f: UsdaFood): Food | null {
  const nutrients = f.foodNutrients ?? [];
  const find = (id: number) => nutrients.find((n) => n.nutrientId === id && typeof n.value === "number");

  const energy = ENERGY_IDS.map((id) =>
    nutrients.find((n) => n.nutrientId === id && n.unitName?.toUpperCase() === "KCAL" && typeof n.value === "number"),
  ).find(Boolean);
  if (!energy) return null;

  const brandRaw = f.brandName || f.brandOwner;
  return {
    name: sentenceCase(f.description.trim()),
    brand: brandRaw ? titleCase(brandRaw.trim()) : undefined,
    fdcId: f.fdcId,
    calories: Math.round(energy.value!),
    protein: round1(find(NUTRIENT.protein)?.value ?? 0),
    carbs: round1(find(NUTRIENT.carbs)?.value ?? 0),
    fat: round1(find(NUTRIENT.fat)?.value ?? 0),
    serving: servingFrom(f),
  };
}

export class UsdaError extends Error {}

async function searchType(query: string, dataType: string, pageSize: number, apiKey: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ api_key: apiKey, query, dataType, pageSize: String(pageSize) });
  const url = `${SEARCH_URL}?${params}`;
  let res = await fetch(url, { signal });
  // The API occasionally fails a valid request; one retry usually succeeds.
  if (!res.ok && res.status !== 429) res = await fetch(url, { signal });
  if (res.status === 429) throw new UsdaError("Too many searches for now. Try again in a little while.");
  if (!res.ok) throw new UsdaError(`The food database returned an error (${res.status}).`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  return (data.foods ?? []).map(parseUsdaFood).filter((f): f is Food => f !== null);
}

/**
 * Searches USDA FoodData Central. Generic foods (e.g. "Banana, raw") come first because
 * they're cleaner; branded products follow. Values are per 100g.
 */
export async function searchUsda(query: string, signal?: AbortSignal): Promise<Food[]> {
  const apiKey = usdaApiKey();
  if (!apiKey) throw new UsdaError("Online food search isn't set up (missing API key).");

  const [generic, branded] = await Promise.all([
    searchType(query, GENERIC_TYPES, 8, apiKey, signal),
    searchType(query, BRANDED_TYPES, 12, apiKey, signal),
  ]);

  const seen = new Set<number>();
  return [...generic, ...branded].filter((f) => {
    if (f.fdcId === undefined || seen.has(f.fdcId)) return false;
    seen.add(f.fdcId);
    return true;
  });
}
