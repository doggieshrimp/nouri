/**
 * Supermarkets whose own-brand products can be searched by name, e.g. "pork tesco".
 * Open Food Facts tags brands inconsistently, so each store lists every tag its
 * products are filed under (checked against search.openfoodfacts.org, Oct 2026).
 */
export interface Store {
  name: string;
  /** Ways people type the store's name, lowercase. */
  aliases: string[];
  /** Open Food Facts brands_tags values for the store's own products. */
  tags: string[];
}

export const STORES: Store[] = [
  { name: "Tesco", aliases: ["tesco", "tescos", "tesco's"], tags: ["tesco", "tesco-finest"] },
  {
    name: "Sainsbury's",
    aliases: ["sainsbury", "sainsburys", "sainsbury's"],
    tags: ["sainsbury-s", "sainsburys", "by-sainsbury-s"],
  },
  { name: "Asda", aliases: ["asda", "asdas", "asda's"], tags: ["asda", "asda-extra-special"] },
  { name: "Morrisons", aliases: ["morrisons", "morrison", "morrison's"], tags: ["morrisons"] },
  { name: "Waitrose", aliases: ["waitrose", "waitroses"], tags: ["waitrose", "waitrose-partners"] },
  { name: "Aldi", aliases: ["aldi", "aldis", "aldi's"], tags: ["aldi"] },
  { name: "Lidl", aliases: ["lidl", "lidls", "lidl's"], tags: ["lidl"] },
  {
    name: "M&S",
    aliases: ["m&s", "m & s", "m and s", "marks and spencer", "marks and spencers", "marks & spencer", "marks & spencers", "marks and sparks"],
    tags: ["m-s", "marks-spencer", "marks-and-spencer"],
  },
  { name: "Co-op", aliases: ["co-op", "coop", "co op", "the co-operative", "co-operative"], tags: ["co-op", "the-co-operative"] },
  { name: "Iceland", aliases: ["iceland"], tags: ["iceland"] },
  { name: "Ocado", aliases: ["ocado"], tags: ["ocado"] },
];

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest aliases first, so "marks and spencer" wins over "marks".
const MATCHERS = STORES.flatMap((store) => store.aliases.map((alias) => ({ store, alias })))
  .sort((a, b) => b.alias.length - a.alias.length)
  .map(({ store, alias }) => ({
    store,
    // Whole words only, so "coop" doesn't match inside "scoop". "from"/"at" before the
    // name goes too: "pork from tesco" searches for "pork".
    pattern: new RegExp(`(?:(?<![\\p{L}\\p{N}])(?:from|at)\\s+)?(?<![\\p{L}\\p{N}])${escapeRegex(alias)}(?![\\p{L}\\p{N}])`, "iu"),
  }));

/**
 * Finds a supermarket named in a search and returns it with the rest of the search,
 * e.g. "Tesco's pork chops" → Tesco, "pork chops".
 */
export function findStore(query: string): { store: Store; rest: string } | null {
  const normalized = query.replace(/[‘’]/g, "'");
  for (const { store, pattern } of MATCHERS) {
    if (pattern.test(normalized)) {
      const rest = normalized.replace(pattern, " ").replace(/\s+/g, " ").trim();
      return { store, rest };
    }
  }
  return null;
}

/** An Open Food Facts query clause matching any of the store's brand tags. */
export function storeClause(store: Store): string {
  return `brands_tags:(${store.tags.map((t) => `"${t}"`).join(" OR ")})`;
}
