import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const userFacingFiles = [
  'index.html',
  'fast-141.html',
  'recover.html',
  'recover-fresh-140.html',
  'docs/OPTIMIZATION.md',
  '.github/workflows/pages.yml',
  'fast-player-v141.js',
  'apple-music-import-v064.js',
  'openspec/changes/fast-player-v1.4.3/design.md',
  'openspec/changes/fast-player-v1.4.3/proposal.md',
  'openspec/changes/fast-player-v1.4.3/specs/fast-runtime/spec.md',
  'openspec/changes/release-v1.5.0/design.md',
  'openspec/changes/release-v1.5.0/proposal.md',
  'openspec/changes/release-v1.5.0/specs/share-routing/spec.md',
  'openspec/changes/release-v1.5.0/tasks.md',
  'openspec/changes/rename-ampula-ampulamp-v1.5/proposal.md',
  'openspec/changes/rename-ampula-ampulamp-v1.5/specs/product-branding/spec.md',
];

for (const path of userFacingFiles) {
  const content = read(path);
  assert.doesNotMatch(content, /Winamp Music|Winamp-style|\bWINAMP MUSIC\b/i, `${path} still exposes legacy branding`);
}

const readme = read('README.md');
const equalizerProposal = read('openspec/changes/visual-eq-v150/proposal.md');
assert.equal((readme.match(/classic Winamp player/g) || []).length, 1, 'README must keep one inspiration reference');
assert.equal((equalizerProposal.match(/classic Winamp player/g) || []).length, 1, 'EQ docs must keep one inspiration reference');
assert.doesNotMatch(readme, /Winamp Music|Winamp-style|\bor Winamp\b/i, 'README contains an extra legacy branding reference');

console.log('ÁmpulaMP branding copy contract: ok');
