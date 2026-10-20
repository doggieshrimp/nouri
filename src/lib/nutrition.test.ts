import { describe, expect, it } from "vitest";
import { entryName, goalPercent, plausibleKcalPer100g, scaleFood, sumMacros, type Food } from "./nutrition";

const chicken: Food = { name: "Chicken breast, raw", calories: 165, protein: 31, carbs: 0, fat: 3.6 };

describe("scaleFood", () => {
  it("returns per-100g values unchanged at 100g", () => {
    expect(scaleFood(chicken, 100)).toEqual({ calories: 165, protein: 31, carbs: 0, fat: 3.6 });
  });

  it("scales to other weights, rounding calories to whole numbers", () => {
    expect(scaleFood(chicken, 150)).toEqual({ calories: 248, protein: 46.5, carbs: 0, fat: 5.4 });
  });

  it("returns zeros for 0g", () => {
    expect(scaleFood(chicken, 0)).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("sumMacros", () => {
  it("returns zeros for an empty list", () => {
    expect(sumMacros([])).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, saturatedFat: 0 });
  });

  it("avoids floating-point artifacts in decimal totals", () => {
    const total = sumMacros([
      { calories: 10, protein: 0.1, carbs: 0.1, fat: 0.1 },
      { calories: 20, protein: 0.2, carbs: 0.2, fat: 0.2 },
    ]);
    expect(total).toMatchObject({ calories: 30, protein: 0.3, carbs: 0.3, fat: 0.3 });
  });

  it("totals sugars and saturates, flagging days where some foods don't report them", () => {
    const total = sumMacros([
      { calories: 10, protein: 0, carbs: 5, fat: 1, sugars: 4.1, saturatedFat: 0.2 },
      { calories: 20, protein: 0, carbs: 5, fat: 1, sugars: 1.2 },
    ]);
    expect(total).toMatchObject({ sugars: 5.3, saturatedFat: 0.2, sugarsIncomplete: false, saturatedFatIncomplete: true });
  });
});

describe("scaleFood with sugars and saturates", () => {
  it("scales them when present and leaves them out when unknown", () => {
    const milk: Food = { name: "Milk", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sugars: 5.1, saturatedFat: 1.9, unit: "ml" };
    expect(scaleFood(milk, 200)).toEqual({ calories: 122, protein: 6.4, carbs: 9.6, fat: 6.6, sugars: 10.2, saturatedFat: 3.8 });
    expect(scaleFood(chicken, 100)).not.toHaveProperty("sugars");
  });
});

describe("goalPercent", () => {
  it("computes the rounded percentage", () => {
    expect(goalPercent(500, 2000)).toBe(25);
  });

  it("caps at 100 when over goal", () => {
    expect(goalPercent(2500, 2000)).toBe(100);
  });

  it("returns 0 instead of NaN or Infinity when the goal is 0", () => {
    expect(goalPercent(0, 0)).toBe(0);
    expect(goalPercent(500, 0)).toBe(0);
  });
});

describe("entryName", () => {
  const yogurt: Food = { name: "Greek yogurt", brand: "Chobani", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 };

  it("includes the brand and weight", () => {
    expect(entryName(yogurt, 150)).toBe("Chobani Greek yogurt (150g)");
  });

  it("doesn't repeat a brand that's already in the name", () => {
    expect(entryName({ ...yogurt, name: "Chobani Plain Greek Yogurt" }, 180)).toBe("Chobani Plain Greek Yogurt (180g)");
  });

  it("uses ml for drinks", () => {
    const cola: Food = { name: "Coca-Cola Original", calories: 42, protein: 0, carbs: 10.6, fat: 0, unit: "ml" };
    expect(entryName(cola, 330)).toBe("Coca-Cola Original (330ml)");
  });

  it("works without a brand", () => {
    expect(entryName(chicken, 100)).toBe("Chicken breast, raw (100g)");
  });
});

describe("plausibleKcalPer100g", () => {
  it("keeps normal values", () => {
    expect(plausibleKcalPer100g(389)).toBe(389);
    expect(plausibleKcalPer100g(884)).toBe(884); // olive oil
  });

  it("converts impossible values from kJ", () => {
    expect(Math.round(plausibleKcalPer100g(1580)!)).toBe(378);
  });

  it("rejects values that are implausible either way", () => {
    expect(plausibleKcalPer100g(50000)).toBeNull();
    expect(plausibleKcalPer100g(-5)).toBeNull();
  });
});
