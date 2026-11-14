// Builds the demo news feed (RSS 2.0) from real Cyber Daily articles around the RMS Cloud article.
// Cyber Daily publishes no RSS feed, so the demo serves a fixed snapshot at news.localhost/feed.xml.
// Run: node demo/scripts/build-feed.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../sites/news/feed.xml');
const RMS_ID = 14364;
const IDS = Array.from({ length: 40 }, (_, i) => RMS_ID - 20 + i);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`(?:property|name)="${prop}" content="([^"]*)"`));
  return m ? decode(m[1]) : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchArticle(id) {
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(`https://www.cyberdaily.au/security/${id}`, { headers: { 'user-agent': 'Spendtrail demo feed builder' } });
    if (res.status !== 429) break;
    await sleep(15000 * (attempt + 1)); // rate limited: back off
  }
  if (!res.ok) return null;
  const html = await res.text();
  const title = meta(html, 'og:title');
  const url = meta(html, 'og:url');
  const published = meta(html, 'article:published_time');
  if (!title || !url || !published) return null;
  // Use the article body so the feed carries the text the agent checks.
  const body = html.match(/class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<section/);
  const text = body
    ? decode(body[1].replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 4000)
    : meta(html, 'og:description') ?? '';
  return { id, title, url, published, text };
}

// One request at a time with a pause, to stay well inside the site's rate limit.
const articles = [];
for (const id of IDS) {
  const article = await fetchArticle(id);
  if (article) articles.push(article);
  process.stdout.write(article ? '.' : 'x');
  await sleep(2000);
}
process.stdout.write('\n');
if (!articles.some((a) => a.id === RMS_ID)) throw new Error('RMS Cloud article missing from the feed');
articles.sort((a, b) => b.published.localeCompare(a.published));

const items = articles
  .map(
    (a) => `    <item>
      <title>${escape(a.title)}</title>
      <link>${escape(a.url)}</link>
      <guid>${escape(a.url)}</guid>
      <pubDate>${new Date(a.published + 'Z').toUTCString()}</pubDate>
      <description>${escape(a.text)}</description>
    </item>`,
  )
  .join('\n');

writeFileSync(
  OUT,
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Cyber Daily – Security (demo snapshot)</title>
    <link>https://www.cyberdaily.au/security</link>
    <description>Snapshot of real Cyber Daily articles for the Spendtrail demo.</description>
${items}
  </channel>
</rss>
`,
);
console.log(`Wrote ${articles.length} articles to ${OUT}`);
