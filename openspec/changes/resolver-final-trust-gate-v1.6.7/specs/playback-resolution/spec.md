# Playback resolution delta: final trust gate

## Requirement: matcher results are independently validated before trust is persisted
A canonical Spotify/Apple row MUST NOT receive a trusted YouTube resolver marker solely because a matcher returned a candidate.

### Scenario: production Madigan false positive is rejected
Given canonical metadata `Madigan — The News` with duration 279s,
when the matcher returns YouTube id `vuJwrcKQ7Sg`, title `News in the Past: Kathleen Madigan`, artist `Laugh Society - Ladies First`, duration 262s,
then the final trust gate rejects the candidate,
and the row does not receive the trusted resolver marker.

### Scenario: correct Madigan Topic recording passes
Given canonical metadata `Madigan — The News` with duration 279s,
when the matcher returns YouTube id `s1b8Q5avQZs`, title `Madigan - The News`, artist `Madigan - Topic`, duration 279s,
then the final trust gate accepts the candidate.

### Scenario: missing duration fails closed
Given canonical metadata with a known duration,
when a matcher result does not expose candidate duration,
then the final trust gate rejects it.

### Scenario: old trusted rows are revalidated
Given a Spotify/Apple row marked `music-only-v1.6.4`,
when it becomes current under v1.6.7,
then it is treated as needing trusted resolution before playback.

## Requirement: prefetch remains bounded and non-blocking
The final trust gate MUST NOT change the two-track prefetch window or make prefetch block current playback.
