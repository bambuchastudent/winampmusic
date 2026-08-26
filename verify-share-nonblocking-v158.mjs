import fs from 'node:fs';

const source = fs.readFileSync(new URL('./fast-actions-v143.js', import.meta.url), 'utf8');

const required = [
  "shareButton.textContent = 'Share'",
  "shareButton.textContent = 'Preparing…'",
  "shareButton.disabled = false",
  "loadScript('./share-ui-cleanup-v162.js?v=162', 'share-ui-cleanup')",
  "loadScript('./compact-share.js?v=164', 'compact-share')",
  "window.winampMusicCompactShare?.share",
  "loadScript('./qr-share-v1.js?v=161', 'qr-share')",
  "loadScript('./legacy-share-v1.js?v=161', 'legacy-share')",
  "params.has('a')",
  "params.has('p')",
  "params.has('s')",
  "load timed out",
];

for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`Missing share contract: ${needle}`);
}

if (source.includes("searchParams.set('p'")) throw new Error('Legacy provider-ID share fallback must not return');
if (source.includes("searchParams.set('s'")) throw new Error('Legacy remote share generation must not return');
if (source.includes('pastepile')) throw new Error('Fast sender must not require a remote paste service');
if (source.includes('Open .ampula')) throw new Error('Primary toolbar must not market the file transport');

console.log('lazy canonical Share + receive-only legacy compatibility contract ok');
