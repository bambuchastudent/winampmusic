# Spotify origin import delta

## Requirement: successful primary metadata must not silently truncate a playlist
Given a public Spotify playlist whose primary metadata adapter returns exactly the first 100 readable tracks,
when the complete playlist contains more tracks,
then AMPULAMP MUST use the paginated metadata path before importing,
and MUST preserve the complete Spotify order up to the existing 500-track cap.

### Scenario: 160-track playlist behind a 100-track primary response
- Primary metadata returns tracks 1 through 100 successfully.
- Spotify Web API reports 160 tracks.
- The importer requests successive track pages until all 160 readable tracks are collected.
- The working library receives 160 Spotify-origin recordings in the same order.

## Requirement: completion is resilient
Given a successful primary response that looks capped,
when the completion path is unavailable,
then AMPULAMP MUST retain and import the readable primary rows rather than fail the import solely because completion failed.

## Requirement: completion cannot change musical identity
For every completed row, Spotify source `title`, `artist`, track id, playlist id and origin metadata remain canonical. A playback provider match MUST NOT overwrite source title/artist/origin.