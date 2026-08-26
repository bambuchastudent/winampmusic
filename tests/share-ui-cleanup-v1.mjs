import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const actions = fs.readFileSync('fast-actions-v143.js', 'utf8');
const cleanup = fs.readFileSync('share-ui-cleanup-v161.js', 'utf8');
const qr = fs.readFileSync('qr-share-v1.js', 'utf8');
const unified = fs.readFileSync('unified-entry-v152.js', 'utf8');

const libraryHeader = index.match(/<div class="library-header"[\s\S]*?<\/div>\s*<input id="search"/)?.[0] || '';
assert.ok(libraryHeader, 'library header must remain present');
assert.ok(!libraryHeader.includes('PLAYLIST'), 'redundant PLAYLIST eyebrow must be removed');
assert.ok(!libraryHeader.includes('Your library'), 'redundant Your library heading must be removed');
assert.match(libraryHeader, /id="trackCount"/, 'compact track count must remain visible');

assert.match(actions, /shareButton\.textContent = 'Share'/);
assert.ok(!actions.includes("shareButton.textContent = 'Share / QR'"));
assert.ok(!actions.includes('openAmpulaButton'));
assert.ok(!actions.includes('Open .ampula'));
assert.match(actions, /share-ui-cleanup-v161\.js\?v=161/);

assert.match(cleanup, /winampShareHeading/);
assert.match(cleanup, /Share music/);
assert.match(cleanup, /Listen to this playlist/);
assert.match(cleanup, /winampShareFile/);
assert.match(cleanup, /\.remove\(\)/, 'format-specific share actions must be removed from rendered UI');
assert.match(cleanup, /Add to library/);
assert.match(cleanup, /Opening this link does not change your library/);

assert.ok(!qr.includes('SCAN ÁMPULA'), 'QR panel copy must stay transport-neutral');
assert.match(qr, /SCAN TO OPEN/);
assert.ok(!unified.includes("share.textContent = 'Share / QR'"));

console.log('compact library and transport-neutral Share UI contract passed');
process.exit(0);
