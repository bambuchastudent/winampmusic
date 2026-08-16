import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('controls-failsafe-v138.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const recovery = fs.readFileSync('recover-fresh-138.html', 'utf8');

assert.match(sw, /v1\.3\.8-hard-controls/, 'service worker build must identify v1.3.8');
assert.match(sw, /controls-failsafe-v138\.js/, 'service worker must include hard controls');
assert.match(sw, /playerNavigation/, 'player navigations must be transformed by the worker');
assert.match(sw, /__WINAMP_HTML_RUNTIME__='1\.3\.8'/, 'worker must expose an inspectable HTML build marker');
assert.match(recovery, /sw\.js\?runtime=138/, 'fresh recovery must install an uncached v1.3.8 worker URL');
assert.match(recovery, /controls-failsafe-v138\.js\?verify=/, 'fresh recovery must verify hard controls from the network');
assert.doesNotMatch(recovery, /localStorage\.(?:clear|removeItem)/, 'recovery must preserve the saved library');

const dom = new JSDOM(`<!doctype html><html><head></head><body>
  <div id="status">READY</div>
  <div class="controls">
    <button id="prevButton">prev</button>
    <button id="playButton">play</button>
    <button id="nextButton">next</button>
    <button id="shuffleButton">shuffle</button>
  </div>
  <div id="overlay"></div>
  <ol><li class="track" data-index="7"><button class="track-main">track</button></li></ol>
</body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });

const { window } = dom;
const calls = [];
window.YT = { Player: function Player() {} };
window.togglePlayback = () => calls.push('play');
window.playPrevious = () => calls.push('prev');
window.playNext = () => calls.push('next');
window.playRandom = () => calls.push('shuffle');
window.playIndex = (index) => calls.push(`track:${index}`);
window.document.elementsFromPoint = () => [];
window.eval(code);

assert.equal(window.__WINAMP_CONTROLS_RUNTIME__, '1.3.8');

function pointer(target) {
  target.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
  target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
}

pointer(window.document.getElementById('playButton'));
pointer(window.document.getElementById('nextButton'));
pointer(window.document.querySelector('.track-main'));
assert.deepEqual(calls, ['play', 'next', 'track:7'], 'pointerup must own core actions exactly once even when click follows');

const overlay = window.document.getElementById('overlay');
const prev = window.document.getElementById('prevButton');
window.document.elementsFromPoint = () => [overlay, prev];
overlay.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
assert.deepEqual(calls, ['play', 'next', 'track:7', 'prev'], 'elementsFromPoint fallback must reach a control under an overlay');

console.log('v1.3.8 hard controls DOM smoke test: passed');
