// Alerts shown on the page by the content script, inside a shadow root so the page's styles do not apply.

import { possessive } from './names';

export type BannerInfo = { company: string; target: string; via: string | null; source: string; date: string };

const BASE_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
`;

function host(id: string): ShadowRoot {
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:2147483647;';
  document.documentElement.appendChild(el);
  return el.attachShadow({ mode: 'open' });
}

export type AlertInfo = {
  company: string;
  companyDomain: string;
  target: string;
  via: string | null;
  article: { title: string; source: string; date: string };
  pageDomain: string;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * L3 alert: holds the payment form and explains why. The fields stay locked until the user leaves
 * or chooses to continue.
 */
export function showAlert(info: AlertInfo, onContinue: () => void) {
  const root = host('spendtrail-alert');
  (root.host as HTMLElement).style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  const system = info.via ? `${possessive(info.company)} ${info.via}` : info.company;
  root.innerHTML = `
    <style>${BASE_CSS}
      .backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.55); display: grid; place-items: center; padding: 16px; }
      .card { width: 100%; max-width: 560px; background: #fff; border-radius: 16px; padding: 22px 24px; color: #0f172a; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
      .top { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
      .mark { width: 30px; height: 30px; border-radius: 8px; background: #dc2626; color: #fff; display: grid; place-items: center; font-weight: 700; }
      h1 { font-size: 18px; margin: 0; line-height: 1.3; }
      p { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #334155; }
      ol.chain { list-style: none; margin: 0 0 14px; padding: 0; }
      .chain li { position: relative; padding: 8px 12px 8px 34px; margin-bottom: 6px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.4; }
      .chain li::before { content: attr(data-n); position: absolute; left: 10px; top: 8px; width: 16px; height: 16px; border-radius: 50%; background: #e2e8f0; color: #475569; font-size: 11px; display: grid; place-items: center; font-weight: 700; }
      .chain li.bad { background: #fef2f2; border-color: #fecaca; }
      .chain li.bad::before { background: #dc2626; color: #fff; }
      .chain b { color: #0f172a; } .chain small { color: #64748b; }
      code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
      h2 { font-size: 13px; margin: 0 0 6px; color: #0f172a; }
      ul.next { margin: 0 0 18px; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #334155; }
      .actions { display: flex; gap: 10px; justify-content: flex-end; }
      button { border-radius: 10px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; border: 0; }
      .leave { background: #0f172a; color: #fff; }
      .continue { background: transparent; color: #64748b; border: 1px solid #cbd5e1; }
      .foot { margin-top: 12px; font-size: 11px; color: #94a3b8; text-align: right; }
    </style>
    <div class="backdrop">
      <div class="card" role="alertdialog" aria-labelledby="t">
        <div class="top"><div class="mark">!</div><h1 id="t">This page is not ${esc(info.company)}</h1></div>
        <p>It asks for your payment details as ${esc(info.company)}, while ${esc(info.company)} is affected by a reported breach. Scam pages often quote real bookings or orders at times like this.</p>
        <ol class="chain">
          <li data-n="1">You paid <b>${esc(info.company)}</b> at <code>${esc(info.companyDomain)}</code></li>
          <li data-n="2">${esc(system)} is <b>${esc(info.target)}</b></li>
          <li data-n="3"><b>${esc(info.target)}</b> was reported breached<br /><small>${esc(info.article.source)}, ${esc(info.article.date)}: ${esc(info.article.title)}</small></li>
          <li data-n="4" class="bad">This page, <code>${esc(info.pageDomain)}</code>, is not ${esc(possessive(info.company))} site</li>
        </ol>
        <h2>What to do</h2>
        <ul class="next">
          <li>Go to ${esc(info.company)} from your bookmark or by typing <code>${esc(info.companyDomain)}</code>.</li>
          <li>Check any payment request with ${esc(info.company)} through its official contact details.</li>
          <li>If you have already entered your card details, contact your card issuer.</li>
        </ul>
        <div class="actions">
          <button class="continue">I understand, continue</button>
          <button class="leave">Leave this page</button>
        </div>
        <div class="foot">Spendtrail · checked on this device · nothing was sent</div>
      </div>
    </div>`;
  root.querySelector('.leave')!.addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.replace('about:blank');
  });
  root.querySelector('.continue')!.addEventListener('click', () => {
    root.host.remove();
    onContinue();
  });
}

/** L0 alert: a banner at the top of the page. It does not block anything. */
export function showBanner(info: BannerInfo) {
  const root = host('spendtrail-banner');
  const what = info.via ? `${possessive(info.company)} ${info.via}, ${info.target},` : info.company;
  root.innerHTML = `
    <style>${BASE_CSS}
      .bar { display: flex; gap: 12px; align-items: flex-start; margin: 10px auto; max-width: 880px; padding: 12px 16px;
             background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; color: #78350f; font-size: 14px; line-height: 1.45;
             box-shadow: 0 6px 24px rgba(0,0,0,.12); }
      .mark { flex: none; width: 26px; height: 26px; border-radius: 7px; background: #4f46e5; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px; }
      b { color: #451a03; }
      .meta { color: #92400e; font-size: 12px; margin-top: 2px; }
      button { margin-left: auto; flex: none; border: 0; background: transparent; color: #92400e; font-size: 18px; cursor: pointer; line-height: 1; }
    </style>
    <div class="bar" role="status">
      <div class="mark">S</div>
      <div>
        <b>${what} was reported breached.</b> Payments on this site are fine.
        Be careful with messages that ask you to pay again or update your card details for ${info.company}.
        <div class="meta">Spendtrail · ${info.source}, ${info.date} · checked on this device</div>
      </div>
      <button aria-label="Dismiss">×</button>
    </div>`;
  root.querySelector('button')!.addEventListener('click', () => root.host.remove());
}
