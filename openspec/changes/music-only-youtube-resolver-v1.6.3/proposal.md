# Music-only YouTube resolver v1.6.3

## Problem

Apple Music and Spotify imports are known recordings, but the shared YouTube matcher can currently accept an arbitrary video when title/artist tokens score highly. For example, `Madigan — The News` can resolve to the non-music video `rWWNZigf7PA` instead of the recording `s1b8Q5avQZs`.

## Goal

Make cross-provider resolution conservative: a known song origin may resolve only to a trustworthy music video with compatible duration. Prefer leaving a track unresolved over selecting non-music content.

## Scope

- Harden `window.winampMusicAppleImport.findYouTubeMatch`, shared by Apple and Spotify flows.
- Search both Piped and Invidious, then enrich a small shortlist through Invidious video metadata.
- Apply a music-only eligibility gate before final scoring.
- Treat source duration as a near-hard constraint when it is known.
- Preserve source-provider title and artist as canonical metadata after resolution.

## Non-goals

- No Spotify playback or iframe/embed restoration.
- No centralized resolver service.
- No change to Ámpula Core identity semantics.
- No attempt to guarantee a YouTube match for every recording.

## Success criteria

- `Madigan — The News` (~4:39) rejects `rWWNZigf7PA` and selects `s1b8Q5avQZs` when both are returned by search.
- Non-music candidates are rejected even with strong text matches.
- Candidates more than 15 seconds away from a known source duration are rejected.
- Topic, Official Audio, `genre=Music`, `musicTracks`, and equivalent strong music evidence improve trust/ranking.
- If no candidate passes the trust gate, the resolver reports no reliable match.
- Apple/Spotify canonical title and artist survive YouTube resolution unchanged.
