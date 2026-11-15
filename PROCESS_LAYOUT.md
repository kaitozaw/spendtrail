# Process layout

```
┌─ Chrome ──────────────────────────────────────────────────────────────────────┐
│                                                                               │
│  Browser process ×1            Chrome UI, routes messages between processes   │
│                                                                               │
│  Renderer process ×1 per site            Extension process ×1 (Spendtrail)    │
│  ┌─ trailhead.localhost ─────┐           ┌──────────────────────────────────┐ │
│  │ page JS · content.js      ├──┐        │ ┌─ background.js ──────────────┐ │ │
│  └───────────────────────────┘  │        │ │ service worker               │ │ │
│  ┌─ harbourbooks.localhost ──┐  │        │ │ L0 / L2 rules, L3 decision   │ │ │
│  │ page JS · content.js      ├──┼◀──────▶│ │ news check every 6 h         │ │ │
│  └───────────────────────────┘  │messages│ │ map, incidents               │ │ │
│  ┌─ mail.google.com ─────────┐  │        │ └──────────────┬───────────────┘ │ │
│  │ page JS · content.js      ├──┘        │                │ create, close   │ │
│  └───────────────────────────┘           │ ┌─ offscreen.html (L3 only) ───┐ │ │
│                                          │ │ WebLLM (JS + Wasm)           │ │ │
│  content.js: L1 find payment fields,     │ │ JSON schema, generation loop │ │ │
│  hold fields, banner / alert,            │ │ tokenise, detokenise         │ │ │
│  record payments                         │ └──────────────┬───────────────┘ │ │
│                                          └────────────────┼─────────────────┘ │
│                                                           │ WebGPU            │
│  GPU process ×1                                           ▼                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ weights + KV cache (L3 only, 360 MB)                WebGPU → Metal       │ │
│  └───────────────────────────────────────┬──────────────────────────────────┘ │
└──────────────────────────────────────────┼────────────────────────────────────┘
                                           ▼
              GPU hardware: embedding, decoder layers, logits (L3 only)

Disk: chrome.storage.local (map, incidents) · Cache Storage (weights, downloaded once)
Demo only: logger host (Node) → terminal
```

## One L3 call

```
content.js        hold fields ─▶ signals
service worker    L2: claims an affected company? ─▶ create offscreen
offscreen         load weights (disk → GPU) ─▶ prefill ─▶ decode payee ─▶ unload
service worker    close offscreen ─▶ rule: payee = company? ─▶ reply
content.js        release fields, or show alert
```
