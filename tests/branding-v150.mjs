import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const manifest = fs.readFileSync('manifest.webmanifest', 'utf8');
const icon = fs.readFileSync('icon.svg', 'utf8');
const brandingSpec = fs.readFileSync('openspec/changes/release-v1.5.0/specs/release-branding/spec.md', 'utf8');
const roadmapSpec = fs.readFileSync('openspec/changes/stabilize-v1.5/specs/v1.5-roadmap/spec.md', 'utf8');

assert.match(index, /<title>AmpMusic 1\.5<\/title>/);
assert.match(index, /<h1>AMP MUSIC<\/h1>/);
assert.match(index, /aria-label="AmpMusic 1\.5"/);
assert.match(index, />AMP<br>MUSIC</);
assert.match(index, />1\.5</);
assert.ok(!index.includes('Version 2.0'), 'production shell must not advertise unapproved 2.0');
assert.ok(!index.includes('AmpDrop Music'), 'old AmpDrop branding must not return');
assert.match(index, /stable-v150\.js\?v=150/);

const parsed = JSON.parse(manifest);
assert.equal(parsed.name, 'AmpMusic');
assert.equal(parsed.short_name, 'AmpMusic');
assert.equal(parsed.display, 'standalone');
assert.ok(Array.isArray(parsed.icons) && parsed.icons.length >= 1, 'PWA icons must stay configured');
assert.match(icon, /<path /, 'existing lightning logo asset must remain present');

assert.match(brandingSpec, /product name SHALL be `AmpMusic`/);
assert.match(brandingSpec, /SHALL NOT display a `2\.0` teaser/);
assert.match(roadmapSpec, /Telegram interface/);
assert.match(roadmapSpec, /AI coding agents/);
assert.match(roadmapSpec, /keep-current-stack option/);

console.log('AmpMusic 1.5 branding/version/roadmap contract passed');
