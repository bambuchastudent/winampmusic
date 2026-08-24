import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const actions = fs.readFileSync('fast-actions-v143.js', 'utf8');

assert.match(html, /<h1>Ampula MP<\/h1>/);
assert.doesNotMatch(html, /by bambuchastudent/i);
assert.match(html, /href="https:\/\/github\.com\/bambuchastudent\/winampmusic"/);
assert.match(html, /AMPU<span class="bolt-l">⚡<\/span>A<br>MP/);
assert.match(html, /<span class="bottle15-version">v1\.5<\/span>/);
assert.doesNotMatch(html, /VERSION 1\.5/);
assert.doesNotMatch(html, /Controls are local and instant/);
assert.match(actions, /shareButton\.textContent = 'Share \/ QR'/);
assert.doesNotMatch(actions, /Gift \/ QR/);

console.log('Ampula MP brand v1.5.5 contract OK');
