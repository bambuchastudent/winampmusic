# Design

## Stable playback bridge ownership

`track-diagnostics-v164.js` and `playback-queue-v170.js` both install wrappers around `window.playIndex`. Delayed diagnostic reinstalls currently inspect only the outer function marker, so after the queue is installed they can wrap outside it again. That makes unresolved navigation hit the long trusted resolver before queue recovery and reproduces the screen-recording symptom: skip works just after reload, then later stalls.

Each installer will walk the `__ampulaWrappedPlayIndex` chain before adding another wrapper. A bridge already present anywhere in the chain is considered installed. This keeps one diagnostics bridge and one queue bridge, with queue recovery remaining authoritative after delayed refresh/pageshow installers.

## Advertisement state

The ad detector already observes YouTube `infoDelivery` wire data. It currently exits early when AMPULAMP says `PAUSED`, even though YouTube can report an ad as playing while the content state is paused. Detection will use the YouTube wire player state plus id/duration mismatch first. While detected, the main status becomes `AD`; the compact countdown remains available. When the ad ends, normal player events may restore the content state.

## YouTube session

No new player lifecycle is introduced. `fast-player-v141.js` keeps one `YT.Player`/iframe instance behind the existing `playerPromise` and switches videos with `loadVideoById`. A regression locks this invariant. YouTube may still choose a pre-roll for each loaded video; AMPULAMP does not control ad frequency.

## Identity safety

No resolver match may rewrite canonical title, artist, or origin metadata. Final-trust requirements are unchanged.