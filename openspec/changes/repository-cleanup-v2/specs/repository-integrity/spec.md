# Repository integrity specification (cleanup v2 delta)

## Requirement: unreachable clusters are removed as a whole
A file MUST NOT be treated as reachable merely because some other file names
it. Reachability is transitive from a real entry point. When a candidate's
only referrer is itself unreachable, the referrer and the candidate form one
cluster and MUST be removed together, referrer first.

### Scenario: loader and target are removed in order
- GIVEN `comments.js` is unreachable from every entry point
- AND `lyrics-sync.js` is referenced only by `comments.js`
- WHEN the cluster is removed
- THEN `comments.js` is removed before `lyrics-sync.js`
- AND at no point does a surviving file reference a missing target.

### Scenario: filename appears in a dynamic loader
- GIVEN a file is named by a `script.src` assignment
- WHEN reachability is computed
- THEN the assignment counts as a dependency only if the file containing it
  is itself reachable from an entry point.

## Requirement: removed filenames are recorded
Every removed file MUST be appended to the removal ledger so a later change
cannot silently reintroduce it, and no surviving executable or configuration
file may still name it.

### Scenario: ledger guards a removal
- GIVEN a file has been removed by this change
- WHEN repository integrity runs
- THEN the file does not exist
- AND no scanned runtime, test, workflow, manifest, or build file names it.

## Requirement: contradictory test contracts are not retained
A behavioral contract that asserts the opposite of a current, enforced
contract MUST NOT be kept. It is stale, not coverage.

### Scenario: superseded branding assertion
- GIVEN `verify-brand-v155.mjs` asserts a wordmark without the diacritic
- AND `tests/repository-integrity-v1.mjs` asserts the wordmark with the
  diacritic
- WHEN cleanup classifies the two
- THEN the superseded assertion is removed and the enforced one is kept.

## Requirement: passing unreferenced contracts are wired, not deleted
A contract that passes against current markup but is executed by no workflow
MUST be connected to CI rather than removed.

### Scenario: dormant contract becomes live coverage
- GIVEN `verify-logo-fit-v158.mjs` passes and no workflow runs it
- WHEN cleanup processes it
- THEN it is executed by a workflow
- AND it is not removed.

## Requirement: behavioral guarantees are not removed as cleanup
A file that is unreferenced at runtime but whose test still proves a
product guarantee MUST be retained by cleanup. Retiring the guarantee
requires its own change.

### Scenario: unloaded module still proves a guarantee
- GIVEN `apple-no-ad-fallback-v150.js` is not loaded by `index.html`
- AND a current test evaluates it to prove an Apple playback failure does not
  fall through to an ad-bearing external player
- WHEN cleanup classifies the file
- THEN the file is retained.

## Requirement: compatibility key loss is explicit
When the sole owner of a compatibility storage key is removed, the change
MUST state the key and confirm that no surviving code path reads it.

### Scenario: key disappears with its only owner
- GIVEN `winampmusic.comments.v4` is written only by `comments.js`
- WHEN `comments.js` is removed
- THEN the change records the key explicitly
- AND no surviving module reads or migrates it.
