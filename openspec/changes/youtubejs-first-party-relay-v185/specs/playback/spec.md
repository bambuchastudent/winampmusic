# Playback delta

## Requirement: browser YouTube.js can use a first-party relay

When the optional project relay is configured, AMPULAMP SHALL prefer it for YouTube.js API/player requests.

### Scenario: configured relay

Given `window.AMPULA_SHORT_LINK_RELAY` contains the deployed Worker origin
When YouTube.js requests an allowed YouTube endpoint
Then the browser sends the same method/body and permitted headers through `/youtubejs/*`
And the Worker reconstructs an HTTPS request to the allowed target host.

### Scenario: no credentials leak

Given a proxied request
When the Worker constructs the upstream request
Then Cookie, Authorization, and Proxy-Authorization are not forwarded.

### Scenario: unrelated host is rejected

Given a browser requests `/youtubejs/*?__host=example.com`
Then the Worker returns 403
And does not fetch the target.

### Scenario: identity remains independent

Given a relay succeeds or fails
Then playback state may change
But stored title, artist, origin and source evidence are unchanged.

### Scenario: relay is unavailable

Given production has no configured project relay
When YouTube.js-only playback is attempted
Then fallback diagnostics may run
And iframe playback remains disabled in YouTube.js-only mode.
