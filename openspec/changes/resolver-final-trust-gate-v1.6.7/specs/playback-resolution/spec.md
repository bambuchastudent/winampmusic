# Playback resolution delta: final trust gate

## Requirement: matcher results are independently validated before trust is persisted
A canonical Spotify/Apple row MUST NOT receive a trusted YouTube match solely because a matcher returned a candidate.

### Scenario: production Madigan false positive is rejected
Given canonical metadata `Madigan — The News` with duration 279s,
when the matcher returns YouTube id `vuJwrcKQ7Sg`, title `News in the Past: Kathleen Madigan`, artist `Laugh Society - Ladies First`, duration 262s,
then the final trust gate rejects the candidate,
and the row does not receive a newly trusted persisted match.

### Scenario: correct Madigan Topic recording passes
Given canonical metadata `Madigan — The News` with duration 279s,
when the matcher returns YouTube id `s1b8Q5avQZs`, title `Madigan - The News`, artist `Madigan - Topic`, duration 279s,
then the final trust gate accepts the candidate.

### Scenario: missing duration fails closed
Given canonical metadata with a known duration,
when a matcher result does not expose candidate duration,
then the final trust gate rejects it.

### Scenario: old trusted rows are revalidated
Given a saved Spotify/Apple row marked `music-only-v1.6.4`,
when the v1.6.7 final trust runtime first starts,
then it removes that legacy trust marker while preserving the old YouTube id for diagnostics,
and the row must pass current-track resolution again before playback can trust it.

### Scenario: final-gate reason is diagnosable
Given a matcher result rejected by the final trust gate,
when the current-track diagnostics bridge catches the matcher error,
then the rejection message contains the specific final-gate reason.

## Requirement: prefetch remains bounded and non-blocking
The final trust gate MUST NOT change the two-track prefetch window or make prefetch block current playback.
