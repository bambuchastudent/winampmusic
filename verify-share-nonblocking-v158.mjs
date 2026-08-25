import fs from 'node:fs';

const source = fs.readFileSync(new URL('./fast-actions-v143.js', import.meta.url), 'utf8');

const required = [
  "shareButton.textContent = 'Share / QR'",
  "shareButton.textContent = 'Preparing…'",
  "shareButton.disabled = false",
  "loadScript('./compact-share.js?v=160', 'compact-share')",
  "window.winampMusicCompactShare?.share",
  "loadScript('./qr-share-v1.js?v=160', 'qr-share')",
  "params.has('a')",
  "load timed out",
];

for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`Missing Ámpula share contract: ${needle}`);
}

if (source.includes("searchParams.set('p'")) throw new Error('Legacy provider-ID share fallback must not return');
if (source.includes('pastepile')) throw new Error('Fast sender must not require a remote paste service');

console.log('lazy Ámpula v1 share contract ok');
