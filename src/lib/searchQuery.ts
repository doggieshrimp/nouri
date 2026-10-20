/**
 * Keeps letters, numbers and simple punctuation so a search can't break the databases'
 * query syntax: USDA rejects "/", "[ ]" and "!" with HTTP 400, and Open Food Facts treats
 * quotes, colons and brackets as operators.
 */
export function cleanQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s'&%,.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
