# Spotify origin import delta

## Requirement: public playlist import survives a stalled primary metadata adapter
Given a valid public Spotify playlist URL,
when the primary wolfX `/api/playlist/:id` request times out or fails,
and the wolfX anonymous token endpoint plus Spotify Web API are available,
then the playlist is imported from Spotify Web API metadata,
and the canonical Spotify title, artist, duration, playlist id, and track ids are preserved.

## Requirement: fallback paginates without changing playback policy
Given a Spotify playlist with more than one Web API page,
when fallback import runs,
then the client reads pages until the playlist is complete or 500 tracks are collected,
and it does not invoke the YouTube matcher merely because metadata was imported.

## Requirement: already-resolved local playback remains local cache
Given a re-imported Spotify recording that already has a trusted local playback match,
when metadata is refreshed through either source,
then the existing playback id/cache fields are preserved while Spotify origin metadata is refreshed.

## Requirement: failures are bounded and visible
A stalled primary request must be aborted independently before fallback begins.
During failover the import status reports `Spotify metadata retry…`.
The user sees a final import error only after both primary and fallback paths fail.