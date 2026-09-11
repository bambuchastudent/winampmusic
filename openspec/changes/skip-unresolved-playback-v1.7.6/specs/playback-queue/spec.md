# Playback queue delta — skip unresolved v1.7.6

## Requirement: unresolved next rows are skipped

When navigation requests an unresolved row and a later final-trusted playable row exists, the client MUST play that later row instead of replaying the current row or stopping on the unresolved row.

### Scenario: Next skips one unresolved row

Given row 40 is current and playable, row 41 is unresolved, and row 42 is final-trusted playable, when the user presses Next, row 42 starts.

### Scenario: track end skips one unresolved row

Given row 40 reaches YouTube `ENDED`, row 41 is unresolved, and row 42 is final-trusted playable, automatic continuation starts row 42.

### Scenario: multiple consecutive unresolved rows are skipped

Given row 40 is current and playable, rows 41 and 42 are unresolved, and row 43 is final-trusted playable, Next or automatic continuation skips rows 41 and 42 and starts row 43.

## Requirement: current row is not a recovery candidate

The row that was current immediately before unresolved recovery begins MUST be excluded from fallback selection for that recovery attempt.

### Scenario: later row resolves while waiting

Given row 40 is current, rows 41 and 42 are initially unresolved, and row 42 becomes final-trusted shortly after recovery starts, row 40 is not restarted and row 42 starts when it becomes ready.

## Requirement: skip preserves unresolved identity

Skipping an unresolved row MUST NOT remove or rewrite that recording. Its background resolution MAY continue after playback has moved on.
