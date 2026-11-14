import type { CheckNow, ClearData } from '../../lib/messages';

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
