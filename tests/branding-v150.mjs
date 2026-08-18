import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const manifest = fs.readFileSync('manifest.webmanifest', 'utf8');
const icon = fs.readFileSync('icon.svg', 'utf8');

assert.match(index, /<title>AmpDrop Music 1\.5<\/title>/);
assert.match(index, /<h1>AMPDROP MUSIC<\/h1>/);
assert.match(index, /aria-label="AmpDrop Music 1\.5"/);
assert.match(index, />AMPDROP<br>MUSIC</);
assert.match(index, />1\.5</);
assert.match(index, /Version 2\.0 · Import all your playlists/);
assert.ok(!index.includes('by bambuchastudent'));
assert.ok(!index.includes('<h1>WINAMP MUSIC</h1>'));

const parsed = JSON.parse(manifest);
assert.equal(parsed.name, 'AmpDrop Music');
assert.equal(parsed.short_name, 'AmpDrop');
assert.match(icon, /aria-label="AmpDrop Music lightning"/);

console.log('AmpDrop Music 1.5 branding contract passed');
