# Demo attack email

Send this from the separate demo sender account to Kaito's Gmail account (kaitozaw@gmail.com) before recording Scene 3.
It is a mock phishing email for the local demo only: the link points to `qantas-booking.localhost`,
which exists only on the demo computer. The booking details match the demo data that **Feed demo data** adds.

**From name:** Qantas Bookings

**Subject:** Action required: payment not confirmed for booking 7KQX2M

**Body:**

> Dear Kaito,
>
> We could not confirm the payment for your **Qantas** booking.
>
> - Booking reference: **7KQX2M**
> - Flight: Brisbane to Sydney
> - Date: 1 December 2026
> - Amount due: AU$412.00
>
> **Confirm your card within 24 hours or your seats will be released.**
>
> [Confirm payment](http://qantas-booking.localhost/?ref=7KQX2M)
>
> Kind regards,
> Qantas Bookings

## Tips

- In Gmail, write the text, select "Confirm payment", press Insert link (Cmd+K), and paste
  `http://qantas-booking.localhost/?ref=7KQX2M`.
- Gmail opens links through its redirect page. The agent checks the page that finally opens, so this does not change the result.
- If the email lands in Spam, move it to the inbox before recording.
