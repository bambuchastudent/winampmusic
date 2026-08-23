# Playlist paste import requirements

## Requirement: one URL field routes by URL intent
AmpMusic 1.5 SHALL keep one music import field. A standalone YouTube video URL SHALL import one track. A YouTube URL containing a valid `list` parameter SHALL be treated as a playlist URL, including URLs that also contain a `v` parameter.

### Scenario: standalone video
Given the user pastes a YouTube video URL without `list`, when they submit the import form, then AmpMusic imports that video as one track and starts it.

### Scenario: watch URL with playlist
Given the user pastes `https://www.youtube.com/watch?v=<video>&list=<playlist>`, when they submit the import form, then AmpMusic resolves and imports the playlist rather than only `<video>`.

## Requirement: no new key or backend
Playlist resolution SHALL reuse the official YouTube IFrame Player API already loaded by AmpMusic playback and SHALL NOT require a new YouTube Data API key, server proxy, or third-party playlist API.

## Requirement: playlist import is immediate and deduplicated
When a playlist resolves to video IDs, AmpMusic SHALL pass them to the existing library import path, preserving existing deduplication. Metadata hydration MAY continue in the background after IDs are saved.

## Requirement: same-card status and failure handling
The existing import card SHALL show playlist detection, loading, completion, and failure status. Failed playlist resolution SHALL NOT remove or replace existing saved tracks.

## Requirement: version and UI stability
This feature SHALL remain in the AmpMusic 1.5 release line and SHALL NOT introduce a second playlist form or change the established visual identity.
