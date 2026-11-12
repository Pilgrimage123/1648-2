/**
 * Czech plural: 1 / 2–4 / 5+ (and teens 12–14 follow 5+).
 * A language with one plural can ignore `few` and return `many` for every n !== 1.
 */
export function pluralCs(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  if (abs === 1) return one;
  if (abs >= 2 && abs <= 4) return few;
  return many;
}
