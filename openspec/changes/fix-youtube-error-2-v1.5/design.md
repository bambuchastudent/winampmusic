# Design

## Root cause
The FAST player currently treats every non-empty saved `track.id` as a YouTube video ID. Legacy normalization and the lazy Invidious search path accepted IDs matching 6–20 URL-safe characters, while YouTube video IDs must be 11 characters. Those malformed legacy/search entries can therefore reach `YT.Player.loadVideoById()` and produce player error 2.

## Prevention
New imports and search results must use a strict `^[A-Za-z0-9_-]{11}$` video-ID contract. The player also normalizes legacy IDs that are actually full YouTube URLs and stores the extracted 11-character ID.

## Recovery
If the main player emits error 2 for the current track, AmpMusic retries at most once. It lazy-loads/reuses the existing YouTube search module, searches using the saved title and artist, accepts only an exact 11-character result, replaces the malformed ID in the existing local-library entry, persists/rerenders, and retries playback. If no safe replacement can be found, the track is kept and the player reports that the source needs re-importing.

## Safety
Recovery is scoped to error 2 only and guarded per track to prevent loops. Errors 5/100/101/150/153 keep their existing behavior and are not silently remapped.