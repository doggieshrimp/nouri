import { addDays, fromDateKey, toDateKey, type DateKey } from "./dates";

// ---------- Periods ----------

export type Period = "week" | "month";

export interface PeriodRange {
  start: DateKey;
  end: DateKey;
  /** Every day from start to end, inclusive. */
  days: DateKey[];
}

/** The calendar week (Monday to Sunday) or month containing `anchor`. */
export function periodRange(period: Period, anchor: DateKey): PeriodRange {
  const date = fromDateKey(anchor);
  let start: DateKey;
  let end: DateKey;
  if (period === "week") {
    const sinceMonday = (date.getDay() + 6) % 7;
    start = addDays(anchor, -sinceMonday);
    end = addDays(start, 6);
  } else {
    start = toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
    end = toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }
  const days: DateKey[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { start, end, days };
}

/** An anchor date in the previous (-1) or next (+1) period. */
export function shiftPeriod(period: Period, anchor: DateKey, direction: -1 | 1): DateKey {
  if (period === "week") return addDays(anchor, 7 * direction);
  const date = fromDateKey(anchor);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + direction, 1));
}

export function periodLabel(period: Period, range: PeriodRange): string {
  if (period === "month") {
    return fromDateKey(range.start).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const fmt = (key: DateKey) => fromDateKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

// ---------- Calories vs goal ----------

export interface GoalChange {
  /** The goal applies from this day onwards. */
  date: DateKey;
  goal: number;
}

/**
 * The goal that applied on a day. Days before the first recorded change use the
 * earliest known goal; with no history at all, the current goal.
 */
export function goalOn(date: DateKey, history: GoalChange[], current: number): number {
  let goal: number | undefined;
  for (const change of history) {
    if (change.date <= date) goal = change.goal;
    else break;
  }
  return goal ?? history[0]?.goal ?? current;
}

/** "today" is still in progress, so it's shown but not counted as a hit or a miss yet. */
export type DayStatus = "on-target" | "over" | "not-logged" | "today" | "future";

export interface DayResult {
  date: DateKey;
  /** Calories eaten, or null when nothing was logged. */
  calories: number | null;
  goal: number;
  status: DayStatus;
}

export function dayResults(
  days: DateKey[],
  caloriesByDay: Map<DateKey, number>,
  history: GoalChange[],
  currentGoal: number,
  today: DateKey,
): DayResult[] {
  return days.map((date) => {
    const goal = goalOn(date, history, currentGoal);
    const calories = caloriesByDay.get(date) ?? null;
    let status: DayStatus;
    if (date > today) status = "future";
    else if (date === today) status = "today";
    else if (calories === null) status = "not-logged";
    else status = calories <= goal ? "on-target" : "over";
    return { date, calories: status === "future" ? null : calories, goal, status };
  });
}

export interface CalorieSummary {
  loggedDays: number;
  onTargetDays: number;
  /** Mean calories over logged days, or null if none. */
  averageCalories: number | null;
  /** Mean goal over logged days, or null if none. */
  averageGoal: number | null;
  /** Sum of (goal − calories) over logged days. Positive means under goal overall. */
  netUnderGoal: number;
}

/** Summarizes finished days only: today is left out until it's over. */
export function summarizeCalories(results: DayResult[]): CalorieSummary {
  const logged = results.filter((r) => r.calories !== null && r.status !== "today");
  const total = (pick: (r: DayResult) => number) => logged.reduce((sum, r) => sum + pick(r), 0);
  return {
    loggedDays: logged.length,
    onTargetDays: logged.filter((r) => r.status === "on-target").length,
    averageCalories: logged.length ? Math.round(total((r) => r.calories!) / logged.length) : null,
    averageGoal: logged.length ? Math.round(total((r) => r.goal) / logged.length) : null,
    netUnderGoal: Math.round(total((r) => r.goal - r.calories!)),
  };
}

// ---------- Weight ----------

export interface WeighIn {
  date: DateKey;
  kg: number;
}

export interface WeighInWithTrend extends WeighIn {
  /** Mean of the weigh-ins in the 7 days ending on this date. */
  trend: number;
}

/**
 * Adds a 7-day moving average. Daily weight swings by a kilo or more with water and
 * food, so the trend is the honest signal of change. `weighIns` may include days
 * before the period so the first points have history behind them.
 */
export function withTrend(weighIns: WeighIn[]): WeighInWithTrend[] {
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w) => {
    const from = addDays(w.date, -6);
    const window = sorted.filter((x) => x.date >= from && x.date <= w.date);
    const trend = window.reduce((sum, x) => sum + x.kg, 0) / window.length;
    return { ...w, trend: Math.round(trend * 100) / 100 };
  });
}

/** Change in the trend from the first to the last weigh-in, or null with fewer than two. */
export function trendChange(points: WeighInWithTrend[]): number | null {
  if (points.length < 2) return null;
  return Math.round((points[points.length - 1].trend - points[0].trend) * 10) / 10;
}

export type WeightUnit = "kg" | "lb" | "st";

const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

/** Stones and pounds, e.g. 82.4 kg → { stone: 12, lb: 13.7 }. */
export function kgToStone(kg: number): { stone: number; lb: number } {
  const totalLb = Math.round(kgToLb(kg) * 10) / 10;
  const stone = Math.floor(totalLb / 14);
  return { stone, lb: Math.round((totalLb - stone * 14) * 10) / 10 };
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === "kg") return `${(Math.round(kg * 10) / 10).toFixed(1)} kg`;
  if (unit === "lb") return `${(Math.round(kgToLb(kg) * 10) / 10).toFixed(1)} lb`;
  const { stone, lb } = kgToStone(kg);
  return `${stone} st ${lb.toFixed(1)} lb`;
}

/** A signed change, e.g. "−0.8 kg" or "+1.5 lb". Stone changes are shown in pounds. */
export function formatWeightChange(kg: number, unit: WeightUnit): string {
  const value = unit === "kg" ? kg : kgToLb(kg);
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)} ${unit === "kg" ? "kg" : "lb"}`;
}

/** Plausible adult body weights, to catch typos like 824 instead of 82.4. */
export const WEIGHT_LIMITS_KG = { min: 25, max: 350 };
