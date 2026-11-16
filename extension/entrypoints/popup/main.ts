import type { CheckNow, ClearData, FeedDemoData } from '../../lib/messages';

// For the demo: adds Kaito's earlier Qantas and Booking.com bookings to the map.
document.getElementById('feed-demo-data')!.addEventListener('click', async () => {
  const message: FeedDemoData = { type: 'feed-demo-data' };
  await chrome.runtime.sendMessage(message);
  window.close();
});

document.getElementById('check-now')!.addEventListener('click', async () => {
  const message: CheckNow = { type: 'check-now' };
  await chrome.runtime.sendMessage(message);
  window.close();
});

// For rehearsals: empties the map and incidents on this device.
document.getElementById('clear-data')!.addEventListener('click', async () => {
  const message: ClearData = { type: 'clear-data' };
  await chrome.runtime.sendMessage(message);
  window.close();
});
