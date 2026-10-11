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
    expect(sumMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("avoids floating-point artifacts in decimal totals", () => {
    const total = sumMacros([
      { calories: 10, protein: 0.1, carbs: 0.1, fat: 0.1 },
      { calories: 20, protein: 0.2, carbs: 0.2, fat: 0.2 },
    ]);
    expect(total).toEqual({ calories: 30, protein: 0.3, carbs: 0.3, fat: 0.3 });
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
