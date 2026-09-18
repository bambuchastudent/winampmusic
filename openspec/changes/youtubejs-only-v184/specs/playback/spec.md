# Playback delta

## Requirement: YouTube.js-only mode isolates the playback provider

When `playback=youtubejs` is present, AMPULAMP SHALL use YouTube.js as the only YouTube playback transport.

### Scenario: iframe is disabled

Given the page URL contains `playback=youtubejs`
When the player boots
Then FAST does not load or warm the YouTube iframe API
And iframe retry is not loaded.

### Scenario: Play is owned by YouTube.js

Given isolation mode and a track with a valid YouTube playback handle
When the user presses Play
Then the action resolves through YouTube.js
And no existing iframe state can bypass the YouTube.js adapter.

### Scenario: YouTube.js fails

Given isolation mode
When YouTube.js resolution or native audio playback fails
Then the visible status starts with `YOUTUBEJS ERROR`
And the iframe fallback is not invoked.

### Scenario: identity is preserved

Given any isolation-mode playback attempt
Then title, artist, origin, and source evidence are not rewritten by the playback adapter.
