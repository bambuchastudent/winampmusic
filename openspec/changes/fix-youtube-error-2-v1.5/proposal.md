# Proposal — recover invalid YouTube track IDs in AmpMusic 1.5

## Problem
The current FAST player accepts any non-empty saved `track.id`. Older import/search paths also accepted YouTube IDs between 6 and 20 characters. YouTube IFrame Player error `2` is returned for invalid parameter values such as a malformed/non-11-character video ID, so a legacy bad library entry can reach `loadVideoById()` and fail at playback.

## Change
Keep AmpMusic at version 1.5 and harden the playback/import boundary:
- accept only valid 11-character YouTube video IDs for new imports/search results;
- normalize legacy IDs that contain a recoverable YouTube URL;
- when playback still receives error 2, use the existing lazy YouTube search provider to repair the saved track from its title/artist and retry once;
- never loop indefinitely; if repair fails, show a useful status and keep the library intact.

No UI redesign and no version change.