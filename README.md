# Spendtrail

A protection agent for one person, running entirely on their device as a Chrome extension. It keeps a map of the companies you pay and the third-party systems behind them. When one of them is breached, it warns you early, and if a page imitates that company when you are about to pay, it holds the payment form and explains why. Decisions are made by rules first. The model, SmolLM2 135M (360 MB), is called only as a last step, and nothing about you leaves the device.

The plan is in [plan/](plan/): [REQUIREMENTS.md](plan/REQUIREMENTS.md), [DEMONSTRATION.md](plan/DEMONSTRATION.md), [DESIGN.md](plan/DESIGN.md).

## Requirements

- macOS with Google Chrome (WebGPU enabled, which is the default on Apple Silicon)
- Node.js 22 or later
- Docker Desktop

## Setup (once)

```sh
cd extension && npm install && cd ..
npm run ext:build          # builds extension/.output/chrome-mv3
npm run logger:install     # registers the terminal logger with Chrome (Native Messaging)
```

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `extension/.output/chrome-mv3`. The folder starts with a dot: press Cmd+Shift+G in the file picker and paste the path. The extension ID is `jbjeljpadjjinlbfkklkappccmkmdlgg`.
2. Restart Chrome (Cmd+Q) so it picks up the logger registration.
3. Pin Spendtrail to the toolbar from the puzzle-piece menu.

After changing the code, run `npm run ext:build` and press the reload button (↻) on the Spendtrail card.

## Run

| Terminal | Command | Shows |
|---|---|---|
| 1 | `npm run demo` | Serves the demo sites at `*.localhost` with Docker (`npm run demo:down` stops them) |
| 2 | `npm run logger` | The agent log: checks, news, map, counters and Chrome's memory |

When the extension starts, it downloads the model once. Wait for `downloaded SmolLM2 135M (360 MB) once` in terminal 2 before the first run.

## Demo

The story is in [DEMONSTRATION.md](plan/DEMONSTRATION.md). Test card for every site: `4242 4242 4242 4242`, expiry `12/28`, CVC `123`. No site sends what you type anywhere.

**Before recording**

1. Spendtrail menu → **Clear agent data**.
2. Pay once at http://coastline.localhost/book.html and once at http://trailhead.localhost/checkout.html. The map now holds Coastline (RMS Cloud) and Trailhead (Northpay).
3. Send the attack email in [demo/email/booking-payment-failed.md](demo/email/booking-payment-failed.md) from the sender account to Mia's demo Gmail.
4. For a clean memory figure, turn off other extensions. The logger adds up all extension processes, and Chrome Task Manager (Window → Task Manager) shows Spendtrail alone.

**Scenes**

| Scene | Do | Ends at |
|---|---|---|
| 1 | Open another site, then http://trailhead.localhost/checkout.html | L0 pass |
| 1 | Open Gmail | L1 pass |
| 1 | Pay at http://harbourbooks.localhost/checkout.html | L2 pass, added to the map |
| 2 | Spendtrail menu → **Check now** | RMS Cloud breach found by rules, notification |
| 3 | Open Coastline from a bookmark, go to its payment page | L0 pass with a banner |
| 3 | Pay at http://staysearch.localhost/checkout.html | L3 pass (model call 1) |
| 3 | Open the email in Gmail, click the link, click the card number field | L3 alert (model call 2) |

Because a check result lasts while you stay on a domain, open a different site before a step that should run L0 again.

## Demo sites

| Site | URL | Role |
|---|---|---|
| Coastline Holiday Parks | http://coastline.localhost | Holiday park whose booking system is RMS Cloud (affected) |
| Trailhead Outfitters | http://trailhead.localhost | Outdoor shop using Northpay (not affected) |
| Harbour Books | http://harbourbooks.localhost | Bookshop Mia has never used |
| StaySearch | http://staysearch.localhost | Travel agent that sells Coastline stays |
| Fake Coastline payment page | http://coastline-payments.localhost/?ref=CHP-48213 | The attack page |
| News feed | http://news.localhost/feed.xml | Snapshot of 39 real Cyber Daily articles |

Regenerate the shop pages with `node demo/scripts/build-shops.mjs`, and the feed with `node demo/scripts/build-feed.mjs` (slow on purpose, to respect the site's rate limit).

## Evaluation

| What | How | Result |
|---|---|---|
| L3 payee extraction | Open `chrome-extension://jbjeljpadjjinlbfkklkappccmkmdlgg/eval.html` (16 cases), or add `?set=holdout` (30 held-out cases) | SmolLM2 135M: 46/46 |
| News rules | `npx --prefix extension tsx eval/run-news-rules.mts` | 26/26, no model |

Cases are in [eval/cases.json](eval/cases.json) and [eval/holdout.json](eval/holdout.json).

## Layout

```
demo/        Docker Compose, demo sites, news feed, attack email
eval/        Evaluation cases and the news rule runner
extension/   Chrome extension (WXT, TypeScript)
  entrypoints/  background (service worker), content script, offscreen document (model), popup, eval page
  lib/          checks (L0–L3), news rules, names, map storage, model, alerts
  data/         known third-party systems, news feeds
logger/      Native Messaging host and terminal viewer (with memory sampling)
plan/        Requirements, demonstration plan and design
```
