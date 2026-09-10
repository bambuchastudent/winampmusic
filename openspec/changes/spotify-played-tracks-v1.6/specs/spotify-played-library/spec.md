# Spotify played-track library

## Requirement: retain only tracks that actually play
When the Spotify IFrame API fires `playback_started` for a `spotify:track:<id>` inside an opened playlist, the application MUST retain that track in the local library. Merely opening a playlist MUST NOT bulk-copy all playlist entries into the library.

### Scenario: first heard track
Given a Spotify playlist is open
When Spotify reports `playback_started` for a track
Then the application resolves public display metadata in the background
And adds exactly one corresponding local-library entry
And Spotify playback continues independently of that work.

## Requirement: preserve Spotify provenance
Each retained Spotify-played entry MUST preserve the Spotify track id and canonical track URL plus the source playlist id and canonical playlist URL. Available playlist title/owner and last-played timestamp SHOULD also be retained.

### Scenario: playlist backlink survives
Given a track was retained from playlist P
When the user later reloads the application
Then the local record still contains a Spotify track link
And still contains a backlink to playlist P.

## Requirement: repeated playback does not duplicate
The same Spotify track id MUST NOT produce multiple local rows when it is played more than once.

### Scenario: replay
Given Spotify track S has already been retained
When `playback_started` fires for S again
Then the existing record is enriched/updated
And the library row count does not increase.

## Requirement: provider playback remains Spotify
Retention MUST NOT switch the active Spotify playlist to YouTube or another provider while the Spotify embed is playing.

### Scenario: fallback resolution
Given the client can resolve a YouTube candidate for a Spotify-played recording
When the Spotify track is retained
Then the YouTube id MAY be stored as a future fallback
But the currently playing Spotify embed MUST remain active.

## Requirement: metadata failure is non-blocking
If Spotify oEmbed or optional fallback matching fails, playback MUST continue. The application MUST NOT invent an artist or save a misleading anonymous row solely from the provider id.

### Scenario: oEmbed unavailable
Given Spotify reports a track URI
And Spotify oEmbed cannot return a title
Then no malformed track is added
And the next real play of that track may retry retention.