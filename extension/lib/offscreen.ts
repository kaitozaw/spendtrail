// Creates the offscreen document on demand, sends it one request, then closes it, so anything it
// loaded (the model) is freed. Requests run one at a time, so one request never closes the document
// while another is still using it.
import type { ToOffscreen } from './messages';

const OFFSCREEN_PATH = 'offscreen.html';
let queue: Promise<unknown> = Promise.resolve();

async function ensureDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'Runs the on-device model only while a check needs an answer.',
  });
}

async function run<T>(message: ToOffscreen): Promise<T> {
  await ensureDocument();
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } finally {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

export function askOffscreen<T>(message: ToOffscreen): Promise<T> {
  const next = queue.then(() => run<T>(message));
  queue = next.catch(() => {});
  return next;
}
