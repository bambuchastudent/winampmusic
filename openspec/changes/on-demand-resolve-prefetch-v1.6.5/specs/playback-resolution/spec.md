# Playback resolution delta v1.6.5

## Requirement: Playlist import preserves unresolved recordings

A Spotify playlist import MUST persist recording metadata and provenance without requiring a YouTube match for every imported row.

### Scenario: Metadata-only import

- GIVEN a readable Spotify playlist
- WHEN it is imported with playback disabled
- THEN every track is added to the Ámpula library
- AND no YouTube matcher call is required by the import
- AND unresolved rows remain valid library entries

## Requirement: Current playback remains fail-closed

A known Spotify/Apple song origin that lacks a current trusted YouTube representation MUST use the existing hardened music-only resolver before playback.

### Scenario: No trustworthy current match

- GIVEN the current row is a known song origin
- AND the hardened resolver finds no trustworthy music candidate
- WHEN playback is requested
- THEN the row remains unresolved
- AND legacy first-result repair MUST NOT be used

## Requirement: Two tracks ahead are prefetched

After a playback request for library index N, the player MUST asynchronously consider the next two library rows for trusted resolution.

### Scenario: Three unresolved future rows

- GIVEN N+1, N+2 and N+3 are unresolved known song origins
- WHEN playback is requested for N
- THEN N+1 and N+2 are submitted for trusted resolution
- AND N+3 is not submitted yet

### Scenario: Playback advances

- GIVEN N+2 is already trusted and N+3 is unresolved
- WHEN playback advances from N to N+1
- THEN the prefetch window advances
- AND N+3 is submitted for trusted resolution

## Requirement: Prefetch does not block playback

Prefetch jobs MUST be launched after delegating the current `playIndex()` request and MUST NOT be awaited by the current playback call.

## Requirement: Canonical metadata survives resolution

Successful prefetch resolution MAY change playback representation fields but MUST preserve provider-origin title, artist and provenance.

### Scenario: YouTube metadata differs

- GIVEN a Spotify row title and artist differ from the selected YouTube video's title/uploader formatting
- WHEN prefetch succeeds
- THEN Spotify title and artist remain canonical
- AND the trusted YouTube id is stored only as playback representation

## Requirement: Live FAST state is synchronized

A successful prefetched id MUST be adopted by the FAST player's current in-memory library as well as persisted storage, so the next playback request can use it without a page reload.