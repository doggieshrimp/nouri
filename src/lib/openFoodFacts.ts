import { plausibleKcalPer100g, round1, type Food, type Unit } from "./nutrition";

// Open Food Facts: free, worldwide product database (includes USDA's branded foods).
// https://openfoodfacts.github.io/openfoodfacts-server/api/
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS =
  "code,product_name,product_name_en,generic_name,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,quantity,product_quantity_unit";

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  /** Pack size as printed, e.g. "330 ml" or "6". */
  quantity?: string;
  product_quantity_unit?: string;
}

export type BarcodeLookup =
  | { status: "found"; food: Food }
  /** The product exists but has no calorie data; its name is still useful for a custom item. */
  | { status: "no-nutrition"; name: string }
  | { status: "not-found" };

/** Digits only, and a length that real retail barcodes use (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/**
 * Expands an 8-digit UPC-E code (used on small US packages) to the 12-digit UPC-A form
 * that product databases index. Other codes are returned unchanged.
 */
export function expandUpcE(code: string): string {
  if (!/^[01]\d{7}$/.test(code)) return code;
  const [ns, d1, d2, d3, d4, d5, d6, check] = code;
  let body: string;
  if (d6 <= "2") body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${body}${check}`;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** Drinks are sold by volume; Open Food Facts then reports nutrition per 100ml. */
export function offUnit(p: OffProduct): Unit {
  // The pack size decides; the serving unit is the fallback (a powder can have an ml scoop).
  for (const unit of [p.product_quantity_unit, p.serving_quantity_unit].map((u) => u?.toLowerCase())) {
    if (unit === "ml" || unit === "g") return unit;
  }
  return /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? "") ? "ml" : "g";
}

function servingFrom(p: OffProduct, foodUnit: Unit): Food["serving"] {
  const amount = num(p.serving_quantity);
  const unit = p.serving_quantity_unit?.toLowerCase();
  if (!amount || amount <= 0 || (unit && unit !== foodUnit)) return undefined;

  // serving_size looks like "30 g (2 Tbsp)", "1 bar (40 g)", or just "30 g".
  const text = p.serving_size?.trim() ?? "";
  const paren = text.match(/\(([^)]+)\)/)?.[1]?.trim();
  const outside = text.replace(/\([^)]*\)/g, "").trim();
  const isJustAmount = (s: string) => /^[\d.,]+\s*(g|ml)$/i.test(s);
  let label = "1 serving";
  if (outside && !isJustAmount(outside)) label = outside;
  else if (paren && !isJustAmount(paren)) label = paren;
  return { grams: round1(amount), label: label.toLowerCase() };
}

export function productName(p: OffProduct): string {
  return (p.product_name || p.product_name_en || p.generic_name || "").trim();
}

/** Converts an Open Food Facts product into a per-100g Food, or null without calorie data. */
export function parseOffProduct(p: OffProduct, barcode: string): Food | null {
  const n = p.nutriments ?? {};
  const rawKcal = num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) !== undefined ? num(n["energy_100g"])! / 4.184 : undefined);
  const kcal = rawKcal === undefined ? null : plausibleKcalPer100g(rawKcal);
  if (kcal === null) return null;

  const brand = p.brands?.split(",")[0]?.trim();
  const unit = offUnit(p);
  const sugars = num(n["sugars_100g"]);
  const saturatedFat = num(n["saturated-fat_100g"]);
  return {
    name: productName(p) || "Unnamed product",
    brand: brand || undefined,
    barcode,
    calories: Math.round(kcal),
    protein: round1(num(n["proteins_100g"]) ?? 0),
    carbs: round1(num(n["carbohydrates_100g"]) ?? 0),
    fat: round1(num(n["fat_100g"]) ?? 0),
    ...(sugars !== undefined ? { sugars: round1(sugars) } : {}),
    ...(saturatedFat !== undefined ? { saturatedFat: round1(saturatedFat) } : {}),
    ...(unit === "ml" ? { unit } : {}),
    serving: servingFrom(p, unit),
  };
}

export class BarcodeLookupError extends Error {}

export async function lookupBarcode(rawCode: string, signal?: AbortSignal): Promise<BarcodeLookup> {
  const code = normalizeBarcode(rawCode);
  if (!code) return { status: "not-found" };

  let res: Response;
  try {
    res = await fetch(`${PRODUCT_URL}/${code}.json?fields=${FIELDS}`, { signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new BarcodeLookupError("Couldn't reach the product database. Check your internet connection.");
  }
  // Unknown products come back as 404 with { status: 0 }.
  if (res.status === 404) return { status: "not-found" };
  if (!res.ok) throw new BarcodeLookupError(`The product database returned an error (${res.status}).`);

  const data = (await res.json()) as { status?: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return { status: "not-found" };

  const food = parseOffProduct(data.product, code);
  if (food) return { status: "found", food };
  return { status: "no-nutrition", name: productName(data.product) };
}
