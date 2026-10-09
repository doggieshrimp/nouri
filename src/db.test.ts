import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addEntry,
  db,
  DEFAULT_GOAL,
  deleteEntry,
  exportBackup,
  getEntriesForDate,
  getGoal,
  importBackup,
  parseBackup,
  setGoal,
} from "./db";

const oats = { name: "Oats", calories: 389, protein: 17, carbs: 66, fat: 7 };
const apple = { name: "Apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 };

beforeEach(async () => {
  await db.entries.clear();
  await db.settings.clear();
});

describe("entries", () => {
  it("returns only the entries for the requested day", async () => {
    await addEntry("2026-10-08", oats);
    await addEntry("2026-10-09", apple);

    const day = await getEntriesForDate("2026-10-09");
    expect(day.map((e) => e.name)).toEqual(["Apple"]);
  });

  it("deletes an entry", async () => {
    await addEntry("2026-10-09", oats);
    const [entry] = await getEntriesForDate("2026-10-09");
    await deleteEntry(entry.id);
    expect(await getEntriesForDate("2026-10-09")).toEqual([]);
  });
});

describe("goal", () => {
  it("defaults when nothing is saved", async () => {
    expect(await getGoal()).toBe(DEFAULT_GOAL);
  });

  it("persists a saved goal", async () => {
    await setGoal(1800);
    expect(await getGoal()).toBe(1800);
  });
});

describe("backup", () => {
  it("round-trips through export and import without duplicating entries", async () => {
    await setGoal(1700);
    await addEntry("2026-10-09", oats);
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup())));

    await db.entries.clear();
    await setGoal(2500);
    expect(await importBackup(backup)).toBe(1);
    await importBackup(backup);

    expect(await getGoal()).toBe(1700);
    expect(await db.entries.count()).toBe(1);
  });

  it("rejects files that aren't backups", () => {
    expect(() => parseBackup({ hello: "world" })).toThrow();
    expect(() => parseBackup(null)).toThrow();
  });

  it("rejects backups with malformed entries", () => {
    expect(() =>
      parseBackup({ app: "daily-log", version: 1, goal: 2000, entries: [{ name: "x" }] }),
    ).toThrow("damaged");
  });
});
