# Playback navigation delta v1.7.10

## Requirement: one unresolved recording must not block later playback

With Shuffle OFF, sequential navigation MUST preserve library order while allowing a non-resolving row to be skipped.

### Scenario: later row is resolvable but not pre-resolved
Given row 5 is current, row 6 is unresolved and its resolver does not finish promptly, and row 7 is unresolved but can obtain a final-trusted playback match, when Next or ENDED advances playback, then row 6 receives only the foreground resolution grace period and row 7 is actively resolved and played.

### Scenario: skipped resolver finishes later
If row 6 finishes resolving after row 7 has started, row 6 may cache its trusted playback handle but MUST NOT replace row 7 playback.

## Requirement: foreground skip does not weaken resolution trust

The queue MUST only play provider-origin rows that satisfy the existing final-trust contract. A timeout/grace expiry means "continue scanning", not "accept a weaker match".

## Requirement: identity remains canonical

Foreground queue recovery MUST preserve stored title, artist, origin URL/provider, and recording order. Playback candidates may update only local playback handles/state.