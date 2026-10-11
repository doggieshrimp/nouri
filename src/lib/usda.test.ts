import { afterEach, describe, expect, it, vi } from "vitest";
import { parseUsdaFood, searchUsda, UsdaError, type UsdaFood } from "./usda";

// Trimmed from real FoodData Central search responses.
const chobani: UsdaFood = {
  fdcId: 2038865,
  description: "GREEK YOGURT",
  dataType: "Branded",
  brandOwner: "Chobani, Inc.",
  brandName: "CHOBANI",
  servingSize: 150.0,
  servingSizeUnit: "g",
  householdServingFullText: "1 CONTAINER",
  foodNutrients: [
    { nutrientId: 1003, unitName: "G", value: 8.67 },
    { nutrientId: 1004, unitName: "G", value: 0.0 },
    { nutrientId: 1005, unitName: "G", value: 10.7 },
    { nutrientId: 1008, unitName: "KCAL", value: 80.0 },
  ],
};

const rotisserie: UsdaFood = {
  fdcId: 2705964,
  description: "Chicken breast, rotisserie, skin not eaten",
  dataType: "Survey (FNDDS)",
  foodNutrients: [
    { nutrientId: 1003, unitName: "G", value: 28.04 },
    { nutrientId: 1004, unitName: "G", value: 3.57 },
    { nutrientId: 1005, unitName: "G", value: 0 },
    { nutrientId: 1008, unitName: "KCAL", value: 144 },
  ],
};

describe("parseUsdaFood", () => {
  it("tidies all-caps branded names and keeps the label serving", () => {
    expect(parseUsdaFood(chobani)).toEqual({
      name: "Greek yogurt",
      brand: "Chobani",
      fdcId: 2038865,
      calories: 80,
      protein: 8.7,
      carbs: 10.7,
      fat: 0,
      serving: { grams: 150, label: "1 container" },
    });
  });

  it("keeps generic names as-is and has no serving", () => {
    const food = parseUsdaFood(rotisserie);
    expect(food?.name).toBe("Chicken breast, rotisserie, skin not eaten");
    expect(food?.brand).toBeUndefined();
    expect(food?.serving).toBeUndefined();
    expect(food?.calories).toBe(144);
  });

  it("returns null when there's no calorie data", () => {
    expect(parseUsdaFood({ ...rotisserie, foodNutrients: [{ nutrientId: 1003, unitName: "G", value: 20 }] })).toBeNull();
  });

  it("ignores energy reported in kJ", () => {
    expect(parseUsdaFood({ ...rotisserie, foodNutrients: [{ nutrientId: 1008, unitName: "kJ", value: 600 }] })).toBeNull();
  });

  it("falls back to Atwater energy for Foundation foods", () => {
    const food = parseUsdaFood({ ...rotisserie, foodNutrients: [{ nutrientId: 2047, unitName: "KCAL", value: 120.4 }] });
    expect(food?.calories).toBe(120);
    expect(food?.protein).toBe(0);
  });

  it("labels servings without household text as one serving", () => {
    expect(parseUsdaFood({ ...chobani, householdServingFullText: null })?.serving).toEqual({ grams: 150, label: "1 serving" });
  });

  it("labels servings whose household text is only a weight as one serving", () => {
    expect(parseUsdaFood({ ...chobani, householdServingFullText: "45 GRM" })?.serving?.label).toBe("1 serving");
  });

  it("converts calorie values that are really kilojoules", () => {
    // Real USDA entry: Quaker oatmeal listed at "1580 KCAL" per 100g.
    const food = parseUsdaFood({ ...chobani, foodNutrients: [{ nutrientId: 1008, unitName: "KCAL", value: 1580 }] });
    expect(food?.calories).toBe(378);
  });

  it("ignores servings not measured in grams", () => {
    expect(parseUsdaFood({ ...chobani, servingSizeUnit: "ml" })?.serving).toBeUndefined();
  });

  it("title-cases multi-word brands", () => {
    expect(parseUsdaFood({ ...chobani, brandName: "TRADER JOE'S" })?.brand).toBe("Trader Joe's");
  });
});

describe("searchUsda", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(byType: Record<string, UsdaFood[]>, status = 200) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const type = new URL(url).searchParams.get("dataType")!;
        return new Response(JSON.stringify({ foods: byType[type] ?? [] }), { status });
      }),
    );
  }

  it("lists generic foods before branded ones and removes duplicates", async () => {
    stubFetch({ "Foundation,SR Legacy,Survey (FNDDS)": [rotisserie], Branded: [chobani, rotisserie] });
    const results = await searchUsda("chicken");
    expect(results.map((f) => f.fdcId)).toEqual([2705964, 2038865]);
  });

  it("merges the same food listed in two datasets", async () => {
    const sr = { ...rotisserie, fdcId: 1, dataType: "SR Legacy" };
    const fndds = { ...rotisserie, fdcId: 2 };
    stubFetch({ "Foundation,SR Legacy,Survey (FNDDS)": [sr, fndds] });
    expect((await searchUsda("chicken")).map((f) => f.fdcId)).toEqual([1]);
  });

  it("retries a failed request once", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        return calls === 1
          ? new Response("Bad Request", { status: 400 })
          : new Response(JSON.stringify({ foods: [rotisserie] }), { status: 200 });
      }),
    );
    // Two data types are searched in parallel; only the first call fails.
    const results = await searchUsda("chicken");
    expect(results.map((f) => f.fdcId)).toEqual([2705964]);
    expect(calls).toBe(3);
  });

  it("explains rate limiting", async () => {
    stubFetch({}, 429);
    await expect(searchUsda("chicken")).rejects.toThrow(UsdaError);
  });
});
