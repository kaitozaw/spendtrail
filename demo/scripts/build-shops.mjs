// Generates the static pages of the three shop-style demo sites (index, checkout, done).
// Run: node demo/scripts/build-shops.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITES = join(dirname(fileURLToPath(import.meta.url)), '../sites');

const shops = [
  {
    dir: 'trailhead',
    name: 'Trailhead Outfitters',
    tagline: 'Gear for the long way round.',
    colors: { brand: '#c2410c', dark: '#9a3412', bg: '#f7f5f0' },
    font: "'Trebuchet MS', system-ui, sans-serif",
    logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#14532d"/><path d="M8 48 L26 18 L36 34 L42 26 L56 48 Z" fill="#fdba74"/><path d="M22 48 L26 40 L30 48 Z" fill="#14532d"/></svg>',
    products: [
      ['Trail Daypack 28L', 'Light, weatherproof and built for long days.', '$89.00'],
      ['Alpine Shell Jacket', 'Three-layer shell for wind and rain.', '$249.00'],
      ['Merino Hiking Socks', 'Two pairs, cushioned heel.', '$34.00'],
    ],
    item: ['Trail Daypack 28L', '$89.00'],
    northpay: true,
    order: 'Order number',
    ref: 'TH-20931',
    agentNote: null,
  },
  {
    dir: 'harbourbooks',
    name: 'Harbour Books',
    tagline: 'An independent bookshop by the water.',
    colors: { brand: '#1e3a8a', dark: '#172554', bg: '#f8fafc' },
    font: "Georgia, 'Times New Roman', serif",
    logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1e3a8a"/><path d="M14 18 H30 V48 H14 Z M34 18 H50 V48 H34 Z" fill="#dbeafe"/><path d="M12 50 Q32 44 52 50" stroke="#93c5fd" stroke-width="3" fill="none"/></svg>',
    products: [
      ['Tides of the Coral Coast', 'A novel of three generations on the reef.', '$32.99'],
      ['The Lighthouse Keeper', 'Short stories from the Tasman Sea.', '$27.50'],
      ['Field Guide to Shorebirds', 'Illustrated, pocket-sized.', '$39.95'],
    ],
    item: ['Tides of the Coral Coast', '$32.99'],
    northpay: true,
    order: 'Order number',
    ref: 'HB-7712',
    agentNote: null,
  },
  {
    dir: 'staysearch',
    name: 'StaySearch',
    tagline: 'Compare and book holiday stays across Australia.',
    colors: { brand: '#7c3aed', dark: '#5b21b6', bg: '#faf5ff' },
    font: 'system-ui, sans-serif',
    logo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7c3aed"/><circle cx="28" cy="28" r="12" fill="none" stroke="#fff" stroke-width="5"/><path d="M37 37 L50 50" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>',
    products: [
      ['Coastline Holiday Parks – Ballina Beachfront Cabin', 'Two bedrooms near Shelly Beach. Provided by Coastline Holiday Parks.', '$162 / night'],
      ['Sunset Bay Resort – Garden Studio', 'Pool, breakfast included. Provided by Sunset Bay Resort.', '$214 / night'],
      ['Gum Tree Glamping – Safari Tent', 'Off-grid luxury in the hinterland. Provided by Gum Tree Glamping.', '$178 / night'],
    ],
    item: ['Coastline Holiday Parks – Ballina Beachfront Cabin, 18–20 January 2027 (2 nights)', '$324.00'],
    northpay: false,
    order: 'StaySearch booking',
    ref: 'SS-55102',
    agentNote: 'StaySearch is a booking agent. Your stay is provided by Coastline Holiday Parks, and StaySearch takes the payment.',
  },
];

const css = (s) => `:root { --brand: ${s.colors.brand}; --dark: ${s.colors.dark}; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 ${s.font}; color: var(--ink); background: ${s.colors.bg}; }
header { display: flex; align-items: center; gap: 12px; padding: 16px 32px; background: #fff; border-bottom: 1px solid var(--line); }
header img { width: 40px; height: 40px; }
header .name { font-size: 20px; font-weight: bold; color: var(--dark); }
header nav { margin-left: auto; font: 14px system-ui, sans-serif; color: var(--muted); }
main { max-width: 880px; margin: 0 auto; padding: 32px; }
h1 { font-size: 28px; margin: 0 0 8px; }
.lede { color: var(--muted); margin: 0 0 24px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
.card h3 { margin: 0 0 4px; font-size: 17px; } .card p { margin: 0 0 12px; color: var(--muted); font-size: 14px; }
.price { font-weight: bold; margin-bottom: 12px; }
.button { display: inline-block; background: var(--brand); color: #fff; text-decoration: none; border: 0; border-radius: 10px; padding: 12px 18px; font: 600 15px system-ui, sans-serif; cursor: pointer; }
.button:hover { background: var(--dark); }
.layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
.summary dt { font: 13px system-ui, sans-serif; color: var(--muted); } .summary dd { margin: 0 0 12px; font-weight: bold; }
.note { font: 13px system-ui, sans-serif; color: var(--muted); background: #f1f5f9; border-radius: 8px; padding: 10px 12px; }
form label { display: block; font: 13px system-ui, sans-serif; color: var(--muted); margin-bottom: 12px; }
form input { display: block; width: 100%; margin-top: 4px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: 15px system-ui, sans-serif; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ref { font: 600 22px ui-monospace, Menlo, monospace; color: var(--dark); }
[data-northpay] { margin-top: 12px; }
footer { text-align: center; padding: 24px; font: 13px system-ui, sans-serif; color: var(--muted); }
`;

const head = (s, title, extra = '') => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:site_name" content="${s.name}" />
  <title>${title}</title>
  <link rel="stylesheet" href="style.css" />${extra}
</head>
<body>
  <header>
    <img src="logo.svg" alt="${s.name} logo" class="logo" />
    <span class="name">${s.name}</span>
    <nav>Shop · Help · Account</nav>
  </header>`;

const foot = (s) => `
  <footer>${s.name}</footer>
</body>
</html>
`;

for (const s of shops) {
  const dir = join(SITES, s.dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'style.css'), css(s));
  writeFileSync(join(dir, 'logo.svg'), s.logo + '\n');

  writeFileSync(
    join(dir, 'index.html'),
    `${head(s, s.name)}
  <main>
    <h1>${s.name}</h1>
    <p class="lede">${s.tagline}</p>
    <div class="grid">
${s.products
  .map(
    ([name, desc, price]) => `      <div class="card">
        <h3>${name}</h3>
        <p>${desc}</p>
        <div class="price">${price}</div>
        <a class="button" href="checkout.html">${s.dir === 'staysearch' ? 'Book' : 'Buy'}</a>
      </div>`,
  )
  .join('\n')}
    </div>
  </main>${foot(s)}`,
  );

  const northpayScript = s.northpay ? '\n  <script src="http://pay.northpay.localhost/northpay.js" defer></script>' : '';
  writeFileSync(
    join(dir, 'checkout.html'),
    `${head(s, `Checkout – ${s.name}`, northpayScript)}
  <main>
    <h1>Checkout</h1>
    <p class="lede">Review your order and pay.</p>
    <div class="layout">
      <div class="card">
        <dl class="summary">
          <dt>${s.dir === 'staysearch' ? 'Stay' : 'Item'}</dt><dd>${s.item[0]}</dd>
          <dt>Total</dt><dd>${s.item[1]}</dd>
        </dl>${s.agentNote ? `\n        <p class="note">${s.agentNote}</p>` : ''}
      </div>
      <form class="card" id="pay-form">
        <label>Name on card <input name="cc-name" autocomplete="cc-name" required /></label>
        <label>Card number <input name="cc-number" autocomplete="cc-number" inputmode="numeric" placeholder="4242 4242 4242 4242" required /></label>
        <div class="row">
          <label>Expiry <input name="cc-exp" autocomplete="cc-exp" placeholder="MM/YY" required /></label>
          <label>CVC <input name="cc-csc" autocomplete="cc-csc" inputmode="numeric" required /></label>
        </div>
        <button class="button" type="submit">Pay ${s.item[1]}</button>${s.northpay ? '\n        <div data-northpay></div>' : ''}
      </form>
    </div>
  </main>
  <script>
    // Demo only: no card data is sent anywhere.
    document.getElementById('pay-form').addEventListener('submit', (e) => {
      e.preventDefault();
      location.href = 'done.html';
    });
  </script>${foot(s)}`,
  );

  writeFileSync(
    join(dir, 'done.html'),
    `${head(s, `Thank you – ${s.name}`)}
  <main>
    <h1>Thank you</h1>
    <p class="lede">Your payment went through.</p>
    <div class="card">
      <dl class="summary">
        <dt>${s.order}</dt><dd class="ref">${s.ref}</dd>
        <dt>${s.dir === 'staysearch' ? 'Stay' : 'Item'}</dt><dd>${s.item[0]}</dd>
        <dt>Paid</dt><dd>${s.item[1]}</dd>
      </dl>
    </div>
  </main>${foot(s)}`,
  );
}

console.log(`Generated ${shops.map((s) => s.dir).join(', ')}`);
