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
- [x] Prove opening a received Ámpula leaves the existing persisted library unchanged.
- [x] Prove `Save Ámpula` persists separately without importing tracks.
- [x] Guard against regeneration of legacy provider-ID `?p=` fallback.
- [x] Keep repository/runtime integrity tests aware of lazy Ámpula share/receive modules.
- [ ] Add a broader fixture with deliberately unresolved tracks and an empty receiver library.

## Domain/runtime implementation

- [x] Define the versioned serialized Ámpula Core v1 schema.
- [x] Introduce a Received Ámpula context separate from `winampmusic.library.v1`.
- [x] Introduce local persistence for saved Ámpulas under a separate key.
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
- [x] Keep unresolved tracks visible with preserved metadata; playback resolution happens on demand.

## Transport

- [x] Make link/QR transport carry the full versioned Ámpula payload.
- [x] Ensure QR encodes the same share link.
- [x] Add `.ampula` JSON export using the same Core schema.
- [x] Remove centralized paste/short-link dependency from current sharing.
- [x] Keep uncompressed compact JSON fallback for browsers without `CompressionStream`.

## Documentation and verification

- [x] Add canonical `ampula/README.md`, schema, resolver and URI docs.
- [x] Remove current runtime documentation/contracts that require ID-only share links.
- [x] Add targeted share/receive round-trip test.
- [ ] Confirm the complete GitHub Pages verification/deploy run is green on the final `develop` head.
