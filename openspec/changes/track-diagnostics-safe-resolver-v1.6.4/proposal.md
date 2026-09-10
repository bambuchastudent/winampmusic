# Proposal: Track diagnostics and safe resolver bridge v1.6.4

## Problem

Spotify/Apple origin tracks can still bypass the hardened music-only YouTube resolver. The FAST player has a legacy repair path for unresolved local ids that searches Invidious and adopts the first video result. During Spotify import, the first row can be played before background YouTube resolution finishes, so a strong text match such as a news video can start even though the hardened resolver would later choose the correct music recording.

Once playback has started, the library can also be updated to the correct YouTube id while the iframe keeps playing the earlier wrong id. The UI currently provides no compact way to distinguish stored representation, resolver decision and actual iframe playback.

## Goal

Prevent known Spotify/Apple song origins from using an untrusted legacy repair result and add per-track copyable diagnostics that make resolver/playback mismatches observable from the UI.

## Scope

- Add a `⋮` action to every library row with `Copy diagnostics`.
- Copy canonical track/origin metadata, resolver state, observed candidate metadata, stored YouTube id and actual YouTube iframe id.
- Observe resolver network responses without changing them and derive diagnostic music evidence, duration delta, score and rejection reason using the current resolver thresholds.
- Capture YouTube iframe `infoDelivery` messages so diagnostics can identify a stored-vs-actually-playing id mismatch.
- Intercept playback of known Spotify/Apple origin tracks until a current music-only resolver match is trusted.
- Mark trusted matches with a resolver-version field so stale matches are revalidated once after this upgrade.
- Preserve Spotify/Apple title and artist as canonical metadata.
- If no trustworthy match exists, preserve origin and remain unresolved rather than playing a legacy search result.

## Non-goals

- Persisting diagnostics inside an Ámpula transfer object.
- Changing the music-only thresholds introduced in v1.6.3.
- Treating YouTube title/uploader as canonical origin metadata.
- Reintroducing Spotify iframe/preview playback.

## Success criteria

1. A known Spotify/Apple origin row cannot start through the FAST player's first-search-result repair path before trusted resolution.
2. Stale pre-v1.6.4 YouTube matches are revalidated once and receive `youtubeMatchResolverVersion=music-only-v1.6.4` only after the hardened matcher succeeds.
3. Resolver failure leaves the origin intact and does not start the previous untrusted YouTube id.
4. `⋮ → Copy diagnostics` returns enough information to compare the row's stored YouTube id with the actual iframe video id.
5. Diagnostics include candidate music evidence, duration delta, diagnostic score and rejection reason when resolver network metadata was observed.
6. The Madigan — The News regression remains green: `rWWNZigf7PA` is rejected and `s1b8Q5avQZs` is the trusted music match.