# Ámpula v0.1

> **Ámpula is a transferable memory of a moment through music.**

Ámpula is not a streaming service, social network, or playlist database. It is an open, portable description of a musical moment that another person can reconstruct with their own client, library, and music services.

## Core idea

A person captures a moment: the recordings that mattered, their order, and a small amount of human context. They send that Ámpula to someone else. The recipient's client resolves the recordings locally using whatever sources that person has: local files, Spotify, YouTube, Apple Music, Yandex Music, future services, or other resolvers.

The original Ámpula is an immutable snapshot. Resolution results belong to the recipient and are stored separately as a local overlay/cache.

## Non-negotiable principles

1. **The moment is the object.** A playlist is only one possible reconstruction of it.
2. **No service owns identity.** Spotify/YouTube/Apple/Yandex IDs and URLs are historical observations, never the canonical identity of a recording.
3. **Client-side recovery.** The recipient's client performs matching and recovery. A central Ámpula resolver/backend is not required.
4. **Local-first.** A client should check the user's local library and prior local matches before querying remote services.
5. **Links may die.** A previous URL means “this recording was observed here at that time”, not “this URL is permanent”.
6. **Recoverable years later.** Store enough evidence to re-find a recording after 1–5+ years: metadata, duration, ISRC/MusicBrainz IDs/fingerprint when known, plus historical service observations.
7. **Immutable source, mutable local knowledge.** Opening an Ámpula must not rewrite the received file. New matches live in an overlay/cache.
8. **Human-readable.** v0.1 is plain UTF-8 JSON. A person should still be able to inspect it if all Ámpula software disappears.
9. **No mandatory account.** Creating, sending, saving, and reading an Ámpula must not require an Ámpula account.
10. **Transport is irrelevant.** File, Telegram, link, AirDrop, NFC, QR, email, USB drive — these are transports, not the product.

## File

Recommended extension:

```text
.ampula
```

Provisional media type:

```text
application/vnd.ampula+json
```

The file contains one JSON object encoded as UTF-8.

## Minimal document

```json
{
  "format": "ampula",
  "version": "0.1",
  "capturedAt": "2026-08-23T02:13:00+02:00",
  "moment": {
    "title": "ночью было хорошо",
    "note": "вот это сейчас прям оно"
  },
  "tracks": [
    {
      "title": "Teardrop",
      "artists": ["Massive Attack"]
    }
  ]
}
```

Only `format`, `version`, `capturedAt`, and a non-empty `tracks` array are required. A track requires `title` and at least one artist.

## Recording identity

A track may carry independent evidence:

```json
{
  "title": "Example",
  "artists": ["Artist"],
  "album": "Album",
  "versionLabel": "live 1994",
  "durationMs": 241000,
  "isrc": "AA-BBB-12-34567",
  "musicBrainzRecordingId": "...",
  "fingerprint": {
    "algorithm": "chromaprint",
    "value": "..."
  }
}
```

No single identifier is mandatory. Clients combine the evidence they understand.

### Optional cue

A moment may refer to a meaningful part of a recording rather than the whole track:

```json
"cue": {
  "startMs": 43000,
  "endMs": 79000
}
```

A client may ignore a cue if its target service cannot represent it.

## Historical observations

Service references are evidence that a recording was once seen somewhere:

```json
"observations": [
  {
    "service": "youtube",
    "itemId": "abc123",
    "url": "https://www.youtube.com/watch?v=abc123",
    "observedAt": "2026-08-23T02:13:00+02:00",
    "representation": "official-video"
  }
]
```

An observation makes **no claim** that the item is still available.

`representation` is optional and free-form in v0.1. Examples: `studio-recording`, `official-video`, `live`, `remaster`, `user-upload`, `cover`.

## Client resolution model

A conforming client SHOULD resolve each recording in this order when practical:

1. Local library exact identifiers/fingerprint.
2. Recipient's previously resolved local overlay/cache.
3. Exact stable identifiers supported by an attached service (ISRC, MusicBrainz mapping, service item IDs).
4. Historical observations, checked for current availability.
5. Fresh search using title + artists + version label + album + duration.
6. Fuzzy candidate ranking with a visible confidence level when the match is not exact.

The client MUST NOT silently replace a clearly identified live/remix/remaster/cover with a materially different recording and call it exact.

## Local resolution overlay

Resolution knowledge is not part of the original moment. A client may keep an adjacent/local structure such as:

```json
{
  "ampulaDigest": "sha256:...",
  "resolvedAt": "2031-08-23T18:10:00+02:00",
  "matches": [
    {
      "trackIndex": 0,
      "service": "spotify",
      "itemId": "new-current-id",
      "confidence": 1.0
    }
  ]
}
```

The overlay format is deliberately **not standardized in v0.1**. Clients can evolve without changing the memory object.

## Privacy

Moment context is optional. Clients should avoid silently inserting precise location, contacts, device IDs, account IDs, or listening history. If a client adds sensitive context, it should be explicit before export.

## v0.1 scope

Included:

- portable moment file;
- ordered recordings;
- optional human context;
- independent recording evidence;
- historical service observations;
- optional per-track cue;
- client-side/local-first resolution model.

Not included yet:

- central accounts or feeds;
- server-side catalog/resolver;
- social graph;
- collaborative mutation/history;
- DRM/audio payloads;
- mandatory signatures;
- standardized local overlay;
- recommendation algorithms.

## Success criterion

An Ámpula created today should still give an unrelated future client enough information to answer:

> **“What music was this person trying to pass to me in that moment, and where can I find those recordings now?”**
