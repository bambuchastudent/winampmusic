# Design

`apple-music-import-v064.js` remains the shared playback matcher. Candidate discovery will fan out to:

- Piped `filter=videos` using the canonical `artist title` query;
- Piped `filter=music_songs` using the same canonical query;
- existing Invidious video search.

All requests stay parallel and bounded by the existing per-request timeout. Results are merged by YouTube id, then pass through the existing shortlist, metadata enrichment, music-evidence threshold, duration constraint, ranking, exclusion list, and external final-trust gate.

This improves recall without changing identity or confidence rules. A candidate found only through the music-song surface is still rejected if it fails the normal trust checks.
