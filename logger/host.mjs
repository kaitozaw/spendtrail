// Native Messaging host. Chrome starts this process and talks to it over stdin/stdout,
// so it cannot print to a terminal itself. It appends each message as one JSON line to the
// agent log, which `npm run logger` (view.mjs) displays. Local only, no network.
import { appendFileSync, mkdirSync } from 'node:fs';
import { LOG_DIR, LOG_FILE } from './paths.mjs';

mkdirSync(LOG_DIR, { recursive: true });

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  // Each message: 4-byte little-endian length, then UTF-8 JSON.
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < 4 + length) break;
    const json = buffer.subarray(4, 4 + length).toString('utf8');
    buffer = buffer.subarray(4 + length);
    appendFileSync(LOG_FILE, json + '\n');
  }
});
process.stdin.on('end', () => process.exit(0));
