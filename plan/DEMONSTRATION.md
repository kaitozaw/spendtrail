# Demonstration Plan

This document defines the demo story for the Westpac Hackathon and what the extension and the demo sites must do to support it. The product background is in [REQUIREMENTS.md](REQUIREMENTS.md).

## Core message

**When a company you pay is breached through a third party behind it, the agent on your device warns you before you enter your payment details on a page that imitates that company. Everything else stays the same, the decisions are made by rules first, and the model is called only as a last step.**

The moment the audience should remember: every page passes through the same checks, almost all of them end in a rule, and the model is asked only when a page claims to be a company affected by a breach.

## Stage layout

The demo runs on one computer, in one Chrome window with the Spendtrail extension installed:

- **Left, Chrome:** the demo sites, the Gmail inbox and the agent's alerts. The extension shows nothing else in the browser apart from its toolbar icon.
- **Right, terminal:** the agent's log, passed from the extension to a local process through Chrome Native Messaging, not over the network. It shows each check and the level at which it ended.
- **Separate screen, DevTools:** the extension's DevTools shows the map and incidents as stored on the device (Application → Extension storage).

## Cast and setup

The breach, the article, Qantas, Booking.com and Expedia are real. Kaito's Qantas and Booking.com bookings are demo data, and the fake payment page is fictional and served locally with Docker.

- **Kaito:** the user. Kaito's Gmail account receives the attack email, which is sent from a separate demo account.

| Site | Domain | Role | Third-party system behind it |
|---|---|---|---|
| Qantas | `www.qantas.com` | Airline Kaito has paid, affected by the breach | Amadeus booking system (`book.qantas.com` loads content from `amadeus.com`) |
| Booking.com | `www.booking.com` | Hotel booking site Kaito has paid, not affected | None recorded |
| Expedia | `www.expedia.com.au` | Travel agent that sells Qantas flights | Its own checkout |
| Fake Qantas payment page | `qantas-booking.localhost` | Page used in the attack, quoting Kaito's booking reference | None |

At the start, the map is empty. Because the demo makes no real payments, Kaito's earlier Qantas and Booking.com bookings are added in Scene 1 from the extension's menu.

### Article

[Japan Airlines suffers third-party data breach exposing passenger info](https://www.bleepingcomputer.com/news/security/japan-airlines-suffers-third-party-data-breach-exposing-passenger-info/) (BleepingComputer, 29 October 2026)

Summary: Amadeus, whose systems handle bookings for airlines, travel agencies and hotels, told Japan Airlines that its Passenger Service System had been accessed without authorisation between August 2023 and September 2026. About 92,000 JAL customers' booking data, including names and flight details, was exposed, and All Nippon Airways reported a breach tied to Amadeus the same day. The article does not mention Qantas: the agent reaches Qantas only through Kaito's map.

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

**L3 `impersonation_check_llm` (model)**
- Not an impersonation, for example a travel agent: pass
- An impersonation: alert

### How the agent checks the news

The agent fetches public news feeds and keeps only the articles in which a sentence names a company or system on the map together with a word that indicates a breach, with no negation such as "not affected" just before it. The news check uses rules only, with no model.

## Demonstration flow

### Scene 1: Before the breach (about 70 seconds)

1. **Add Kaito's payment history**
   - **On screen:** DevTools shows the stored map entries: Qantas with Amadeus as its booking system, Booking.com with no known systems, and for each the domain and the booking reference, dates and place of Kaito's booking.
   - **Do:** click **Feed demo data** on the extension's toolbar menu, then refresh Extension storage in DevTools.
2. **L0 `domain_check`: pass**
   - **On screen:** Qantas's home page. The terminal shows the check ending at L0, with no alert.
   - **Do:** open Qantas's site from a bookmark.
3. **L0 `domain_check`: pass**
   - **On screen:** Booking.com's home page. The terminal shows the check ending at L0, with no alert.
   - **Do:** open Booking.com from a bookmark.

### Scene 2: Breach detected (about 60 seconds)

1. **Show the news feed**
   - **On screen:** the BleepingComputer feed that the agent reads, a list of security articles, and among them the article "Japan Airlines suffers third-party data breach exposing passenger info", which names Amadeus as the breached booking system.
   - **Do:** open http://news.localhost/bleepingcomputer.xml, then open https://www.bleepingcomputer.com/news/security/japan-airlines-suffers-third-party-data-breach-exposing-passenger-info/.
2. **Check the news**
   - **On screen:** the rules find the one article that reports a breach of Amadeus, a system on the map. Qantas is marked as affected through its booking system, Booking.com is not, and Chrome shows a notification that messages quoting the Qantas booking may follow. DevTools shows the stored incident: Amadeus, the article and when it was detected.
   - **Do:** click **Check now** on the extension's toolbar menu, then refresh Extension storage in DevTools.

### Scene 3: After the breach (about 120 seconds)

1. **L0 `domain_check`: pass**
   - **On screen:** Booking.com's home page. The check ends at L0 with no alert, because Booking.com is not affected by the Amadeus breach.
   - **Do:** open Booking.com from a bookmark.
2. **L0 `domain_check`: pass, with an alert**
   - **On screen:** Qantas's home page. The check ends at L0, and an alert explains that Qantas's booking system, Amadeus, has been breached, that payments on this site are fine, and that messages asking for payment should be checked.
   - **Do:** open Qantas's site from a bookmark.
3. **L3 `impersonation_check_llm`: pass**
   - **On screen:** Expedia's checkout for a Qantas flight. L2 sends the page to L3 because it names Qantas. The model names Expedia as the business taking the payment, and the rule finds that this is not Qantas. The payment form stays open.
   - **Do:** choose a Qantas flight on Expedia and go to the payment step, without paying.
4. **L3 `impersonation_check_llm`: alert**
   - **On screen:** Kaito's Gmail inbox: "We could not confirm the payment for your Qantas booking. Confirm your card within 24 hours or your seats will be released." The email quotes Kaito's booking reference and flight. The link opens the fake Qantas payment page. When the card field is selected, the model names Qantas as the business taking the payment on a domain that is not Qantas's, and the rule marks the page as an impersonation. The alert holds the form and shows the chain: Qantas, its booking system Amadeus, the breach article, and this page's domain, which is not Qantas's. It also says what to do next: go to Qantas from a bookmark, check with Qantas through its official contact details, and contact the card issuer if card details have already been entered.
   - **Do:** open the email, click the link, then click the card number field.
