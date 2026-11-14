# Demonstration Plan

This document defines the demo story for the Westpac Hackathon and what the extension and the demo sites must do to support it. The product background is in [REQUIREMENTS.md](REQUIREMENTS.md).

## Core message

**When a company you pay is breached through a third party behind it, the agent on your device warns you before you enter your payment details on a page that imitates that company. Everything else stays the same, the decisions are made by rules first, and the model is called only as a last step.**

The moment the audience should remember: every page passes through the same checks, almost all of them end in a rule, and the model is asked only when a page claims to be a company affected by a breach.

## Stage layout

The demo runs on one computer, in one Chrome window with the Spendtrail extension installed:

- **Left, Chrome:** the demo sites, the Gmail inbox and the agent's alerts. The extension shows nothing else in the browser apart from its toolbar icon.
- **Top right, terminal:** the agent's log, passed from the extension to a local process through Chrome Native Messaging, not over the network. It shows the map, each check and the level at which it ended, the news checks, and three counters: model calls, personal data sent and the extension's memory use.
- **Bottom right, Chrome Task Manager:** the extension's memory and CPU, as Chrome reports them.

## Cast and setup

The breach and the article are real. The user, the companies and the sites are fictional, and the sites are served locally with Docker.

- **Mia:** the user. A demo Gmail account receives the attack email, which is sent from a separate demo account.

| Site | Domain | Role | Third-party system it loads |
|---|---|---|---|
| Coastline Holiday Parks | `coastline.localhost` | Holiday park, affected by the breach | RMS Cloud booking system (`bookings.rmscloud.localhost`) |
| Trailhead Outfitters | `trailhead.localhost` | Outdoor gear shop, not affected | Northpay payment provider (`pay.northpay.localhost`) |
| Harbour Books | `harbourbooks.localhost` | Bookshop Mia has never used | Northpay payment provider |
| StaySearch | `staysearch.localhost` | Travel agent that sells Coastline stays | Its own checkout |
| Fake Coastline payment page | `coastline-payments.localhost` | Copy of Coastline's payment page used in the attack | None |

At the start, the map already holds Coastline and Trailhead from Mia's earlier payments. The demo opens with the terminal showing this map:

```
Coastline Holiday Parks  → RMS Cloud (booking system)
Trailhead Outfitters     → Northpay (payment provider)
```

The narration introduces these two companies as the ones Mia pays, and every other site as one she has never used. Domains are shown only in the terminal and are not read out.

### Article

[Aussie holiday park operators compromised by RMS Cloud third-party breach](https://www.cyberdaily.au/security/14364-aussie-holiday-park-operators-compromised-by-rms-cloud-third-party-breach) (Cyber Daily, 28 October 2026)

Summary: RMS Cloud, a booking system used by more than 6,000 holiday parks, hotels and campgrounds, confirmed a global incident. Guests of Reflections Holidays, BIG4, G'day Parks and other Australian operators received emails, SMS and WhatsApp messages that quote genuine booking information, claim a booking payment has failed and ask for payment details. Guests who shared card details are advised to contact their bank.

## How the agent checks a page

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

A page presents itself as a company when any signal matches, fully or partly: the company name, its logo, or details of Mia's payments to it, such as a booking reference, dates or a place.

**L3 `impersonation_check_llm` (model)**
- Not an impersonation, for example a travel agent: pass
- An impersonation: alert

The model only names the business taking the payment. A rule compares that name with the company and makes the decision.

The alert holds the payment form. Mia cannot type into it until she chooses **Leave this page** or **I understand, continue**.

L0 runs when Mia opens a new domain. L1 runs each time a payment field appears on the page. A result lasts while Mia stays on that domain, and all results are cleared when a new breach is detected.

### How the agent checks the news

The agent fetches public news feeds and keeps only the articles in which a sentence names a company or system on the map together with a word that indicates a breach, with no negation such as "not affected" just before it. The news check uses rules only, with no model.

## Demonstration flow

### Scene 1: Before the breach (about 70 seconds)

1. **L0 `domain_check`: pass**
   - **On screen:** Trailhead's checkout. The terminal shows the check ending at L0, and the payment goes through.
   - **Do:** buy an item at Trailhead and pay with a test card.
2. **L1 `payment_check`: pass**
   - **On screen:** Mia's Gmail inbox. The terminal shows the check ending at L1.
   - **Do:** open Gmail.
3. **L2 `impersonation_check_rule`: pass**
   - **On screen:** Harbour Books' checkout. The terminal shows the check ending at L2, and after payment the terminal adds Harbour Books to the map with Northpay as its payment provider.
   - **Do:** buy a book and pay.

The model call counter is still 0.

### Scene 2: Breach detected (about 45 seconds)

1. **Check the news**
   - **On screen:** the terminal shows the articles checked and the one article that names RMS Cloud from the map. The rules confirm that the article reports a breach of RMS Cloud, and the model call counter stays at 0. Coastline is marked as affected, and Chrome shows a notification that messages quoting the Coastline booking may follow.
   - **Do:** click **Check now** on the extension's toolbar menu.

### Scene 3: After the breach (about 120 seconds)

1. **L0 `domain_check`: pass, with an alert**
   - **On screen:** Coastline's own payment page. The check ends at L0, and an alert explains that Coastline's booking system, RMS Cloud, has been breached, that payments on this site are fine, and that messages asking for payment should be checked.
   - **Do:** open Coastline's site from a bookmark and go to its payment page.
2. **L3 `impersonation_check_llm`: pass**
   - **On screen:** StaySearch's checkout for a Coastline stay. L2 sends the page to L3 because it names Coastline. The model names StaySearch as the business taking the payment, the rule finds that this is not Coastline, and the model call counter becomes 1. The payment goes through.
   - **Do:** book a Coastline stay on StaySearch and pay.
3. **L3 `impersonation_check_llm`: alert**
   - **On screen:** Mia's Gmail inbox: "Your booking payment has failed. Update your payment details within 24 hours or your reservation will be cancelled." The link opens the fake Coastline payment page. When the card field is selected, the model names Coastline Holiday Parks as the business taking the payment on a domain that is not Coastline's, the rule marks the page as an impersonation, and the model call counter becomes 2. The alert holds the form and shows the chain: Coastline Holiday Parks, its booking system RMS Cloud, the breach article, and this page's domain, which is not Coastline's. It also says what to do next: go to Coastline from a bookmark, check with Coastline through its official contact details, and contact the card issuer if card details have already been entered.
   - **Do:** open the email, click the link, then click the card number field.

At the end, the terminal shows 2 model calls and 0 bytes of personal data sent. Throughout the demo, its memory figure and Chrome Task Manager show that the extension stays small, and that its memory use rises only while the model answers and falls back when the model is unloaded.
