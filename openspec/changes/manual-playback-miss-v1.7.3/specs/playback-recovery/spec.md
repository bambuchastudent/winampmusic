# Playback recovery delta

## Requirement: reject only the playback candidate

When the user marks the current YouTube playback as `MISS`, the client MUST reject that YouTube candidate without deleting or rewriting the canonical recording identity.

### Scenario: wrong YouTube candidate is rejected

Given a Spotify-origin row with canonical title `The News`, artist `Madigan`, duration `279`, and current YouTube playback ID `vuJwrcKQ7Sg`
When the user presses `MISS`
Then playback of `vuJwrcKQ7Sg` is stopped immediately
And `vuJwrcKQ7Sg` is persisted in the local rejected-candidate set for that recording
And the library row keeps title `The News`, artist `Madigan`, duration `279`, and its Spotify origin evidence
And the YouTube playback/trust fields are cleared before retry.

## Requirement: rejected candidates do not re-enter ranking

The YouTube matcher MUST accept a list of rejected YouTube IDs and MUST remove those IDs before shortlist truncation and final ranking.

### Scenario: next candidate becomes visible

Given candidate A ranks above candidate B
And candidate A is in `excludeYoutubeIds`
When the matcher builds its shortlist
Then candidate A is absent
And candidate B can be enriched, validated and selected.

## Requirement: final trust remains mandatory

A candidate found after `MISS` MUST still pass the existing final trust gate before it can be cached or played.

### Scenario: replacement is also wrong

Given a rejected first candidate
And the next search candidate fails duration, title or artist identity validation
When recovery retries
Then that candidate is not persisted or played
And the canonical track remains unresolved.

## Requirement: playback continues after exhausted recovery

If the current recording has no trustworthy alternate candidate, the client SHOULD try subsequent library rows until one can play, bounded by the existing queue scan limits.

### Scenario: current row cannot recover

Given the current row has no trustworthy alternate YouTube candidate
And a later row resolves successfully
When `MISS` recovery completes
Then the current canonical row remains unresolved in place
And playback starts on the later playable row.

## Requirement: visible compact control

The player MUST expose a compact Winamp-style `MISS` control in the status row whenever the current canonical-origin recording has a YouTube candidate that can be rejected.

### Scenario: rejection count

Given one YouTube candidate was already rejected for the current recording
When the status row is rendered
Then the control label is `MISS · 1`.