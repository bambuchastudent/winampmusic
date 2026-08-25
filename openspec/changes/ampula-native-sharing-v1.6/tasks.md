# Tasks: Native Ámpula sharing and receiving

## Specification

- [x] Define the problem and breaking-change scope.
- [x] Define the Received Ámpula and Saved Ámpula states.
- [x] Define full-fidelity sharing requirements and legacy `?p=` removal.
- [x] Define non-destructive receive scenarios.
- [x] Define explicit `Save Ámpula` semantics.
- [x] Define separation between saving an Ámpula and importing tracks.

## Tests first

- [ ] Add a behavioral test proving a shared 18-track Ámpula preserves order/title/artist.
- [ ] Add a behavioral test proving opening an 18-track Ámpula does not change an existing 40-track library.
- [ ] Add a behavioral test proving an empty library remains empty after opening a received Ámpula.
- [ ] Add a behavioral test proving unresolved tracks keep preserved metadata instead of `YouTube <id>` placeholders.
- [ ] Add a behavioral test proving `Save Ámpula` persists the complete object without importing tracks.
- [ ] Add a behavioral test proving saved Ámpulas reopen without the original share URL.
- [ ] Add a behavioral test proving `?p=` is neither generated nor accepted.
- [ ] Add a regression test proving invalid shared payloads do not block local player startup or controls.

## Domain/runtime implementation

- [ ] Define the versioned serialized Ámpula schema used by share transports.
- [ ] Introduce a Received Ámpula session/store separate from `winampmusic.library.v1`.
- [ ] Introduce local persistence for saved Ámpulas.
- [ ] Change share generation to serialize the complete Ámpula object.
- [ ] Change share receiving to decode into Received Ámpula instead of calling `window.importTracks`.
- [ ] Remove generation of `?p=<id>...` from fast share actions.
- [ ] Remove parsing/import of `?p=` from share receiving.
- [ ] Remove provider-ID-only fallback behavior.
- [ ] Preserve received metadata independently of playback resolution.
- [ ] Keep resolver results as local playback state/cache rather than canonical Ámpula identity.

## UI

- [ ] Render a distinct Received Ámpula state with its own ordered track list.
- [ ] Add `Save Ámpula` to the received state.
- [ ] Add access to locally saved Ámpulas (`My Ámpulas` or equivalent product wording).
- [ ] Ensure `Save Ámpula` does not modify `Your library`.
- [ ] If exposed in this change, implement `Add tracks to library` as a separate explicit action.
- [ ] Show unresolved tracks with preserved metadata and a clear unavailable/resolving state.

## Transport

- [ ] Make link/QR transport carry or reference the full versioned Ámpula payload.
- [ ] Ensure QR encodes the same share transport as the copy/share link.
- [ ] Ensure `.ampula` import/export maps to the same domain schema.
- [ ] Do not require a centralized backend for the core format or local save/open behavior.

## Documentation and verification

- [ ] Update `README.md` with the new share/receive/save behavior.
- [ ] Remove documentation that describes ID-only share links as supported.
- [ ] Run targeted share/receive tests.
- [ ] Run the repository verification suite before merge.
