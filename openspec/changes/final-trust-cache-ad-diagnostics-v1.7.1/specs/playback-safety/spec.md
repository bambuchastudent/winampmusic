# Playback safety delta v1.7.1

## Requirement: legacy resolver markers do not authorize playback
Given a Spotify/Apple-origin row with a valid-looking YouTube id and `youtubeMatchResolverVersion = music-only-v1.6.4`,
when `youtubeMatchFinalTrustVersion` is absent,
then the row MUST NOT be treated as ready for playback,
and it MUST pass the v1.6.7 final trust matcher again or remain unresolved.

### Scenario: captured Madigan stale cache
Given `Madigan — The News` / 279s with cached id `vuJwrcKQ7Sg`,
when that row lacks a v1.6.7 final-trust marker,
then the player does not start `vuJwrcKQ7Sg` merely because it has the legacy marker.

## Requirement: successful final-trusted matches remain cached
When a guarded matcher returns a candidate that passes v1.6.7 final trust,
then the local playback cache stores its YouTube id and `youtubeMatchFinalTrustVersion = music-only-v1.6.7`,
and later playback reuses the cached id without another resolver request.

Canonical title, artist and origin metadata MUST remain unchanged.

## Requirement: ad status uses iframe playback telemetry
Given a final-trusted canonical track is selected,
when the YouTube iframe reports PLAYING telemetry for a different video id,
then the player shows a yellow `AD m:ss` badge on the right side of the `PLAYING` row,
using iframe duration minus iframe current time for the countdown.

When iframe playback returns to the expected final-trusted video id, the badge disappears.

An untrusted/stale playback id MUST NOT be presented as an advertisement.

## Requirement: diagnostics can be saved as JSON
Each track `⋮` menu MUST keep `Copy diagnostics` as its first action and expose `Download diagnostics` as the second action.

The downloaded JSON MUST be the same `ampula-track-diagnostics-v1` payload available through the copy action and MUST include a timestamped filename.
