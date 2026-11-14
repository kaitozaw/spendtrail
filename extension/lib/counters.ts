// Counters shown in the terminal, kept in the service worker's memory.
import { log } from './log';

export const counters = {
  model_calls: 0,
  personal_data_sent_bytes: 0,
  model_loaded: false,
  model_size_mb: 0,
};

export function logCounters() {
  log(
    'counters',
    `model calls ${counters.model_calls} · personal data sent ${counters.personal_data_sent_bytes} B · model ${counters.model_loaded ? `loaded (${counters.model_size_mb} MB)` : 'not loaded'}`,
    { ...counters },
  );
}

/**
 * Every request the extension makes goes through here. It adds up the size of each request body
 * and query string, the only places a request could carry data about the user.
 */
export async function trackedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const query = new URL(url).search;
  const body = typeof init.body === 'string' ? init.body : init.body ? JSON.stringify(init.body) : '';
  counters.personal_data_sent_bytes += new TextEncoder().encode(query.replace(/^\?/, '') + body).length;
  return fetch(url, init);
}
