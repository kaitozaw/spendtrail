import {
  logMap,
  onCheckNews,
  onClearData,
  onFeedDemoData,
  onNoPaymentField,
  onPageOpened,
  onPaymentDetails,
  onPaymentField,
  onPaymentSubmitted,
  prepareModel,
} from '../lib/agent';
import { logCounters } from '../lib/counters';
import { siteOf } from '../lib/domain';
import { log } from '../lib/log';
import type { ToServiceWorker } from '../lib/messages';

const NEWS_ALARM = 'news';
const NEWS_PERIOD_MINUTES = 6 * 60;

export default defineBackground(() => {
  log('agent', 'Spendtrail agent started. Runs on this device; nothing about you leaves it.');
  void logMap().then(logCounters);
  void prepareModel();

  // P2: check the news every 6 hours, and when the user clicks Check now.
  void chrome.alarms.get(NEWS_ALARM).then((alarm) => {
    if (!alarm) void chrome.alarms.create(NEWS_ALARM, { periodInMinutes: NEWS_PERIOD_MINUTES });
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === NEWS_ALARM) void onCheckNews('scheduled');
  });

  chrome.runtime.onMessage.addListener((received: ToServiceWorker, sender, sendResponse) => {
    // Checks and the map work per site: www.qantas.com and book.qantas.com are both qantas.com.
    const message = ('domain' in received ? { ...received, domain: siteOf(received.domain) } : received) as ToServiceWorker;
    const tabId = sender.tab?.id;
    switch (message.type) {
      case 'page-opened':
        if (tabId === undefined) return false;
        onPageOpened(tabId, message.domain).then(sendResponse);
        return true; // reply asynchronously
      case 'no-payment-field':
        onNoPaymentField(message.domain);
        break;
      case 'payment-field':
        onPaymentField(message).then(sendResponse);
        return true; // reply asynchronously
      case 'payment-submitted':
        void onPaymentSubmitted(message);
        break;
      case 'payment-details':
        void onPaymentDetails(message);
        break;
      case 'check-now':
        void onCheckNews('Check now');
        break;
      case 'clear-data':
        void onClearData();
        break;
      case 'feed-demo-data':
        void onFeedDemoData();
        break;
    }
    sendResponse(undefined);
    return false;
  });
});
