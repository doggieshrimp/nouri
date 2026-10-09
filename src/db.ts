import Dexie, { type EntityTable } from "dexie";
import type { DateKey } from "./lib/dates";
import type { Entry, Macros } from "./lib/nutrition";

export interface LogEntry extends Entry {
  date: DateKey;
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

  constructor() {
    super("daily-log");
    this.version(1).stores({
      entries: "id, date",
      settings: "key",
    });
  }
}

export const db = new TrackerDB();

export async function getEntriesForDate(date: DateKey): Promise<LogEntry[]> {
  return db.entries.where("date").equals(date).sortBy("createdAt");
}

export async function addEntry(date: DateKey, item: { name: string } & Macros): Promise<void> {
  await db.entries.add({ ...item, id: crypto.randomUUID(), date, createdAt: Date.now() });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function getGoal(): Promise<number> {
  const row = await db.settings.get("goal");
  return typeof row?.value === "number" ? row.value : DEFAULT_GOAL;
}

export async function setGoal(goal: number): Promise<void> {
  await db.settings.put({ key: "goal", value: goal });
}

// ---- Backup ----

export interface Backup {
  app: "daily-log";
  version: 1;
  exportedAt: string;
  goal: number;
  entries: LogEntry[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: "daily-log",
    version: 1,
    exportedAt: new Date().toISOString(),
    goal: await getGoal(),
    entries: await db.entries.toArray(),
  };
}

function isLogEntry(e: unknown): e is LogEntry {
  if (typeof e !== "object" || e === null) return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    typeof r.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    typeof r.createdAt === "number" &&
    ["calories", "protein", "carbs", "fat"].every((k) => typeof r[k] === "number")
  );
}

/** Throws if the data isn't a valid Daily Log backup. */
export function parseBackup(data: unknown): Backup {
  if (typeof data !== "object" || data === null) throw new Error("Not a backup file.");
  const b = data as Record<string, unknown>;
  if (b.app !== "daily-log" || b.version !== 1) throw new Error("Not a Daily Log backup file.");
  if (typeof b.goal !== "number" || !Array.isArray(b.entries) || !b.entries.every(isLogEntry)) {
    throw new Error("Backup file is damaged or incomplete.");
  }
  return data as Backup;
}

/**
 * Merges a backup into the database. Entries with matching ids are overwritten,
 * so importing the same file twice doesn't create duplicates.
 * Returns the number of entries imported.
 */
export async function importBackup(backup: Backup): Promise<number> {
  await db.transaction("rw", db.entries, db.settings, async () => {
    await db.entries.bulkPut(backup.entries);
    await setGoal(backup.goal);
  });
  return backup.entries.length;
}
