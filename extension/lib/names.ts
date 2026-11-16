// Rules for comparing company names. Shared by L2 and by the checks that follow the model's extractions.

// Look-alike characters used to imitate names (C0astline, Harb0ur).
const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

// Words that say what kind of business it is, not which one.
const GENERIC = new Set([
  'the', 'and', 'of', 'pty', 'ltd', 'limited', 'inc', 'co', 'company', 'group', 'australia', 'au',
  'holiday', 'holidays', 'park', 'parks', 'resort', 'resorts', 'hotel', 'hotels', 'stay', 'stays',
  'shop', 'store', 'online', 'official', 'secure', 'payment', 'payments', 'portal', 'guest', 'guests', 'checkout',
]);

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[0-9@$]/g, (c) => LOOKALIKES[c] ?? c)
    .normalize('NFKD')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** For payment details: keeps digits, which carry the reference and the dates. */
export function normaliseDetail(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function significantTokens(name: string): string[] {
  return normaliseName(name)
    .split(' ')
    .filter((t) => t.length > 1 && !GENERIC.has(t));
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

function tokensMatch(a: string, b: string, strict = false): boolean {
  if (a === b) return true;
  // coastline ~ coastal. Not used in strict mode, where "coast" in ordinary text would match.
  if (!strict && Math.min(a.length, b.length) >= 5 && a.slice(0, 5) === b.slice(0, 5)) return true;
  return Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= 1;
}

/**
 * True when `candidate` names the same company as `company`, allowing small variants and
 * look-alike characters. More than half of the company's significant words must match.
 * `strict` drops the shared-prefix rule, for scanning ordinary page text rather than names.
 */
export function nameMatches(company: string, candidate: string, strict = false): boolean {
  const want = significantTokens(company);
  const have = significantTokens(candidate);
  if (want.length === 0 || have.length === 0) return false;
  // Spacing and hyphen variants: "Tech-Zone" and "Tech Zone" name "TechZone".
  const joinedWant = want.join('');
  const joinedHave = have.join('');
  if (joinedWant === joinedHave || (Math.min(joinedWant.length, joinedHave.length) >= 6 && editDistance(joinedWant, joinedHave) <= 1)) return true;
  const matched = want.filter((w) => have.some((h) => tokensMatch(w, h, strict))).length;
  return matched / want.length > 0.5;
}

/** "Trailhead Outfitters'" and "Harbour Books'", but "Coastline's". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
