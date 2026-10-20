import { describe, expect, it, vi } from "vitest";
import { localeHints, parseHits, searchOpenFoodFacts, type HttpGet, type OffSearchHit } from "./offSearch";
import { cleanQuery } from "./searchQuery";

// Trimmed from real search.openfoodfacts.org hits for "crumpets".
const warburtons: OffSearchHit = {
  code: "5010044000701",
  product_name: "Crumpets",
  brands: ["Warburtons"],
  serving_size: "1 crumpet (55 g)",
  serving_quantity: 55,
  nutriments: { "energy-kcal_100g": 176, proteins_100g: 6, carbohydrates_100g: 35, fat_100g: 0.9 },
};
const sainsburys: OffSearchHit = {
  ...warburtons,
  code: "01245678",
  brands: ["Sainsbury's"],
  nutriments: { "energy-kcal_100g": 206, proteins_100g: 6.3, carbohydrates_100g: 41, fat_100g: 1 },
};

describe("localeHints", () => {
  it("maps the phone's region to an Open Food Facts country tag", () => {
    expect(localeHints("en-GB")).toEqual({ lang: "en", countryTag: "en:united-kingdom" });
    expect(localeHints("en-US")).toEqual({ lang: "en", countryTag: "en:united-states" });
    expect(localeHints("fr-FR")).toEqual({ lang: "fr", countryTag: "en:france" });
  });

  it("has no country when the locale has no region", () => {
    expect(localeHints("en")).toEqual({ lang: "en", countryTag: null });
  });
});

describe("cleanQuery", () => {
  it("removes characters that break search syntax", () => {
    expect(cleanQuery('bread "rolls" (white):')).toBe("bread rolls white");
    expect(cleanQuery("beef 85/15 [lean] tea!")).toBe("beef 85 15 lean tea");
  });

  it("keeps apostrophes, ampersands, percentages and accents", () => {
    expect(cleanQuery("M&S pain au chocolat, Sainsbury's crème 5% fat")).toBe("M&S pain au chocolat, Sainsbury's crème 5% fat");
  });
});

describe("parseHits", () => {
  it("handles brand lists and keeps the serving", () => {
    const [food] = parseHits([warburtons], "en");
    expect(food).toMatchObject({ name: "Crumpets", brand: "Warburtons", calories: 176, serving: { grams: 55, label: "1 crumpet" } });
  });

  it("prefers the name in the reader's language", () => {
    const [food] = parseHits([{ ...warburtons, product_name: "Petits pains", product_name_en: "Bread rolls" }], "en");
    expect(food.name).toBe("Bread rolls");
  });

  it("drops duplicates, unnamed products and ones without calories", () => {
    const foods = parseHits(
      [warburtons, { ...warburtons, code: "2" }, { ...warburtons, code: "3", product_name: "" }, { ...warburtons, code: "4", nutriments: {} }],
      "en",
    );
    expect(foods).toHaveLength(1);
  });
});

describe("searchOpenFoodFacts", () => {
  function fakeGet(responses: Record<string, OffSearchHit[]>) {
    return vi.fn<HttpGet>(async (_url, params) => ({ status: 200, data: { hits: responses[params.q] ?? [] } }));
  }

  it("searches the reader's country first", async () => {
    const get = fakeGet({ 'crumpets countries_tags:"en:united-kingdom"': [warburtons, sainsburys, { ...warburtons, code: "5", brands: ["Tesco"] }, { ...warburtons, code: "6", brands: ["Waitrose"] }] });
    const foods = await searchOpenFoodFacts("crumpets", "en-GB", get);
    expect(foods.map((f) => f.brand)).toEqual(["Warburtons", "Sainsbury's", "Tesco", "Waitrose"]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("adds worldwide results when the country has too few", async () => {
    const get = fakeGet({ 'crumpets countries_tags:"en:united-kingdom"': [warburtons], crumpets: [warburtons, sainsburys] });
    const foods = await searchOpenFoodFacts("crumpets", "en-GB", get);
    expect(foods.map((f) => f.brand)).toEqual(["Warburtons", "Sainsbury's"]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws on errors so the caller can hide the section", async () => {
    const get = vi.fn<HttpGet>(async () => ({ status: 503, data: null }));
    await expect(searchOpenFoodFacts("crumpets", "en", get)).rejects.toThrow("503");
  });
});
