import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.match(index, /class="app-version-link"[^>]*>1\.5<\/a>/, 'source footer should remain unstamped');
assert.match(workflow, /TZ:\s*Europe\/Madrid/);
assert.match(workflow, /date \+'%y%m%d%H%M'/);
assert.match(workflow, /stamp-build-revision\.mjs index\.html/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ampula-revision-'));
const fixture = path.join(tempDir, 'index.html');
fs.writeFileSync(fixture, '<footer><a class="app-version-link" href="https://github.com/bambuchastudent/winampmusic">1.5</a></footer>');

const ok = spawnSync(process.execPath, ['scripts/stamp-build-revision.mjs', fixture, '2609110005'], { encoding: 'utf8' });
assert.equal(ok.status, 0, ok.stderr || ok.stdout);
const stamped = fs.readFileSync(fixture, 'utf8');
assert.match(stamped, />v1\.5 r2609110005<\/a>/);
assert.match(stamped, /href="https:\/\/github\.com\/bambuchastudent\/winampmusic"/);

const badFixture = path.join(tempDir, 'bad.html');
fs.writeFileSync(badFixture, '<a class="app-version-link" href="#">1.5</a>');
const bad = spawnSync(process.execPath, ['scripts/stamp-build-revision.mjs', badFixture, 'bad-revision'], { encoding: 'utf8' });
assert.notEqual(bad.status, 0, 'malformed revision must fail');
assert.equal(fs.readFileSync(badFixture, 'utf8'), '<a class="app-version-link" href="#">1.5</a>');

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('timestamped footer build revision contract: ok');
