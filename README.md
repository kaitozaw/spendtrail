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
| 2 | `npm run logger` | The agent log: each check and the level at which it ended |

When the extension starts, it downloads the model once. Wait for `downloaded SmolLM2 135M (360 MB) once` in terminal 2 before the first run.

## Layout

```
demo/        Docker Compose, fake payment page, news feeds, attack email
eval/        Evaluation cases and the news rule runner
extension/   Chrome extension (WXT, TypeScript)
  data/         known third-party systems, news feeds, demo data
  entrypoints/  background (service worker), content script, offscreen document (model), popup, eval page
  lib/          checks (L0–L3), news rules, names, domains, map storage, model, alerts
logger/      Native Messaging host and terminal viewer
plan/        Requirements, demonstration plan and design
```
