# Demo attack email

Send this from the separate demo sender account to Mia's demo Gmail account before recording Scene 3.
It is a mock phishing email for the local demo only: the link points to `coastline-payments.localhost`,
which exists only on the demo computer.

**From name:** Coastline Holiday Parks

**Subject:** Action required: your booking payment has failed (CHP-48213)

**Body:**

> Dear Mia,
>
> We were unable to process the payment for your booking at **Coastline Holiday Parks**.
>
> - Booking reference: **CHP-48213**
> - Stay: Ballina Beachfront Cabin, Ballina NSW
> - Dates: 12–15 December 2026
> - Amount due: $486.00
>
> **Your booking payment has failed. Update your payment details within 24 hours or your reservation will be cancelled.**
>
> [Update payment details](http://coastline-payments.localhost/?ref=CHP-48213)
>
> Kind regards,
> Coastline Holiday Parks Reservations

## Tips

- In Gmail, write the text, select "Update payment details", press Insert link (Cmd+K), and paste
  `http://coastline-payments.localhost/?ref=CHP-48213`.
- Gmail opens links through its redirect page. The agent checks the page that finally opens, so this does not change the result.
- If the email lands in Spam, move it to the inbox before recording.
