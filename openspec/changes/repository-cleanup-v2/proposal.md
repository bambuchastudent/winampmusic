# Proposal: repository cleanup v2

## Problem
`repository-cleanup-v1` removed a first proven-dead batch and left a
repository-integrity contract behind, but it deliberately stopped before the
remaining candidates. A follow-up audit of `develop` at `4557e7f` found that
two clusters are now provably unreachable, while several files that *look*
dead must be retained.

The audit also found that reachability cannot be judged by grepping a
filename. `lyrics-sync.js` is referenced by a `script.src` assignment and so
appears used, but its only referrer is `comments.js`, which is itself
unreachable. Removing one without the other would either strand a loader or
leave a loader pointing at a missing file.

Separately, three root `verify-*.mjs` scripts assert branding contracts that
the current product spec has already replaced. They are wired into no
workflow, they fail when run, and one of them asserts a wordmark without the
diacritic that `repository-integrity-v1` requires. They are stale contracts,
not evidence that the runtime is wrong.

## Goal
Remove only the files proven unreachable from every entry point and every
contract class, and stop stale test contracts from contradicting current
ones — without changing user-visible behavior, runtime compatibility, or
product branding.

## Scope
- remove the lyrics/comments cluster, in referrer-before-target order;
- remove three stale branding `verify-*.mjs` scripts that contradict the
  current branding contract;
- wire the two passing, currently unreferenced `verify-*.mjs` contracts into
  CI instead of deleting them;
- record every removed filename in the removal ledger;
- add a repository-hygiene ignore file so local tool/IDE artifacts stay out
  of the working tree.

## Non-goals
- no UX, playback, import, sharing, PWA, or branding behavior change;
- no renaming of compatibility localStorage keys or runtime identifiers;
- no consolidation of the Apple adapter chain or the duplicated
  `ampMusicPlayDirectIndex` ownership;
- no service-worker precache changes;
- no removal of `apple-no-ad-fallback-v150.js`, whose test still protects a
  real behavioral guarantee;
- no removal of public recovery/fallback entrypoints;
- no removal of OpenSpec history.

## Success criteria
- every local startup script and lazy JavaScript target still resolves;
- service-worker and manifest references still resolve;
- Now Playing/import preservation, Apple provenance/playability separation,
  Share/QR, shared-link receiving, background, recovery, and header branding
  contracts are unchanged;
- every removed filename has no remaining runtime, test, workflow, PWA, or
  build reference, and is present in the removal ledger;
- the previously unreferenced passing branding contracts now run in CI.
