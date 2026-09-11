# Resolver music-search recall v1.7.4

## Problem

The final trust gate correctly rejects false-positive YouTube playback, but the current resolver searches only the generic video surface. For ambiguous names such as `Madigan — The News`, generic video results can omit the actual recording entirely, leaving a valid origin unresolved.

## Change

Keep the existing trust rules unchanged and broaden discovery by querying the YouTube Music songs surface exposed by Piped in parallel with ordinary video search. Merge and deduplicate those candidates before the existing enrichment, music-evidence, duration, scoring, and final-trust stages.

## Non-goals

- Do not weaken title/artist/duration trust.
- Do not special-case Madigan or any concrete YouTube id in production code.
- Do not rewrite Spotify/Apple canonical metadata with YouTube metadata.
