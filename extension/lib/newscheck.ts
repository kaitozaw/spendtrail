// P2: checks public news feeds against the map. Rules only, no model.
// Feeds are fetched whole, with no query that depends on the map, so every user sends the same request.
import feeds from '../data/feeds.json';
import { logCounters, trackedFetch } from './counters';
import { log } from './log';
import { possessive } from './names';
import { mentions, reportsBreach } from './news';
import { addIncident, affectedBy, getIncidents, getMap } from './storage';
import type { Incident, MapEntry } from './types';

type FeedItem = { title: string; link: string; published: string; text: string; source: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

/** Minimal RSS 2.0 reader (service workers have no DOMParser). */
function parseRss(xml: string): FeedItem[] {
  const source = decode(xml.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/)?.[1] ?? 'News').replace(/\s*[–-].*$/, '');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const tag = (name: string) => decode(item!.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '');
    return { title: tag('title'), link: tag('link'), published: tag('pubDate'), text: tag('description'), source };
  });
}

const shortDate = (d: string) =>
  isNaN(Date.parse(d)) ? d : new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

export type NewIncident = { incident: Incident; affected: MapEntry[] };

/** Runs P2 once. Returns the incidents it created and the companies they affect. */
export async function checkNews(trigger: string): Promise<NewIncident[]> {
  log('news', `▶ news check (${trigger})`);

  // 1. Fetch
  const items: FeedItem[] = [];
  for (const url of feeds as string[]) {
    try {
      const res = await trackedFetch(url);
      items.push(...parseRss(await res.text()));
    } catch (e) {
      log('news', `  could not fetch ${url}: ${(e as Error).message}`);
    }
  }
  log('news', `  fetched ${items.length} articles from ${(feeds as string[]).length} feed${(feeds as string[]).length === 1 ? '' : 's'}`);

  const [map, known] = await Promise.all([getMap(), getIncidents()]);
  const names = [...new Set(map.flatMap((e) => [e.company, ...e.systems.map((s) => s.name)]))];

  // 2. Name match (rules)
  const candidates = items.flatMap((item) =>
    names.filter((name) => mentions(name, `${item.title} ${item.text}`)).map((name) => ({ item, name })),
  );
  log(
    'news',
    `  ${'N1 name match'.padEnd(20)}${candidates.length} of ${items.length} articles name the map${candidates.length ? `: ${[...new Set(candidates.map((c) => c.name))].join(', ')}` : ''}`,
  );

  // 3. Breach words (rules)
  const created: NewIncident[] = [];
  for (const { item, name } of candidates) {
    const verdict = reportsBreach(name, item.title, item.text);
    log('news', `  ${'N2 breach words'.padEnd(20)}"${item.title}" → ${verdict.reports ? `breach of ${name}` : 'no breach'}`);
    if (!verdict.reports || known.some((i) => i.target === name) || created.some((c) => c.incident.target === name)) continue;

    // 4. Record
    const incident: Incident = {
      target: name,
      article: { url: item.link, title: item.title, source: item.source, published_at: item.published },
      detected_at: new Date().toISOString(),
    };
    await addIncident(incident);
    const affected = map.filter((e) => affectedBy(e, [incident]));
    created.push({ incident, affected });
    log('alert', `incident: ${name} breached (${item.source}, ${shortDate(item.published)})`);
    for (const e of affected) {
      log('alert', `  affected: ${e.company}${e.company === name ? '' : ` (its ${e.systems.find((s) => s.name === name)?.kind.replace('_', ' ') ?? 'system'} is ${name})`}`);
    }
  }
  if (created.length === 0) log('news', '  no new incidents');
  log('news', `  model calls for the news check: 0`);
  logCounters();
  return created;
}

export function notificationText(incident: Incident, entry: MapEntry): { title: string; message: string } {
  const what =
    entry.company === incident.target
      ? entry.company
      : `${possessive(entry.company)} ${entry.systems.find((s) => s.name === incident.target)?.kind.replace('_', ' ') ?? 'system'}, ${incident.target},`;
  return {
    title: `${entry.company} may be affected by a breach`,
    message: `${what} was reported breached (${incident.article.source}). Messages quoting your ${entry.company} booking or order may follow. Do not enter card details from links in them.`,
  };
}
