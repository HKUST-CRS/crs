/**
 * Compares two strings in a human-friendly way.
 *
 * Numeric substrings are compared based on their numeric value.
 */
export function compareString(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

/**
 * Sorts the keys of a record in a human-friendly way.
 *
 * Internally, it uses `compareString` to compare the keys.
 */
export function sortRecord<V>(r: Record<string, V>): Record<string, V> {
  const keys = Object.keys(r).sort(compareString);
  const rr: Record<string, V> = {};
  for (const key of keys) {
    rr[key] = r[key] as V;
  }
  return rr;
}
