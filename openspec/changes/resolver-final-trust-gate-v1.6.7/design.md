# Design: resolver final trust gate v1.6.7

## Ownership
`resolver-trust-v167.js` owns the final persistence-boundary validation. It is intentionally separate from the search/ranking matcher so a stale or buggy matcher result cannot self-certify as trusted.

## Validation contract
For canonical Spotify/Apple metadata with a known duration, a candidate is accepted only when:
1. YouTube id is exactly 11 URL-safe characters.
2. Candidate duration exists and differs by no more than 15 seconds.
3. Canonical title identity is present strongly enough in the candidate title. Short/ambiguous one-keyword titles require the full normalized title phrase, preventing `The News` from matching `News in the Past: Kathleen Madigan`.
4. Canonical artist identity is present in the candidate channel/artist, an enriched `musicTracks` artist, or a clear dash-separated title attribution.
5. Candidate is not live/upcoming.

The gate returns `{ ok, reason, durationDelta }` and never mutates storage.

## Integration
- Header loader loads the final trust gate before diagnostics and prefetch.
- Current-track diagnostics bridge validates the returned matcher candidate immediately before persistence.
- Prefetch validates immediately before persistence.
- Spotify compatibility background resolver validates immediately before persistence.
- Trusted resolver marker becomes `music-only-v1.6.7`; v1.6.4 rows therefore require current-track revalidation.

## Failure mode
If the gate is missing or rejects a candidate, the row remains canonical/unresolved and no trusted marker is written. Current playback fails closed rather than delegating to the legacy untrusted resolver.

## Caching
The header script query and child loader queries are bumped to v167. The service-worker cache/build id is bumped as well, reducing the chance that an older matcher/bridge remains active after deployment.
