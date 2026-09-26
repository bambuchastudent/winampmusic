# YouTube.js diagnostic delta

## Requirement: explain known restriction categories safely

When player information identifies a known bot-confirmation, age-confirmation, or sign-in restriction, the local playback diagnostic SHALL expose the corresponding stable category. Unrecognized or localized evidence SHALL be `UNKNOWN`. The diagnostic SHALL NOT expose raw upstream reason/screen text.

## Requirement: report request provenance safely

A YouTube.js resolution diagnostic SHALL include a safe timestamp and the winning transport label for the associated YouTube player request when available. Missing evidence SHALL be `UNKNOWN`. Overlapping resolutions SHALL NOT display another video's transport as their own. Diagnostics SHALL NOT include request URLs, signed media URLs, cookies, authorization headers, or tokens.

## Requirement: preserve resolution and fallback behavior

The adapter SHALL retain the existing `resolveAudio(videoId, suppliedInnertube)` API, anonymous transport behavior, bounded WEB-to-YTMUSIC retry eligibility, and iframe fallback for `LOGIN_REQUIRED`. Diagnostics SHALL NOT cause a restricted video to be marked permanently unavailable or trigger additional resolution actions.

### Scenario: known and unknown restriction evidence

- GIVEN a failed stream lookup with playability status `LOGIN_REQUIRED`
- WHEN the basic-info reason indicates bot confirmation or age confirmation, or the status/reason indicates sign-in
- THEN the report exposes the matching allowlisted category
- AND the report contains no raw upstream reason text

### Scenario: unknown restriction evidence

- GIVEN a failed stream lookup with an unrecognized playability status and localized reason
- WHEN the diagnostic is created
- THEN the restriction category is `UNKNOWN`
- AND the report contains no raw upstream reason text

### Scenario: overlapping video resolutions

- GIVEN two unresolved video IDs whose player requests succeed through different transports
- WHEN their basic-info requests complete in overlapping order
- THEN each report names only the transport recorded for its own video ID

### Scenario: overlapping requests for the same video

- GIVEN two overlapping basic-info lookups for the same video ID
- WHEN their player requests cannot be attributed unambiguously
- THEN both reports use `UNKNOWN` for player transport

### Scenario: explicit sign-in restriction

- GIVEN WEB has no streaming data and basic info returns `LOGIN_REQUIRED`
- WHEN resolution fails
- THEN no YTMUSIC request is attempted and normal mode retains iframe fallback
