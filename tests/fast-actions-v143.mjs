import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('fast-actions-v143.js', 'utf8');
assert.ok(!code.includes('stopImmediatePropagation'));
assert.ok(!code.includes("addEventListener('pointer"));
assert.ok(!code.includes("searchParams.set('p'"), 'legacy provider-id fallback must never be generated');
assert.match(code, /loadScript\('\.\/share-ui-cleanup-v161\.js\?v=161', 'share-ui-cleanup'\)/);
assert.match(code, /loadScript\('\.\/compact-share\.js\?v=161', 'compact-share'\)/);
assert.match(code, /loadScript\('\.\/legacy-share-v1\.js\?v=161', 'legacy-share'\)/);
assert.match(code, /winampMusicCompactShare\?\.share/);
assert.match(code, /params\.has\('a'\)/);
assert.match(code, /params\.has\('p'\).*params\.has\('s'\)/s);
assert.ok(!code.includes('openAmpulaButton'), 'primary toolbar must not expose a .ampula opener');
assert.ok(!code.includes('Open .ampula'), 'primary toolbar must not market the file transport');

const dom = new JSDOM(`<!doctype html><body>
  <div id="status">READY</div>
  <section class="library-panel"><div class="library-header"><span id="trackCount">1</span></div></section>
</body>`, {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
});
const { window } = dom;
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk', title: 'Track', artist: 'Artist' }]));
window.eval(code);

const share = window.document.getElementById('sharePlaylistButton');
const clear = window.document.getElementById('clearPlaylistButton');
assert.ok(share, 'Share button must be installed');
assert.ok(clear, 'Clear button must be installed');
assert.equal(share.textContent, 'Share');
assert.equal(window.document.getElementById('openAmpulaButton'), null);
assert.equal(window.document.getElementById('openAmpulaInput'), null);
assert.equal(window.document.querySelector('script[data-fast-module="share-ui-cleanup"]'), null, 'share UI cleanup must remain lazy at startup');
assert.equal(window.document.querySelector('script[data-fast-module="compact-share"]'), null, 'share code must remain lazy at startup');
assert.equal(window.document.querySelector('script[data-fast-module="legacy-share"]'), null, 'legacy compatibility code must remain lazy on normal startup');

share.click();
await new Promise((resolve) => setTimeout(resolve, 0));
const cleanupScript = window.document.querySelector('script[data-fast-module="share-ui-cleanup"]');
assert.ok(cleanupScript, 'sender must lazy-load Share UI cleanup first');
cleanupScript.dispatchEvent(new window.Event('load'));
await new Promise((resolve) => setTimeout(resolve, 0));
const compactScript = window.document.querySelector('script[data-fast-module="compact-share"]');
assert.ok(compactScript, 'sender must lazy-load the canonical share module');
assert.equal(window.document.getElementById('winampShareDialog'), null, 'fast actions must not create a provider-ID fallback dialog itself');

window.history.replaceState({}, '', '/?p=abcdefghijk#k=legacy');
clear.click();
assert.ok(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(clear.textContent, 'Confirm clear');
clear.click();
assert.equal(window.localStorage.getItem('winampmusic.library.v1'), null);
assert.equal(window.location.search, '', 'confirmed clear must remove share query parameters');
assert.equal(window.location.hash, '', 'confirmed clear must remove legacy share hash keys');

const legacyDom = new JSDOM(`<!doctype html><body>
  <div id="status">READY</div>
  <section class="library-panel"><div class="library-header"><span id="trackCount">0</span></div></section>
</body>`, {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/?p=abcdefghijk',
  pretendToBeVisual: true,
});
legacyDom.window.eval(code);
assert.ok(legacyDom.window.document.querySelector('script[data-fast-module="legacy-share"]'), 'historical p/s URLs must route to the lazy compatibility adapter');
assert.equal(legacyDom.window.document.querySelector('script[data-fast-module="compact-share"]'), null, 'legacy provider-only URL must not be routed through canonical Ámpula receive');

console.log('fast actions compact share UI + legacy routing contract passed');
process.exit(0);
