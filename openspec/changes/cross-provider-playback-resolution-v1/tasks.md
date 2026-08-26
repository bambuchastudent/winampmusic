# Tasks

## Specification

- [x] Define the stale-state playback failure and cross-provider goal in `proposal.md`.
- [x] Define authoritative working-library ownership and fallback flow in `design.md`.
- [x] Add executable requirements in `specs/playback-resolution/spec.md`.

## Tests before implementation

- [ ] Add a regression test for Apple-origin Cyrillic metadata resolving to YouTube and falling back from direct audio to the iframe.
- [ ] Assert that origin/title/artist survive source adoption.
- [ ] Assert that invalid resolved ids are rejected.

## Implementation

- [ ] Add a validated core operation that adopts a resolved playback source into the in-memory library.
- [ ] Make `clean-playback-v150.js` use the core operation before direct/fallback playback.
- [ ] Preserve compatibility when the new core operation is absent.

## Completion

- [ ] Run the new targeted regression test in CI.
- [ ] Keep existing FAST, Apple origin, unresolved-track, import and playback tests green.
- [ ] Mark tasks complete after CI passes.
