# Design — Apple-origin full playback resolution v1.6

## Source model

Apple catalog metadata and current playback are separate concerns.

- `appleTrackId` and `appleTrackUrl` are provider evidence.
- `title` + `artist` identify the recording for the local/provider-independent library model.
- generic `id` is a current playback handle only when it is a real YouTube video ID.
- no Apple catalog ID is encoded into an 11-character generic ID.

## Import resolution

`apple-resolution-v162.js` is a provider adapter layered after the existing Apple readers. It patches the final track/album/playlist import functions and uses the existing strict matcher to resolve each Apple recording by title, artist, album, and duration.

Album and playlist resolution is concurrent with a small worker pool. Every readable Apple recording remains in its original order whether resolution succeeds or fails. Progress and completion messages count only real full playback handles as playable.

## Playback order

1. If MusicKit is configured and authorization succeeds, Apple-native playback remains preferred.
2. Otherwise the resolved YouTube handle is attempted through the existing direct-audio path.
3. If direct/proxy audio fails but the track already has a real YouTube handle, the pre-MusicKit YouTube iframe player is invoked directly.
4. If no full source can be resolved, the track remains unresolved; a 90-second Apple preview is not substituted as successful playback.

The iframe fallback is installed from `fast-release-v150.js` before the Apple playback adapters capture `ampMusicPlayDirectIndex`, so it can bypass the later Apple wrapper recursion safely.

## Legacy migration

Older catalog-first builds stored deterministic synthetic IDs derived from `appleTrackId`. The new resolver recognizes the exact old deterministic value, rewrites it to the same provider-independent `U-...` recording ID used by the core library, marks it unresolved, persists the migration, and reloads once so the already-created core runtime rereads the corrected library.

Only exact deterministic legacy IDs are migrated; arbitrary 11-character IDs are never rewritten.

## Critical-path constraints

The synchronous fast player remains unchanged. `fast-release-v150.js` loads the new resolver asynchronously. Normal YouTube startup and controls remain available if the resolver module fails to load.

## Failure modes

- Strict resolver unavailable: preserve Apple metadata and mark unresolved.
- Some album tracks resolve: import all tracks, play the first real full source, and report the unresolved count.
- Direct audio proxy unavailable: fall back to the YouTube iframe for a verified real handle.
- MusicKit secrets absent: do not claim Apple-native playback; use resolved full fallback sources.
- MusicKit authorization denied: existing fallback behavior remains available.
