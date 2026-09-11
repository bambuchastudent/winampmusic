import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
const cleanup = readFileSync(new URL('../.github/workflows/cleanup-merged-branches.yml', import.meta.url), 'utf8');
const docs = readFileSync(new URL('../docs/RELEASE_LIFECYCLE.md', import.meta.url), 'utf8');

assert.match(pages, /id: revision[\s\S]*revision="r\$\(date \+'%y%m%d%H%M'\)"/, 'Pages deploy must choose one rYYMMDDHHMM revision');
assert.match(pages, /node scripts\/stamp-build-revision\.mjs index\.html "\$\{revision#r\}"/, 'footer must be stamped from the same revision used for release');
assert.match(pages, /outputs:\s*\n\s*revision: \$\{\{ steps\.revision\.outputs\.revision \}\}/, 'deploy job must expose the stamped revision');
assert.match(pages, /release:\s*\n\s*if: github\.event_name == 'push'\s*\n\s*needs: deploy/, 'release must run only after successful deploy on develop push');
assert.match(pages, /contents: write/, 'release job needs permission to create tag/release');
assert.match(pages, /commits\/\$\{GITHUB_SHA\}\/pulls/, 'release notes should recover the merged PR associated with deployed SHA');
assert.match(pages, /gh release create "\$REVISION"[\s\S]*--notes-file release-notes\.md/, 'successful deploy must create a release/tag from the exact revision');
assert.match(pages, /Pages: https:\/\/bambuchastudent\.github\.io\/winampmusic\//, 'release notes must identify the production Pages URL');

assert.match(cleanup, /pull_request:\s*\n\s*types: \[closed\]/, 'branch cleanup must react to PR close');
assert.match(cleanup, /github\.event\.pull_request\.merged == true/, 'cleanup must run only for merged PRs');
assert.match(cleanup, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/, 'cleanup must not touch fork branches');
assert.match(cleanup, /contents: write/, 'cleanup needs branch deletion permission');
assert.match(cleanup, /git\/refs\/heads\/\$\{HEAD_REF\}/, 'cleanup must delete the merged head ref');
assert.match(cleanup, /develop\|main\|master/, 'cleanup must protect trunk branch names');

assert.match(docs, /successful Pages deployment chooses one Madrid-time revision/i);
assert.match(docs, /Git tag named `rYYMMDDHHMM`/i);
assert.match(docs, /GitHub Release named `ÁmpulaMP rYYMMDDHHMM`/i);
assert.match(docs, /Merged same-repository feature branches are deleted automatically/i);

console.log('release lifecycle v1.7.6: ok');
