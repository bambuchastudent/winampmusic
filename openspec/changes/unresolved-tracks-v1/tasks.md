# Tasks: unresolved-tracks-v1

## Specification

- [x] Write `proposal.md` with problem, goal, scope, non-goals and success criteria.
- [x] Write `design.md` covering ownership, the two track states, the local recording id, import rules, compatibility and failure modes.
- [x] Write `specs/music-library/spec.md` with requirements and executable scenarios.

## Tests before implementation

- [x] Add `tests/unresolved-tracks-v1.mjs` encoding every scenario of the spec delta.
- [x] Confirm the new test fails against the current core.

## Core domain

- [x] Add `localRecordingId(title, artist)` and `isResolved(track)` to `fast-player-v141.js`.
- [x] Stop `readLibrary` substituting `YouTube <id>` / `YouTube` for missing metadata.
- [x] Rewrite `importTracks` to accept identity-only items, assign a local recording id, discard malformed provider ids and deduplicate on the resulting id.
- [x] Adopt an incoming playable id into an existing unresolved recording instead of adding a duplicate.
- [x] Render display fallbacks in `makeRow` and `updateNowPlaying` without persisting them.
- [x] Mark unresolved rows in the library list and style them in `styles.css`.
- [x] Report `NO SOURCE FOUND` when a track that never had a handle cannot be resolved.
- [x] Expose `window.ampMusicIsResolved` as the single shared definition.

## Importers

- [x] Stop `fast-import-v150.js` writing `YouTube <id>` / `YouTube` for pasted links and playlists.
- [x] Stop `apple-music-import-v064.js` falling back to `YouTube <id>` / `YouTube` for unmatched metadata.

## Existing contracts

- [x] Update the malformed-id assertion in `tests/youtube-error2-v150.mjs` to the stronger contract from `design.md`.
- [x] Raise the core source budget in `tests/performance-v150.mjs` to 19000 and keep both synchronous startup gates unchanged.
- [x] Keep `tests/mutation-v150.mjs`, `tests/fast-player-v141.mjs`, `tests/fast-import-v142.mjs`, `tests/ui-polish-v150.mjs` and `tests/ampula-sharing-v1.mjs` green.

## Completion

- [x] Run every `tests/*.mjs` and `verify-*.mjs`.
- [x] Update `README.md` if the user-visible library behaviour changes.
