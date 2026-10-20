import { describe, expect, it } from "vitest";
import {
  dayResults,
  formatWeight,
  formatWeightChange,
  goalOn,
  kgToStone,
  lbToKg,
  periodRange,
  shiftPeriod,
  summarizeCalories,
  trendChange,
  withTrend,
} from "./progress";

describe("periodRange", () => {
  it("runs weeks Monday to Sunday", () => {
    // 2026-10-15 is a Thursday.
    const week = periodRange("week", "2026-10-15");
    expect(week.start).toBe("2026-10-12");
    expect(week.end).toBe("2026-10-18");
    expect(week.days).toHaveLength(7);
  });

  it("keeps a Sunday in the week that started the Monday before", () => {
    expect(periodRange("week", "2026-10-18").start).toBe("2026-10-12");
  });

  it("covers whole calendar months, including leap Februaries", () => {
    const oct = periodRange("month", "2026-10-20");
    expect([oct.start, oct.end, oct.days.length]).toEqual(["2026-10-01", "2026-10-31", 31]);
    expect(periodRange("month", "2028-02-10").days).toHaveLength(29);
  });
});

describe("shiftPeriod", () => {
  it("moves by whole weeks and months", () => {
    expect(shiftPeriod("week", "2026-10-15", -1)).toBe("2026-10-08");
    expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftPeriod("month", "2026-12-15", 1)).toBe("2027-01-01");
  });
});

describe("goalOn", () => {
  const history = [
    { date: "2026-10-05", goal: 2000 },
    { date: "2026-10-12", goal: 1800 },
  ];

  it("uses the goal that was set on or before the day", () => {
    expect(goalOn("2026-10-11", history, 1700)).toBe(2000);
    expect(goalOn("2026-10-12", history, 1700)).toBe(1800);
  });

  it("uses the earliest goal before history starts, and the current goal without history", () => {
    expect(goalOn("2026-09-01", history, 1700)).toBe(2000);
    expect(goalOn("2026-09-01", [], 1700)).toBe(1700);
  });
});

describe("dayResults and summarizeCalories", () => {
  const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
  const eaten = new Map([
    ["2026-10-12", 1700],
    ["2026-10-13", 2150],
  ]);
  const results = dayResults(days, eaten, [], 1900, "2026-10-14");

  it("marks each day on target, over, not logged, in progress today, or future", () => {
    expect(results.map((r) => r.status)).toEqual(["on-target", "over", "today", "future"]);
    expect(dayResults(days, eaten, [], 1900, "2026-10-20").map((r) => r.status)).toEqual([
      "on-target",
      "over",
      "not-logged",
      "not-logged",
    ]);
  });

  it("leaves today out of the summary until it's over", () => {
    const withToday = dayResults(days, new Map([...eaten, ["2026-10-14", 900]]), [], 1900, "2026-10-14");
    expect(summarizeCalories(withToday)).toMatchObject({ loggedDays: 2, onTargetDays: 1 });
  });

  it("summarizes only logged days", () => {
    expect(summarizeCalories(results)).toEqual({
      loggedDays: 2,
      onTargetDays: 1,
      averageCalories: 1925,
      averageGoal: 1900,
      netUnderGoal: -50,
    });
  });

  it("handles a period with nothing logged", () => {
    expect(summarizeCalories(dayResults(days, new Map(), [], 1900, "2026-10-20")).averageCalories).toBeNull();
  });
});

describe("weight trend", () => {
  it("averages the weigh-ins in the 7 days ending on each date", () => {
    const points = withTrend([
      { date: "2026-10-03", kg: 84 },
      { date: "2026-10-01", kg: 85 },
      { date: "2026-10-09", kg: 83 },
    ]);
    expect(points.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-03", "2026-10-09"]);
    expect(points.map((p) => p.trend)).toEqual([85, 84.5, 83.5]); // 10-09 window: 10-03..10-09
  });

  it("reports the change in trend across a period", () => {
    expect(trendChange(withTrend([{ date: "2026-10-01", kg: 85 }]))).toBeNull();
    expect(
      trendChange(
        withTrend([
          { date: "2026-10-01", kg: 85 },
          { date: "2026-10-20", kg: 83.4 },
        ]),
      ),
    ).toBe(-1.6);
  });
});

describe("weight units", () => {
  it("formats kilograms, pounds and stones", () => {
    expect(formatWeight(82.4, "kg")).toBe("82.4 kg");
    expect(formatWeight(82.4, "lb")).toBe("181.7 lb");
    expect(formatWeight(82.4, "st")).toBe("12 st 13.7 lb");
  });

  it("converts pounds and stones back to kilograms", () => {
    expect(lbToKg(181.7)).toBeCloseTo(82.4, 1);
    expect(kgToStone(63.5)).toEqual({ stone: 10, lb: 0 });
  });

  it("formats signed changes", () => {
    expect(formatWeightChange(-0.84, "kg")).toBe("−0.8 kg");
    expect(formatWeightChange(0.5, "st")).toBe("+1.1 lb");
    expect(formatWeightChange(0, "kg")).toBe("0.0 kg");
  });
});
