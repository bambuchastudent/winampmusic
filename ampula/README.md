# Ámpula Core v1

> **Ámpula is a small, portable memory of a musical moment.**

Ámpula is an open data format. It is not a streaming service, catalog, account system, social network, or a playlist owned by AMPULAMP.

**AMPULAMP** is one reference application that can create, open, resolve, and play Ámpulas. Other clients are expected to be possible.

## Principles

1. **The portable object is the moment.** Track order and minimal context are part of the object.
2. **No provider owns track identity.** Spotify, Apple Music, YouTube, SoundCloud, local-file and future service IDs are observations/hints, not canonical identity.
3. **The receiver resolves locally.** A client may use local files, prior matches, stable recording IDs, historical observations, or fresh provider search.
4. **No mandatory backend.** `.ampula` files and self-contained Ámpula links must work without an Ámpula server.
5. **The received object is immutable evidence.** Playback matches/caches belong to the receiver and must not rewrite the original object.
6. **Keep Core small.** Artwork, lyrics, comments, provider catalogs, user profiles and audio bytes are outside Core v1.

## Canonical file

Recommended extension:

```text
.ampula
```

Provisional media type:

```text
application/vnd.ampula+json
```

The canonical file representation is UTF-8 JSON and is intentionally human-readable.

## Minimal valid document

```json
{
  "format": "ampula",
  "version": "1",
  "tracks": [
    {
      "title": "Teardrop",
      "artists": ["Massive Attack"]
    }
  ]
}
```

Only `format`, `version`, and a non-empty ordered `tracks` array are required. Each track requires `title` and at least one artist.

`capturedAt`, `moment`, `startTrack`, `album`, `versionLabel`, `durationMs`, `isrc`, `musicBrainzRecordingId`, `fingerprint`, `cue`, and `observations` are optional evidence/context.

## Track identity evidence

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

No single identifier is mandatory. A resolver combines the evidence it understands.

## Historical observations

Provider references are historical observations, not identity:

```json
{
  "service": "youtube",
  "itemId": "abcdefghijk",
  "observedAt": "2026-08-25T11:50:00Z",
  "representation": "official-video"
}
```

An observation means only that this representation was known at some time. It does not promise that the item still exists or is playable for the receiver.

## Moment context

```json
{
  "capturedAt": "2026-08-25T13:50:00+02:00",
  "moment": {
    "title": "Night Valencia",
    "note": "август, жара, едем домой"
  },
  "startTrack": 3
}
```

Context is optional. Clients must not silently insert precise location, account IDs, contacts, device IDs, or listening history.

## Transport

The canonical object and its transport are separate concerns:

- `.ampula` — readable JSON file;
- self-contained URL / QR — compact transport encoding of the same object;
- `ampula:` URI — reserved design direction for clients that register a custom scheme.

See [`URI.md`](./URI.md).

## Resolution

A client should prefer local and exact evidence before fuzzy search. Resolution results are local mutable knowledge and are not written back into the received Ámpula.

See [`RESOLVER.md`](./RESOLVER.md).

## Compatibility rule

Provider-only payloads such as `?p=<id>.<id>...` are **not Ámpula v1**. They do not contain enough independent identity/context and must not be generated as a fallback.

Schema: [`schema/ampula-1.schema.json`](./schema/ampula-1.schema.json)

Example: [`examples/night.ampula`](./examples/night.ampula)
