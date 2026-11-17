# Demonstration Script

## Demonstration flow

### Scene 1: Before the breach

- Spendtrail is a Chrome extension
- At the moment, it can only be used in Developer mode
- First, let me feed some demo data
- As you can see, this adds transaction history to local storage
    - Qantas
    - Booking.com
- It records the domain and payment details, as well as the third-party system used for the transaction
- Even though this is demo data, same data can be inserted when a user submits a payment form in the browser
- No incident is detected yet, so visiting both websites shows no alerts

### Scene 2: Breach detected

- Next, spendtrail collects incident news from external sources
- Normally it checks cybersecurity RSS feeds every 6 hours, but I'll trigger it manually for this demo
- The feed includes an article about a data breach in a third-party system Qantas uses
- As you can see, it adds this news to local storage because Qantas uses the breached system

### Scene 3: After the breach

- Now, let's see how spendtrail behaves after the breach
- First, I open Booking.com
- No alert is shown, because Booking.com doesn't use the breached system
- Next, I open Qantas 
- This time, an alert is shown
- It says Qantas's booking system, Amadeus, has been breached
- But the user can continue browsing, as this is Qantas's official domain, where the user booked before
- Next, I choose a Qantas flight on Expedia and go to the payment step
- This page mentions Qantas, but rules alone can't tell whether it's a fake Qantas site or a travel agent selling Qantas flights
- So spendtrail asks the local model who is taking the payment
- The model says it's Expedia, not Qantas, so the payment form stays open
- Finally, let's look at a scam email
- It says the payment for my Qantas booking failed, and asks me to confirm my card within 24 hours
- It even quotes my real booking reference and flight, which were leaked in the breach
- I click the link, and it opens a fake Qantas payment page
- Like Expedia, this page mentions Qantas, so spendtrail asks the local model who is taking the payment
- This time, the model says it's Qantas, but the domain isn't Qantas's, so spendtrail blocks the form
