// Registers the Native Messaging host with Google Chrome on macOS.
// The host files are copied to ~/.spendtrail/host, outside the project, because macOS privacy
// controls can stop Chrome from starting programs inside ~/Documents. host.sh pins the absolute
// node path, since Chrome starts hosts with a minimal PATH. The manifest allows only the
// Spendtrail extension ID. Pass --profile <dir> to also register for a custom Chrome profile.
import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_NAME, LOG_DIR } from './paths.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { id } = JSON.parse(readFileSync(join(here, '../extension/extension-key.json'), 'utf8'));

const hostDir = join(LOG_DIR, 'host');
mkdirSync(hostDir, { recursive: true });
for (const file of ['host.mjs', 'paths.mjs']) copyFileSync(join(here, file), join(hostDir, file));

const hostScript = join(hostDir, 'host.sh');
writeFileSync(
  hostScript,
  `#!/bin/sh\nexec "${process.execPath}" "${join(hostDir, 'host.mjs')}" 2>>"${join(LOG_DIR, 'host-error.log')}"\n`,
);
chmodSync(hostScript, 0o755);

const manifest =
  JSON.stringify(
    { name: HOST_NAME, description: 'Spendtrail terminal logger', path: hostScript, type: 'stdio', allowed_origins: [`chrome-extension://${id}/`] },
    null,
    2,
  ) + '\n';

const profileArg = process.argv.indexOf('--profile');
const manifestDirs = [join(homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts')];
if (profileArg > -1) manifestDirs.push(join(process.argv[profileArg + 1], 'NativeMessagingHosts'));

for (const dir of manifestDirs) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${HOST_NAME}.json`), manifest);
  console.log(`Registered ${HOST_NAME} in ${dir}`);
}
console.log(`  extension: ${id}`);
console.log(`  host:      ${hostScript}`);
console.log('Restart Chrome if it was already running.');
