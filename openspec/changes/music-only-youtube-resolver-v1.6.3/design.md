# Design

## Architecture

The existing Apple import matcher remains the shared browser-side resolver. Spotify continues to call the same `findYouTubeMatch` API; provider adapters keep ownership of canonical origin metadata.

Resolution becomes two-stage:

1. Search Piped and Invidious concurrently and deduplicate candidates by YouTube video ID.
2. Pre-rank cheaply, keep at most 10 candidates, enrich them through a healthy Invidious `/api/v1/videos/:id` endpoint, apply trust gates, then perform final scoring.

## Music trust gate

A known-song candidate is ineligible when it is live/upcoming, has an explicit non-Music genre/category, or conflicts with a known source duration by more than 15 seconds. When source duration is known, a candidate with no usable duration is also ineligible.

Eligible candidates additionally require strong music evidence. Stable Invidious signals are preferred: `genre=Music`, non-empty `musicTracks`, Topic uploader, Official Audio/VEVO wording, or `Provided to YouTube by` metadata. `categoryId=10` and `licensedContent` are consumed opportunistically if an instance exposes them, but are not required by the Invidious API contract.

`licensedContent` alone is not enough to prove music.

## Duration

For a known source duration:

- delta <= 3 s: strongest duration bonus;
- delta <= 10 s: acceptable;
- delta <= 15 s: weakly acceptable;
- delta > 15 s: reject before scoring.

## Metadata ownership

The matcher returns playback candidate data only. Apple and Spotify adapters retain their source `title` and `artist`; YouTube title/uploader must not overwrite them.

## Failure modes

- Invidious detail enrichment failure: search-level strong music evidence may still qualify a candidate, but ambiguous candidates remain unresolved.
- All search providers fail: preserve existing no-match behavior.
- No trustworthy candidate: throw `No reliable YouTube match found`; provider adapters preserve origin metadata and unresolved state.
- Abort: propagate the abort rather than converting it into a candidate or ordinary no-match result.

## Performance

Search providers are queried concurrently with bounded timeouts. Detail requests for the shortlist are concurrent and use a healthy Invidious base discovered during search so the Spotify per-track resolver timeout remains bounded.
