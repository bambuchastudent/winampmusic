# AGENTS.md

## Project identity

This repository implements **Ámpulamp**.

- **Ámpulamp** is the player. The ending `MP` means **Music Player**.
- **Ámpula** is the portable musical moment handled by the player.
- Ámpulas are transferred as **`.ampula`** files.
- The repository name `winampmusic` is legacy/internal and must not redefine the user-facing product identity.

## Product rules

Keep these rules unless the maintainer explicitly asks to change them:

1. Ámpulamp is a music player for **sharing a moment through music**, not another streaming service.
2. A `.ampula` preserves the intended moment and ordered track selection so it can be opened now or later.
3. Provider URLs and service-specific IDs are source/recovery information, not the product itself.
4. The source used to create an Ámpula may differ from the source used to play it later.
5. Do not make a centralized backend, hosted music catalog, mandatory social network, or single streaming provider a requirement for the core concept.
6. Do not treat a stored provider URL as proof that a track is playable.

## Development guidance

- Prefer provider-independent domain concepts.
- Keep provider-specific code behind import/resolution/playback adapters.
- Keep `.ampula` portable and versionable.
- Preserve existing runtime behavior unless the task explicitly asks to change it.
- Update `README.md` when user-facing product behavior or terminology changes.
