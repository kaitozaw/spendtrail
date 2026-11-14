// Shows the agent log in the terminal as it is written, with Chrome's memory. Run: npm run logger
// Memory is sampled every second, and every 200 ms while the model runs, so the peak is caught.
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, watch, writeFileSync } from 'node:fs';
import { sample } from './memory.mjs';
import { LOG_DIR, LOG_FILE } from './paths.mjs';

const C = { dim: '\x1b[2m', reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m', yellow: '\x1b[33m', green: '\x1b[32m', red: '\x1b[31m', gray: '\x1b[90m' };
const KIND_COLOR = { agent: C.gray, page: C.cyan, check: C.blue, news: C.magenta, model: C.yellow, map: C.green, alert: C.red, counters: C.dim, memory: C.dim };

mkdirSync(LOG_DIR, { recursive: true });
if (process.argv.includes('--clear') || !existsSync(LOG_FILE)) writeFileSync(LOG_FILE, '');

console.log(`${C.bold}Spendtrail agent log${C.reset} ${C.dim}(${LOG_FILE})${C.reset}\n`);

// ---------- Memory ----------
let latest = sample();
let peakGpu = latest?.gpu ?? 0;
let modelRunning = false;
let fastTimer = null;

function takeSample() {
  const s = sample();
  if (!s) return;
  latest = s;
  if (modelRunning) peakGpu = Math.max(peakGpu, s.gpu);
}
setInterval(takeSample, 1000);

function startModelWatch() {
  modelRunning = true;
  peakGpu = latest?.gpu ?? 0;
  fastTimer ??= setInterval(takeSample, 200);
}
function stopModelWatch() {
  takeSample();
  modelRunning = false;
  clearInterval(fastTimer);
  fastTimer = null;
}

function memoryLine() {
  if (!latest) return `${C.dim}memory   Chrome not found${C.reset}`;
  const peak = peakGpu > latest.gpu + 20 ? ` (peak ${peakGpu} MB while the model ran)` : '';
  const ext = `${latest.extensions} MB in ${latest.extensionCount} extension process${latest.extensionCount === 1 ? '' : 'es'}`;
  return `${C.dim}${''.padEnd(10)}memory   ${ext} · GPU ${latest.gpu} MB${peak}${C.reset}`;
}

// ---------- Log ----------
function render(line) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  if (entry.kind === 'check' && entry.text.includes('loading ')) startModelWatch();
  if (entry.kind === 'check' && entry.text.includes('model unloaded')) stopModelWatch();
  if (entry.kind === 'check' && entry.text.includes('model unavailable')) stopModelWatch();

  const time = new Date(entry.time).toLocaleTimeString('en-AU', { hour12: false });
  const color = KIND_COLOR[entry.kind] ?? '';
  console.log(`${C.dim}${time}${C.reset}  ${color}${entry.kind.padEnd(8)}${C.reset} ${entry.text}`);
  if (entry.kind === 'counters') {
    takeSample();
    console.log(memoryLine());
    peakGpu = latest?.gpu ?? 0;
  }
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
