// The agent's logic in the service worker: page checks (P3), recording payments (P1) and the log (P6).
import { domainCheck, impersonationCheckRule, type Signal } from './checks';
import { counters, logCounters } from './counters';
import { log } from './log';
import { nameMatches, possessive } from './names';
import { checkNews, notificationText } from './newscheck';
import type { OffscreenReply, PageOpenedReply, PaymentDetailsFound, PaymentField, PaymentFieldReply, PaymentSubmitted } from './messages';
import { MODEL_ID, MODEL_NAME, MODEL_SIZE_MB } from './modelinfo';
import { askOffscreen } from './offscreen';
import { affectedBy, clearAll, getIncidents, getMap, saveMapEntry } from './storage';
import { KIND_LABEL, systemsFromHosts } from './systems';
import type { CheckResult, Incident, Level, MapEntry, Outcome, PageSignals } from './types';
import type { AlertInfo, BannerInfo } from './ui';

const LEVEL_NAME: Record<Level, string> = {
  L0: 'L0 domain_check',
  L1: 'L1 payment_check',
  L2: 'L2 impersonation_check_rule',
  L3: 'L3 impersonation_check_llm',
};
const CAPTURE_WINDOW_MS = 2 * 60 * 1000;

// Memory only: results last while the user stays on a domain, and are cleared when a breach is detected.
const results = new Map<string, CheckResult>();
const tabDomain = new Map<number, string>();
const pendingCapture = new Map<string, number>();
const loggedNoField = new Set<string>();
const banners = new Map<string, BannerInfo>();
const alerts = new Map<string, AlertInfo>();

function step(level: Level, text: string) {
  log('check', `  ${LEVEL_NAME[level].padEnd(30)}${text}`);
}

function finish(domain: string, level: Level, outcome: Outcome, company: string | null) {
  results.set(domain, { domain, ended_at: level, outcome, company, checked_at: new Date().toISOString() });
  logCounters();
}

/** Called when a new breach is detected: every domain is checked again. */
export function clearResults() {
  results.clear();
  loggedNoField.clear();
  banners.clear();
  alerts.clear();
  tabDomain.clear();
}

const systemsText = (e: MapEntry) =>
  e.systems.length ? e.systems.map((s) => `${s.name} (${KIND_LABEL[s.kind]})`).join(', ') : 'no known systems';

export async function logMap() {
  const [map, incidents] = await Promise.all([getMap(), getIncidents()]);
  log('map', `Mia's map: ${map.length} ${map.length === 1 ? 'company' : 'companies'}`);
  for (const e of map) {
    const incident = affectedBy(e, incidents);
    log('map', `  ${e.company.padEnd(26)}→ ${systemsText(e)}${incident ? `   [affected: ${incident.target} breach]` : ''}`);
  }
}

/** L0 runs when the tab opens a new domain. The reply tells the content script whether to watch for payment fields. */
export async function onPageOpened(tabId: number, domain: string): Promise<PageOpenedReply> {
  const captureAt = pendingCapture.get(domain);
  const capture = !!captureAt && Date.now() - captureAt < CAPTURE_WINDOW_MS;
  if (capture) pendingCapture.delete(domain);

  if (tabDomain.get(tabId) === domain) return { watch: !results.has(domain), capture, banner: banners.get(domain) };
  tabDomain.set(tabId, domain);
  loggedNoField.delete(domain);

  log('page', `▶ ${domain}`);
  const l0 = domainCheck(domain, await getMap(), await getIncidents());
  if (l0.outcome === 'pass') {
    step('L0', `in transaction history (${l0.entry.company}), not affected → pass`);
    finish(domain, 'L0', 'pass', l0.entry.company);
    return { watch: false, capture };
  }
  if (l0.outcome === 'pass_with_alert') {
    step('L0', `in transaction history (${l0.entry.company}), affected by ${l0.incident.target} breach → pass with alert`);
    finish(domain, 'L0', 'pass_with_alert', l0.entry.company);
    const system = l0.entry.systems.find((s) => s.name === l0.incident.target);
    const banner: BannerInfo = {
      company: l0.entry.company,
      target: l0.incident.target,
      via: system ? KIND_LABEL[system.kind] : null,
      source: l0.incident.article.source,
      date: new Date(l0.incident.article.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    };
    banners.set(domain, banner);
    log('alert', `  banner shown on ${domain}: ${possessive(banner.company)} ${banner.via ?? 'company'} ${banner.target} was breached`);
    return { watch: false, capture, banner };
  }
  results.delete(domain);
  step('L0', 'not in transaction history → L1');
  return { watch: true, capture };
}

export function onNoPaymentField(domain: string) {
  if (loggedNoField.has(domain)) return;
  loggedNoField.add(domain);
  step('L1', 'no card or bank transfer field → pass');
  logCounters();
}

/** L1 found a payment field: run L2, and L3 when L2 asks for it. */
export async function onPaymentField(message: PaymentField): Promise<PaymentFieldReply> {
  const { domain, signals } = message;
  const known = results.get(domain);
  if (known) return { outcome: known.outcome === 'alert' ? 'alert' : 'pass', alert: alerts.get(domain) };
  step('L1', 'card or bank transfer field found → L2');
  const l2 = impersonationCheckRule(signals, await getMap(), await getIncidents());
  const via = (s: Signal[]) => s.join(', ');
  if (l2.outcome === 'pass' && l2.reason === 'no company in the transaction history') {
    step('L2', 'does not present itself as a company in the transaction history → pass');
    finish(domain, 'L2', 'pass', null);
    return { outcome: 'pass' };
  }
  if (l2.outcome === 'pass') {
    step('L2', `presents itself as ${l2.entry.company} (${via(l2.signals)}), not affected → pass`);
    finish(domain, 'L2', 'pass', l2.entry.company);
    return { outcome: 'pass' };
  }
  step('L2', `presents itself as ${l2.entry.company} (${via(l2.signals)}), affected by ${l2.incident.target} breach → L3`);
  return impersonationCheckLlm(domain, signals, l2.entry, l2.incident);
}

/** L3 impersonation_check_llm: the model names the business taking the payment; a rule decides. */
async function impersonationCheckLlm(domain: string, signals: PageSignals, entry: MapEntry, incident: Incident): Promise<PaymentFieldReply> {
  const input = { company: entry.company, domain, title: signals.title, text: signals.nearText };
  counters.model_calls++;
  counters.model_loaded = true;
  counters.model_size_mb = MODEL_SIZE_MB;
  step('L3', `loading ${MODEL_NAME} (${MODEL_SIZE_MB} MB) to read the payment form…`);
  let reply: OffscreenReply;
  try {
    reply = await askOffscreen<OffscreenReply>({ target: 'offscreen', type: 'extract-payee', modelId: MODEL_ID, input });
  } catch (e) {
    reply = { ok: false, error: (e as Error).message };
  }
  counters.model_loaded = false;

  let impersonation: boolean;
  if (reply.ok) {
    impersonation = nameMatches(entry.company, reply.payee ?? '');
    step(
      'L3',
      `model named the business taking the payment: "${reply.payee}" (${Math.round(reply.answerMs ?? 0)} ms), model unloaded`,
    );
    step(
      'L3',
      impersonation
        ? `"${reply.payee}" is ${entry.company}, but ${domain} is not ${possessive(entry.company)} domain → impersonation → alert`
        : `"${reply.payee}" is not ${entry.company} → not an impersonation → pass`,
    );
  } else {
    impersonation = true; // a failure leads to a warning rather than a missed one
    step('L3', `model unavailable (${reply.error}) → alert`);
  }

  if (!impersonation) {
    finish(domain, 'L3', 'pass', entry.company);
    return { outcome: 'pass' };
  }
  const system = entry.systems.find((s) => s.name === incident.target);
  const alert: AlertInfo = {
    company: entry.company,
    companyDomain: entry.domain,
    target: incident.target,
    via: system ? KIND_LABEL[system.kind] : null,
    article: {
      title: incident.article.title,
      source: incident.article.source,
      date: new Date(incident.article.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
    pageDomain: domain,
  };
  alerts.set(domain, alert);
  log('alert', `  alert shown on ${domain}: payment form held`);
  finish(domain, 'L3', 'alert', entry.company);
  return { outcome: 'alert', alert };
}

/** P1: record the payment on the map. */
export async function onPaymentSubmitted(message: PaymentSubmitted) {
  // Set before any await: the confirmation page can open while this payment is still being recorded.
  pendingCapture.set(message.domain, Date.now());
  const now = new Date().toISOString();
  const existing = (await getMap()).find((e) => e.domain === message.domain);
  const entry: MapEntry = {
    company: existing?.company ?? message.company,
    domain: message.domain,
    systems: systemsFromHosts(message.hosts),
    logo_hashes: [...new Set([...(existing?.logo_hashes ?? []), ...message.logoHashes])],
    payment_details: existing?.payment_details ?? [],
    first_paid_at: existing?.first_paid_at ?? now,
    last_paid_at: now,
  };
  await saveMapEntry(entry);
  log('map', `${existing ? 'updated' : 'added'} ${entry.company} (${entry.domain}) → ${systemsText(entry)}`);
}

export async function onPaymentDetails(message: PaymentDetailsFound) {
  const { details } = message;
  if (!details.reference && !details.dates && !details.place) return;
  const entry = (await getMap()).find((e) => e.domain === message.domain);
  if (!entry) return;
  const same = (d: typeof details) => d.reference === details.reference && d.dates === details.dates && d.place === details.place;
  if (entry.payment_details.some(same)) return;
  entry.payment_details = [...entry.payment_details, details];
  await saveMapEntry(entry);
  const parts = [details.reference && `reference ${details.reference}`, details.dates, details.place].filter(Boolean);
  log('map', `  ${entry.company}: payment details ${parts.join(', ')}`);
}

/** P2 then P3 reset: check the news, and on a new incident notify the user and recheck every domain. */
export async function onCheckNews(trigger: string) {
  const created = await checkNews(trigger);
  if (created.length === 0) return;
  clearResults();
  for (const { incident, affected } of created) {
    for (const entry of affected) {
      const { title, message } = notificationText(incident, entry);
      chrome.notifications.create(`spendtrail-${incident.target}-${entry.domain}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon/128.png'),
        title,
        message,
        priority: 2,
      });
      log('alert', `  notification: ${title}`);
    }
  }
  await logMap();
}

/** Downloads the model once at startup, so the first L3 check does not wait for the download. */
export async function prepareModel() {
  try {
    const reply = await askOffscreen<OffscreenReply>({ target: 'offscreen', type: 'prepare', modelId: MODEL_ID });
    if (reply.downloaded) log('model', `downloaded ${MODEL_NAME} (${MODEL_SIZE_MB} MB) once; it stays unloaded until a check needs it`);
    else if (!reply.ok) log('model', `could not prepare ${MODEL_NAME}: ${reply.error}`);
  } catch (e) {
    log('model', `could not prepare ${MODEL_NAME}: ${(e as Error).message}`);
  }
}

export async function onClearData() {
  await clearAll();
  clearResults();
  counters.model_calls = 0;
  counters.personal_data_sent_bytes = 0;
  log('agent', 'agent data cleared');
  await logMap();
}
