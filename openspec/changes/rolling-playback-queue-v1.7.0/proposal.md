# Proposal: rolling playback queue v1.7.0

## Problem
ÁmpulaMP warms exactly the next two playlist positions. If the first unresolved Spotify/Apple origin row has no strict YouTube match, automatic playback stops at that row even when later tracks are playable. Successful resolutions also need to remain durable in the browser cache and in FAST's live in-memory library.

The compact player screen also gives no visual clue when the embedded YouTube player is temporarily showing an advertisement.

## Change
- Maintain two **playable** tracks ahead, scanning past unresolved failures instead of treating positions N+1/N+2 as the goal.
- On automatic end-of-track advance, skip an origin row only when strict resolution fails; preserve that row unresolved and continue to the next trusted playable row.
- Keep manual selection fail-closed: tapping an unresolved track must not silently jump elsewhere.
- Synchronize successful trusted resolutions into both FAST live playback state and `winampmusic.library.v1`; cached trusted rows are reused without another resolver call.
- Add a minimal yellow `AD mm:ss` indicator on the right side of the green screen's top `PLAYING` row. It is shown only when canonical Spotify/Apple duration exists and the active iframe-reported duration differs beyond the strict resolver tolerance, and the timer shows estimated remaining ad time.

## Non-goals
- Do not loosen the final trust gate or accept the 205s `Back Roads 2018 Youri Lentjes - God Shaped Hole` video for the 180s Spotify recording.
- Do not claim access to YouTube ad metadata, title, click-through URL, or skip controls.
- Do not resolve an entire 100-track playlist eagerly.