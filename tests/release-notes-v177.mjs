import assert from 'node:assert/strict';
import {
  classifyReleaseType,
  shortSummary,
  renderReleaseNotes,
} from '../scripts/build-release-notes.mjs';

assert.equal(classifyReleaseType('feature/release-summary-v177'), 'Feature');
assert.equal(classifyReleaseType('feat/new-player'), 'Feature');
assert.equal(classifyReleaseType('fix/skip-current'), 'Bugfix');
assert.equal(classifyReleaseType('bugfix/resolver'), 'Bugfix');
assert.equal(classifyReleaseType('hotfix/pages'), 'Bugfix');
assert.equal(classifyReleaseType('ci/cache'), 'Maintenance');

assert.equal(
  shortSummary('## What changed\n- fixes Next so unresolved tracks are skipped\n- keeps metadata intact', 'Fallback title'),
  'fixes Next so unresolved tracks are skipped',
);
assert.equal(shortSummary('No markdown bullets here', 'Fallback title'), 'Fallback title');

const bugfixNotes = renderReleaseNotes({
  pr: {
    number: 107,
    title: 'Skip unresolved tracks and formalize production releases',
    body: '## What changed\n- fixes Next/ENDED continuation across unresolved rows\n\n## Safety\nIdentity stays canonical.',
    url: 'https://github.com/bambuchastudent/winampmusic/pull/107',
    headRefName: 'fix/skip-unresolved-release-lifecycle-v176',
  },
  revision: 'r2609111957',
  sha: '422c72fd4d3d2987ed33e3edcc1bfe0b7eb1e60e',
  pagesUrl: 'https://bambuchastudent.github.io/winampmusic/',
});

assert.match(bugfixNotes, /^## Bugfix\n\nfixes Next\/ENDED continuation across unresolved rows\n/);
assert.match(bugfixNotes, /## Published\n\n### \[#107 — Skip unresolved tracks and formalize production releases\]/);
assert.match(bugfixNotes, /## Safety\nIdentity stays canonical\./);
assert.match(bugfixNotes, /Revision: `r2609111957`/);
assert.match(bugfixNotes, /Commit: `422c72fd4d3d2987ed33e3edcc1bfe0b7eb1e60e`/);
assert.match(bugfixNotes, /Pages: https:\/\/bambuchastudent\.github\.io\/winampmusic\//);

const featureNotes = renderReleaseNotes({
  pr: {
    number: 108,
    title: 'Add concise release summaries',
    body: '- adds a compact typed summary before detailed release notes',
    url: 'https://github.com/bambuchastudent/winampmusic/pull/108',
    headRefName: 'feature/release-summary-v177',
  },
  revision: 'r2609112000',
  sha: 'abc123',
  pagesUrl: 'https://bambuchastudent.github.io/winampmusic/',
});
assert.match(featureNotes, /^## Feature\n\nadds a compact typed summary before detailed release notes\n/);

const maintenanceNotes = renderReleaseNotes({
  pr: {
    number: 109,
    title: 'Refresh CI runtime',
    body: 'No bullets here.',
    url: 'https://github.com/bambuchastudent/winampmusic/pull/109',
    headRefName: 'ci/runtime',
  },
  revision: 'r2609112001',
  sha: 'def456',
  pagesUrl: 'https://bambuchastudent.github.io/winampmusic/',
});
assert.match(maintenanceNotes, /^## Maintenance\n\nRefresh CI runtime\n/);

console.log('release notes v1.7.7: ok');
