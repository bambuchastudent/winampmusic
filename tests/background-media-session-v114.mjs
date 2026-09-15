import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../background-media-session-v114.js', import.meta.url), 'utf8');
const handlers = new Map();
const clicks = [];
const nodes = new Map(['playButton','prevButton','nextButton','nowTitle','nowArtist'].map(id => [id, { click: () => clicks.push(id) }]));
const storage = new Map([
  ['winampmusic.fast.current.v1', '0'],
  ['winampmusic.library.v1', JSON.stringify([{ title: 'Original title', artist: 'Original artist', playbackProvider: 'youtube', youtubeMatchId: 'abcdefghijk' }])],
]);
class MutationObserver { observe() {} }
class MediaMetadata { constructor(value) { Object.assign(this, value); } }
const mediaSession = { metadata: null, setActionHandler(action, handler) { handlers.set(action, handler); } };
const context = {
  window: { addEventListener() {} },
  navigator: { mediaSession }, MediaMetadata, MutationObserver,
  localStorage: { getItem: key => storage.get(key) ?? null },
  document: { getElementById: id => nodes.get(id) ?? null },
  console,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context);

assert.equal(mediaSession.metadata.title, 'Original title');
assert.equal(mediaSession.metadata.artist, 'Original artist');
for (const action of ['play','pause','previoustrack','nexttrack','seekbackward','seekforward','seekto']) assert.equal(typeof handlers.get(action), 'function', `${action} handler missing`);
handlers.get('nexttrack')();
handlers.get('previoustrack')();
assert.deepEqual(clicks, ['nextButton', 'prevButton']);
assert.equal(storage.get('winampmusic.library.v1').includes('Original title'), true, 'metadata must not rewrite track identity');
console.log('background Media Session v1.14 contract: ok');
