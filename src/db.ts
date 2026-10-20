import Dexie, { type EntityTable } from "dexie";
import { todayKey, type DateKey } from "./lib/dates";
import type { Entry, Food, Macros } from "./lib/nutrition";
import type { GoalChange, WeighIn } from "./lib/progress";

/** What gets logged: fixed macros, plus the source food and weight when it came from a lookup. */
export interface LogItem extends Macros {
  name: string;
  /** Per-100g food this was scaled from. Absent for custom items. */
  food?: Food;
  grams?: number;
}

export interface LogEntry extends Entry, LogItem {
  date: DateKey;
  createdAt: number;
}

export interface Meal {
  id: string;
  name: string;
  items: LogItem[];
  createdAt: number;
}

/** One weigh-in per day; logging again the same day replaces it. Stored in kg. */
export interface StoredWeight extends WeighIn {
  createdAt: number;
}

interface Setting {
  key: string;
  value: unknown;
}

export const DEFAULT_GOAL = 2000;

class TrackerDB extends Dexie {
  entries!: EntityTable<LogEntry, "id">;
  settings!: EntityTable<Setting, "key">;
  meals!: EntityTable<Meal, "id">;
  weights!: EntityTable<StoredWeight, "date">;

  constructor() {
    super("daily-log");
    this.version(1).stores({
      entries: "id, date",
      settings: "key",
    });
    // v2: index entries by createdAt for "recent foods", and add saved meals.
    this.version(2).stores({
      entries: "id, date, createdAt",
      settings: "key",
      meals: "id, createdAt",
    });
    // v3: body weight, keyed by day.
    this.version(3).stores({
      entries: "id, date, createdAt",
      settings: "key",
      meals: "id, createdAt",
      weights: "date",
    });
  }
}

export const db = new TrackerDB();

// ---- Entries ----

export async function getEntriesForDate(date: DateKey): Promise<LogEntry[]> {
  return db.entries.where("date").equals(date).sortBy("createdAt");
}

export async function addEntry(date: DateKey, item: LogItem): Promise<void> {
  await db.entries.add({ ...item, id: crypto.randomUUID(), date, createdAt: Date.now() });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

/** Copies just the loggable fields of an entry (drops id, date and createdAt). */
function itemFrom({ name, calories, protein, carbs, fat, sugars, saturatedFat, food, grams }: LogItem): LogItem {
  const item: LogItem = { name, calories, protein, carbs, fat };
  if (sugars !== undefined) item.sugars = sugars;
  if (saturatedFat !== undefined) item.saturatedFat = saturatedFat;
  if (food) Object.assign(item, { food, grams });
  return item;
}

function recentKey(item: LogItem): string {
  if (!item.food) return `custom:${item.name.toLowerCase()}`;
  if (item.food.fdcId !== undefined) return `usda:${item.food.fdcId}`;
  if (item.food.barcode) return `barcode:${item.food.barcode}`;
  return `food:${item.food.name.toLowerCase()}`;
}

/** The most recently logged distinct foods, newest first, with the amount last used. */
export async function getRecentItems(limit = 8): Promise<LogItem[]> {
  const seen = new Set<string>();
  const recent: LogItem[] = [];
  await db.entries
    .orderBy("createdAt")
    .reverse()
    .until(() => recent.length >= limit)
    .each((entry) => {
      const key = recentKey(entry);
      if (seen.has(key)) return;
      seen.add(key);
      recent.push(itemFrom(entry));
    });
  return recent;
}

// ---- Goal ----

export async function getGoal(): Promise<number> {
  const row = await db.settings.get("goal");
  return typeof row?.value === "number" ? row.value : DEFAULT_GOAL;
}

function isGoalChange(v: unknown): v is GoalChange {
  return isRecord(v) && typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && typeof v.goal === "number";
}

/** When the goal changed, oldest first, so past days are judged against the goal they had. */
export async function getGoalHistory(): Promise<GoalChange[]> {
  const row = await db.settings.get("goalHistory");
  const history = Array.isArray(row?.value) ? row.value.filter(isGoalChange) : [];
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

/** Merges goal changes, keeping one per day (later ones win). */
async function mergeGoalHistory(changes: GoalChange[]): Promise<void> {
  const byDate = new Map((await getGoalHistory()).map((c) => [c.date, c.goal]));
  for (const c of changes) byDate.set(c.date, c.goal);
  const merged = [...byDate].map(([date, goal]) => ({ date, goal })).sort((a, b) => a.date.localeCompare(b.date));
  await db.settings.put({ key: "goalHistory", value: merged });
}

/** Sets the goal from today onwards. Earlier days keep the goal they had. */
export async function setGoal(goal: number): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    await db.settings.put({ key: "goal", value: goal });
    await mergeGoalHistory([{ date: todayKey(), goal }]);
  });
}

// ---- Progress ----

/** Total calories logged on each day in the range (inclusive). Days with nothing logged are absent. */
export async function getCaloriesByDay(start: DateKey, end: DateKey): Promise<Map<DateKey, number>> {
  const totals = new Map<DateKey, number>();
  await db.entries
    .where("date")
    .between(start, end, true, true)
    .each((e) => totals.set(e.date, (totals.get(e.date) ?? 0) + e.calories));
  for (const [date, kcal] of totals) totals.set(date, Math.round(kcal));
  return totals;
}

export async function getWeighIns(start: DateKey, end: DateKey): Promise<WeighIn[]> {
  const rows = await db.weights.where("date").between(start, end, true, true).toArray();
  return rows.map(({ date, kg }) => ({ date, kg }));
}

export async function setWeight(date: DateKey, kg: number): Promise<void> {
  await db.weights.put({ date, kg: Math.round(kg * 100) / 100, createdAt: Date.now() });
}

export async function deleteWeight(date: DateKey): Promise<void> {
  await db.weights.delete(date);
}

// ---- Meals ----

export async function getMeals(): Promise<Meal[]> {
  const meals = await db.meals.toArray();
  return meals.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveMeal(name: string, items: LogItem[]): Promise<void> {
  await db.meals.add({ id: crypto.randomUUID(), name, items: items.map(itemFrom), createdAt: Date.now() });
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id);
}

/** Logs every item in a meal to the given day, keeping the meal's order. */
export async function addMealToDay(date: DateKey, meal: Meal): Promise<void> {
  const now = Date.now();
  await db.entries.bulkAdd(
    meal.items.map((item, i) => ({ ...item, id: crypto.randomUUID(), date, createdAt: now + i })),
  );
}

// ---- Backup ----

export interface Backup {
  app: "daily-log";
  version: 3;
  exportedAt: string;
  goal: number;
  goalHistory: GoalChange[];
  entries: LogEntry[];
  meals: Meal[];
  weights: StoredWeight[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "daily-log",
    version: 3,
    exportedAt: new Date().toISOString(),
    goal: await getGoal(),
    goalHistory: await getGoalHistory(),
    entries: await db.entries.toArray(),
    meals: await db.meals.toArray(),
    weights: await db.weights.toArray(),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isLogItem(v: unknown): v is LogItem {
  if (!isRecord(v)) return false;
  return (
    typeof v.name === "string" &&
    ["calories", "protein", "carbs", "fat"].every((k) => typeof v[k] === "number") &&
    ["sugars", "saturatedFat"].every((k) => v[k] === undefined || typeof v[k] === "number") &&
    (v.food === undefined || (isRecord(v.food) && typeof v.food.calories === "number"))
  );
}

function isLogEntry(v: unknown): v is LogEntry {
  return (
    isLogItem(v) &&
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.createdAt === "number"
  );
}

function isMeal(v: unknown): v is Meal {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.createdAt === "number" &&
    Array.isArray(v.items) &&
    v.items.every(isLogItem)
  );
}

function isStoredWeight(v: unknown): v is StoredWeight {
  return (
    isRecord(v) &&
    typeof v.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.kg === "number" &&
    typeof v.createdAt === "number"
  );
}

/**
 * Throws if the data isn't a valid Nouri backup. Accepts older versions:
 * v1 had no meals, v2 had no weights or goal history.
 */
export function parseBackup(data: unknown): Backup {
  if (!isRecord(data)) throw new Error("Not a backup file.");
  if (data.app !== "daily-log" || ![1, 2, 3].includes(data.version as number)) {
    throw new Error("Not a Nouri backup file.");
  }
  const meals = data.meals ?? [];
  const weights = data.weights ?? [];
  const goalHistory = data.goalHistory ?? [];
  if (
    typeof data.goal !== "number" ||
    !Array.isArray(data.entries) ||
    !data.entries.every(isLogEntry) ||
    !Array.isArray(meals) ||
    !meals.every(isMeal) ||
    !Array.isArray(weights) ||
    !weights.every(isStoredWeight) ||
    !Array.isArray(goalHistory) ||
    !goalHistory.every(isGoalChange)
  ) {
    throw new Error("Backup file is damaged or incomplete.");
  }
  return { ...(data as unknown as Backup), version: 3, meals, weights, goalHistory };
}

/**
 * Merges a backup into the database. Rows with matching ids (or days, for weights)
 * are overwritten, so importing the same file twice doesn't create duplicates.
 * Returns the number of entries imported.
 */
export async function importBackup(backup: Backup): Promise<number> {
  await db.transaction("rw", [db.entries, db.settings, db.meals, db.weights], async () => {
    await db.entries.bulkPut(backup.entries);
    await db.meals.bulkPut(backup.meals);
    await db.weights.bulkPut(backup.weights);
    await db.settings.put({ key: "goal", value: backup.goal });
    await mergeGoalHistory(backup.goalHistory);
  });
  return backup.entries.length;
}
