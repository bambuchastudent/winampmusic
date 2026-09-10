# Proposal: On-demand playback resolution with two-track prefetch v1.6.5

## Problem

Spotify playlist import currently resolves every imported track to YouTube immediately. That does unnecessary network work, couples playlist persistence to current playback availability, and weakens the Ámpula model where provider metadata is the durable recording identity while YouTube is only a replaceable playback representation.

At the same time, resolving only when a track reaches the player can introduce a visible pause between tracks.

## Goal

Keep imported Spotify/Apple origin rows valid while unresolved, resolve the current track only when playback needs it, and proactively resolve the next two library tracks so normal sequential playback remains smooth.

## Scope

- Stop automatic whole-playlist YouTube resolution after Spotify metadata import.
- Keep Spotify title, artist, duration and provenance as canonical metadata.
- Preserve unresolved rows in the library until they are needed.
- Wrap the existing trusted playback entry point with a non-blocking two-track prefetch window.
- Reuse `window.winampMusicAppleImport.findYouTubeMatch`; do not create a weaker matcher.
- Persist successful prefetched YouTube ids with the existing `music-only-v1.6.4` trust marker.
- Synchronize successful prefetched ids into the FAST player's live library as well as local storage.
- Move the two-track window forward whenever `playIndex()` advances.

## Non-goals

- Resolving the whole imported playlist eagerly.
- Changing music-only scoring thresholds.
- Making YouTube metadata canonical.
- Guaranteeing that every imported row is immediately playable.
- Changing shuffle semantics.

## Success criteria

1. Importing a Spotify playlist with playback disabled performs zero YouTube resolver calls.
2. Starting track N does not wait for the prefetch jobs for N+1 and N+2.
3. Only the next two unresolved known-song-origin rows are prefetched.
4. Advancing playback moves the prefetch window forward.
5. A failed prefetch leaves the row unresolved and preserves provider metadata.
6. A successful prefetch writes a trusted YouTube playback id without replacing canonical title or artist.
7. Existing Madigan — The News music-only regression remains green.