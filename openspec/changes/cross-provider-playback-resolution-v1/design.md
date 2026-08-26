# Design: Authoritative cross-provider playback resolution

## Ownership

`fast-player-v141.js` owns the authoritative working-library array used by playback controls. `localStorage` is persistence for that state, not a second source of truth while the page is running.

Provider adapters and playback bridges may discover a better playback representation, but they must hand that result back to the core instead of independently replacing `winampmusic.library.v1`.

## Existing authoritative adoption path

The core already exposes `window.importTracks`. Its provider-independent dedupe key is the recording identity derived from title + artist. When the same recording exists unresolved and a later import supplies a valid YouTube id, `importTracks` adopts that id into the existing in-memory recording instead of creating a duplicate.

That is exactly the state transition needed here, so this change deliberately reuses it rather than adding a second mutation API.

`clean-playback-v150.js` must call `window.importTracks` with the resolved id and the recording's existing title/artist before it updates auxiliary persistent metadata. Because the known-recording path only adopts the playback id, the original title, artist, Apple URLs/ids, storefront evidence and badges remain intact.

## Direct playback flow

For an Apple-origin track:

1. the existing strict matcher resolves the recording evidence to a YouTube candidate;
2. `clean-playback-v150.js` immediately feeds that candidate back through `window.importTracks` using the existing recording identity;
3. the FAST in-memory library and persistence now agree on the resolved playback id;
4. direct Piped audio is attempted for that YouTube id;
5. if direct audio works, playback continues as today;
6. if direct audio fails, `window.playIndex(index)` sees the already-resolved id in the FAST in-memory library and uses the YouTube iframe directly.

This makes the source chosen for playback independent of the source that created the recording while retaining Apple as origin evidence.

## Compatibility

If `window.importTracks` is unavailable in a partially loaded shell, the existing defensive `localStorage` update remains. Normal current-version execution has `importTracks` because the FAST core loads synchronously before deferred playback adapters.

## Failure modes

- Strict matcher finds no acceptable recording: no source is adopted; existing unresolved behavior remains.
- Direct Piped endpoint is unavailable: iframe fallback uses the adopted id.
- YouTube iframe also cannot play the candidate: existing player error/recovery behavior applies; the track remains visible and Apple provenance remains intact.
- localStorage write fails: existing best-effort persistence semantics apply.

## Critical path and performance

No new synchronous core code or startup network work is added. The fix is confined to the deferred playback bridge and reuses the core's existing recording adoption semantics.

## Why not make Apple the playback source

Apple Music URL/storefront/id are historical observations and optional provider hints. They cannot be the canonical recording identity and cannot prevent playback from another source. This follows `AGENTS.md` and `ampula/RESOLVER.md` without changing Core v1.
