# Design: Ámpula open format v1

## Ownership

- **Ámpula Core v1** owns portable musical-moment semantics.
- **Compact transport** owns URL/QR size reduction only.
- **Resolver** owns local playback matching.
- **AMPULAMP** is a reference application, not the owner or required host of the format.

## Canonical object

The authoritative schema is `ampula/schema/ampula-1.schema.json`.

Minimum object:

```text
Ampula {
  format = "ampula"
  version = "1"
  tracks[]
}

Track {
  title
  artists[]
  album?
  versionLabel?
  durationMs?
  isrc?
  musicBrainzRecordingId?
  fingerprint?
  cue?
  observations[]?
}
```

`capturedAt`, `moment`, and `startTrack` are optional moment/playback context. No globally assigned Ámpula ID or per-track internal ID is required by Core v1.

## Identity vs observations

Human metadata, duration and stable recording identifiers are independent identity evidence. Provider IDs and URLs are stored only as historical observations. Resolution results remain local runtime/cache state.

## Transport

The web implementation encodes a compact tuple representation, optionally gzip-compresses it, base64url-encodes it, and places it in `?a=`. Decoding MUST reconstruct and validate the canonical Core v1 object.

The transport is self-contained. There is no dependency on Pastepile, a short-link service, a centralized Ámpula API or a hosted catalog.

## Receive model

Opening `?a=` presents a distinct Received Ámpula dialog with the full ordered metadata. The existing local library remains untouched. Playback from the received context may resolve a local playable representation, but that match does not rewrite the received Ámpula.

`Save Ámpula` stores the original object in a separate local saved-Ámpula collection. `Add playable tracks` is a separate explicit action and may add only tracks for which the current runtime has a usable playback representation.

## Compatibility

- `?p=` and `?s=` provider/remote legacy shares are unsupported by the new runtime path and are never generated as fallback.
- Existing local library/storage keys stay unchanged.
- Existing player startup remains independent of the optional sharing module; the module is still lazy-loaded on Share or when `?a=` is present.

## Failure modes

- Invalid payload: report unsupported/invalid Ámpula and leave normal player usable.
- No current playable source: keep the track visible and mark resolution unavailable.
- QR too large/unavailable: the link and `.ampula` file remain valid transports.
- Browser lacks CompressionStream: emit uncompressed compact JSON transport instead.
- Browser lacks DecompressionStream for a compressed incoming link: fail non-destructively rather than importing partial provider IDs.
