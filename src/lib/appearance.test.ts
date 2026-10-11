import { beforeEach, describe, expect, it } from "vitest";
import { applyAppearance, DEFAULT_APPEARANCE, loadAppearance, saveAppearance, type Appearance } from "./appearance";

// Minimal in-memory stand-ins so this runs in Node without a DOM.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  clear() {
    this.data.clear();
  }
}

function fakeRoot() {
  const props = new Map<string, string>();
  const classes = new Set<string>();
  return {
    props,
    classes,
    dataset: {} as Record<string, string>,
    style: { setProperty: (k: string, v: string) => props.set(k, v), fontSize: "", colorScheme: "" },
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
  };
}

const storage = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = storage;

beforeEach(() => storage.clear());

describe("loadAppearance", () => {
  it("returns defaults when nothing is saved", () => {
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it("round-trips saved settings", () => {
    const a: Appearance = { background: "blue", font: "lexend", textSize: 1.25, extraSpacing: true, plainText: true };
    saveAppearance(a);
    expect(loadAppearance()).toEqual(a);
  });

  it("falls back to defaults for corrupt or outdated data", () => {
    storage.setItem("daily-log:appearance", "{not json");
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
    storage.setItem("daily-log:appearance", JSON.stringify({ ...DEFAULT_APPEARANCE, font: "comic-sans" }));
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });
});

describe("applyAppearance", () => {
  it("sets colour tokens, font, size and mode classes", () => {
    const root = fakeRoot();
    applyAppearance(
      { background: "dark", font: "opendyslexic", textSize: 1.5, extraSpacing: true, plainText: false },
      root as unknown as HTMLElement,
    );
    expect(root.props.get("--paper")).toBe("#1C1C1A");
    expect(root.props.get("--ink")).toBe("#EEEAE2");
    expect(root.props.get("--font-body")).toContain("OpenDyslexic");
    expect(root.style.fontSize).toBe("150%");
    expect(root.style.colorScheme).toBe("dark");
    expect([...root.classes]).toEqual(["extra-spacing"]);
    expect(root.dataset.font).toBe("opendyslexic");
  });
});
