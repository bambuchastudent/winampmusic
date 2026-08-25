import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('fast-actions-v143.js', 'utf8');
assert.ok(!code.includes('stopImmediatePropagation'));
assert.ok(!code.includes("addEventListener('pointer"));
assert.ok(!code.includes("searchParams.set('p'"), 'legacy provider-id fallback must not return');
assert.match(code, /loadScript\('\.\/compact-share\.js\?v=160', 'compact-share'\)/);
assert.match(code, /loadScript\('\.\/ampula-file-open-v1\.js\?v=160', 'ampula-file-open'\)/);
assert.match(code, /winampMusicCompactShare\?\.share/);
assert.match(code, /ampulaFileOpen\?\.openFile/);
assert.match(code, /params\.has\('a'\)/);

const dom = new JSDOM(`<!doctype html><body>
  <div id="status">READY</div>
  <section class="library-panel"><div class="library-header"><div>Playlist</div></div></section>
</body>`, {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk', title: 'Track', artist: 'Artist' }]));
window.eval(code);

const share = window.document.getElementById('sharePlaylistButton');
const open = window.document.getElementById('openAmpulaButton');
const openInput = window.document.getElementById('openAmpulaInput');
const clear = window.document.getElementById('clearPlaylistButton');
assert.ok(share, 'Share / QR button must be installed');
assert.ok(open, 'Open .ampula button must be installed');
assert.ok(openInput, '.ampula file input must be installed');
assert.match(openInput.accept, /\.ampula/);
assert.ok(clear, 'Clear button must be installed');
assert.equal(share.textContent, 'Share / QR');
assert.equal(open.textContent, 'Open .ampula');
assert.equal(window.document.querySelector('script[data-fast-module="compact-share"]'), null, 'share code must remain lazy at startup');
assert.equal(window.document.querySelector('script[data-fast-module="ampula-file-open"]'), null, 'file opener must remain lazy at startup');

share.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(window.document.querySelector('script[data-fast-module="compact-share"]'), 'sender must lazy-load the full Ámpula module');
assert.equal(window.document.getElementById('winampShareDialog'), null, 'fast actions must not create a provider-ID fallback dialog itself');

clear.click();
assert.ok(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(clear.textContent, 'Confirm clear');
clear.click();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), null);

console.log('fast actions Ámpula v1 + file-open contract passed');
process.exit(0);
