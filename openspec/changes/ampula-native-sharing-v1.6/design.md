# Design: Native Ámpula sharing and receiving

> This sharing design now consumes **Ámpula Core v1** as defined by `ampula/README.md` and `ampula/schema/ampula-1.schema.json`. It does not define a second domain model.

## Domain model

Sharing operates on a canonical Ámpula Core v1 object, not on a list of provider IDs.

Core requires only:

```text
Ampula {
  format = "ampula"
  version = "1"
  tracks[]
}

Track {
  title
  artists[]
  ...optional identity evidence / observations
}
```

`capturedAt`, `moment`, and `startTrack` are optional context. Provider IDs and URLs belong only in `observations` and are not canonical identity. Core v1 does not require a globally assigned Ámpula ID or internal per-track ID.

## Runtime states

### Local library

`Your library` remains the receiver's general saved-track collection. Merely opening a shared Ámpula must never append, replace, reorder, or remove library entries.

### Received Ámpula

A shared payload opens in a separate transient context with:

- its own ordered track list;
- preserved sender metadata/context;
- local playback-resolution state;
- explicit `Save Ámpula` and separate `Add playable tracks` actions.

Closing the received context without saving leaves the local library and saved Ámpulas unchanged.

### Saved Ámpulas

`Save Ámpula` persists the original received Core object as a first-class local object. Local resolution/playback matches are cacheable runtime knowledge and must not redefine or rewrite the saved object's identity.

## Sharing contract

The sender builds a valid Core v1 object from the current musical moment.

Transports may include:

- a self-contained URL;
- QR representing that URL;
- a `.ampula` JSON file;
- an optional short-link alias that dereferences to the same Core object.

Transport is not the domain model. Current AMPULAMP web transport uses `?a=<compact-payload>` and decodes back to Core v1 before presenting the moment.

A future short-link service is allowed only as a transport alias. Its token is not an Ámpula ID, and the service must not become the sole full-fidelity copy of the musical moment. Self-contained URL and `.ampula` export remain independent escape hatches.

The old `?p=<provider-id>...` and remote `?s=` contracts are not Ámpula v1 and are not fallback transports for new sharing.

## Receive flow

1. Detect `?a=` on startup.
2. Decode and validate Core v1.
3. Present a Received Ámpula context without calling the normal library-import path.
4. Render preserved title/artist/order immediately, independently of successful playback resolution.
5. Resolve playable sources locally as requested.
6. Allow explicit `Save Ámpula`.
7. Allow separate explicit `Add playable tracks`.

A separate lazy compatibility adapter may recognize historical `?p=` or `?s=` URLs. That adapter is outside the canonical Ámpula decoder and may recover the historical working playlist, but it must never promote provider-ID-only data to Core v1.

## Save semantics

Saving is intentionally not equivalent to importing tracks. It preserves the received Core v1 object and stores a local saved timestamp outside musical identity.

A later resolver may choose different playable providers without rewriting the original observations or changing the musical moment.

## Compatibility

- Do not generate `?p=` or `?s=` links.
- Do not parse `?p=` or `?s=` inside the canonical Ámpula decoder.
- A separate receive-only compatibility adapter may recover historical `?p=` or `?s=` links.
- Never represent or save provider-ID-only legacy payloads as Ámpula Core v1.
- Existing local library storage remains intact.

## Critical-path constraints

The FAST invariant remains in force:

- optional share/receive code stays lazy outside normal startup;
- an invalid shared payload must not break normal local playback;
- receiving must not write to the general library until an explicit library action.

## Failure modes

### Invalid or unsupported payload

Show a non-destructive error and keep the normal local player usable.

### Some tracks cannot be resolved

Keep the full Ámpula visible with preserved metadata. Mark unresolved tracks unavailable/unresolved rather than deleting or replacing them.

### QR unavailable or too large

Keep the self-contained link and `.ampula` file as valid full-fidelity transports. Never fall back to provider-ID-only sharing.

### Short-link service unavailable

Keep self-contained link/file export usable. Failure of an optional alias service must not redefine or corrupt the Ámpula object.

### Duplicate save

Deduplicate local saved records without mutating the original received object.
