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

/** Hosts of everything the page loaded from other domains: iframes, scripts, images and requests. */
export function loadedHosts(): string[] {
  const urls = [
    ...[...document.querySelectorAll<HTMLIFrameElement | HTMLScriptElement | HTMLImageElement>('iframe[src], script[src], img[src]')].map((el) => el.src),
    ...performance.getEntriesByType('resource').map((e) => e.name),
  ];
  const hosts = new Set<string>();
  for (const url of urls) {
    try {
      const host = new URL(url, location.href).hostname;
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

const NOT_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SELECT']);
const NEAR_BEFORE = 600;
const NEAR_AFTER = 900;

/** Visible text of a node, without the options of drop-down lists (country codes, months). */
function visibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim();
  if (!(node instanceof HTMLElement) || NOT_TEXT.has(node.tagName)) return '';
  // innerText of an element that is not rendered (a script, a closed dialog) is its raw text, so skip it.
  // Wrappers with display: contents have no box but are rendered, so they are kept.
  const display = getComputedStyle(node).display;
  if (display === 'none' || (display !== 'contents' && node.getClientRects().length === 0)) return '';
  const options = new Set([...node.querySelectorAll('option')].map((o) => (o.textContent ?? '').trim()));
  return (node.innerText ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !options.has(l))
    .join('\n');
}

/**
 * Text around the payment field: what comes just before it and just after it on the page.
 * Measured from the field itself, because some checkouts wrap the whole page in one form.
 */
function nearText(field: HTMLElement): string {
  const before: string[] = [];
  const after: string[] = [];
  let node: Node = field;
  while (node.parentNode && node !== document.body) {
    const parent: Node = node.parentNode;
    const b: string[] = [];
    let seen = false;
    for (const child of parent.childNodes) {
      if (child === node) {
        seen = true;
        continue;
      }
      const text = visibleText(child);
      if (text) (seen ? after : b).push(text);
    }
    before.unshift(...b);
    node = parent;
  }
  return [before.join('\n').slice(-NEAR_BEFORE), after.join('\n').slice(0, NEAR_AFTER)].filter(Boolean).join('\n');
}

/** The name the site gives itself: og:site_name, otherwise the alt text of its logo ("expedia"). */
function brand(): string | null {
  const logo = [...document.querySelectorAll<HTMLImageElement>('img')].find((img) => /logo/i.test(`${img.src} ${img.alt} ${img.className}`));
  const alt = logo?.alt.replace(/\blogo\b/gi, '').trim();
  return siteName() ?? (alt || null);
}

export async function pageSignals(field: HTMLElement): Promise<PageSignals> {
  return {
    title: document.title,
    siteName: siteName(),
    brand: brand(),
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
