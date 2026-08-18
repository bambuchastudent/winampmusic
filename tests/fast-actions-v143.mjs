import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('fast-actions-v143.js', 'utf8');
assert.ok(!code.includes('stopImmediatePropagation'));
assert.ok(!code.includes("addEventListener('pointer"));

const dom = new JSDOM(`<!doctype html><body>
  <div id="status">READY</div>
  <section class="library-panel"><div class="library-header"><div>Playlist</div></div></section>
</body>`, {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk' }]));
window.eval(code);

const gift = window.document.getElementById('sharePlaylistButton');
const clear = window.document.getElementById('clearPlaylistButton');
assert.ok(gift, 'Gift / QR button must be installed');
assert.ok(clear, 'Clear button must be installed');
assert.equal(gift.textContent, 'Gift / QR');
assert.equal(window.document.querySelector('script[data-fast-module="compact-share"]'), null, 'share code must not load at startup');
assert.equal(window.document.querySelector('script[data-fast-module="qr-share"]'), null, 'QR code must not load at startup');

clear.click();
assert.ok(window.localStorage.getItem('winampmusic.library.v1'), 'first clear tap must not delete playlist');
assert.equal(clear.textContent, 'Confirm clear');
clear.click();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), null, 'second clear tap must delete playlist');

// Gift action must lazy-load compact sharing first. QR is loaded only after compact-share is ready.
gift.click();
await new Promise((resolve) => setTimeout(resolve, 0));
const compact = window.document.querySelector('script[data-fast-module="compact-share"]');
assert.ok(compact, 'Gift must lazy-load compact share module');
assert.equal(window.document.querySelector('script[data-fast-module="qr-share"]'), null, 'QR must wait for compact share');

console.log('v1.4.3 fast actions test passed');
process.exit(0);
