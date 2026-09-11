# Design — deterministic navigation v1.7.8

## Intent model

A tiny navigation adapter records the current user gesture during the synchronous click dispatch:

- `track(index)` means an explicit recording selection and must never be substituted;
- `next` / automatic `current + 1` means queue continuation;
- `previous` keeps reverse sequential semantics;
- `shuffle` toggles mode only and does not immediately change the current track.

The intent is ephemeral and is cleared after the event turn. Shuffle state is durable in `localStorage` under `winampmusic.playback.shuffle.v1`; absence means OFF.

## Queue behavior

`playback-queue-v170.js` remains responsible for readiness and unresolved recovery. For an explicit unresolved selection it attempts to resolve exactly that row and returns unresolved if it cannot produce a final-trusted playback source. It does not scan for a replacement.

For forward continuation with Shuffle OFF, recovery scans in library order and therefore `3 -> unresolved 4 -> playable 5` becomes `3 -> 5`.

For forward continuation with Shuffle ON, the next ready row is selected from ready rows other than the current row. Direct track selection bypasses shuffle.

## UI state

The adapter owns the Shuffle button state (`aria-pressed`, active class, title) and inserts `#playbackModeStatus` immediately after the origin/playback provenance line when available. Text is intentionally compact:

- `SHUFFLE · OFF · ORDER · SEQUENTIAL`
- `SHUFFLE · ON · NEXT · RANDOM`

## Hidden-tab continuity

`fast-background-v150.js` keeps `intendedPlaying` sticky while the document is hidden. A provider-generated `PAUSED` mutation while hidden is treated as suspension, not as user intent. Explicit Media Session pause still clears intent before the state mutation. This prevents later checkpoint writes from replacing `wasPlaying: true` with `false`.

## Identity boundary

All navigation decisions operate on library indices/readiness only. The change does not rewrite recording identity, origin, title, artist, or provider metadata.
