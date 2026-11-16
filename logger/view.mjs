// Shows the agent log in the terminal as it is written. Run: npm run logger
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, watch, writeFileSync } from 'node:fs';
import { LOG_DIR, LOG_FILE } from './paths.mjs';

const C = { dim: '\x1b[2m', reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m', yellow: '\x1b[33m', green: '\x1b[32m', red: '\x1b[31m', gray: '\x1b[90m' };
const KIND_COLOR = { agent: C.gray, page: C.cyan, check: C.blue, news: C.magenta, model: C.yellow, map: C.green, alert: C.red };
const LEVEL_COLOR = { L0: '\x1b[1;92m', L1: '\x1b[1;96m', L2: '\x1b[1;94m', L3: '\x1b[1;93m' };
const INDENT = ' '.repeat(10);
// The map and the news check are shown in the extension's DevTools, not in the terminal.
const HIDDEN = new Set(['map', 'news']);

mkdirSync(LOG_DIR, { recursive: true });
if (process.argv.includes('--clear') || !existsSync(LOG_FILE)) writeFileSync(LOG_FILE, '');

console.log(`${C.bold}Spendtrail agent log${C.reset} ${C.dim}(${LOG_FILE})${C.reset}\n`);

function render(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  if (HIDDEN.has(entry.kind)) return;
  const time = new Date(entry.time).toLocaleTimeString('en-AU', { hour12: false });
  // A check: the level name in its colour, then the result on the next line.
  if (entry.kind === 'check' && entry.data?.level) {
    console.log(`${C.dim}${time}${C.reset}  ${LEVEL_COLOR[entry.data.level] ?? ''}${entry.data.name}${C.reset}`);
    console.log(`${INDENT}${entry.text}`);
    return;
  }
  const color = KIND_COLOR[entry.kind] ?? '';
  console.log(`${C.dim}${time}${C.reset}  ${color}${entry.kind.padEnd(8)}${C.reset} ${entry.text}`);
}

let offset = process.argv.includes('--from-start') ? 0 : statSync(LOG_FILE).size;
let partial = '';
function readNew() {
  const size = statSync(LOG_FILE).size;
  if (size < offset) offset = 0; // file was cleared
  if (size === offset) return;
  const fd = openSync(LOG_FILE, 'r');
  const buf = Buffer.alloc(size - offset);
  readSync(fd, buf, 0, buf.length, offset);
  closeSync(fd);
  offset = size;
  const lines = (partial + buf.toString('utf8')).split('\n');
  partial = lines.pop() ?? '';
  lines.filter(Boolean).forEach(render);
}

readNew();
watch(LOG_FILE, readNew);
setInterval(readNew, 200); // fs.watch can miss events on some filesystems
