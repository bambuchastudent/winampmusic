# Proposal — skip unresolved playback v1.7.6

## Problem

When the next library row has no final-trusted YouTube playback match, Next/track-ended recovery can wrap around and start the track that just finished again. In a sequence such as playable 40 → unresolved 41 → playable 42, playback must not replay 40 or stop on 41.

## Goal

Treat unresolved rows as skippable playback gaps while keeping their canonical Spotify/Apple identity in the library and continuing their background resolution.

## Scope

- Next and YouTube `ENDED` must continue to the next final-trusted playable row.
- The just-finished/current row must be excluded from fallback selection so queue recovery cannot replay it merely because it is the only ready row seen during wrap-around.
- An unresolved target continues resolving in the background.
- Queue recovery may wait for a later row to become playable, but must never fill that wait by restarting the current row.
- Preserve Previous direction when the immediately previous row is unresolved.

## Non-goals

- Do not delete unresolved recordings from the library.
- Do not weaken final trust or rewrite title/artist/origin metadata.
- Do not hardcode provider IDs for specific recordings.

## Success criteria

1. Given playable row 40, unresolved row 41 and playable row 42, Next plays 42.
2. The same transition happens when row 40 emits YouTube `ENDED`.
3. If row 42 becomes playable shortly after the skip begins, row 40 is not replayed while waiting; row 42 starts when ready.
4. The unresolved row remains in the library and background resolution continues.
