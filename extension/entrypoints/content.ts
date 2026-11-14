// Observes the page: reports the domain (L0), watches for payment fields (L1), collects signals (L2),
// shows alerts (P4) and records payments (P1). It never sends anything off the device; messages go
// to the service worker.
import type { PageOpened, PageOpenedReply, PaymentFieldReply, ToServiceWorker } from '../lib/messages';
import { companyName, loadedHosts, logoHashes, pageSignals, paymentDetails, paymentFields } from '../lib/page';
import { showAlert, showBanner } from '../lib/ui';

const send = <T = unknown>(message: ToServiceWorker) => chrome.runtime.sendMessage(message) as Promise<T>;

/** Holds the payment fields: they cannot be typed into while locked. */
function lock(fields: HTMLInputElement[], locked: boolean) {
  for (const f of fields) {
    f.readOnly = locked;
    f.style.opacity = locked ? '0.6' : '';
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    const domain = location.hostname;
    const opened: PageOpened = { type: 'page-opened', url: location.href, domain };
    const reply = await send<PageOpenedReply>(opened).catch(() => null);
    if (!reply) return;

    // L0 alert: a company on the map is affected by a breach; this is its own site.
    if (reply.banner) showBanner(reply.banner);

    // P1: record a payment when a form with a payment field is submitted. The message is sent
    // synchronously, before the page moves on, so the logo hashes are computed in advance.
    let logos: string[] = [];
    void logoHashes().then((h) => (logos = h));
    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target as HTMLFormElement;
        if (paymentFields(form).length === 0) return;
        void send({ type: 'payment-submitted', domain, company: companyName(), hosts: loadedHosts(), logoHashes: logos });
      },
      true,
    );

    // P1: read the payment details shown after the payment.
    if (reply.capture) await send({ type: 'payment-details', domain, details: paymentDetails() });

    // L0 passed: nothing more to check on this domain.
    if (!reply.watch) return;

    // L1: check now, then each time a payment field appears. The fields are held while L2 and L3 run.
    let reported = false;
    const check = async () => {
      if (reported) return;
      const fields = paymentFields();
      const field = fields[0];
      if (!field) return;
      reported = true;
      observer.disconnect();
      lock(fields, true);
      const verdict = await send<PaymentFieldReply>({ type: 'payment-field', domain, signals: await pageSignals(field) }).catch(
        () => null,
      );
      if (verdict?.outcome !== 'alert' || !verdict.alert) return lock(fields, false);

      // L3 alert: keep the fields held, and explain when the user reaches for them (or straight away).
      const alert = verdict.alert;
      let shown = false;
      const reveal = () => {
        if (shown) return;
        shown = true;
        showAlert(alert, () => lock(fields, false));
      };
      fields.forEach((f) => f.addEventListener('focus', reveal, { once: true }));
      if (fields.includes(document.activeElement as HTMLInputElement)) reveal();
    };
    const observer = new MutationObserver(() => void check());
    if (paymentFields().length === 0) await send({ type: 'no-payment-field', domain });
    else await check();
    if (!reported) observer.observe(document.body, { childList: true, subtree: true });
  },
});
