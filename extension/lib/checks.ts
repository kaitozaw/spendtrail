// The rule-based checks L0 and L2 (DESIGN.md, P3). Pure functions: no storage, no messaging.
import { nameMatches, normaliseDetail } from './names';
import { mentions } from './news';
import { affectedBy } from './storage';
import type { Incident, MapEntry, PageSignals } from './types';

export type L0Result =
  | { outcome: 'pass'; entry: MapEntry }
  | { outcome: 'pass_with_alert'; entry: MapEntry; incident: Incident }
  | { outcome: 'next' };

/** L0 domain_check */
export function domainCheck(domain: string, map: MapEntry[], incidents: Incident[]): L0Result {
  const entry = map.find((e) => e.domain === domain);
  if (!entry) return { outcome: 'next' };
  const incident = affectedBy(entry, incidents);
  return incident ? { outcome: 'pass_with_alert', entry, incident } : { outcome: 'pass', entry };
}

export type Signal = 'name' | 'logo' | 'payment details';

export type L2Result =
  | { outcome: 'pass'; reason: 'no company in the transaction history' }
  | { outcome: 'pass'; reason: 'company not affected'; entry: MapEntry; signals: Signal[] }
  | { outcome: 'next'; entry: MapEntry; incident: Incident; signals: Signal[] };

const LOGO_DISTANCE = 6; // out of 64 bits

function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Which signals say that the page presents itself as this company, fully or partly. */
export function signalsFor(entry: MapEntry, page: PageSignals): Signal[] {
  const found: Signal[] = [];

  const shortLines = page.nearText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && l.length <= 60);
  const nameHit =
    [page.title, page.siteName ?? ''].some((t) => t && nameMatches(entry.company, t)) ||
    mentions(entry.company, page.nearText) ||
    shortLines.some((l) => nameMatches(entry.company, l, true));
  if (nameHit) found.push('name');

  if (page.logoHashes.some((h) => entry.logo_hashes.some((k) => hamming(h, k) <= LOGO_DISTANCE))) found.push('logo');

  // Whole words only, and digits kept: "HB-48213" must not match "HB-48813".
  const text = ` ${normaliseDetail(page.pageText)} `;
  const has = (s: string | null) => !!s && normaliseDetail(s).length > 0 && text.includes(` ${normaliseDetail(s)} `);
  if (entry.payment_details.some((d) => has(d.reference) || (has(d.dates) && has(d.place)))) found.push('payment details');

  return found;
}

/** L2 impersonation_check_rule */
export function impersonationCheckRule(page: PageSignals, map: MapEntry[], incidents: Incident[]): L2Result {
  const claimed = map
    .map((entry) => ({ entry, signals: signalsFor(entry, page) }))
    .filter((c) => c.signals.length > 0);
  if (claimed.length === 0) return { outcome: 'pass', reason: 'no company in the transaction history' };

  for (const c of claimed) {
    const incident = affectedBy(c.entry, incidents);
    if (incident) return { outcome: 'next', entry: c.entry, incident, signals: c.signals };
  }
  return { outcome: 'pass', reason: 'company not affected', entry: claimed[0]!.entry, signals: claimed[0]!.signals };
}
