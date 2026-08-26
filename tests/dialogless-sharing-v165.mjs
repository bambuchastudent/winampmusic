import assert from 'node:assert/strict';
import fs from 'node:fs';

const cleanup = fs.readFileSync('share-ui-cleanup-v162.js', 'utf8');
const actions = fs.readFileSync('fast-actions-v143.js', 'utf8');
const shortLink = fs.readFileSync('ampula-short-link-v163.js', 'utf8');
const spec = fs.readFileSync('openspec/changes/dialogless-short-link-sharing-v1.6.5/specs/share-ui/spec.md', 'utf8');

assert.match(cleanup, /HTMLDialogElement\?\.prototype/, 'dialog adapter must intercept browser dialog presentation');
assert.match(cleanup, /this\.id === 'winampShareDialog'/, 'sender dialog must be explicitly suppressed');
assert.match(cleanup, /this\.id === 'ampulaReceivedDialog'/, 'received dialog must be explicitly converted to inline content');
assert.match(cleanup, /makeReceivedInline/, 'received content needs an inline rendering path');
assert.match(cleanup, /\.library-panel/, 'received content must render in the main library panel');
assert.match(cleanup, /SHORT LINK COPIED/, 'successful alias minting must finish with the short URL on the clipboard');
assert.match(cleanup, /ÁMPULA LINK READY/, 'canonical URL must remain the failure-safe first copy');
assert.match(cleanup, /SHORT LINK READY/, 'dialogless adapter must react to the existing alias-ready signal');
assert.match(cleanup, /Add to library/, 'received shares must preserve explicit library mutation');
assert.match(cleanup, /← My library/, 'inline received view must provide a route back to the local library');

assert.match(actions, /ampula-short-link-v163\.js/, 'Share action must keep the optional short-link adapter');
assert.match(actions, /winampMusicCompactShare\.share/, 'canonical Ámpula creation remains the source of truth');
assert.match(shortLink, /input\.value = alias\.url/, 'alias adapter must replace the transport URL after successful minting');
assert.match(shortLink, /setStatus\('SHORT LINK READY'\)/, 'alias adapter must publish the signal consumed by the dialogless clipboard flow');

assert.match(spec, /MUST NOT present a custom share modal\/dialog/i);
assert.match(spec, /short alias replaces the canonical link as the final copied value/i);
assert.match(spec, /MUST NOT present the received music in a modal dialog/i);
assert.match(spec, /saved local library remains unchanged/i);

console.log('dialogless short-link sharing contract passed');
