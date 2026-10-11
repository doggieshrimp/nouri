import { afterEach, describe, expect, it, vi } from "vitest";
import { expandUpcE, lookupBarcode, normalizeBarcode, parseOffProduct, type OffProduct } from "./openFoodFacts";

// Trimmed from a real Open Food Facts response (barcode 0031200037206).
const oceanSpray: OffProduct = {
  code: "0031200037206",
  product_name: "Greek yogurt",
  brands: "Ocean Spray,Craisins",
  serving_size: "30 g (2 Tbsp)",
  serving_quantity: 30,
  nutriments: {
    "energy-kcal_100g": 467,
    energy_100g: 1953,
    proteins_100g: 3.33,
    carbohydrates_100g: 70,
    fat_100g: 20,
  },
};

describe("normalizeBarcode", () => {
  it("keeps the digits of valid lengths", () => {
    expect(normalizeBarcode(" 0031200037206 ")).toBe("0031200037206");
    expect(normalizeBarcode("031200037206")).toBe("031200037206");
    expect(normalizeBarcode("96385074")).toBe("96385074");
  });

  it("rejects things that aren't retail barcodes", () => {
    expect(normalizeBarcode("12345")).toBeNull();
    expect(normalizeBarcode("https://example.com")).toBeNull();
  });
});

describe("expandUpcE", () => {
  it("expands each UPC-E pattern to UPC-A", () => {
    // Coca-Cola 12oz can: UPC-E 04963406 = UPC-A 049000006346
    expect(expandUpcE("04963406")).toBe("049000006346");
    expect(expandUpcE("01234531")).toBe("012300000451"); // last digit 3
    expect(expandUpcE("01234543")).toBe("012340000053"); // last digit 4
    expect(expandUpcE("01234558")).toBe("012345000058"); // last digit 5-9
  });

  it("leaves other codes alone", () => {
    expect(expandUpcE("0031200037206")).toBe("0031200037206");
    expect(expandUpcE("96385074")).toBe("96385074"); // EAN-8 starting with 9
  });
});

describe("parseOffProduct", () => {
  it("converts a product to a per-100g food with its serving", () => {
    expect(parseOffProduct(oceanSpray, "0031200037206")).toEqual({
      name: "Greek yogurt",
      brand: "Ocean Spray",
      barcode: "0031200037206",
      calories: 467,
      protein: 3.3,
      carbs: 70,
      fat: 20,
      serving: { grams: 30, label: "2 tbsp" },
    });
  });

  it("uses the serving description outside parentheses when it isn't just grams", () => {
    const p = { ...oceanSpray, serving_size: "1 bar (40 g)", serving_quantity: "40" };
    expect(parseOffProduct(p, "1")?.serving).toEqual({ grams: 40, label: "1 bar" });
  });

  it("falls back to '1 serving' when the size is only grams", () => {
    const p = { ...oceanSpray, serving_size: "30 g" };
    expect(parseOffProduct(p, "1")?.serving?.label).toBe("1 serving");
  });

  it("skips servings measured in ml", () => {
    const p = { ...oceanSpray, serving_quantity_unit: "ml" };
    expect(parseOffProduct(p, "1")?.serving).toBeUndefined();
  });

  it("converts kJ when kcal is missing", () => {
    const p = { ...oceanSpray, nutriments: { energy_100g: 418.4 } };
    expect(parseOffProduct(p, "1")?.calories).toBe(100);
  });

  it("returns null without energy data", () => {
    expect(parseOffProduct({ ...oceanSpray, nutriments: { proteins_100g: 3 } }, "1")).toBeNull();
  });
});

describe("lookupBarcode", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubResponse(body: unknown, status = 200) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("finds a product", async () => {
    stubResponse({ status: 1, product: oceanSpray });
    const result = await lookupBarcode("0031200037206");
    expect(result.status).toBe("found");
  });

  it("reports unknown products", async () => {
    stubResponse({ status: 0, status_verbose: "product not found" }, 404);
    expect(await lookupBarcode("0000000000017")).toEqual({ status: "not-found" });
  });

  it("returns the name when a product has no nutrition data", async () => {
    stubResponse({ status: 1, product: { product_name: "Mystery snack", nutriments: {} } });
    expect(await lookupBarcode("0000000000017")).toEqual({ status: "no-nutrition", name: "Mystery snack" });
  });

  it("doesn't call the API for invalid codes", async () => {
    const fetchMock = stubResponse({});
    expect(await lookupBarcode("abc")).toEqual({ status: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
