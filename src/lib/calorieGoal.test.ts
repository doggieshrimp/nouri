import { describe, expect, it } from "vitest";
import { bmr, ftInToCm, lbToKg, suggestGoal, validateInputs, type GoalInputs } from "./calorieGoal";

const man: GoalInputs = { sex: "male", age: 30, heightCm: 180, weightKg: 80, activity: "moderate", rate: "lose" };
const woman: GoalInputs = { sex: "female", age: 30, heightCm: 165, weightKg: 60, activity: "sedentary", rate: "lose-fast" };

describe("bmr", () => {
  it("matches the Mifflin-St Jeor equation", () => {
    expect(bmr(man)).toBe(1780); // 800 + 1125 - 150 + 5
    expect(bmr(woman)).toBeCloseTo(1320.25); // 600 + 1031.25 - 150 - 161
  });

  it("uses the midpoint of the sex constants when unspecified", () => {
    expect(bmr({ ...man, sex: "unspecified" })).toBe(1780 - 5 - 78);
  });
});

describe("suggestGoal", () => {
  it("applies activity and the weekly rate, rounded to 10", () => {
    // 1780 * 1.55 = 2759 maintenance, minus 550 for 0.5 kg/week
    expect(suggestGoal(man)).toEqual({ bmr: 1780, maintenance: 2760, goal: 2210, raisedToFloor: false });
  });

  it("returns maintenance when maintaining", () => {
    const s = suggestGoal({ ...man, rate: "maintain" });
    expect(s.goal).toBe(s.maintenance);
  });

  it("never suggests less than the safe minimum", () => {
    // 1320 * 1.2 = 1584 maintenance, minus 825 would be ~760
    expect(suggestGoal(woman)).toMatchObject({ goal: 1200, raisedToFloor: true });
    expect(suggestGoal({ ...woman, sex: "male" })).toMatchObject({ goal: 1500, raisedToFloor: true });
  });

  it("doesn't apply the floor when gaining", () => {
    expect(suggestGoal({ ...woman, rate: "gain-slow" }).raisedToFloor).toBe(false);
  });
});

describe("unit conversion", () => {
  it("converts feet and inches to cm", () => {
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34);
  });

  it("converts pounds to kg", () => {
    expect(lbToKg(176)).toBeCloseTo(79.83, 2);
  });
});

describe("validateInputs", () => {
  it("accepts realistic adult values", () => {
    expect(validateInputs(man)).toBeNull();
  });

  it("explains that the formula is for adults", () => {
    expect(validateInputs({ ...man, age: 15 })).toMatch(/adults/);
  });

  it("rejects missing or unrealistic values", () => {
    expect(validateInputs({ ...man, age: 0 })).toMatch(/age/);
    expect(validateInputs({ ...man, heightCm: 50 })).toMatch(/height/);
    expect(validateInputs({ ...man, weightKg: NaN })).toMatch(/weight/);
  });
});
