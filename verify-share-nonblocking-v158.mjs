import fs from 'node:fs';

const source = fs.readFileSync(new URL('./fast-actions-v143.js', import.meta.url), 'utf8');

const required = [
  "shareButton.textContent = 'Share / QR'",
  "url.searchParams.set('p', ids.join('.'))",
  "if (!dialog.open) dialog.showModal()",
  "shareButton.textContent = 'Preparing…'",
  "shareButton.disabled = false",
  "shareButton.textContent = 'Share / QR'",
  "loadScript('./qr-share-v1.js?v=158', 'qr-share')",
  "load timed out",
];

for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`Missing share contract: ${needle}`);
}

if (source.includes("await loadScript('./compact-share.js?v=143'")) {
  throw new Error('Sender flow must not wait on compact-share before opening the share dialog');
}

console.log('share non-blocking v1.5.8 contract ok');
