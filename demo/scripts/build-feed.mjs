// Builds the demo news feeds (RSS 2.0) from real articles, served as fixed snapshots at news.localhost:
// - bleepingcomputer.xml: BleepingComputer security news around the Amadeus article (27–31 October 2026)
// - cyberdaily.xml: Cyber Daily articles around the RMS Cloud article (Cyber Daily publishes no RSS feed)
// Run: node demo/scripts/build-feed.mjs [bleepingcomputer|cyberdaily]   (both when omitted; slow on purpose)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NEWS = join(dirname(fileURLToPath(import.meta.url)), '../sites/news');
const UA = 'Spendtrail demo feed builder';

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`(?:property|name)="${prop}" content="([^"]*)"`));
  return m ? decode(m[1]) : null;
};
const plain = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One request at a time, backing off when rate limited. */
async function get(url) {
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.status !== 429) break;
    await sleep(15000 * (attempt + 1));
  }
  return res.ok ? res.text() : null;
}

function writeFeed(file, channel, link, articles) {
  articles.sort((a, b) => b.published.localeCompare(a.published));
  const items = articles
    .map(
      (a) => `    <item>
      <title>${escape(a.title)}</title>
      <link>${escape(a.url)}</link>
      <guid>${escape(a.url)}</guid>
      <pubDate>${new Date(a.published).toUTCString()}</pubDate>
      <description>${escape(a.text)}</description>
    </item>`,
    )
    .join('\n');
  writeFileSync(
    join(NEWS, file),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${channel} – Security (demo snapshot)</title>
    <link>${link}</link>
    <description>Snapshot of real ${channel} articles for the Spendtrail demo.</description>
${items}
  </channel>
</rss>
`,
  );
  console.log(`Wrote ${articles.length} articles to ${join(NEWS, file)}`);
}

// BleepingComputer: every security article published in the window, from the category listing.
// The window ends before Qantas said it was looking into the breach (3 November), and any article that
// names Qantas is left out, so the agent reaches Qantas only through the map.
async function bleepingComputer() {
  const AMADEUS_URL = 'https://www.bleepingcomputer.com/news/security/japan-airlines-suffers-third-party-data-breach-exposing-passenger-info/';
  const FROM = '2026-10-27';
  const TO = '2026-10-31';
  const day = (s) => new Date(`${s} UTC`).toISOString().slice(0, 10); // "October 29, 2026" → 2026-10-29

  const urls = [];
  for (let page = 1; page < 40; page++) {
    const html = await get(`https://www.bleepingcomputer.com/news/security/${page > 1 ? `page/${page}/` : ''}`);
    if (!html) break;
    const items = [...html.matchAll(/<h4><a href="([^"]+)">[\s\S]*?class="bc_news_date">([^<]+)</g)].map((m) => ({ url: m[1], day: day(m[2]) }));
    urls.push(...items.filter((i) => i.day >= FROM && i.day <= TO).map((i) => i.url));
    process.stdout.write('.');
    if (items.length === 0 || items.every((i) => i.day < FROM)) break;
    await sleep(2000);
  }
  process.stdout.write('\n');

  const articles = [];
  for (const url of [...new Set(urls)]) {
    const html = await get(url);
    await sleep(2000);
    if (!html) continue;
    const title = meta(html, 'og:title');
    const published = html.match(/"datePublished":\s*"([^"]+)"/)?.[1];
    const body = html.match(/class="articleBody">([\s\S]*?)(?:<div class="cz-related|<div id="article-bottom|<\/article>)/)?.[1] ?? '';
    const text = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => plain(m[1])).filter(Boolean).join(' ').slice(0, 4000);
    if (!title || !published) continue;
    if (/qantas/i.test(`${title} ${text}`)) {
      console.log(`left out (names Qantas): ${title}`);
      continue;
    }
    articles.push({ title, url, published, text });
  }
  if (!articles.some((a) => a.url === AMADEUS_URL)) throw new Error('Amadeus article missing from the feed');
  writeFeed('bleepingcomputer.xml', 'BleepingComputer', 'https://www.bleepingcomputer.com/news/security/', articles);
}

// Cyber Daily: the 40 articles around the RMS Cloud article, by article ID.
async function cyberDaily() {
  const RMS_ID = 14364;
  const articles = [];
  for (const id of Array.from({ length: 40 }, (_, i) => RMS_ID - 20 + i)) {
    const html = await get(`https://www.cyberdaily.au/security/${id}`);
    await sleep(2000);
    process.stdout.write(html ? '.' : 'x');
    if (!html) continue;
    const title = meta(html, 'og:title');
    const url = meta(html, 'og:url');
    const published = meta(html, 'article:published_time');
    if (!title || !url || !published) continue;
    // Use the article body so the feed carries the text the agent checks.
    const body = html.match(/class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<section/);
    const text = body ? plain(body[1]).slice(0, 4000) : (meta(html, 'og:description') ?? '');
    articles.push({ id, title, url, published: `${published}Z`, text });
  }
  process.stdout.write('\n');
  if (!articles.some((a) => a.id === RMS_ID)) throw new Error('RMS Cloud article missing from the feed');
  writeFeed('cyberdaily.xml', 'Cyber Daily', 'https://www.cyberdaily.au/security', articles);
}

const only = process.argv[2];
if (!only || only === 'bleepingcomputer') await bleepingComputer();
if (!only || only === 'cyberdaily') await cyberDaily();
