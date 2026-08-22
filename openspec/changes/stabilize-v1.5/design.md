# Design: stabilize AmpMusic 1.5

## Runtime ownership
`fast-player-v141.js` remains the owner of playback, local library state, filtering and `window.importTracks`. The stabilization layer is additive and may only bridge already-existing contracts.

## Playlist import bridge
A lightweight deferred `stable-v150.js` restores the legacy playlist handoff used by `youtube-import.js`:
- accept messages only from explicit YouTube origins;
- require `{ type: WINAMP_MUSIC_IMPORT, version: 1 }`;
- pass `payload.tracks` to `window.importTracks`;
- reply to the same source/origin with `WINAMP_MUSIC_IMPORT_ACK` including `added` and `total`;
- never intercept player pointer/click events.

The protocol name remains `WINAMP_MUSIC_*` for stored/bookmarklet compatibility even though the product name is AmpMusic.

## PWA restoration
The canonical manifest remains linked from `index.html`. `stable-v150.js` registers `sw.js?v=150` only after the FAST shell is interactive. Because the inherited FAST core contains a delayed obsolete-worker cleanup, the stable layer performs a second idempotent registration after that cleanup window. This avoids adding service-worker work to synchronous startup while restoring an active worker for installation/offline shell behavior.

`sw.js` uses a new 1.5 cache identity and caches only the canonical 1.5 FAST assets, including the stabilization layer.

## Branding/version contract
Public product name is `AmpMusic`. Public version stays `1.5`. Existing lightning/logo/icon visuals are preserved. Source-level storage/protocol names beginning with `winampmusic` remain unchanged for compatibility.

No production UI, manifest, test or spec may advertise a 2.0 release unless a future explicitly approved OpenSpec change authorizes it.

## Failure behavior
If service-worker APIs are unavailable, the browser player still works normally. If an import message is malformed or comes from an unapproved origin, it is ignored. If `window.importTracks` is not available yet, the import is not acknowledged as successful.

## Critical path
The new bridge runs as a deferred script after the synchronous FAST player. Telegram work is roadmap-only and adds no code in this change.