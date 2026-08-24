import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync('unified-entry-v152.js', 'utf8');

assert.match(js, /\.fast-note\{display:none!important\}/, 'provider implementation note should be hidden');
assert.match(js, /document\.querySelector\('\.fast-note'\)\?\.remove\(\)/, 'provider implementation note should be removed from DOM');
assert.match(js, /\.bottle15\{[^}]*animation:none!important;[^}]*transition:none!important;[^}]*transform:none!important/, 'bottle logo must be visually stable');
assert.match(js, /\.bottle15-label\{transform:none!important\}/, 'bottle label must not drift via transform');
assert.match(js, /share\.textContent = 'Share \/ QR'/, 'playlist action should read Share / QR');
assert.match(js, /Share playlist by link or QR code/, 'share action accessibility label should match the new copy');

console.log('unified entry polish v1.5.3 contracts OK');
