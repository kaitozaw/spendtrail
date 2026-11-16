// The site a host belongs to, so that www.qantas.com and book.qantas.com both count as qantas.com.

// Second-level labels under a two-letter country code: expedia.com.au, bbc.co.uk.
const SECOND_LEVEL = new Set(['com', 'net', 'org', 'edu', 'gov', 'asn', 'id', 'co', 'ac']);

export function siteOf(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2 || labels.every((l) => /^\d+$/.test(l))) return labels.join('.');
  const n = labels.length;
  const take = labels[n - 1]!.length === 2 && SECOND_LEVEL.has(labels[n - 2]!) ? 3 : 2;
  return labels.slice(-take).join('.');
}
