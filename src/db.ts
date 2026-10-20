import Dexie, { type EntityTable } from "dexie";
import type { DateKey } from "./lib/dates";
import type { Entry, Food, Macros } from "./lib/nutrition";

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

interface Setting {
  key: string;
  value: unknown;
}

export const DEFAULT_GOAL = 2000;

class TrackerDB extends Dexie {
  entries!: EntityTable<LogEntry, "id">;
  settings!: EntityTable<Setting, "key">;
  meals!: EntityTable<Meal, "id">;

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

export async function setGoal(goal: number): Promise<void> {
  await db.settings.put({ key: "goal", value: goal });
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
  version: 2;
  exportedAt: string;
  goal: number;
  entries: LogEntry[];
  meals: Meal[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "daily-log",
    version: 2,
    exportedAt: new Date().toISOString(),
    goal: await getGoal(),
    entries: await db.entries.toArray(),
    meals: await db.meals.toArray(),
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

/** Throws if the data isn't a valid Nouri backup. Accepts v1 backups (no meals). */
export function parseBackup(data: unknown): Backup {
  if (!isRecord(data)) throw new Error("Not a backup file.");
  if (data.app !== "daily-log" || (data.version !== 1 && data.version !== 2)) {
    throw new Error("Not a Nouri backup file.");
  }
  const meals = data.meals ?? [];
  if (
    typeof data.goal !== "number" ||
    !Array.isArray(data.entries) ||
    !data.entries.every(isLogEntry) ||
    !Array.isArray(meals) ||
    !meals.every(isMeal)
  ) {
    throw new Error("Backup file is damaged or incomplete.");
  }
  return { ...(data as unknown as Backup), version: 2, meals };
}

/**
 * Merges a backup into the database. Rows with matching ids are overwritten,
 * so importing the same file twice doesn't create duplicates.
 * Returns the number of entries imported.
 */
export async function importBackup(backup: Backup): Promise<number> {
  await db.transaction("rw", db.entries, db.settings, db.meals, async () => {
    await db.entries.bulkPut(backup.entries);
    await db.meals.bulkPut(backup.meals);
    await setGoal(backup.goal);
  });
  return backup.entries.length;
}
