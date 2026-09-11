# Playback resolution delta — full-library background resolution v1.7.5

## Requirement: full working library is eligible for background resolution

After unresolved Spotify/Apple-origin tracks enter the working library, the client MUST schedule every unresolved row for local playback resolution. Resolution MUST NOT be limited to a fixed number of tracks ahead of the current position.

### Scenario: four unresolved rows behind the current track

Given one playable current row followed by four unresolved origin rows, when playback begins, all four unresolved rows are scheduled for resolution without moving playback through them first.

## Requirement: long search is bounded but not prematurely aborted

A recording resolution attempt MUST have a total search budget of at least 120 seconds. Individual public-instance requests MAY use shorter independent timeouts so one dead endpoint does not block the entire attempt.

### Scenario: exact result appears after an initial page miss

Given `Madigan — The News` with duration 279 seconds, and an initial search page that contains only the rejected `vuJwrcKQ7Sg`, when a later Piped search page contains `s1b8Q5avQZs` with matching identity/duration, the resolver returns `s1b8Q5avQZs` after final trust validation.

## Requirement: deeper discovery does not weaken identity trust

Every candidate discovered by alternate queries or pagination MUST pass the existing final trust boundary before persistence. Discovery MUST NOT rewrite canonical title, artist or origin metadata.

### Scenario: weak generic result remains rejected

Given canonical `Madigan — The News` and a generic result `News in the Past: Kathleen Madigan` / `Laugh Society - Ladies First` / 262 seconds, the result remains rejected even when deeper search is enabled.

## Requirement: unresolved playback continues

When a requested row is still unresolved and another final-trusted playable row exists later in the working library, playback MUST continue to the next available playable row instead of stopping at the unresolved row.

### Scenario: next row is unresolved but a later row is ready

Given current row 0, unresolved row 1, and playable row 2, when playback requests row 1 and it is not ready, row 2 is played. Resolution of row 1 MAY continue in the background.

## Requirement: queue scan covers the complete library

Queue recovery MUST be able to inspect every other row in the current library before reporting that no playable track exists.

### Scenario: first playable row is farther than twelve positions away

Given a library where rows 1 through 12 are unresolved and row 13 is final-trusted playable, recovery from row 0 reaches and plays row 13.
