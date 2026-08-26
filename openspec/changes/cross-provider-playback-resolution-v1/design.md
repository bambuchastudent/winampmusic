# Design: Authoritative cross-provider playback resolution

## Ownership

`fast-player-v141.js` owns the authoritative working-library array used by playback controls. `localStorage` is persistence for that state, not a second source of truth while the page is running.

Provider adapters and playback bridges may discover a better playback representation, but they must hand that result back to the core instead of independently replacing `winampmusic.library.v1`.

## New core operation

Expose a small runtime API:

```js
window.ampMusicAdoptPlaybackSource(index, patch)
```

The operation:

1. validates `patch.id` with the existing YouTube id parser;
2. rejects an invalid index or invalid id;
3. updates only mutable playback fields on the existing in-memory recording;
4. preserves recording identity and provenance (`title`, `artist`, Apple URLs/ids, badges and other imported evidence);
5. saves the authoritative array, re-renders the library and refreshes now-playing when necessary;
6. returns the validated id on success and an empty string on failure.

The first patch fields are `id`, optional `thumbnail`, and optional resolution timestamp. Provider-specific provenance is deliberately not accepted as a replacement identity.

## Direct playback flow

For an Apple-origin track:

1. the existing strict matcher resolves the recording evidence to a YouTube candidate;
2. `clean-playback-v150.js` immediately calls `ampMusicAdoptPlaybackSource`;
3. direct Piped audio is attempted for that resolved YouTube id;
4. if direct audio works, playback continues as today;
5. if direct audio fails, `window.playIndex(index)` sees the same resolved id in the FAST in-memory library and uses the YouTube iframe directly.

This makes the source chosen for playback independent of the source that created the recording while retaining Apple as origin evidence.

## Compatibility fallback

If the core adoption API is unavailable (for example, a partially cached old shell with a newer deferred script), `clean-playback-v150.js` keeps a defensive localStorage update. Normal current-version execution must use the authoritative API.

## Failure modes

- Strict matcher finds no acceptable recording: no source is adopted; existing unresolved behavior remains.
- Resolved id fails validation: no mutation occurs.
- Direct Piped endpoint is unavailable: iframe fallback uses the adopted id.
- YouTube iframe also cannot play the candidate: existing player error/recovery behavior applies; the track remains visible and Apple provenance remains intact.
- localStorage write fails: the in-memory player still owns the adopted id for the current page, matching existing best-effort persistence semantics.

## Critical path and performance

The core addition is a small mutation helper and replaces no startup network work. No provider API is added to the synchronous path. The change must remain within the existing FAST source budget.

## Why not make Apple the playback source

Apple Music URL/storefront/id are historical observations and optional provider hints. They cannot be the canonical recording identity and cannot prevent playback from another source. This follows `AGENTS.md` and `ampula/RESOLVER.md` without changing Core v1.
