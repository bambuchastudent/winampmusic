import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const manifestText = fs.readFileSync('manifest.webmanifest', 'utf8');
const icon = fs.readFileSync('icon.svg', 'utf8');
const background = fs.readFileSync('fast-background-v150.js', 'utf8');
const share = fs.readFileSync('compact-share.js', 'utf8');
const qrShare = fs.readFileSync('qr-share-v1.js', 'utf8');
const release = fs.readFileSync('fast-release-v150.js', 'utf8');
const stable = fs.readFileSync('stable-v150.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const agents = fs.readFileSync('AGENTS.md', 'utf8');
const openspecReadme = fs.readFileSync('openspec/README.md', 'utf8');
const brandingSpec = fs.readFileSync('openspec/changes/rename-ampula-ampulamp-v1.5/specs/product-branding/spec.md', 'utf8');

assert.match(index, /<title>ÁmpulaMP 1\.5<\/title>/);
assert.match(index, /<h1>ÁmpulaMP<\/h1>/);
assert.match(index, /aria-label="ÁmpulaMP 1\.5"/);
assert.match(index, />ÁMPULA<br>MP</);
assert.match(index, />1\.5</);
assert.ok(!index.includes('AmpMusic'), 'old AmpMusic public branding must not remain in the production shell');
assert.ok(!index.includes('AMP MUSIC'), 'old AMP MUSIC heading must not remain in the production shell');
assert.ok(!index.includes('Ámpulamp'), 'superseded Ámpulamp player name must not remain in the production shell');
assert.ok(!index.includes('Version 2.0'), 'production shell must not advertise unapproved 2.0');
assert.match(index, /stable-v150\.js\?v=150/);

const manifest = JSON.parse(manifestText);
assert.equal(manifest.name, 'ÁmpulaMP');
assert.equal(manifest.short_name, 'ÁmpulaMP');
assert.match(manifest.description, /ÁmpulaMP/);
assert.match(manifest.description, /Ámpula/);
assert.equal(manifest.display, 'standalone');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 1, 'PWA icons must stay configured');

assert.match(icon, /aria-label="ÁmpulaMP lightning"/);
assert.match(icon, /<path /, 'existing lightning logo asset must remain present');
assert.match(background, /album: track\.playlist \|\| 'ÁmpulaMP'/);
assert.match(share, /title: 'ÁmpulaMP playlist'/);
assert.match(share, /Listen to my \$\{count\}-track ÁmpulaMP playlist/);
assert.match(qrShare, /Scan → ÁmpulaMP opens → playlist is received/);

assert.match(readme, /^# Ámpula\n/);
assert.match(readme, /\*\*ÁmpulaMP\*\* is the player/);
assert.ok(!readme.startsWith('# Ámpulamp'), 'README must use the project name Ámpula');
assert.match(agents, /This repository implements the \*\*Ámpula\*\* project/);
assert.match(agents, /\*\*ÁmpulaMP\*\* is the player/);
assert.match(openspecReadme, /^# Ámpula OpenSpec workflow/);

assert.match(brandingSpec, /project SHALL be named \*\*Ámpula\*\*/);
assert.match(brandingSpec, /player application SHALL be named \*\*ÁmpulaMP\*\*/);
assert.match(brandingSpec, /supersedes the `AmpMusic` public-name requirement/);
assert.match(brandingSpec, /badge SHALL remain `1\.5`/);

// Compatibility identifiers intentionally survive the public rename.
assert.match(release, /const LIBRARY_KEY = 'winampmusic\.library\.v1'/);
assert.match(stable, /payload\.type !== 'WINAMP_MUSIC_IMPORT'/);

console.log('Ámpula / ÁmpulaMP 1.5 branding and compatibility contract passed');
