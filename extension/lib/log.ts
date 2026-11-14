// Sends log lines to the terminal logger through Chrome Native Messaging (local, no network).
// Falls back to the service worker console when the logger is not installed.

export const NATIVE_HOST = 'com.spendtrail.logger';

export type LogKind = 'agent' | 'page' | 'check' | 'news' | 'model' | 'map' | 'alert' | 'counters';
export type LogLine = { time: string; kind: LogKind; text: string; data?: unknown };

let port: chrome.runtime.Port | null = null;

function connect(): chrome.runtime.Port | null {
  try {
    const p = chrome.runtime.connectNative(NATIVE_HOST);
    p.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) console.warn('[spendtrail] logger disconnected:', chrome.runtime.lastError.message);
      port = null;
    });
    return p;
  } catch (e) {
    console.warn('[spendtrail] logger unavailable:', e);
    return null;
  }
}

export function log(kind: LogKind, text: string, data?: unknown) {
  const line: LogLine = { time: new Date().toISOString(), kind, text, data };
  console.log(`[spendtrail] ${kind}: ${text}`);
  port ??= connect();
  try {
    port?.postMessage(line);
  } catch {
    port = null;
  }
}
