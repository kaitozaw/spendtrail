// The offscreen document runs the model for L3. The service worker creates it for one request
// and closes it afterwards, which frees everything the model used.
import type { OffscreenReply, ToOffscreen } from '../../lib/messages';
import { isModelCached, Model } from '../../lib/model';

async function handle(message: ToOffscreen): Promise<OffscreenReply> {
  if (message.type === 'ping') return { ok: true };

  if (message.type === 'prepare') {
    if (await isModelCached(message.modelId)) return { ok: true, downloaded: false };
    const model = await Model.load(message.modelId);
    await model.unload();
    return { ok: true, downloaded: true };
  }

  // extract-payee
  const t0 = performance.now();
  const model = await Model.load(message.modelId);
  const loadMs = performance.now() - t0;
  try {
    const t1 = performance.now();
    const { payee = '' } = await model.extract('page_payee', message.input);
    return { ok: true, payee, loadMs, answerMs: performance.now() - t1 };
  } finally {
    await model.unload();
  }
}

chrome.runtime.onMessage.addListener((message: ToOffscreen, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  handle(message)
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: (e as Error).message } satisfies OffscreenReply));
  return true; // reply asynchronously
});
