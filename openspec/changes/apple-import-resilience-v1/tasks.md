# Tasks: apple-import-resilience-v1

## Specification

- [x] Write `proposal.md` with the problem, goal, scope, non-goals and success criteria.
- [x] Write `design.md` covering reader outcomes, match outcomes, recording lookup, playback and compatibility.
- [x] Write `specs/apple-import/spec.md` with requirements and executable scenarios.

## Tests before implementation

- [x] Add `tests/apple-import-resilience-v1.mjs` encoding every scenario of the spec delta.
- [x] Confirm the new test fails against the current adapter.

## Core

- [x] Expose `window.ampMusicRecordingId` from `fast-player-v141.js`.

## Public playlist path

- [x] Stop `fetchPublicPlaylist` throwing when the page yields no tracks.
- [x] Make `resolveTracks` return an unresolved track instead of `null` and drop `results.filter(Boolean)`.
- [x] Remove the zero-match throw from `importPlaylistUrl` and report an empty playlist as its own outcome.
- [x] Start playback from the first playable track and skip playback when none is playable.
- [x] Report matched and unresolved counts in the completion status.

## Catalog-first path

- [x] Make `playlistTrack` return an unresolved track instead of `null`.
- [x] Drop `filter(Boolean)` and the zero-match throw from the playlist patch.
- [x] Handle an empty playlist without raising.
- [x] Make `existingIndex` recognise an already-imported unresolved recording.

## Album path

- [x] Make the album matcher return unresolved tracks instead of `null`.
- [x] Remove the zero-match throw from `importAlbumUrl` and start playback on the first playable track.

## Existing contracts

- [x] Update `tests/apple-playlist-v150.mjs` to the new import contract.
- [x] Keep `tests/apple-album-source-v150.mjs`, `tests/apple-musickit-in-player-v150.mjs`, `tests/apple-origin-playback-v151.mjs` and `tests/fast-import-v142.mjs` green.

## Completion

- [x] Run every `tests/*.mjs` and `verify-*.mjs`.
- [x] Update `README.md` if the user-visible import behaviour changes.
