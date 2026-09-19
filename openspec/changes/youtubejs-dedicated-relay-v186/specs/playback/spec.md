# Playback delta

## Requirement: provider playback transport is separated from Ámpula alias transport

### Scenario: short-link relay stays provider-agnostic

Given the repository contains optional playback integrations
When the short-link Worker is inspected
Then it contains no YouTube/provider routing logic
And continues to store only opaque Ámpula alias payloads.

### Scenario: dedicated YouTube.js relay is configured

Given Cloudflare credentials are available during Pages delivery
When the YouTube.js relay deploys and passes `/healthz`
Then CI writes its public HTTPS base URL to `youtubejs-relay-config.js`
And the browser adapter prefers that relay for allowed YouTube.js requests.

### Scenario: dedicated relay is unavailable

Given the playback relay is not configured or fails health verification
When Pages is published
Then `window.AMPULA_YOUTUBEJS_RELAY` remains empty
And Pages deployment still succeeds.

### Scenario: identity remains unchanged

Given any dedicated relay success or failure
Then title, artist, origin and source evidence remain unchanged.
