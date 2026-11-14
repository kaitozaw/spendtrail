// Evaluates the rule-only news check (no model) on the article cases, the held-out cases,
// and the demo news feed. Run: npx tsx eval/run-news-rules.mts
import { readFileSync } from 'node:fs';
import { mentions, reportsBreach } from '../extension/lib/news.ts';

type Article = { id: string; expected: 'yes' | 'no'; input: { name: string; title: string; sentences: string[] } };
const load = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

function evaluate(label: string, articles: Article[]) {
  let ok = 0;
  for (const a of articles) {
    const v = reportsBreach(a.input.name, a.input.title, a.input.sentences.join(' '));
    const verdict = v.reports ? 'yes' : 'no';
    if (verdict === a.expected) ok++;
    else console.log(`  MISS ${a.id}: expected ${a.expected}, got ${verdict}${v.sentence ? ` ← "${v.sentence}"` : ''}`);
  }
  console.log(`${label}: ${ok}/${articles.length}`);
}

evaluate('cases.json articles', load('./cases.json').articles);
evaluate('holdout.json articles', load('./holdout.json').articles);

// Demo feed: which articles would trigger for the names on Mia's map?
const xml = readFileSync(new URL('../demo/sites/news/feed.xml', import.meta.url), 'utf8');
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<description>([\s\S]*?)<\/description>/g)].map((m) => ({
  title: decode(m[1]!),
  text: decode(m[2]!),
}));
const MAP_NAMES = ['Coastline Holiday Parks', 'Trailhead Outfitters', 'Harbour Books', 'RMS Cloud', 'Northpay'];
let named = 0;
let reported = 0;
for (const item of items) {
  for (const name of MAP_NAMES) {
    if (!mentions(name, `${item.title} ${item.text}`)) continue; // N1
    named++;
    const v = reportsBreach(name, item.title, item.text); // N2
    if (v.reports) reported++;
    console.log(`  feed: ${name} in "${item.title}" → ${v.reports ? 'BREACH' : 'no breach'}`);
  }
}
console.log(`demo feed: ${items.length} articles, ${named} name the map, ${reported} reported as a breach`);
