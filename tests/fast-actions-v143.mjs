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
// jsdom does not implement <dialog>.showModal/close; shim them so the share flow can be exercised.
const dialogProto = window.HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
  dialogProto.close = function close() { this.removeAttribute('open'); };
}
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk' }]));
window.eval(code);

const share = window.document.getElementById('sharePlaylistButton');
const clear = window.document.getElementById('clearPlaylistButton');
assert.ok(share, 'Share / QR button must be installed');
assert.ok(clear, 'Clear button must be installed');
assert.equal(share.textContent, 'Share / QR');
assert.equal(window.document.querySelector('script[data-fast-module="compact-share"]'), null, 'share code must not load at startup');
assert.equal(window.document.querySelector('script[data-fast-module="qr-share"]'), null, 'QR code must not load at startup');

// Sender flow is non-blocking (v1.5.8): the share dialog opens from a locally built fallback link,
// so compact-share must stay unloaded and only QR rendering is lazy-loaded.
// Must run while the library still has tracks.
share.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(window.document.getElementById('winampShareDialog'), 'Share must open the quick share dialog');
assert.ok(
  window.document.querySelector('script[data-fast-module="qr-share"]'),
  'Share must lazy-load the QR module',
);
assert.equal(
  window.document.querySelector('script[data-fast-module="compact-share"]'),
  null,
  'sender flow must not wait on compact share',
);

clear.click();
assert.ok(window.localStorage.getItem('winampmusic.library.v1'), 'first clear tap must not delete playlist');
assert.equal(clear.textContent, 'Confirm clear');
clear.click();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), null, 'second clear tap must delete playlist');

console.log('v1.4.3 fast actions test passed');
process.exit(0);
