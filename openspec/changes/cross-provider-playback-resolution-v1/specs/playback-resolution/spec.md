# Playback resolution specification delta

## Requirement: Origin does not constrain playback

A recording's historical provider origin MUST NOT restrict the provider used for current playback. When AMPULAMP resolves a playable representation on another supported provider, it MUST be allowed to use that representation while preserving the original provenance.

### Scenario: Apple origin resolves to YouTube

Given a library recording with Apple Music origin metadata and a human-readable title and artist,
when the receiver resolves that recording to a valid YouTube video id,
then the working player MUST adopt the YouTube id as local playback state,
and the Apple origin URL/id/storefront evidence MUST remain unchanged.

## Requirement: Resolution updates authoritative player state

A successful resolver result MUST be applied to the same in-memory working-library state read by the playback controls before fallback playback begins. Updating persistence alone is insufficient.

### Scenario: Direct audio fails after a successful resolution

Given an Apple-origin recording whose strict resolver returns a valid YouTube id,
and direct Piped audio for that id is unavailable,
when playback falls back to the YouTube iframe,
then the iframe MUST receive the already-resolved YouTube id,
and the player MUST NOT fall back using the stale pre-resolution id.

## Requirement: Recording identity and provenance survive resolution

Adopting a playback source MUST NOT replace the recording title or artist and MUST NOT remove or rewrite provider-origin evidence.

### Scenario: Cyrillic Apple-origin recording

Given `Клоуны` by `t.A.T.u.` with Apple Music (TR) origin metadata,
when a valid YouTube representation is resolved,
then the stored title MUST remain `Клоуны`,
the artist MUST remain `t.A.T.u.`,
the Apple origin metadata MUST remain present,
and only mutable playback fields may change.

## Requirement: Invalid resolver results are not adopted

A resolver result that is not a valid YouTube video id MUST NOT replace the current playback handle.

### Scenario: Invalid id

Given an existing recording,
when the adoption operation receives an invalid id,
then it MUST return failure and MUST NOT mutate the stored or in-memory recording.

## Requirement: Playback status remains truthful

Finding or adopting a candidate MUST NOT by itself claim that audio is playing. Existing playback events remain responsible for `PLAYING` status, and `NO PLAYABLE SOURCE` is only valid after usable playback routes have failed.
