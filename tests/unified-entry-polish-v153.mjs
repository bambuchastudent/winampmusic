import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('unified-entry-v152.js', 'utf8');

assert.match(js, /\.fast-note\{display:none!important\}/, 'provider implementation note should be hidden');
assert.match(js, /document\.querySelector\('\.fast-note'\)\?\.remove\(\)/, 'provider implementation note should be removed from DOM');
assert.match(js, /\.bottle15\{[^}]*animation:none!important;[^}]*transition:none!important;[^}]*transform:none!important/, 'bottle logo must be visually stable');
assert.match(js, /\.bottle15-label\{transform:none!important\}/, 'bottle label must not drift via transform');
assert.match(js, /share\.textContent = 'Share'/, 'playlist action should read Share');
assert.match(js, /Share current music/, 'share action accessibility label should stay transport-neutral');
assert.ok(!js.includes("share.textContent = 'Share / QR'"));

console.log('unified entry polish v1.5.3 contracts OK');
