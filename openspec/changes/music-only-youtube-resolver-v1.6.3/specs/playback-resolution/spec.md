# Playback resolution delta

## Requirement: Known-song origins resolve only to trustworthy music

When Apple Music or Spotify identifies an input as a song, AMPULAMP MUST reject YouTube candidates that lack trustworthy music evidence. Explicit non-music metadata MUST make a candidate ineligible even when title and artist text match strongly.

### Scenario: Madigan — The News

Given source metadata `Madigan — The News` with duration about 279 seconds, and search results containing `rWWNZigf7PA` as a non-music/news video and `s1b8Q5avQZs` as the music recording, the resolver MUST reject `rWWNZigf7PA` and select `s1b8Q5avQZs`.

### Scenario: Text match is not music proof

Given a candidate whose title and uploader strongly overlap the source metadata but whose enriched genre is non-music, the resolver MUST reject it.

## Requirement: Known duration is a near-hard identity constraint

When the source duration and candidate duration are both known, a delta greater than 15 seconds MUST make the candidate ineligible. Deltas up to 3 seconds SHOULD receive the strongest duration preference, followed by deltas up to 10 seconds and then 15 seconds.

### Scenario: Large duration mismatch

Given a 279-second source recording and an otherwise music-looking 900-second candidate, the resolver MUST reject the candidate.

## Requirement: Music evidence participates in trust and ranking

The resolver MUST recognize stable music evidence including Invidious `genre=Music`, non-empty `musicTracks`, Topic uploaders, Official Audio/VEVO markers, and `Provided to YouTube by` descriptions. Optional `categoryId=10` and licensed-content metadata MAY add evidence when exposed. Licensed-content metadata alone MUST NOT establish music identity.

### Scenario: Strong official music evidence wins

Given two duration-compatible text matches that both qualify as music, the candidate with Topic/Official Audio/`genre=Music`/music metadata SHOULD rank above the weaker candidate.

## Requirement: Origin metadata remains canonical

Resolving playback to YouTube MUST NOT replace Apple Music or Spotify source `title` or `artist` with the YouTube title/uploader.

### Scenario: YouTube metadata differs

Given canonical source title/artist and a matched YouTube candidate with different presentation metadata, the stored/imported track MUST retain the source title/artist.

## Requirement: Ambiguity remains unresolved

When no candidate passes the music and duration trust gates, the resolver MUST return no reliable match so the provider adapter can preserve the origin as unresolved.
