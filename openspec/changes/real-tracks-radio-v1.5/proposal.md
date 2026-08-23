# Proposal: real-track playback and explicit Radio in AmpMusic 1.5

## Problem
Apple Music imports currently resolve tracks with a permissive YouTube search matcher and then play them through the YouTube iframe. For non-Latin titles the legacy normalizer can discard most of the title, so an unrelated promo/ad-like video may win. Even a correct YouTube video can insert provider advertising before the music.

## Change
- Keep AmpMusic at public version 1.5 and preserve the existing import field/UI baseline.
- Replace Apple-import matching with a strict Unicode-aware matcher that rejects promo/ad/review/cover-style candidates unless the Apple title itself asks for that variant.
- Require strong title/artist agreement and duration agreement when Apple duration is known; unresolved tracks are skipped instead of substituting unrelated audio.
- Play Apple-imported tracks through a direct audio stream resolved from the already-matched YouTube video using public Piped `/streams/:videoId` endpoints, with the YouTube iframe only as a failure fallback.
- Add an explicit Radio control. Radio is the opt-in place for related/recommended tracks and may use Piped `relatedStreams`; it must not contaminate deterministic Apple playlist matching.
- Existing imported Apple rows are re-resolved strictly on direct playback so previously bad local matches can self-repair.

## Non-goals
- No new AmpMusic backend.
- No Apple Music account requirement.
- No public version bump beyond 1.5.
- No replacement of YouTube playback for ordinary user-pasted YouTube links.
