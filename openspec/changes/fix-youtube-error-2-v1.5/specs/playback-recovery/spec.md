# Playback recovery specification

## Requirement: valid YouTube video IDs
AmpMusic SHALL only send an 11-character URL-safe YouTube video ID to the main IFrame player and SHALL reject malformed IDs from new import/search results.

### Scenario: legacy URL ID
Given a saved legacy track whose `id` is a YouTube watch/short/youtu.be URL containing a valid video ID, when the library is loaded, then AmpMusic extracts and persists the valid 11-character video ID before playback.

## Requirement: error 2 recovery
When the main YouTube player reports error 2 for the current track, AmpMusic SHALL make at most one repair attempt for that track using the existing lazy search provider and the saved title/artist. A valid replacement result SHALL update the local library and retry playback. If no valid replacement is found, the track SHALL remain in the library and the UI SHALL report that the source needs re-importing.
