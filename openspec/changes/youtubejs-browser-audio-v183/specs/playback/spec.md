# Playback delta

## Requirement: YouTube.js is the preferred YouTube playback provider

When a track has a usable YouTube playback handle, the browser SHALL attempt YouTube.js audio-only resolution before iframe playback.

### Scenario: direct audio succeeds

Given a track with canonical title and artist and a YouTube playback handle
When the user starts the track
Then YouTube.js resolves an audio-only format
And the persistent native audio element plays it
And the visible status contains `YOUTUBEJS`
And title, artist, and origin remain unchanged.

### Scenario: browser CORS transport

Given the app is served from GitHub Pages
When YouTube.js performs its anonymous InnerTube requests
Then those requests use a browser-compatible relay
And cookies and authorization credentials are not forwarded.

### Scenario: user activation

Given playback resolution takes longer than the initiating tap task
When the user starts a track
Then the persistent audio element is primed synchronously during that user gesture
So the resolved native audio can start without switching to the iframe solely because user activation was lost.

### Scenario: resolver fails

Given the relay or YouTube.js cannot produce a playable audio URL
When resolution fails
Then the app shows an explicit fallback status
And delegates to existing iframe playback
And does not change musical identity.
