# Design: Native Ámpula sharing and receiving

## Domain model

Sharing operates on a versioned Ámpula domain object, not on a list of provider IDs.

Minimum logical shape:

```text
Ampula {
  version
  id
  createdAt
  startTrackId
  tracks[]
}

AmpulaTrack {
  id
  title
  artist
  duration?
  provenance[]
  sourceHints[]
}
```

`id` identifies the track or Ámpula inside the portable object. Provider IDs and URLs belong in provenance/source hints and are not the canonical identity.

The exact serialized schema may evolve, but all transports must decode into the same versioned Ámpula object.

## Runtime states

### Local library

`Your library` remains the receiver's general saved-track collection. Merely opening a shared Ámpula must never append, replace, reorder, or remove library entries.

### Received Ámpula

A shared payload opens in a separate transient context:

- its own ordered track list;
- its own selected/start track;
- preserved sender metadata;
- local playback-resolution state;
- explicit actions such as `Save Ámpula` and, separately, `Add tracks to library`.

Closing the received context without saving must leave the local library and saved Ámpulas unchanged.

### Saved Ámpulas

`Save Ámpula` persists the received Ámpula as a first-class local object. The saved object retains the received order, metadata, and provenance. Resolution/playback results are cacheable local state and must not redefine the saved object's identity.

## Sharing contract

The sender creates a complete versioned Ámpula payload from the current musical moment.

The share transport may be:

- a URL;
- a QR code representing that URL;
- a `.ampula` file.

Transport is not the domain model. A URL transport may embed or reference an opaque serialized payload, but the receiver must reconstruct and validate the complete Ámpula before presenting it.

The old `?p=<provider-id>...` contract is removed. There is no compatibility fallback from a failed full share to a provider-ID list.

## Receive flow

1. Detect an Ámpula transport on startup or explicit open/import.
2. Decode and validate the versioned Ámpula payload.
3. Create a `Received Ámpula` session without calling the normal library-import path.
4. Render preserved title/artist/order immediately, before or independently of playback resolution.
5. Resolve playable sources locally as needed.
6. Allow explicit `Save Ámpula`.
7. Allow a separate explicit `Add tracks to library` action if/when exposed by UI.

## Save semantics

Saving is intentionally not equivalent to importing tracks.

`Save Ámpula` stores:

- the received Ámpula identity/version;
- ordered track selection;
- human-readable track metadata;
- provenance/source hints;
- intended start track;
- local saved timestamp as local metadata.

A later resolver may choose different playable providers without rewriting the original provenance or changing the musical moment.

## Compatibility

This change is intentionally breaking for the old share format.

- Do not generate `?p=` links.
- Do not parse `?p=` links.
- Do not silently import provider-ID-only payloads.
- Existing local library storage remains intact unless a separate migration requires otherwise.

## Critical-path constraints

The FAST invariant remains in force:

- optional share/receive modules must not block player startup;
- an invalid or unavailable shared payload must not break normal local playback;
- opening a shared Ámpula must not take ownership of unrelated core control events;
- receiving must not write to the general library until the user explicitly requests a library import.

## Failure modes

### Invalid or unsupported payload

Show a non-destructive error and keep the normal local player usable.

### Some tracks cannot be resolved

Keep the full Ámpula visible with preserved metadata. Mark unresolved tracks as unavailable/unresolved rather than deleting or replacing them.

### Share transport unavailable

Do not fall back to provider-ID-only sharing. Offer another full-fidelity transport, such as copying/exporting the complete Ámpula representation.

### Duplicate save

The implementation should avoid creating accidental duplicate local records for the same received Ámpula. Exact deduplication policy may use Ámpula identity/content identity, but must not mutate the original received object.
