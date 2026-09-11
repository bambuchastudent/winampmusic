# Proposal: final trust cache + ad diagnostics v1.7.1

## Problem
A Spotify/Apple row can preserve an older YouTube playback id and the legacy `music-only-v1.6.4` marker across re-import. The rolling queue currently treats that legacy marker as sufficient trust, so a stale false-positive can start playing even though the v1.6.7 final trust gate would reject it.

The compact ad badge also relies mainly on the app's rendered duration fields. YouTube pre-roll ads can play inside the iframe without those fields exposing the ad duration reliably, so the badge can remain hidden.

Track diagnostics can currently be copied but not saved as a file, which makes mobile bug reports cumbersome.

## Change
- Require an explicit v1.6.7 final-trust cache marker before a canonical Spotify/Apple YouTube id is considered ready for playback.
- Persist that marker only after resolution has passed the guarded public matcher.
- Re-resolve legacy cached ids instead of playing them merely because `music-only-v1.6.4` is present.
- Detect pre-roll ads from YouTube iframe `infoDelivery` telemetry when available and show the compact `AD m:ss` badge beside `PLAYING`.
- Add `Download diagnostics` as the second action in each track `⋮` menu and save the same payload as a JSON file.

## Non-goals
- Do not weaken title/artist/duration matching.
- Do not rewrite Spotify/Apple canonical identity with a YouTube match.
- Do not attempt to skip ads or expose unsupported ad metadata.
