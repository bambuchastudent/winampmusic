# Tasks

## Specification

- [x] Define the stale-state playback failure and cross-provider goal in `proposal.md`.
- [x] Define authoritative working-library ownership and fallback flow in `design.md`.
- [x] Add executable requirements in `specs/playback-resolution/spec.md`.

## Tests before implementation

- [x] Add a regression test for Apple-origin Cyrillic metadata resolving to YouTube and falling back from direct audio to the iframe.
- [x] Assert that origin/title/artist survive source adoption.

## Implementation

- [x] Reuse the FAST core's provider-independent `importTracks` adoption path for a newly resolved playback id.
- [x] Make `clean-playback-v150.js` update authoritative in-memory state before direct/fallback playback.
- [x] Preserve the existing persistent metadata update for compatibility and resolution details.

## Completion

- [x] Run the new targeted regression test in CI.
- [x] Keep existing FAST, Apple origin, unresolved-track, import and playback gates green.
- [x] Mark tasks complete after CI passes.
