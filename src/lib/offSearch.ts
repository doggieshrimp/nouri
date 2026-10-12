import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { Food } from "./nutrition";
import { parseOffProduct, type OffProduct } from "./openFoodFacts";

// Open Food Facts product search (search-a-licious), strong on UK and European groceries.
// It doesn't send CORS headers, so browsers can't read it: the Android app calls it
// through Capacitor's native HTTP instead, and the web version skips it.
const SEARCH_URL = "https://search.openfoodfacts.org/search";
const MAX_RESULTS = 10;
/** Below this many usable results in the reader's country, also search worldwide. */
const MIN_LOCAL_RESULTS = 4;

export const canSearchOpenFoodFacts = Capacitor.isNativePlatform();

export interface OffSearchHit extends Omit<OffProduct, "brands"> {
  brands?: string | string[];
  [key: `product_name_${string}`]: string | undefined;
}

export type HttpGet = (url: string, params: Record<string, string>) => Promise<{ status: number; data: unknown }>;

const nativeGet: HttpGet = async (url, params) => {
  const res = await CapacitorHttp.get({ url, params, connectTimeout: 10_000, readTimeout: 15_000 });
  return { status: res.status, data: typeof res.data === "string" ? JSON.parse(res.data) : res.data };
};

/** The reader's language and country from the phone's settings, e.g. en-GB → en, en:united-kingdom. */
export function localeHints(locale: string): { lang: string; countryTag: string | null } {
  try {
    const { language, region } = new Intl.Locale(locale);
    if (!region) return { lang: language, countryTag: null };
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(region);
    return { lang: language, countryTag: name ? `en:${name.toLowerCase().replace(/\s+/g, "-")}` : null };
  } catch {
    return { lang: "en", countryTag: null };
  }
}

/** Keeps letters, numbers and simple punctuation so the query can't break the search syntax. */
export function cleanQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s'&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Converts search hits to foods, preferring the reader's language and dropping repeats. */
export function parseHits(hits: OffSearchHit[], lang: string): Food[] {
  const foods: Food[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const product: OffProduct = {
      ...hit,
      product_name: hit[`product_name_${lang}`] || hit.product_name,
      brands: Array.isArray(hit.brands) ? hit.brands.join(",") : hit.brands,
    };
    const food = product.code ? parseOffProduct(product, product.code) : null;
    if (!food || food.name === "Unnamed product") continue;
    const key = `${food.name.toLowerCase()}|${(food.brand ?? "").toLowerCase()}|${food.calories}`;
    if (seen.has(key)) continue;
    seen.add(key);
    foods.push(food);
  }
  return foods;
}

export async function searchOpenFoodFacts(
  query: string,
  locale = navigator.language,
  get: HttpGet = nativeGet,
): Promise<Food[]> {
  const q = cleanQuery(query);
  if (q.length < 2) return [];
  const { lang, countryTag } = localeHints(locale);
  const fields = `code,product_name,product_name_${lang},brands,nutriments,serving_size,serving_quantity,serving_quantity_unit`;

  async function run(fullQuery: string): Promise<Food[]> {
    const { status, data } = await get(SEARCH_URL, { q: fullQuery, page_size: "24", langs: lang, fields });
    if (status < 200 || status >= 300) throw new Error(`Open Food Facts search failed (${status})`);
    return parseHits(((data as { hits?: OffSearchHit[] })?.hits ?? []), lang);
  }

  let foods = countryTag ? await run(`${q} countries_tags:"${countryTag}"`) : [];
  if (foods.length < MIN_LOCAL_RESULTS) {
    const worldwide = await run(q);
    const known = new Set(foods.map((f) => f.barcode));
    foods = [...foods, ...worldwide.filter((f) => !known.has(f.barcode))];
  }
  return foods.slice(0, MAX_RESULTS);
}
