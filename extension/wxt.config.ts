import { readFileSync } from 'node:fs';
import { defineConfig } from 'wxt';

// The public key fixes the extension ID, so Native Messaging can allow it by ID.
const { key } = JSON.parse(readFileSync(new URL('./extension-key.json', import.meta.url), 'utf8'));

export default defineConfig({
  manifest: {
    name: 'Spendtrail',
    description: 'Protects your payments when a company you pay is breached. Runs entirely on your device.',
    key,
    permissions: ['storage', 'alarms', 'offscreen', 'nativeMessaging', 'notifications'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Spendtrail' },
    // WebLLM runs the model with WebAssembly and WebGPU.
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" },
  },
});
