import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM, VirtualConsole } from 'jsdom';

// Listen-first received Ámpula.
// Spec: openspec/changes/received-share-listen-first-v1.6.4/specs/received-share-ux/spec.md
//
// The happy path under test is: opened a link -> saw the songs -> tapped a track -> music plays.
// Everything that manages the received object must stay reachable, but never in the way.

const compactShareCode = fs.readFileSync('compact-share.js', 'utf8');
const shortLinkCode = fs.readFileSync('ampula-short-link-v163.js', 'utf8');
const cleanupCode = fs.readFileSync('share-ui-cleanup-v162.js', 'utf8');

const sharedTracks = [
  // Carries a provider observation, so it resolves without any network access.
  { id: 'abcdefghijk', title: 'Teardrop', artist: 'Massive Attack', duration: '5:31' },
  // No observation: only a local search can make it playable.
  { title: 'Ghost Signal', artist: 'Hollow Coast' },
  // No observation and no reachable source.
  { title: 'Missing Tape', artist: 'No Source' },
];

const receiverLibrary = [
  { id: '11111111111', title: 'Local One', artist: 'Local Artist' },
  { id: '22222222222', title: 'Local Two', artist: 'Local Artist' },
];

const virtualConsole = new VirtualConsole();
const dom = new JSDOM('<!doctype html><body><div id="status">READY</div></body>', {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;
window.TextEncoder = TextEncoder;
window.TextDecoder = TextDecoder;
const dialogProto = window.HTMLDialogElement?.prototype;
if (dialogProto && typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
  dialogProto.close = function close() { this.removeAttribute('open'); };
}

const downloads = [];
window.URL.createObjectURL = (blob) => { downloads.push(blob); return 'blob:ampula-test'; };
window.URL.revokeObjectURL = () => {};

const searchResults = new Map([['Ghost Signal Hollow Coast', 'zyxwvutsrqp']]);
const aliasPayloads = new Map();
const fetchCalls = [];
window.fetch = async (input, options = {}) => {
  const raw = String(input?.url || input);
  fetchCalls.push({ url: raw, options });
  const url = new window.URL(raw, window.location.href);
  if (/\/a\/[^/]+\.json$/.test(url.pathname)) {
    const token = url.pathname.split('/').pop().replace(/\.json$/, '');
    const payload = aliasPayloads.get(token);
    if (!payload) return { ok: false, status: 404, json: async () => ({ error: 'not_found' }) };
    return { ok: true, status: 200, json: async () => ({ v: 1, payload }) };
  }
  const videoId = searchResults.get(url.searchParams.get('q') || '');
  if (!videoId) throw new Error('search unavailable');
  return { ok: true, status: 200, json: async () => [{ type: 'video', videoId }] };
};

const importCalls = [];
window.importTracks = (tracks) => {
  importCalls.push(tracks);
  return { added: tracks.length };
};

window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(receiverLibrary));
const libraryBefore = window.localStorage.getItem('winampmusic.library.v1');
const libraryUnchanged = (message) => assert.equal(window.localStorage.getItem('winampmusic.library.v1'), libraryBefore, message);

window.eval(compactShareCode);
window.eval(shortLinkCode);

const api = window.winampMusicCompactShare;
assert.ok(api, 'canonical share module must load');

const settle = async () => { for (let i = 0; i < 6; i += 1) await new Promise((resolve) => { setTimeout(resolve, 5); }); };

const visibleText = (node) => {
  if (!node) return '';
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';
  if (node.hidden === true || node.hasAttribute('hidden')) return '';
  if (node.getAttribute('style')?.includes('display:none')) return '';
  if (node.style?.display === 'none') return '';
  let text = '';
  for (const child of node.childNodes) text += ` ${visibleText(child)}`;
  return text;
};

const shared = api.toAmpula(sharedTracks);
const payload = await api.encode(shared);
window.history.replaceState({}, '', `/winampmusic/?a=${encodeURIComponent(payload)}`);
await api.load();
await settle();

const dialog = window.document.getElementById('ampulaReceivedDialog');
assert.ok(dialog, 'a received link must open the shared-music surface');
const list = dialog.querySelector('#ampulaReceivedList');
const menu = dialog.querySelector('#ampulaMoreMenu');
const more = dialog.querySelector('#ampulaMore');
const rows = () => [...list.querySelectorAll('li')];

// --- 1. The songs are the first thing on screen. -------------------------------------------------
assert.ok(list, 'the received surface must render a track list');
assert.equal(rows().length, 3, 'every shared track must be listed immediately');
for (const track of ['Teardrop', 'Ghost Signal', 'Missing Tape']) {
  assert.match(visibleText(list), new RegExp(track), `${track} must be visible without any extra step`);
}
assert.equal(dialog.querySelector('#ampulaReceivedTitle').textContent, 'Shared music');
assert.match(dialog.querySelector('#ampulaReceivedMeta').textContent, /3 tracks/);
libraryUnchanged('opening a shared link must not mutate Your library');

// --- 2. The primary surface is not an object admin panel. ----------------------------------------
assert.ok(menu, 'secondary actions must live in a dedicated menu');
assert.equal(menu.hidden, true, 'secondary actions must start collapsed');
assert.ok(more, 'the received surface must expose one compact secondary control');

const primaryButtons = () => [...dialog.querySelectorAll('button')].filter((button) => !menu.contains(button) && !list.contains(button));
const primaryLabels = () => primaryButtons().map((button) => button.textContent.trim());

for (const label of primaryLabels()) {
  assert.doesNotMatch(label, /save|add to library|\.ampula/i, `secondary action "${label}" must not sit on the primary surface`);
}
assert.equal(
  primaryButtons().filter((button) => button.id !== 'ampulaReceivedClose').length,
  1,
  'the primary surface must expose exactly one secondary control besides Close',
);
assert.ok(dialog.querySelector('#ampulaReceivedClose'), 'Close must stay on the primary surface');

const firstScreen = visibleText(dialog);
assert.doesNotMatch(firstScreen, /does not change your library/i, 'library-semantics copy must not be first-screen content');
assert.doesNotMatch(firstScreen, /Save Ámpula|Add playable tracks/i, 'legacy object-management labels must be gone');
assert.match(firstScreen, /Shared music/, 'the shared-music identification must stay visible');

// --- 3. Tapping a track plays it, with no library import. ----------------------------------------
const trackButton = (index) => rows()[index].querySelector('button');
trackButton(0).click();
await settle();

const player = dialog.querySelector('#ampulaReceivedPlayer');
const playedFrame = player.querySelector('iframe');
assert.ok(playedFrame, 'tapping a track must start playback in the received context');
assert.match(playedFrame.src, /abcdefghijk/, 'playback must use the resolved source for the tapped track');
assert.notEqual(player.style.display, 'none', 'the player must become visible on playback');
assert.equal(rows()[0].dataset.state, 'playing', 'the tapped track must report that it is playing');
assert.equal(importCalls.length, 0, 'playback must not import anything into Your library');
libraryUnchanged('playback must not mutate Your library');
assert.equal(menu.hidden, true, 'playing a track must not open the secondary menu');

// A track without a provider observation resolves locally through search, still without import.
trackButton(1).click();
await settle();
assert.match(dialog.querySelector('#ampulaReceivedPlayer').querySelector('iframe').src, /zyxwvutsrqp/, 'a locally resolved track must play');
assert.ok(fetchCalls.some(({ url }) => url.includes('Ghost+Signal') || url.includes('Ghost%20Signal')), 'local resolution must go through the existing resolver');
assert.equal(importCalls.length, 0, 'local resolution must not import anything');
libraryUnchanged('local resolution must not mutate Your library');

// --- 4. A failed resolution is a track problem, not a dialog problem. ----------------------------
trackButton(2).click();
await settle();

const failedRow = rows()[2];
assert.equal(failedRow.dataset.state, 'unresolved', 'an unresolvable track must report its own failure');
const failureNote = failedRow.querySelector('[data-role="note"]');
assert.ok(failureNote, 'the failing track must carry a readable note');
assert.equal(failureNote.hidden, false, 'the failure note must be visible on that track');
assert.match(failureNote.textContent, /source/i, 'the failure note must explain that no source was found');
assert.match(visibleText(failedRow), /Missing Tape/, 'a failed track must keep its title');
assert.match(visibleText(failedRow), /No Source/, 'a failed track must keep its artist');

assert.equal(rows().length, 3, 'a failed resolution must not drop tracks');
assert.match(visibleText(list), /Teardrop/, 'a failed resolution must not damage the rest of the list');
assert.ok(dialog.querySelector('#ampulaReceivedPlayer').querySelector('iframe'), 'a failed resolution must not stop the playing track');
assert.equal(dialog.querySelector('#ampulaReceivedList'), list, 'a failed resolution must not rebuild the dialog');
assert.ok(dialog.open !== false, 'a failed resolution must not close the received surface');
assert.equal(importCalls.length, 0, 'a failed resolution must not import anything');
libraryUnchanged('a failed resolution must not mutate Your library');

// The rest of the list stays interactive after a failure.
trackButton(0).click();
await settle();
assert.equal(rows()[0].dataset.state, 'playing', 'other tracks must stay playable after a failure');
assert.equal(rows()[2].dataset.state, 'unresolved', 'the failed track must keep reporting its state');

// --- 5. The secondary menu holds the object actions. ---------------------------------------------
more.click();
await settle();
assert.equal(menu.hidden, false, 'the compact control must open the secondary menu');
assert.equal(more.getAttribute('aria-expanded'), 'true', 'the compact control must expose its expanded state');

const save = menu.querySelector('#ampulaSave');
const add = menu.querySelector('#ampulaAdd');
const exportFile = menu.querySelector('#ampulaExport');
assert.ok(save, 'Save must be reachable from the secondary menu');
assert.ok(add, 'Add to library must be reachable from the secondary menu');
assert.ok(exportFile, '.ampula export must be reachable from the secondary menu');
assert.equal(save.textContent.trim(), 'Save');
assert.equal(add.textContent.trim(), 'Add to library');
assert.match(exportFile.textContent, /\.ampula/);
assert.match(visibleText(menu), /does not change your library/i, 'the library-semantics note belongs in the secondary surface');

// --- 6. Save persists the received object, not local resolver state. -----------------------------
const receivedObject = await api.decode(payload);
save.click();
await settle();

const savedEntries = JSON.parse(window.localStorage.getItem('winampmusic.ampulas.v1'));
assert.equal(savedEntries.length, 1, 'Save must persist the received Ámpula');
assert.deepEqual(
  JSON.parse(JSON.stringify(savedEntries[0].ampula)),
  JSON.parse(JSON.stringify(receivedObject)),
  'Save must store exactly the received Core object',
);
assert.ok(!savedEntries[0].ampula.tracks[1].observations, 'a local playback match must not be written into the saved object');
assert.ok(!JSON.stringify(savedEntries[0].ampula).includes('zyxwvutsrqp'), 'locally resolved identifiers must never enter the saved object');
libraryUnchanged('Save must stay separate from Your library');

// --- 7. Add to library stays explicit. -----------------------------------------------------------
assert.equal(importCalls.length, 0, 'nothing must have been imported before Add to library was chosen');
add.click();
await settle();
assert.equal(importCalls.length, 1, 'Add to library must import exactly once, when chosen');
assert.deepEqual([...importCalls[0]].map((track) => track.id), ['abcdefghijk', 'zyxwvutsrqp'], 'Add to library must offer the playable received tracks');
assert.ok(![...importCalls[0]].some((track) => track.title === 'Missing Tape'), 'an unresolved track must not be imported');

// --- 8. Export survived the move to the secondary menu. ------------------------------------------
exportFile.click();
await settle();
assert.equal(downloads.length, 1, '.ampula export must still work as a secondary action');
assert.match(downloads[0].type, /application\/vnd\.ampula\+json/, 'export must produce a canonical .ampula file');

// --- 9. Every canonical transport reaches the same listen-first receiver. ------------------------
aliasPayloads.set('Ab3Xk9pQ2', payload);
window.history.replaceState({}, '', '/winampmusic/?al=Ab3Xk9pQ2');
assert.equal(await window.ampulaShortLink.receive(), true, 'a short alias must be handled by the alias adapter');
await settle();

assert.equal(new window.URL(window.location.href).searchParams.get('a'), payload, 'an alias must rebuild the canonical link locally');
assert.equal(window.document.getElementById('ampulaReceivedDialog'), dialog, 'an alias must reuse the canonical received surface');
assert.equal(rows().length, 3, 'an alias must render the same shared tracks immediately');
assert.equal(menu.hidden, true, 'an alias must render with secondary actions collapsed');
assert.equal(more.getAttribute('aria-expanded'), 'false', 'a re-render must reset the secondary control state');
libraryUnchanged('opening a short alias must not mutate Your library');

// A pre-existing self-contained link keeps working through the same receiver.
window.history.replaceState({}, '', `/winampmusic/?a=${encodeURIComponent(payload)}`);
await api.load();
await settle();
assert.equal(window.document.getElementById('ampulaReceivedDialog'), dialog, 'a self-contained link must reuse the canonical received surface');
assert.equal(rows().length, 3, 'a self-contained link must render the same shared tracks immediately');
assert.equal(menu.hidden, true, 'a self-contained link must render with secondary actions collapsed');

// --- 10. Copy normalization stays non-destructive against the new layout. ------------------------
window.eval(cleanupCode);
await settle();

assert.equal(dialog.querySelector('#ampulaReceivedList'), list, 'copy normalization must not remove the track list');
assert.equal(rows().length, 3, 'copy normalization must not remove the shared tracks');
assert.ok(dialog.querySelector('#ampulaMore'), 'copy normalization must not remove the secondary control');
assert.ok(dialog.querySelector('#ampulaMoreMenu'), 'copy normalization must not remove the secondary menu');
assert.ok(dialog.querySelector('#ampulaSave'), 'copy normalization must not remove Save');
assert.ok(dialog.querySelector('#ampulaAdd'), 'copy normalization must not remove Add to library');
assert.ok(dialog.querySelector('#ampulaExport'), 'copy normalization must not remove the secondary .ampula export');
assert.equal(dialog.querySelector('#ampulaReceivedTitle').textContent, 'Shared music');
assert.equal(dialog.querySelector('#ampulaSave').textContent.trim(), 'Save');
assert.equal(dialog.querySelector('#ampulaAdd').textContent.trim(), 'Add to library');
assert.equal(dialog.querySelector('#ampulaMoreMenu').hidden, true, 'copy normalization must not expand the secondary menu');
libraryUnchanged('copy normalization must not mutate Your library');

console.log('listen-first received Ámpula contract passed');
process.exit(0);
