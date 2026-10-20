import { describe, expect, it } from "vitest";
import { linear, niceStep, niceTicks } from "./scale";

describe("niceStep", () => {
  it("picks round steps", () => {
    expect(niceStep(2400, 4)).toBe(500);
    expect(niceStep(4000, 4)).toBe(1000);
    expect(niceStep(2000, 4)).toBe(500);
    expect(niceStep(3, 4)).toBe(1);
    expect(niceStep(9, 4)).toBe(2.5);
  });
});

describe("niceTicks", () => {
  it("covers the range with clean values", () => {
    expect(niceTicks(0, 2300, 4)).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    expect(niceTicks(82.3, 85.1, 3)).toEqual([82, 83, 84, 85, 86]);
  });
});

describe("linear", () => {
  it("maps a domain onto a range, including inverted ones", () => {
    const y = linear([0, 2000], [150, 10]);
    expect(y(0)).toBe(150);
    expect(y(1000)).toBe(80);
  });

  it("doesn't divide by zero for a flat domain", () => {
    expect(linear([5, 5], [0, 100])(5)).toBe(0);
  });
});
