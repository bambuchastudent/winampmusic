# Ámpula resolver profile v1

Resolution answers one local question:

> Given this recording evidence, what playable representation can this receiver use now?

Resolution is deliberately separate from Ámpula identity.

## Recommended order

A client SHOULD try, when practical:

1. exact local-file fingerprint or stable recording ID;
2. the receiver's prior local resolution cache;
3. exact stable IDs supported by an attached provider, such as ISRC or MusicBrainz mappings;
4. historical provider observations, checked for current availability;
5. fresh search using title + artists + album/version label + duration;
6. fuzzy candidate ranking with an explicit confidence level.

## Rules

- A resolved provider ID or URL MUST NOT replace the original recording evidence in the received Ámpula.
- A client MUST NOT silently call a live/remix/remaster/cover an exact match when the Ámpula clearly identifies a materially different recording.
- An unresolved track remains part of the musical moment and stays visible.
- Provider availability, authentication and subscription state belong to the receiver's runtime, not to Core.
- Resolver caches are local mutable state and may be discarded without invalidating an Ámpula.

## Minimal local overlay example

```json
{
  "ampulaDigest": "sha256:...",
  "resolvedAt": "2031-08-23T18:10:00+02:00",
  "matches": [
    {
      "trackIndex": 0,
      "service": "youtube",
      "itemId": "abcdefghijk",
      "confidence": 0.96
    }
  ]
}
```

The overlay format is not standardized by Core v1.
