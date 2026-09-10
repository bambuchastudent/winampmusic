# Design: Track diagnostics and safe resolver bridge v1.6.4

## Failure path

The hardened resolver introduced in v1.6.3 is not the only code capable of assigning a YouTube id.

For Spotify origin import the current ordering is:

1. Import canonical Spotify metadata as a normal Ámpula library row.
2. The row initially receives a provider-independent local recording id.
3. Schedule immediate playback of the first imported row.
4. Resolve Spotify rows to YouTube in the background using the hardened shared matcher.

The FAST core sees the first row before step 4 finishes. Because its id is not yet a valid YouTube id, `repairCurrentTrack()` runs its older `findRepairCandidate()` implementation. That path takes the first Invidious video result and has no music-only gate. A news result can therefore start before the hardened resolver finishes.

There is a second observability problem: after the background resolver updates local storage to the correct YouTube id, the already-loaded YouTube iframe can keep playing the earlier video. Looking only at the persisted row is therefore insufficient to diagnose the failure.

## Playback bridge

`track-diagnostics-v164.js` wraps the public `window.playIndex` entry point used by row clicks and Spotify autoplay.

Before delegating to the FAST core it checks whether the row is a known song origin (Spotify or Apple) and whether the current YouTube representation has been certified by the current trusted resolver version.

A row needs trusted resolution when:

- it is a known Spotify/Apple song origin; and
- it has no valid YouTube id, or its `youtubeMatchResolverVersion` is not `music-only-v1.6.4`.

The bridge invokes the existing shared `window.winampMusicAppleImport.findYouTubeMatch` resolver with canonical title, artist and duration. It does not implement a second playback matcher.

On success it updates only mutable playback fields:

- `id`
- `youtubeMatchId`
- `youtubeMatchResolverVersion`
- `playbackProvider`
- playback badge

Canonical title, artist and provider-origin fields are copied from the current library row and remain authoritative.

On failure the bridge does not delegate to the FAST core, which prevents its legacy first-result repair path from running for known song origins. The row remains available with origin metadata and the status reports that no trustworthy YouTube match exists.

The version marker intentionally causes one revalidation of pre-v1.6.4 matches. This repairs stale valid-looking YouTube ids that cannot otherwise be distinguished from matches produced by the hardened resolver.

## Diagnostics UI

Every `.track[data-index]` row is decorated with a `⋮` button. The menu is outside `.track-main`, stops event propagation and therefore cannot trigger playback. The only current action is `Copy diagnostics`.

The copied JSON contains:

- app/runtime versions and capture timestamp;
- the complete current library row including origin/provenance fields;
- current resolver trust version and whether the row still needs trusted resolution;
- the latest trusted-resolution trace for that recording;
- observed resolver candidates with derived trust diagnostics;
- UI/player state;
- stored YouTube representation;
- actual YouTube iframe representation when observed;
- recent resolver network summaries.

## Resolver network observation

The diagnostics runtime wraps `window.fetch` transparently. Only requests matching known Piped/Invidious resolver search or video-detail endpoints are inspected. The original response is returned unchanged; diagnostics parse a cloned response asynchronously.

The in-memory trace is bounded and not transferred with an Ámpula. Search payloads retain only a compact top-candidate summary. Video-detail responses retain fields relevant to the current music gate: duration, genre, category id, keywords, music tracks, licensing, live/upcoming flags, author and a bounded description excerpt.

For diagnostics, the runtime mirrors the current v1.6.3 thresholds to report why an observed candidate would be rejected: music evidence, duration delta, match score and explicit gate reason. These calculations are explanatory only; actual playback trust still comes from the shared hardened resolver.

## Actual iframe playback observation

The YouTube iframe API communicates with the page through `postMessage`. The diagnostics runtime listens only for YouTube origins and `infoDelivery` messages, recording the most recent `videoData.video_id`, title, author, player state, current time and duration.

This lets the copied payload distinguish:

- `storedYoutubeId`: what the library currently says should play; and
- `actualYoutubeId`: what the iframe reports it is playing.

`storedVsActualMismatch` makes the race visible even if persistence was corrected after playback had already started.

## Loading

The existing deferred `header-visualizer-v159.js` is used as the lightweight loader for `track-diagnostics-v164.js`. The diagnostics runtime has an explicit v1.6.4 cache-busting query and a script marker to avoid duplicate insertion.

## Safety and fallback

For known Spotify/Apple song origins, no match is preferable to an untrusted match. The bridge therefore fails closed when the hardened resolver is unavailable, times out, or reports no reliable candidate. It does not erase provider origin metadata and does not copy YouTube title/uploader into canonical recording identity.
