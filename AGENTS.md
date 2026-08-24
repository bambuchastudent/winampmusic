# AGENTS.md

## Project identity

This repository implements the **Ámpula** project.

- **Ámpula** is the project/concept for passing portable musical moments between people.
- **ÁmpulaMP** is the player. The ending `MP` means **Music Player**.
- A musical moment is transferred as a **`.ampula`** file containing the ordered track selection and enough identity/source context for later recovery.
- The repository name `winampmusic` and historical `winampmusic.*` / `WINAMP_MUSIC_*` identifiers are legacy infrastructure/compatibility names, not user-facing product identity.

## Product rules

Keep these rules unless the maintainer explicitly asks to change them:

1. ÁmpulaMP is a music player for **sharing a moment through music**, not another streaming service.
2. A `.ampula` preserves the intended moment and ordered track selection so it can be opened now or later.
3. Provider URLs and service-specific IDs are source/recovery information, not the identity of the moment and not proof of playability.
4. The source used to create a `.ampula` may differ from the source used to play it later.
5. Do not make a centralized backend, hosted music catalog, mandatory social network, or single streaming provider a requirement for the core Ámpula concept.
6. Keep provenance/history separate from an actually usable playback source.

## Development guidance

- Follow `openspec/README.md` for user-visible/runtime changes: specification and targeted tests come before implementation.
- Prefer provider-independent domain concepts.
- Keep provider-specific code behind import/resolution/playback adapters.
- Keep `.ampula` portable and versionable.
- Preserve existing compatibility storage keys, import messages, and runtime identifiers unless a migration is explicitly specified and tested.
- Preserve existing runtime behavior unless the task explicitly asks for a behavioral change.
- Update `README.md` when user-facing product behavior or terminology changes.
