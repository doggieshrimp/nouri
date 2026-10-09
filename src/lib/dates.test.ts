import { describe, expect, it } from "vitest";
import { addDays, fromDateKey, toDateKey } from "./dates";

describe("toDateKey", () => {
  it("formats a local date with zero padding", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses local time, not UTC, late in the evening", () => {
    expect(toDateKey(new Date(2026, 9, 9, 23, 59))).toBe("2026-10-09");
  });
});

describe("fromDateKey", () => {
  it("round-trips with toDateKey", () => {
    expect(toDateKey(fromDateKey("2026-10-09"))).toBe("2026-10-09");
  });
});

describe("addDays", () => {
  it("moves forward and backward", () => {
    expect(addDays("2026-10-09", 1)).toBe("2026-10-10");
    expect(addDays("2026-10-09", -1)).toBe("2026-10-08");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("handles leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
