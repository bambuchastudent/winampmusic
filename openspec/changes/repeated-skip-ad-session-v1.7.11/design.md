# Design

## Stable playback bridge ownership

`track-diagnostics-v164.js` and `playback-queue-v170.js` both install wrappers around `window.playIndex`. Delayed diagnostic reinstalls currently inspect only the outer function marker, so after the queue is installed they can wrap outside it again. That makes unresolved navigation hit the long trusted resolver before queue recovery and reproduces the screen-recording symptom: skip works just after reload, then later stalls.

A small v1.7.11 playback-bridge guard is installed on `window.playIndex` before the diagnostics/prefetch/queue chain. Normal wrapper assignments remain allowed, but once the chain already contains both the trusted-resolver bridge and the queue bridge, the guard rejects a redundant later trusted-resolver wrapper that would move diagnostics back outside the queue. This keeps exactly one trusted-resolver bridge inside exactly one queue bridge while preserving the existing adapters between them.

## Advertisement state

The ad detector already observes YouTube `infoDelivery` wire data. It currently exits early when AMPULAMP says `PAUSED`, even though YouTube can report an ad as playing while the content state is paused. Detection now uses the YouTube wire player state plus id/duration mismatch first. While detected, the main status becomes `AD`; the compact countdown remains available. When the ad ends, normal content state is restored without treating the advertisement as a canonical track.

## YouTube session

No new player lifecycle is introduced. `fast-player-v141.js` keeps one `YT.Player`/iframe instance behind the existing `playerPromise` and switches videos with `loadVideoById`. A regression locks this invariant. A page reload creates a new page/player instance, but normal track changes within one page reuse the same player.

YouTube may still choose a pre-roll for each individual video load. Reusing one iframe/player does not imply that YouTube will serve only one advertisement for the whole queue, and AMPULAMP does not control YouTube's ad frequency.

## Identity safety

No resolver match may rewrite canonical title, artist, or origin metadata. Final-trust requirements are unchanged.