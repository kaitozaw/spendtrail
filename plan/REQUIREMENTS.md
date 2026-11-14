# Context
AI is making scams more convincing and cheaper to run at scale. Attackers increasingly breach the third parties around the companies people pay, and use the real data they steal to make scams believable. In October 2026, RMS Cloud, a booking system used by more than 6,000 holiday parks, hotels and campgrounds, confirmed a security incident in which guests' names, contact details and booking details were accessed. Guests of Australian operators such as Reflections Holidays and BIG4 then received emails, SMS and WhatsApp messages that quoted their genuine bookings, claimed a payment had failed, and asked them to update their payment details or lose their reservation. 

# Current State (As is)
When a company or service people use is breached, often through a third party behind it, people rarely learn that it affects them, and their protection stays the same. Scams that quote real stolen data reach them without any warning, and when they pay, the money is usually lost.

# Ideal State (To be)
When a company or service people use is breached, the people affected learn of it early and are protected before they pay. Everyone else's experience stays the same, and none of their personal data leaves their device.

# Problems (Gap)
1. People do not know which companies and services they use
2. People do not know which security incidents affect the companies and services they use
3. People do not know how to respond to a security incident affecting the companies and services they use

# Causes (Why)
1. Companies and services rely on third-party systems that people never see, such as booking systems and payment providers, so people know only the companies they deal with directly
2. People's transaction history is scattered across their own devices and each company's records, so there is no way to link daily security incidents to the companies and services each person uses
3. Existing tools check pages against lists of known unsafe sites and other static information, so they cannot strengthen protection when an incident affects the companies and services a person uses

# Objectives (What)
1. Map the companies and services a person uses, and the third-party systems behind them, on the device
2. Link daily security incidents to the companies and services on that map
3. Strengthen protection when an incident affects them: warn early about what to expect, and warn before payment details are entered on a page that imitates the affected company

# Solution (How)
A protection agent installed as a browser extension that runs entirely on the device. As the user pays online, it records each company and the third-party systems its pages load, building a personal map. It reads public breach reports. When a name on the map appears, a small on-device model confirms whether that company or system was breached. The agent then strengthens protection for that company: it warns the user early about the messages to expect. When the user is about to enter card details or send money, it compares the page with the map: the company the page presents itself as, its domain, and the systems it loads. If the page imitates a company affected by a breach, the agent holds the payment form, explains why, and lets the user decide whether to continue. Rules make the decisions, and the model answers only narrow questions the rules cannot. Nothing about the user leaves the device.
