import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  addEntry,
  addMealToDay,
  db,
  DEFAULT_GOAL,
  deleteEntry,
  exportBackup,
  deleteWeight,
  getCaloriesByDay,
  getEntriesForDate,
  getGoal,
  getGoalHistory,
  getMeals,
  getRecentItems,
  getWeighIns,
  importBackup,
  parseBackup,
  saveMeal,
  setGoal,
  setWeight,
} from "./db";

const oats = { name: "Oats", calories: 389, protein: 17, carbs: 66, fat: 7 };
const apple = { name: "Apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 };

beforeEach(async () => {
  await db.entries.clear();
  await db.settings.clear();
  await db.meals.clear();
  await db.weights.clear();
});

describe("progress data", () => {
  it("totals calories per day within a range", async () => {
    await addEntry("2026-10-12", oats);
    await addEntry("2026-10-12", apple);
    await addEntry("2026-10-14", apple);
    await addEntry("2026-10-20", apple); // outside the range
    const byDay = await getCaloriesByDay("2026-10-12", "2026-10-18");
    expect([...byDay]).toEqual([
      ["2026-10-12", 441],
      ["2026-10-14", 52],
    ]);
  });

  it("keeps one weigh-in per day and can delete it", async () => {
    await setWeight("2026-10-12", 84.2);
    await setWeight("2026-10-12", 84.0);
    await setWeight("2026-10-14", 83.6);
    expect(await getWeighIns("2026-10-01", "2026-10-31")).toEqual([
      { date: "2026-10-12", kg: 84 },
      { date: "2026-10-14", kg: 83.6 },
    ]);
    await deleteWeight("2026-10-12");
    expect(await getWeighIns("2026-10-01", "2026-10-31")).toHaveLength(1);
  });

  it("records when the goal changes", async () => {
    await setGoal(1800);
    const history = await getGoalHistory();
    expect(history).toHaveLength(1);
    expect(history[0].goal).toBe(1800);
  });
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

describe("recent items", () => {
  const bananaFood = { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 };

  it("lists distinct foods newest first, keeping the last amount used", async () => {
    await addEntry("2026-10-08", { ...bananaFood, name: "Banana (100g)", food: bananaFood, grams: 100 });
    await new Promise((r) => setTimeout(r, 2));
    await addEntry("2026-10-09", oats);
    await new Promise((r) => setTimeout(r, 2));
    await addEntry("2026-10-09", { ...bananaFood, name: "Banana (120g)", food: bananaFood, grams: 120 });

    const recent = await getRecentItems();
    expect(recent.map((r) => r.name)).toEqual(["Banana (120g)", "Oats"]);
    expect(recent[0].grams).toBe(120);
  });

  it("keeps sugars and saturates", async () => {
    await addEntry("2026-10-09", { ...apple, sugars: 10.4, saturatedFat: 0 });
    const [recent] = await getRecentItems();
    expect(recent).toMatchObject({ sugars: 10.4, saturatedFat: 0 });
  });

  it("respects the limit", async () => {
    for (const name of ["A", "B", "C"]) await addEntry("2026-10-09", { ...apple, name });
    expect(await getRecentItems(2)).toHaveLength(2);
  });
});

describe("meals", () => {
  it("saves a meal and logs all of its items to a day in order", async () => {
    await saveMeal("Breakfast", [oats, apple]);
    const [meal] = await getMeals();
    expect(meal.name).toBe("Breakfast");

    await addMealToDay("2026-10-11", meal);
    const day = await getEntriesForDate("2026-10-11");
    expect(day.map((e) => e.name)).toEqual(["Oats", "Apple"]);
  });

  it("sorts meals by name", async () => {
    await saveMeal("Lunch", [apple]);
    await saveMeal("Breakfast", [oats]);
    expect((await getMeals()).map((m) => m.name)).toEqual(["Breakfast", "Lunch"]);
  });
});

describe("backup compatibility", () => {
  it("includes meals in backups", async () => {
    await saveMeal("Breakfast", [oats]);
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup())));
    await db.meals.clear();
    await importBackup(backup);
    expect((await getMeals()).map((m) => m.name)).toEqual(["Breakfast"]);
  });

  it("includes weights and goal history in backups", async () => {
    await setWeight("2026-10-12", 84);
    await setGoal(1800);
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup())));
    await db.weights.clear();
    await db.settings.clear();
    await importBackup(backup);
    expect(await getWeighIns("2026-10-01", "2026-10-31")).toEqual([{ date: "2026-10-12", kg: 84 }]);
    expect((await getGoalHistory()).map((c) => c.goal)).toEqual([1800]);
    expect(await getGoal()).toBe(1800);
  });

  it("still imports version 2 backups, which had no weights", async () => {
    const v2 = { app: "daily-log", version: 2, exportedAt: "2026-10-11T12:00:00.000Z", goal: 1900, entries: [], meals: [] };
    await importBackup(parseBackup(v2));
    expect(await getGoal()).toBe(1900);
  });

  it("rejects backups with malformed weights", () => {
    const bad = { app: "daily-log", version: 3, goal: 1900, entries: [], meals: [], weights: [{ date: "x", kg: "84" }] };
    expect(() => parseBackup(bad)).toThrow("damaged");
  });

  it("still imports version 1 backups, which had no meals", async () => {
    const v1 = {
      app: "daily-log",
      version: 1,
      exportedAt: "2026-10-09T12:00:00.000Z",
      goal: 1900,
      entries: [{ id: "a", date: "2026-10-09", createdAt: 1, ...oats }],
    };
    await importBackup(parseBackup(v1));
    expect(await getGoal()).toBe(1900);
    expect(await getEntriesForDate("2026-10-09")).toHaveLength(1);
  });
});
