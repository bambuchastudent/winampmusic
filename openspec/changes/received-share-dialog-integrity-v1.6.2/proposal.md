# Proposal: Preserve received Share dialog integrity

## Problem

The v1.6.1 Share UI cleanup rewrites the explanatory copy inside the Received Ámpula dialog by scanning every descendant `div` and assigning `textContent` to the first node whose aggregate text contains the old sentence.

Because a parent container's `textContent` includes all descendant text, the matcher can select the dialog content container instead of the leaf notice. Assigning `textContent` to that container destroys the rendered track list, actions, close control and player, leaving only `Opening this link does not change your library.` visible.

The existing test only checks source strings, so it does not detect DOM destruction.

The active sharing specs also contain contradictory legacy-link wording: the canonical sharing spec says historical `?p=`/`?s=` links must not be consumed, while the newer compatibility spec intentionally restores them through a receive-only legacy adapter.

## Goal

- Make Shared/Received Music copy cleanup provably non-destructive.
- Add a behavioral regression test that models DOM `textContent` replacement semantics.
- Cache-bust the fixed cleanup module so deployed clients do not remain on v1.6.1.
- Reconcile OpenSpec so legacy provider-ID links are receive-only compatibility, never Ámpula Core.
- Record that a future short-link service is allowed only as an optional transport alias, not as musical identity or the sole copy of an Ámpula.

## Scope

- Add `share-ui-cleanup-v162.js` and route Share/receive loading to it.
- Rewrite only a leaf explanatory notice; never a container with child elements.
- Bump the service-worker shell cache to include the v1.6.2 cleanup module.
- Upgrade `tests/share-ui-cleanup-v1.mjs` from source-only checks to a small runtime DOM-integrity regression.
- Correct the legacy compatibility wording in the canonical sharing spec/design.

## Non-goals

- No change to Ámpula Core v1 schema or identity.
- No automatic import of received tracks into the local library.
- No implementation of a short-link backend in this hotfix.
- No change to playback provider resolution.

## Success criteria

- Opening a canonical `?a=` link leaves the received track list and Save/Add actions rendered after UI copy normalization.
- Only the explanatory leaf notice is rewritten.
- The regression test fails against the destructive v1.6.1 algorithm and passes against v1.6.2.
- New clients load the cache-busted v1.6.2 cleanup module.
- OpenSpec consistently distinguishes canonical Ámpula receive from legacy receive-only compatibility.
