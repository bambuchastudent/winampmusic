# Design: On-demand playback resolution with two-track prefetch v1.6.5

## Model

Provider metadata is the durable recording identity. A Spotify or Apple row may exist in the Ámpula library without a current YouTube playback representation. YouTube resolution is treated as a cacheable playback concern, not an import requirement.

## Import flow

Spotify playlist import now performs only:

1. Read playlist metadata.
2. Insert or update normal Ámpula rows with Spotify provenance.
3. Optionally request playback of the first imported row.

It no longer invokes `resolveInBackground()` automatically. That function remains exported only for compatibility and explicit tooling.

## Playback flow

The v1.6.4 trusted playback bridge remains responsible for the current track. If the current known Spotify/Apple origin row is unresolved or carries an older trust marker, it is resolved through the hardened shared matcher before playback is delegated to FAST.

A new `playback-prefetch-v165.js` wrapper is loaded only after that trusted bridge. It does not replace current-track safety logic. It calls the already-wrapped `playIndex()` immediately, then schedules prefetch work for the next two library indices without awaiting it.

## Prefetch window

For current index N, the prefetch layer considers N+1 and N+2, wrapping at the end of the library. It skips rows that are not known Spotify/Apple song origins and rows already carrying a valid YouTube id with `youtubeMatchResolverVersion=music-only-v1.6.4`.

When playback advances, the wrapper runs again, so the window naturally slides forward.

## Resolver

Prefetch uses `window.winampMusicAppleImport.findYouTubeMatch` with canonical title, artist and duration. This is the same music-only resolver used by trusted current-track playback; there is no alternate first-result fallback.

Each prefetch request has a timeout and is de-duplicated by provider track id or canonical title/artist identity. Failure is silent from the playback path and leaves the row unresolved.

## Persistence and live state

The FAST player keeps an in-memory library in addition to local storage. A prefetch result written only to local storage could therefore remain invisible to the next playback call until reload.

On successful prefetch the implementation first feeds the resolved row through `window.importTracks()` so unresolved live rows adopt the YouTube id, then writes the complete canonical origin row back to local storage. Only playback fields are changed: id, youtubeMatchId, youtubeMatchResolverVersion, playbackProvider and playback badge. Canonical provider metadata remains unchanged.

## Loading order

`header-visualizer-v159.js` already loads `track-diagnostics-v164.js`. The loader now waits for that script's load event and only then loads `playback-prefetch-v165.js`. This guarantees that the prefetch wrapper sits outside the trusted current-track wrapper rather than bypassing it.

## Failure behavior

Prefetch never blocks the current `playIndex()` result. Resolver timeout, missing matcher or no trustworthy candidate leave the future row untouched. When that row eventually becomes current, the v1.6.4 trusted bridge performs its normal on-demand resolution and fails closed if necessary.

## Compatibility

`ampulaSpotifyOrigin162` keeps its existing public name and `resolveInBackground()` method so callers do not break. Normal `importPlaylist()` returns a resolved compatibility summary declaring strategy `on-demand+2-ahead` and does not start whole-playlist matching.