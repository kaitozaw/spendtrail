// Samples the memory of the user's Chrome on macOS: its extension processes and its GPU process,
// where WebGPU keeps the model while it runs. Uses `footprint`, the same measure as Activity Monitor,
// which includes graphics memory. Other Chrome instances (for example headless test browsers) are ignored.
import { execFileSync } from 'node:child_process';

function processes() {
  const out = execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8', maxBuffer: 1e7 });
  const rows = out
    .split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, command]) => ({ pid, ppid, command }));
  // SPENDTRAIL_MEMORY_HEADLESS=1 measures a headless Chrome instead, for automated tests.
  const headless = process.env.SPENDTRAIL_MEMORY_HEADLESS === '1';
  const browser = rows.find(
    (r) => r.command.startsWith('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') && r.command.includes('--headless') === headless,
  );
  if (!browser) return null;
  const children = rows.filter((r) => r.ppid === browser.pid);
  return {
    gpu: children.filter((r) => r.command.includes('--type=gpu-process')).map((r) => r.pid),
    extensions: children.filter((r) => r.command.includes('--type=renderer') && r.command.includes('--extension-process')).map((r) => r.pid),
  };
}

function footprintMb(pids) {
  if (pids.length === 0) return {};
  const out = execFileSync('footprint', pids.flatMap((p) => ['-p', p]), { encoding: 'utf8' });
  const result = {};
  for (const [, pid, value, unit] of out.matchAll(/\[(\d+)\].*?Footprint: ([\d.]+) (KB|MB|GB)/g)) {
    result[pid] = Number(value) * (unit === 'GB' ? 1024 : unit === 'KB' ? 1 / 1024 : 1);
  }
  return result;
}

/** One sample in MB, or null if Chrome is not running. */
export function sample() {
  try {
    const p = processes();
    if (!p) return null;
    const mb = footprintMb([...p.gpu, ...p.extensions]);
    const sum = (pids) => Math.round(pids.reduce((t, pid) => t + (mb[pid] ?? 0), 0));
    return { extensions: sum(p.extensions), extensionCount: p.extensions.length, gpu: sum(p.gpu) };
  } catch {
    return null;
  }
}
