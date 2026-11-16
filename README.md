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
| 1 | `npm run demo` | Serves the fake payment page and the news feeds at `*.localhost` with Docker (`npm run demo:down` stops them) |
| 2 | `npm run logger` | The agent log: checks, news, map, counters and Chrome's memory |

When the extension starts, it downloads the model once. Wait for `downloaded SmolLM2 135M (360 MB) once` in terminal 2 before the first run.

## Demo

The story is in [DEMONSTRATION.md](plan/DEMONSTRATION.md). Qantas, Booking.com and Expedia are the real sites: never complete a payment on them. On the fake page, use the test card `4242 4242 4242 4242`, expiry `12/28`, CVC `123`; it sends nothing anywhere.

**Before recording**

1. Spendtrail menu → **Clear agent data**.
2. Send the attack email in [demo/email/qantas-payment-failed.md](demo/email/qantas-payment-failed.md) from the sender account to Kaito's Gmail.
3. Bookmark https://www.qantas.com and https://www.booking.com.
4. On the Spendtrail card in `chrome://extensions`, click **service worker** to open its DevTools, then go to Application → Extension storage → Local and dock it in the Chrome window.
5. For a clean memory figure, turn off other extensions. The logger adds up all extension processes, and Chrome Task Manager (Window → Task Manager) shows Spendtrail alone.

**Scenes**

| Scene | Do | Ends at |
|---|---|---|
| 1 | Spendtrail menu → **Feed demo data**, refresh Extension storage | Qantas (Amadeus) and Booking.com added to the map |
| 1 | Open Qantas from the bookmark | L0 pass |
| 1 | Open Booking.com from the bookmark | L0 pass |
| 2 | Spendtrail menu → **Check now**, refresh Extension storage | Amadeus breach found by rules, notification, incident stored |
| 3 | Open Qantas from the bookmark | L0 pass with a banner |
| 3 | On https://www.expedia.com.au, choose a Qantas flight and go to the payment step without paying | L3 pass (model call 1) |
| 3 | Open the email in Gmail, click the link, click the card number field | L3 alert (model call 2) |

Because a check result lasts while you stay on a domain, open a different site before a step that should run L0 again. Feed demo data and a newly found breach clear the results.

## Demo sites

| Site | URL | Role |
|---|---|---|
| Qantas | https://www.qantas.com | Real airline; its booking system is Amadeus (affected) |
| Booking.com | https://www.booking.com | Real hotel booking site (not affected) |
| Expedia | https://www.expedia.com.au | Real travel agent that sells Qantas flights |
| Fake Qantas payment page | http://qantas-booking.localhost/?ref=7KQX2M | The attack page |
| News feeds | http://news.localhost/bleepingcomputer.xml, http://news.localhost/feed.xml | Snapshots of 43 real BleepingComputer and 39 real Cyber Daily articles |

The demo data that **Feed demo data** adds is in [extension/data/demo-history.json](extension/data/demo-history.json). Regenerate the feeds with `node demo/scripts/build-feed.mjs [bleepingcomputer|cyberdaily]` (slow on purpose, to respect the sites' rate limits).

## Evaluation

| What | How | Result |
|---|---|---|
| L3 payee extraction | Open `chrome-extension://jbjeljpadjjinlbfkklkappccmkmdlgg/eval.html` (18 cases), or add `?set=holdout` (30 held-out cases) | SmolLM2 135M: 18/18 and 30/30 |
| News rules | `npx --prefix extension tsx eval/run-news-rules.mts` | 27/27, no model |

Cases are in [eval/cases.json](eval/cases.json) and [eval/holdout.json](eval/holdout.json).

## Layout

```
demo/        Docker Compose, fake payment page, news feeds, attack email
eval/        Evaluation cases and the news rule runner
extension/   Chrome extension (WXT, TypeScript)
  entrypoints/  background (service worker), content script, offscreen document (model), popup, eval page
  lib/          checks (L0–L3), news rules, names, domains, map storage, model, alerts
  data/         known third-party systems, news feeds, demo data
logger/      Native Messaging host and terminal viewer (with memory sampling)
plan/        Requirements, demonstration plan and design
```
