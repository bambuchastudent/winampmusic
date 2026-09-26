# YouTube authorization experiment

## Requirement: isolated opt-in experiment

The application SHALL not load the experiment or send any authorized request during ordinary playback. The experiment SHALL require an HTTPS, operator-configured relay and user-entered Google TV/Limited Input OAuth client identity.

### Scenario: normal playback

Given the ordinary player opens, no experiment module or auth relay runs, and its anonymous relay still strips Authorization.

## Requirement: short-lived, memory-only authorization

The experiment SHALL start a Google device-code flow for `youtube.readonly`, display Google's direct verification URL and user code, poll at or below the allowed rate until success/error/expiry/cancel, and keep credentials only in memory. It SHALL support refresh and logout/revoke. Pending and late responses SHALL not resurrect a canceled session. Different experiment instances SHALL not share state.

### Scenario: cancel or logout during a pending request

When cancellation or logout occurs before a delayed poll/refresh resolves, the late token is discarded and the report remains unauthenticated.

## Requirement: constrained credential transport

The relay SHALL reject unrelated hosts, paths, methods, origins, cookies, malformed bodies, and redirects; OAuth credentials SHALL only go to fixed Google OAuth endpoints; bearer credentials SHALL only go to fixed TV InnerTube paths. No public fallback proxy SHALL receive credentials.

### Scenario: malformed or disallowed request

The worker returns an error without contacting upstream and without echoing the supplied value.

## Requirement: independently measured results

The experiment SHALL probe the same video anonymously and with provided-token YouTube.js TV instances, distinguish OAuth completion from provider acceptance and audio availability, and expose only enum/status/count fields. Reports, errors, console output, storage, and exported files SHALL contain no OAuth codes, tokens, client secret, cookies, or signed media URL.

### Scenario: Google success but provider failure

An OAuth grant can coexist with `LOGIN_REQUIRED`, another provider status, or no audio format; the report shows that distinction without asserting playback works.
