import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

assert.equal(/<script[^>]+src=["']https?:\/\//i.test(html), false, 'Cold boot must not contain blocking third-party script tags');
assert.ok(html.includes('./app.js?v=0.4'), 'app.js must remain in the HTML boot path');
assert.ok(html.includes('./boot-v134.js?v=1.3.4'), 'zero-blocking bootstrap must be wired');
assert.ok(html.indexOf('./app.js?v=0.4') < html.indexOf('./boot-v134.js?v=1.3.4'), 'app.js must own controls before the bootstrap helper');

const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');
const dom = new JSDOM(stripped, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});

const { window } = dom;
window.MediaMetadata = class MediaMetadata { constructor(data) { Object.assign(this, data); } };
window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
// Model a browser without Media Session support. Assigning undefined would still
// make `'mediaSession' in navigator` true, which is not how unsupported browsers behave.
try { delete window.navigator.mediaSession; } catch {}

window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([
  { id: 'abcdefghijk', title: 'Smoke Track One', artist: 'Smoke Artist' },
  { id: 'lmnopqrstuv', title: 'Smoke Track Two', artist: 'Smoke Artist' },
]));

window.eval(app);

const status = window.document.getElementById('status');
const title = window.document.getElementById('nowTitle');
const play = window.document.getElementById('playButton');
const next = window.document.getElementById('nextButton');
const search = window.document.getElementById('search');
const count = window.document.getElementById('trackCount');

assert.equal(count.textContent, '2', 'Saved library must render during local boot');
play.click();
assert.equal(status.textContent, 'PLAYER LOADING', 'Real Play click must reach app.js even before YouTube is ready');
assert.equal(title.textContent, 'Smoke Track One', 'Play click must select the first track');

next.click();
assert.equal(title.textContent, 'Smoke Track Two', 'Real Next click must reach app.js');

search.value = 'Two';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(count.textContent, '1/2', 'Library filter input must remain interactive');

console.log('v1.3.4 boot smoke: real DOM clicks and filter passed');
