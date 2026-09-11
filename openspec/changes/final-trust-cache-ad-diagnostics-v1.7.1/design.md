# Design

## Playback trust cache
Canonical Spotify/Apple rows keep their original title/artist/origin metadata. A local YouTube playback match may be cached, but readiness now requires two independent facts:

- a valid 11-character YouTube id;
- `youtubeMatchFinalTrustVersion === music-only-v1.6.7`.

The older `youtubeMatchResolverVersion === music-only-v1.6.4` remains diagnostic/compatibility metadata but is not sufficient to play a canonical-origin row.

The final marker is persisted only by code paths that consume `window.winampMusicAppleImport.findYouTubeMatch`, which is guarded by `resolver-trust-v167.js`. Existing legacy cache rows therefore re-enter resolution once. After a successful guarded resolution, the final marker remains in local storage and future playback reuses it without another search.

## Ad badge
The badge remains in the green player screen on the same row as `PLAYING`, aligned right. Detection prefers the YouTube iframe telemetry already collected by track diagnostics:

- `videoId`
- `currentTime`
- `duration`
- `playerState`

When a canonical-origin track has a final-trusted expected YouTube id and the actively playing iframe reports a different video id, that interval is treated as a YouTube ad. A large duration mismatch is a fallback when iframe video id is unavailable. The badge shows `AD m:ss`, where time is remaining iframe time.

A stale/untrusted playback id must not be mislabeled as an ad; it must be re-resolved/fail closed instead.

## Diagnostics download
A small additive runtime decorates the existing per-track `⋮` menu. It uses the already-public `ampulaTrackDiagnostics164.payloadForIndex(index)` API and downloads exactly that JSON payload. `Copy diagnostics` stays first; `Download diagnostics` is appended as the second menu row.
