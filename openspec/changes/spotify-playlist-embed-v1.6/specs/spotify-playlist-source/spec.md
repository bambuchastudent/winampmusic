# Spotify playlist source

## Requirement: recognize Spotify playlist links
AMPULAMP MUST recognize `https://open.spotify.com/playlist/<id>` in the unified music entry and MUST NOT route it to YouTube or Apple importers.

### Scenario: direct Spotify playlist
Given the unified input contains `https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L`
When the user submits the form
Then AMPULAMP opens a Spotify source panel for playlist `3A4l0emm89zzee5bzE7E0L`
And clears the unified input.

## Requirement: known wrapper alias
AMPULAMP MUST map explicitly registered share-wrapper aliases without pretending to provide generic URL unshortening.

### Scenario: Better Call Saul shared Google link
Given the unified input contains `https://share.google/T0seuEuCz8Wdpksp3`
When the user submits the form
Then AMPULAMP opens Spotify playlist `3A4l0emm89zzee5bzE7E0L`.

## Requirement: optional provider playback
Spotify playback MUST use Spotify's official Embed/IFrame API and MUST stay outside the core startup path and Ámpula Core.

### Scenario: Spotify unavailable
Given Spotify's embed script cannot load
When a Spotify playlist is opened
Then AMPULAMP remains usable
And the Spotify panel exposes an `Open in Spotify` link.

## Requirement: local source state
Closing a Spotify source MUST NOT mutate `Your library`. A successfully opened Spotify source MAY be restored after refresh from optional local UI state.
