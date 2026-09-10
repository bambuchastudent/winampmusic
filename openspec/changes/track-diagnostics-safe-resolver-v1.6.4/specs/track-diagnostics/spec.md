# Track diagnostics and safe resolution specification delta

## Requirement: Known song origins use trusted resolution before playback

A Spotify- or Apple-origin recording MUST NOT start playback from an unresolved or stale YouTube representation until the current music-only resolver has accepted that representation.

### Scenario: Spotify row is played before background resolution completes

Given a Spotify-origin row with canonical title, artist and duration but only a local recording id,
when playback is requested before background YouTube resolution completes,
then playback MUST invoke the hardened shared resolver,
and the FAST player's legacy first-search-result repair MUST NOT be allowed to start a candidate first.

### Scenario: Pre-upgrade YouTube id is present

Given a Spotify- or Apple-origin row with a valid YouTube-shaped id but no current resolver-version marker,
when playback is requested after upgrading to v1.6.4,
then the row MUST be revalidated once with the current music-only resolver,
and only a successful result may receive `youtubeMatchResolverVersion=music-only-v1.6.4`.

## Requirement: Resolver failure is safer than untrusted playback

When no trustworthy music candidate is available, origin metadata MUST be preserved and the player MUST remain unresolved instead of starting an older untrusted candidate.

### Scenario: Strong text match is a news video

Given a song-origin recording whose search results contain a non-music video with strong title token overlap,
when the music-only resolver rejects every candidate,
then playback MUST NOT delegate to the legacy repair result,
and the UI MUST report that no trustworthy YouTube match is available.

## Requirement: Track diagnostics are copyable per row

Every rendered library row MUST expose a compact action menu containing `Copy diagnostics` without triggering playback.

### Scenario: User copies diagnostics while the wrong iframe video is playing

Given a library row whose stored YouTube id differs from the video currently reported by the YouTube iframe,
when the user selects `⋮ → Copy diagnostics`,
then the copied JSON MUST include the full stored row metadata, the stored YouTube id, the actual iframe YouTube id and `storedVsActualMismatch=true`.

## Requirement: Resolver diagnostics expose trust evidence

Copied diagnostics SHOULD include recently observed resolver search/detail metadata and derived trust evaluation for candidates when those network responses were visible to the current page runtime.

### Scenario: Candidate is rejected by duration or music gate

Given observed candidate metadata and a canonical source duration,
when diagnostics are copied,
then each reconstructed candidate SHOULD expose duration delta, music-evidence score, diagnostic match score, acceptance state and a rejection reason when rejected.

## Requirement: Canonical origin metadata survives resolution

Trusted YouTube resolution MUST NOT replace Spotify/Apple canonical title and artist with YouTube title/uploader metadata.

### Scenario: Trusted YouTube match is adopted

Given canonical Spotify or Apple title and artist,
when a trusted YouTube candidate is adopted,
then only mutable playback fields such as `id`, `youtubeMatchId`, resolver-version marker and playback provider may change,
and canonical title/artist MUST remain unchanged.