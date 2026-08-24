# AGENTS.md

## Project identity

This repository implements **Ámpulamp**.

- **Ámpulamp** is the player. The ending `MP` means **Music Player**.
- **Ámpula** is the portable musical moment handled by the player.
- Ámpulas are transferred as **`.ampula`** files.
- The repository name `winampmusic` is legacy/internal and must not redefine the user-facing product identity.

Before changing product behavior, UX, data models, import/export, playback resolution, naming, documentation, or architecture, read [`AMPULA_SPEC.md`](./AMPULA_SPEC.md). It is the canonical product specification.

## Product invariants

Treat the following as constraints unless a task explicitly changes the product specification:

1. Ámpulamp is a music player for **sharing a moment through music**, not another streaming service.
2. A `.ampula` preserves the intended moment and ordered track selection so it can be opened now or later.
3. A provider URL, service-specific ID, or catalog match is **provenance/recovery information**, not the canonical identity of the musical moment.
4. Creation source and playback source may differ. The recipient should be able to resolve recordings using sources available to them.
5. Do not make a centralized backend, hosted music catalog, mandatory social network, or a single streaming provider a prerequisite for the Ámpula concept.
6. Never describe a provider URL merely being present as proof that a track is playable. Distinguish historical/source metadata from a source actually usable for playback.

## Source of truth

Use this order when repository documents disagree:

1. Explicit task/request from the maintainer.
2. `AMPULA_SPEC.md` for product identity and product boundaries.
3. Accepted ADRs under `docs/adr/` for durable technical/product decisions.
4. `AGENTS.md` for agent workflow and repository invariants.
5. `README.md` for public overview and current implementation notes.

If a change intentionally alters a product invariant, update `AMPULA_SPEC.md` and add or supersede the relevant ADR in the same pull request instead of silently changing the meaning in code.

## Development behavior

- Preserve existing runtime behavior unless the task explicitly asks for a behavioral change.
- Prefer provider-independent domain concepts and isolate provider-specific adapters.
- Keep `.ampula` versionable and portable; avoid making its meaning depend on local browser state or one provider's current URL format.
- When adding source metadata, keep provenance and playability/resolution state conceptually separate.
- Update tests and documentation when a change modifies a documented contract.

## Pull requests

PR descriptions should state whether the change affects any of these contracts:

- product identity/naming;
- `.ampula` format or semantics;
- track identity/recovery;
- provider adapters/playability;
- persistence/portability.

If none are affected, say so explicitly.