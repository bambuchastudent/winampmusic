# Design: resolver final trust gate v1.6.7

## Ownership
`resolver-trust-v167.js` owns the final validation layer. It is intentionally separate from the search/ranking matcher so a stale or buggy matcher result cannot self-certify as trusted.

## Validation contract
For canonical Spotify/Apple metadata with a known duration, a candidate is accepted only when:
1. YouTube id is exactly 11 URL-safe characters.
2. Candidate duration exists and differs by no more than 15 seconds.
3. Canonical title identity is present strongly enough in the candidate title. Short/ambiguous one-keyword titles require the full normalized title phrase, preventing `The News` from matching `News in the Past: Kathleen Madigan`.
4. Canonical artist identity is present in the candidate channel/artist, an enriched `musicTracks` artist, or a clear dash-separated title attribution.
5. Candidate is not live/upcoming.

The gate returns `{ ok, reason, durationDelta }` and does not persist a match itself.

## Integration
- Header loader loads the final trust gate before diagnostics and prefetch.
- The gate wraps `window.winampMusicAppleImport.findYouTubeMatch` synchronously when that public API is assigned.
- Current-track diagnostics, two-track prefetch, and Spotify compatibility resolution already consume that public matcher API, so all three receive the guarded function without duplicating validation logic.
- Existing Spotify/Apple rows carrying `music-only-v1.6.4` are migrated once by removing only the trust marker. The old YouTube id is retained as diagnostic/revalidation input.
- A good guarded result may still be persisted by legacy consumers with their existing marker; the independent gate guarantees it passed v1.6.7 validation first.

## Failure mode
If the gate rejects a matcher result, it throws `Final trust gate rejected: <reason>`. Existing diagnostics records that exact error as the resolver rejection reason. Current playback remains fail-closed rather than delegating to the legacy untrusted resolver.

## Caching
Diagnostics and prefetch child loader queries are bumped to `v=167`, and the service-worker build/cache id is bumped to v1.6.7/v168 so old runtime assets are replaced on update.
