# Design — skip unresolved playback v1.7.6

## Queue ownership

`playback-queue-v170.js` remains the safety wrapper around the legacy FAST `window.playIndex`. It owns only selection of a playable row; the FAST player still owns actual YouTube playback.

## Selection rule

When a requested row is unresolved, queue recovery receives the previously selected/current row before invoking the underlying player. That previous row is excluded from fallback selection. Recovery scans from the requested row in navigation direction, starts background resolution, and plays the first final-trusted ready row. If none is ready yet, it polls while background resolution continues, without restarting the excluded row.

The direction is inferred only for adjacent navigation: current+1 means forward and current-1 means backward. Direct row selection keeps forward recovery semantics.

## Identity and trust

Selection uses the existing `music-only-v1.6.7` final-trust marker for Spotify/Apple-origin recordings. No candidate becomes playable merely because queue recovery wants continuity. Canonical title, artist, duration and origin remain unchanged.

## Failure modes

- If no other row becomes playable before the queue wait budget expires, playback stops with an explicit no-playable-track status rather than replaying the current row.
- Resolver/network failures leave rows unresolved and visible.
- Background resolution is not cancelled by a skip.
