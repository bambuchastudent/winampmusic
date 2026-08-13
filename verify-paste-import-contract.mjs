import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('app.js', 'utf8');
const paste = fs.readFileSync('paste-import.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

for (const name of ['importTracks', 'renderLibrary', 'playIndex']) {
  assert.match(
    app,
    new RegExp(`window\\.${name}\\s*=\\s*${name}`),
    `app.js must expose window.${name} for feature modules`,
  );
}

assert.match(paste, /typeof window\.importTracks !== 'function'/, 'paste importer must guard its runtime bridge');
assert.match(paste, /host === 'youtu\.be'/, 'paste importer must accept youtu.be links');
assert.match(paste, /SEARCH\.addEventListener\('paste'/, 'paste importer must react immediately to paste');

const appIndex = html.indexOf('./app.js');
const pasteIndex = html.indexOf('./paste-import.js');
assert.ok(appIndex >= 0 && pasteIndex >= 0, 'index.html must load both app.js and paste-import.js');
assert.ok(appIndex < pasteIndex, 'app.js must load before paste-import.js so the bridge exists');

console.log('paste URL import contract: OK');
