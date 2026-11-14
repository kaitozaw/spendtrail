// Runs in the content script: reads the page for the checks and for recording a payment.
import type { PageDetails } from './messages';
import type { PageSignals } from './types';

const PAYMENT_AUTOCOMPLETE = ['cc-number', 'cc-exp', 'cc-csc', 'cc-name'];
const PAYMENT_NAME = /card.?number|cardnum|\bcc.?num|\bcvv\b|\bcvc\b|\bbsb\b|account.?number/i;

/** L1: card or bank transfer fields on the page. */
export function paymentFields(root: ParentNode = document): HTMLInputElement[] {
  return [...root.querySelectorAll('input')].filter((input) => {
    const ac = (input.getAttribute('autocomplete') ?? '').toLowerCase();
    if (PAYMENT_AUTOCOMPLETE.some((t) => ac.includes(t))) return true;
    const label = input.closest('label')?.textContent ?? '';
    return PAYMENT_NAME.test(`${input.name} ${input.id} ${input.placeholder} ${label}`);
  });
}

export function siteName(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content?.trim() || null;
}

export function companyName(): string {
  return siteName() ?? document.title.split(/[–|-]/).pop()!.trim();
}

/** Hosts of the iframes and scripts the page loads from other domains. */
export function loadedHosts(): string[] {
  const hosts = new Set<string>();
  for (const el of document.querySelectorAll<HTMLIFrameElement | HTMLScriptElement>('iframe[src], script[src]')) {
    try {
      const host = new URL(el.src, location.href).hostname;
      if (host && host !== location.hostname) hosts.add(host);
    } catch {
      /* ignore invalid URLs */
    }
  }
  return [...hosts];
}

/** 64-bit difference hash of an image, as 16 hex digits. Null if the image cannot be read. */
async function dHash(img: HTMLImageElement): Promise<string | null> {
  try {
    if (!img.complete) await new Promise((r) => img.addEventListener('load', r, { once: true }));
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 9, 8);
    const px = ctx.getImageData(0, 0, 9, 8).data;
    const gray = (x: number, y: number) => {
      const i = (y * 9 + x) * 4;
      return px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114;
    };
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray(x, y) > gray(x + 1, y) ? '1' : '0';
    return bits.match(/.{4}/g)!.map((b) => parseInt(b, 2).toString(16)).join('');
  } catch {
    return null; // cross-origin images cannot be read
  }
}

/** Hashes of images in the page header whose source, alt text or class mentions a logo. */
export async function logoHashes(): Promise<string[]> {
  const imgs = [...document.querySelectorAll<HTMLImageElement>('header img, img')].filter((img) =>
    /logo/i.test(`${img.src} ${img.alt} ${img.className}`),
  );
  const hashes = await Promise.all(imgs.slice(0, 3).map(dHash));
  return [...new Set(hashes.filter((h): h is string => !!h))];
}

/** Text around the payment form: the nearest container that holds the form and some context. */
function nearText(field: HTMLElement): string {
  let el: HTMLElement | null = field.closest('form') ?? field;
  while (el && el.parentElement && (el.innerText ?? '').length < 400) el = el.parentElement;
  return (el?.innerText ?? '').slice(0, 1500);
}

export async function pageSignals(field: HTMLElement): Promise<PageSignals> {
  return {
    title: document.title,
    siteName: siteName(),
    nearText: nearText(field),
    pageText: document.body.innerText.slice(0, 8000),
    logoHashes: await logoHashes(),
  };
}

/** Payment details shown after a payment, read by label (P1). */
export function paymentDetails(): PageDetails {
  const text = document.body.innerText;
  const reference =
    text.match(/(?:booking reference|order number|booking number|reference|order|booking)\s*[:#]?\s*\n?\s*([A-Z]{2,4}-?\d{3,})/i)?.[1] ??
    null;
  const dates = text.match(/\b(\d{1,2}\s*[–-]\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)/)?.[1] ?? null;
  const place = text.match(/\b([A-Z][a-z]+)\s+(?:NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/)?.[1] ?? null;
  return { reference, dates: dates?.replace(/\s*[–-]\s*/, '–') ?? null, place };
}
