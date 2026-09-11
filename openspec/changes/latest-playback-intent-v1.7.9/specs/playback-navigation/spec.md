# Playback navigation delta v1.7.9

## Requirement: the latest playback intent wins

Every explicit navigation request establishes a newer playback intent. Async work started for an older request MUST NOT start or replace playback after a newer track selection, Next, Previous, Play, or Pause intent exists.

### Scenario: stale explicit resolver finishes after a newer track tap
Given row 3 is unresolved and its explicit selection starts asynchronous resolution, when the user selects ready row 5 before row 3 resolves, then row 5 starts and a later row-3 resolver completion MUST NOT call the underlying player for row 3.

### Scenario: sequential Next remains authoritative
Given row 5 is current, Shuffle is OFF, row 6 is unresolved, and row 7 is ready, when Next is requested, row 7 starts. Older resolver completions MUST NOT replace row 7 afterward.

## Requirement: pending playback has a real Pause affordance

Once the user has requested playback, the primary transport control MUST expose Pause while player startup is pending. It MUST NOT replace the transport control with an ellipsis-only loading glyph.

### Scenario: pause while startup is pending
Given a play request is waiting for the provider/player to become ready, when the user presses Pause, the pending play intent is cancelled and a later provider-ready callback MUST NOT start playback for that cancelled request.

## Requirement: identity remains separate from playback resolution

Cancelling or superseding navigation requests MUST NOT rewrite title, artist, origin metadata, or origin provider from a playback candidate. Resolver results may only update local playback state/handles according to the existing trust contract.
