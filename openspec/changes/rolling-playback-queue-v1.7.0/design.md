# Design: rolling playback queue v1.7.0

## Playback queue
`playback-queue-v170.js` loads after the existing trusted resolver and two-position prefetch bridge, then wraps `window.playIndex`.

A row is immediately ready when it has a valid 11-character YouTube id and either:
- it is not a Spotify/Apple origin row; or
- it carries the current consumer trust marker `music-only-v1.6.4` (whose candidate has already crossed the independent v1.6.7 final trust gate).

For unresolved rows, the queue reuses `ampulaPlaybackPrefetch165.resolveAhead` so concurrent prefetch work shares its existing inflight map. For valid-but-untrusted legacy rows it calls `ampulaTrackDiagnostics164.resolveTrusted`.

After a trusted result, the queue adopts the YouTube id into FAST's live library with `window.importTracks`, then rewrites the full resolver metadata back into `winampmusic.library.v1`. This prevents FAST's id-only adoption from erasing persistent trust metadata.

## Two playable ahead
After a successful play request, the queue scans forward up to 12 rows until two trusted/playable rows are present. Failed rows remain unresolved and do not count toward the two-ahead target. This remains bounded and does not expand into whole-playlist resolution.

## Automatic rollover
FAST currently calls global `window.playIndex(next)` directly from the YouTube `ENDED` callback after changing the play button from pause to play while the status still reads `PLAYING`. The queue uses this existing synchronous state to distinguish automatic rollover from a manual click.

If automatic resolution of N+1 fails, the queue scans later rows for the next trusted playable track. Manual selection still returns false on strict-resolution failure and never skips elsewhere.

## Advertisement indicator
`ad-indicator-v170.js` adds a compact right-aligned badge to the existing green screen top row. The iframe API has no supported ad-state/title/skip API, so v1 uses a deliberately narrow duration heuristic:
- current row must have canonical Spotify/Apple origin metadata and duration;
- playback must currently be active;
- iframe-reported duration, reflected by the existing player progress UI, must differ from canonical duration by more than 16 seconds.

The strict resolver permits at most 15 seconds duration delta, so this threshold sits outside accepted canonical-match variance. When active, the badge displays `AD mm:ss`, where the timer is reported duration minus reported elapsed time. It hides as soon as the canonical track duration becomes active again.