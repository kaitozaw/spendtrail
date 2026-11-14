# Architecture

## Overview

Spendtrail is a Chrome extension that runs entirely on the user's computer. The only things it fetches from outside are public news feeds and, once, the model. No request it sends contains anything about the user.

```
┌──────────────────────────── User's computer ─────────────────────────────┐
│                                                                           │
│  ┌──────────────────────── Chrome ────────────────────────┐               │
│  │ Content script (every page)                            │               │
│  │  observes the page, shows alerts                       │               │
│  │            ▲ │                                         │               │
│  │            │ ▼                                         │               │
│  │ Service worker                                         │               │
│  │  runs the checks, keeps the map, fetches the news      │               │
│  │            ▲ │                    ▲ │                  │               │
│  │            │ ▼                    │ ▼                  │               │
│  │ Offscreen document         chrome.storage              │               │
│  │  runs the model on demand   map, incidents             │               │
│  └────────────┬───────────────────────────────────────────┘               │
│               │ Native Messaging (local, no network)                      │
│               ▼                                                           │
│  Terminal logger: log, counters, memory                                   │
│                                                                           │
│  Docker: demo sites, mock third-party systems, demo news feed             │
└───────────────────────────────────────────────────────────────────────────┘
               │ public news feeds, the same for every user
               ▼
          News sites (RSS)
```

## Components

- **Content script:** runs on every page. It reports the domain when the user opens a page, watches the page for payment fields, collects the signals used by the checks, and shows alerts.
- **Service worker:** runs the checks, keeps the map, incidents and check results, fetches the news on a schedule, counts model calls and personal data sent, and sends the log to the terminal logger.
- **Offscreen document:** loads the model only when a check needs it, and unloads it after the answer.
- **Terminal logger:** a Native Messaging host that Chrome starts, which appends each log line to a local file, and a viewer that prints the file in the terminal with the counters and Chrome's memory use.
- **Demo environment:** Docker serves the demo sites, the mock third-party systems they load, and the demo news feed.

## Privacy boundary

- News feeds are fetched whole, with no query that depends on the map, so every user sends the same request.
- The model is downloaded once and runs in the browser.
- The map, incidents, check results and page content never leave the device.
- The personal data counter adds up the size of every request body and query string the extension sends. It stays at 0 because no request carries user data.

# Tech stack

| Area | Choice |
|---|---|
| Language | TypeScript |
| Extension | Chrome Manifest V3, WXT |
| Schema and validation | Zod |
| Model runtime | WebLLM (WebGPU) in an offscreen document |
| Model | SmolLM2 135M Instruct (`SmolLM2-135M-Instruct-q0f16-MLC`, 360 MB while loaded), the smallest model that passed the evaluation |
| Storage | chrome.storage.local |
| Terminal logger | Node.js, Chrome Native Messaging |
| Demo sites | Docker Compose, nginx, static HTML |
| Email | Gmail (web) |

# Data

## Where data is managed

| Data | Location | Storage |
|---|---|---|
| Map entries | Extension | chrome.storage.local |
| Known systems | `extension/data/known-systems.json` | Bundled with the extension |
| News feeds | `extension/data/feeds.json` | Bundled with the extension |
| Incidents | Extension | chrome.storage.local |
| Check results | Extension | Memory |
| Counters and log | Extension, terminal logger | Memory |

## Schemas

**Map entry**

| Field | Type |
|---|---|
| `company` | string |
| `domain` | string |
| `systems` | `{ name, kind }[]` |
| `logo_hashes` | string[] |
| `payment_details` | `{ reference, dates, place }[]` (each field nullable) |
| `first_paid_at` | datetime |
| `last_paid_at` | datetime |

**Known system**

| Field | Type |
|---|---|
| `name` | string |
| `kind` | `booking_system` \| `payment_provider` \| `other` |
| `domain_patterns` | string[] |

**Incident**

| Field | Type |
|---|---|
| `target` | string (a company or system on the map) |
| `article` | `{ url, title, source, published_at }` |
| `detected_at` | datetime |

**Check result**

| Field | Type |
|---|---|
| `domain` | string |
| `ended_at` | `L0` \| `L1` \| `L2` \| `L3` |
| `outcome` | `pass` \| `pass_with_alert` \| `alert` |
| `company` | string \| null (the company the page presents itself as) |
| `checked_at` | datetime |

**Counters**

| Field | Type |
|---|---|
| `model_calls` | integer |
| `personal_data_sent_bytes` | integer |
| `model_loaded` | boolean |
| `model_size_mb` | number |
| `chrome_memory_mb` | number (sampled by the terminal logger) |

# Logic

## P1. Recording a payment

- A payment is recorded when the user submits a form that contains a card or bank transfer field.
- `company`: the page's `og:site_name`, otherwise its title.
- `systems`: the domains of the iframes and scripts the page loads, matched against `domain_patterns` in known systems.
- `logo_hashes`: a perceptual hash of each image in the page header whose source, alt text or class contains `logo`.
- `payment_details`: read from the next page on the same domain, using labels such as "Booking reference", "Order number", dates and a place name.
- If the domain is already on the map, the entry is updated at each payment: `systems` is replaced with the systems the page loads now, new `logo_hashes` and `payment_details` are added, and `last_paid_at` is set.

## P2. Checking the news

1. **Fetch:** every 6 hours, and when the user clicks **Check now**, fetch every feed in `feeds.json`.
2. **Name match (rules):** keep articles whose title or text names a `company` or a system `name` on the map as whole words, after normalising both sides (lower case, punctuation removed, spaces collapsed).
3. **Breach words (rules):** keep articles where a sentence, or the title, names it and contains a breach word (such as breach, compromised, incident, hacked, ransomware, leaked, unauthorised), with no negation (such as not, no, neither, never, unaffected) in the 4 words before the breach word.
4. **Record:** create an incident for the name. A company is affected when it is the target, or when one of its systems is the target. All check results are cleared, and Chrome shows a notification for each newly affected company.

The news check uses no model.

## P3. Checking a page

L0 runs when the user opens a new domain. L1 runs each time a payment field appears on the page. L2 runs when L1 finds a payment field, and L3 runs when L2 finds that the page presents itself as a company affected by a breach. A result lasts while the user stays on that domain, so L2 and L3 run at most once per stay.

**L0 `domain_check` (rules)**
- Domain in the transaction history, and the company is not affected by a breach: pass
- Domain in the transaction history, and the company is affected by a breach: pass, with an alert
- Domain not in the transaction history: go to L1

**L1 `payment_check` (rules)**
- No card or bank transfer field: pass
- A card or bank transfer field: go to L2

**L2 `impersonation_check_rule` (rules)**
- The page does not present itself as a company in the transaction history: pass
- The page presents itself as a company in the transaction history that is not affected by a breach: pass
- The page presents itself as a company in the transaction history that is affected by a breach: go to L3

A page presents itself as a company when any of these signals matches, fully or partly:

| Signal | Match |
|---|---|
| Company name | The normalised name, or a close variant (small edit distance, look-alike characters), appears in the title, `og:site_name` or the text near the payment form |
| Logo | A header image's perceptual hash is close to one of `logo_hashes` |
| Payment details | A stored `reference` appears on the page, or a stored date and place both appear |

**L3 `impersonation_check_llm` (model)**
- Not an impersonation, for example a travel agent: pass
- An impersonation: alert

The model names the business taking the payment, and a rule makes the decision:

1. **Extract (model):** the model reads the page title and the text near the payment form, and returns the name of the business taking the payment.
2. **Decide (rules):** the page is an impersonation when that name matches the company. Names match when, after normalising, more than half of the company's distinctive words match (allowing small spelling differences and look-alike characters such as 0 for o), or when the names are the same once spaces and hyphens are removed. Generic words such as holiday, parks, shop and payments are ignored. The domain is already known not to be the company's, because L0 did not pass the page.

## P4. Alerts

- **L0 alert:** a banner at the top of the page. It says which system of the company was breached, that payments on this site are fine, and that messages asking for payment should be checked. It does not block anything.
- **L3 alert:** an overlay on the payment form that disables its fields. It shows the chain from the company to its breached system, the article and the page's domain. It lists what to do next: go to the company from a bookmark, check with the company through its official contact details, and contact the card issuer if card details have already been entered. **Leave this page** goes back. **I understand, continue** unlocks the form for the rest of the stay on that domain.

## P5. Model

- The model is used only by L3. The offscreen document loads it when L3 needs an answer, and unloads it straight after.
- The prompt asks for the name of the business taking the payment, with four short worked examples that use businesses not found in the evaluation. The output is constrained to `{"payee": string}` of at most 60 characters.
- If the model cannot load or answer, L3 shows the alert, so a failure leads to a warning rather than a missed one.
- **Model selection:** each candidate (SmolLM2 135M and 360M, Llama 3.2 1B, Qwen2.5 0.5B and 1.5B) extracted the payee on 16 tuning cases and 30 held-out cases that were never used to tune the prompt. These cases cover impersonations, look-alike names, travel agents, marketplaces, resellers and review sites. The smallest model that got every case right is used. Asking the models yes/no questions directly gave results close to chance for every model under 1.5B, which is why the model extracts a name and a rule decides.

## P6. Log and counters

- The service worker sends each check, each news step and each model call to the terminal logger as one line.
- The extension reports `model_calls`, `personal_data_sent_bytes`, `model_loaded` and `model_size_mb`.
- The terminal logger samples the memory of the user's Chrome every second, and every 200 ms while the model runs, using macOS `footprint` (the same measure as Activity Monitor, including graphics memory). It reports the extension processes and the GPU process, where WebGPU holds the model, and prints these figures under each counters line, with the GPU peak while the model ran.
