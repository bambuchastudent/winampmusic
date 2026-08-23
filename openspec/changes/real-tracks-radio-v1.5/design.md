# Design

## Strict Apple -> YouTube match
A 1.5 bootstrap patch installs before the lazy Apple importer. When `winampMusicAppleImport` is assigned, the patch replaces the exported `findYouTubeMatch` and main-field `handleUrl` with strict versions.

Matching rules:
- Unicode letters/numbers are preserved during normalization, including Cyrillic.
- significant Apple title tokens must be present in the candidate title;
- Apple artist tokens must agree with candidate title/uploader;
- when both durations are known, large duration mismatches are rejected;
- advertisement/promo/commercial/trailer/review/reaction/cover/remix/live variants are rejected unless the Apple source title contains that variant;
- official-audio / Topic / verified uploader signals improve ranking;
- if no candidate passes the strict threshold, the track remains unresolved instead of choosing the best bad result.

Piped search is primary and existing Invidious-compatible search is fallback. This remains client-only.

## Direct playback for imported Apple tracks
A lightweight adapter owns direct playback only for tracks tagged `Apple Music` or `Radio`. It resolves Piped `/streams/:videoId`, prefers a playable audio stream, and drives a single `Audio` element. The existing FAST YouTube player remains untouched and remains the owner for ordinary YouTube imports.

The adapter captures library/control clicks only while a direct track is involved. If direct audio cannot be resolved, it falls back to the existing `window.playIndex` path.

Before playing an Apple row, the adapter re-runs strict matching from stored Apple title/artist/duration and repairs the persisted local track id when needed. This lets older bad local matches self-heal without forcing a library reset.

## Radio
A fifth player control (`📻`) starts Radio. Radio reads `relatedStreams` from the current Piped stream payload, chooses a non-noisy related video, saves it as a `Radio` track, and plays it through the same direct-audio path. Related/fuzzy discovery is therefore explicit and opt-in rather than used as the truth source for Apple imports.

## Failure behavior
- Strict matcher failure: skip/unresolved; never substitute a low-confidence result.
- Piped direct-stream failure: fall back to the existing YouTube iframe for that exact matched video id.
- Autoplay policy rejection: keep the direct source loaded and show a tap-play state.
