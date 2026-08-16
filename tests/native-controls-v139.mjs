import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('controls-failsafe-v139.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const recovery = fs.readFileSync('recover-fresh-139.html', 'utf8');

assert.doesNotMatch(code, /stopImmediatePropagation|stopPropagation|preventDefault/, 'failsafe must never block the native event pipeline');
assert.match(sw, /v1\.3\.9-native-controls/, 'service worker build must identify v1.3.9');
assert.match(sw, /controls-failsafe-v139\.js/, 'worker must inject v1.3.9 controls');
assert.match(sw, /__WINAMP_HTML_RUNTIME__='1\.3\.9'/, 'worker must expose the current HTML runtime');
assert.match(recovery, /sw\.js\?runtime=139/, 'fresh recovery must install an uncached v1.3.9 worker');
assert.match(recovery, /controls-failsafe-v139\.js\?verify=/, 'fresh recovery must verify the current controls');
assert.doesNotMatch(recovery, /localStorage\.(?:clear|removeItem)/, 'recovery must preserve the saved library');

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div class="controls"><button id="playButton">play</button></div>
  <div id="overlay"></div>
</body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });

const { window } = dom;
const play = window.document.getElementById('playButton');
const overlay = window.document.getElementById('overlay');
let appClicks = 0;
let bootClicks = 0;

// Represents the target listener installed by app.js.
play.addEventListener('click', () => { appClicks += 1; });
// Represents boot-v134.js observing the same click after app.js changes status.
window.document.addEventListener('click', (event) => {
  if (event.target === play) bootClicks += 1;
});

window.document.elementsFromPoint = () => [];
window.eval(code);
assert.equal(window.__WINAMP_CONTROLS_RUNTIME__, '1.3.9');

// Normal mobile sequence: failsafe sees pointerup but does nothing because the
// pointer actually landed on the real button. Native click must reach app + boot.
play.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
play.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
assert.equal(appClicks, 1, 'native app click handler must run exactly once');
assert.equal(bootClicks, 1, 'document/boot click observer must also receive the same click');

// Overlay rescue: pointer lands on an unrelated node, but the control is under
// it. The failsafe calls the real button click synchronously, preserving exactly
// the same app -> document event pipeline.
window.document.elementsFromPoint = () => [overlay, play];
overlay.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
assert.equal(appClicks, 2, 'overlay fallback must click the real app control once');
assert.equal(bootClicks, 2, 'overlay fallback must remain visible to boot/document listeners');

console.log('v1.3.9 native controls integration smoke test: passed');
