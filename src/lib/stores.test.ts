import { describe, expect, it } from "vitest";
import { findStore, storeClause } from "./stores";

describe("findStore", () => {
  it("finds a store anywhere in the search and returns the rest", () => {
    expect(findStore("pork tesco")).toMatchObject({ store: { name: "Tesco" }, rest: "pork" });
    expect(findStore("Tesco pork chops")).toMatchObject({ store: { name: "Tesco" }, rest: "pork chops" });
    expect(findStore("tortilla wraps from Sainsbury’s")).toMatchObject({ store: { name: "Sainsbury's" }, rest: "tortilla wraps" });
  });

  it("understands common spellings", () => {
    for (const q of ["tescos pork", "tesco's pork", "pork at tesco"]) expect(findStore(q)?.store.name).toBe("Tesco");
    for (const q of ["m&s chicken", "M & S chicken", "marks and spencers chicken", "marks and sparks chicken"]) {
      expect(findStore(q)).toMatchObject({ store: { name: "M&S" }, rest: "chicken" });
    }
    expect(findStore("coop milk")?.store.name).toBe("Co-op");
  });

  it("returns an empty rest when only the store is typed", () => {
    expect(findStore("aldi")).toMatchObject({ store: { name: "Aldi" }, rest: "" });
  });

  it("only matches whole words", () => {
    expect(findStore("ice cream scoop")).toBeNull();
    expect(findStore("pork chops")).toBeNull();
  });
});

describe("storeClause", () => {
  it("matches any of the store's brand tags", () => {
    expect(storeClause(findStore("tesco")!.store)).toBe('brands_tags:("tesco" OR "tesco-finest")');
  });
});
