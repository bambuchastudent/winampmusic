# Playback resolution delta

## Requirement: Music-specific discovery supplements generic video search

For a known song origin, AMPULAMP MUST include a music-specific YouTube search surface in candidate discovery when available. Music-specific discovery supplements rather than replaces generic video search, and every discovered candidate MUST still pass the existing music, duration, ranking, exclusion, and final-trust rules.

### Scenario: Generic results omit the recording

Given canonical metadata `Madigan — The News` with duration about 279 seconds, when generic video search returns only unrelated or duration-incompatible results but the YouTube Music songs surface returns `s1b8Q5avQZs` as `Madigan - The News` by `Madigan - Topic`, the resolver MUST be able to select `s1b8Q5avQZs`.

### Scenario: Music search does not bypass trust

Given a candidate returned by a music-specific search surface that conflicts with canonical title, artist, or known duration, the resolver MUST reject it under the same trust rules as any generic-video candidate.

## Requirement: Canonical origin metadata remains unchanged

A newly discovered YouTube playback representation MUST NOT replace the Spotify or Apple Music title, artist, or origin metadata of the recording.
