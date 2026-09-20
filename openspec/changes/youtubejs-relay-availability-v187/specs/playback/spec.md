# Playback delta

## Requirement: optional relay availability must not block normal playback

### Scenario: relay is absent in normal mode

Given the deployed YouTube.js relay config is empty
And AMPULAMP has an existing iframe playback handler
When the audio-first runtime loads
Then it does not replace the iframe playback handler
And a Play action remains available immediately.

### Scenario: relay is absent in diagnostic-only mode

Given the deployed YouTube.js relay config is empty
And `?playback=youtubejs` is active
When the audio-first runtime loads
Then it does not enable iframe fallback
And it reports `YOUTUBEJS ERROR · RELAY NOT CONFIGURED`.

### Scenario: relay is configured

Given the dedicated YouTube.js relay config contains a valid public URL
When the audio-first runtime loads
Then it installs the native audio-first playback override
And YouTube.js remains the primary playback path.

### Scenario: identity remains unchanged

Given relay availability changes
Then title, artist, origin, source evidence, and received Ámpula content remain unchanged.
