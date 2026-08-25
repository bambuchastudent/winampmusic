# Tasks: Native Ámpula sharing and receiving

## Specification

- [x] Define the problem and breaking-change scope.
- [x] Define the Received Ámpula and Saved Ámpula states.
- [x] Define full-fidelity sharing requirements and legacy `?p=` removal.
- [x] Define non-destructive receive scenarios.
- [x] Define explicit `Save Ámpula` semantics.
- [x] Define separation between saving an Ámpula and importing tracks.
- [x] Align this change with canonical Ámpula Core v1 under `ampula/`.

## Tests

- [x] Add a round-trip behavioral test preserving ordered title/artist metadata.
- [x] Prove opening a received Ámpula leaves an existing persisted library unchanged.
- [x] Prove an empty receiver library remains empty.
- [x] Prove unresolved tracks keep preserved metadata instead of provider placeholders.
- [x] Prove `Save Ámpula` persists separately without importing tracks.
- [x] Prove saved Ámpulas reopen without the original share URL.
- [x] Guard against regeneration or import of legacy provider-ID `?p=` fallback.
- [x] Prove invalid shared payloads fail without mutating the local library.
- [x] Keep repository/runtime integrity tests aware of lazy Ámpula share/receive modules.

## Domain/runtime implementation

- [x] Define the versioned serialized Ámpula Core v1 schema.
- [x] Introduce a Received Ámpula context separate from `winampmusic.library.v1`.
- [x] Introduce local persistence for saved Ámpulas.
- [x] Change share generation to serialize the complete Ámpula object.
- [x] Change share receiving to decode into Received Ámpula instead of calling `window.importTracks`.
- [x] Remove generation of `?p=<id>...` from fast share actions.
- [x] Remove parsing/import of `?p=` and `?s=` as Ámpula.
- [x] Remove provider-ID-only fallback behavior.
- [x] Preserve received metadata independently of playback resolution.
- [x] Keep resolver results as local playback state/cache rather than canonical Ámpula identity.

## UI

- [x] Render a distinct Received Ámpula state with its own ordered track list.
- [x] Add `Save Ámpula` to the received state.
- [x] Add access to locally saved Ámpulas.
- [x] Ensure `Save Ámpula` does not modify `Your library`.
- [x] Implement `Add playable tracks` as a separate explicit action.
- [x] Keep unresolved tracks visible with preserved metadata.
- [x] Add `Open .ampula` for portable file input.

## Transport

- [x] Make link/QR transport carry the full versioned Ámpula payload.
- [x] Ensure QR encodes the same share link.
- [x] Add `.ampula` JSON export and open using the same Core schema.
- [x] Remove centralized paste/short-link dependency from current sharing.
- [x] Keep uncompressed compact JSON fallback for browsers without `CompressionStream`.

## Documentation and verification

- [x] Add canonical `ampula/README.md`, schema, resolver and URI docs.
- [x] Update root README to describe live v1 behavior.
- [x] Remove current runtime contracts that require ID-only share links.
- [x] Add targeted share/receive/file-open regression coverage.
- [ ] Confirm the complete GitHub Pages verification/deploy run is green on the final `develop` head.
