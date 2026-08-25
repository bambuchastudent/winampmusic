# AGENTS.md

## Project identity

This repository contains the reference implementation for the **Ámpula** open format.

- **Ámpula** is the portable object/format: a transferable memory of a musical moment.
- **AMPULAMP** is the reference player/editor that creates, opens, resolves, saves, and plays Ámpulas.
- Ámpula does not belong to AMPULAMP. Other clients, converters, plugins, and resolvers must be able to implement the format independently.
- A musical moment is transferred as a **`.ampula`** UTF-8 JSON file or an equivalent self-contained transport containing the same Core object.
- The repository name `winampmusic` and historical `winampmusic.*` / `WINAMP_MUSIC_*` identifiers are legacy infrastructure/compatibility names, not format identity.

## Non-negotiable format rules

Keep these rules unless the maintainer explicitly changes the Ámpula specification:

1. Ámpula Core stays small and provider-independent: ordered recordings plus minimal optional context/evidence.
2. A Core track requires human-readable `title` and at least one `artist`; provider IDs alone are never a valid Ámpula track identity.
3. Provider URLs and service-specific IDs are historical observations/recovery hints, not canonical identity and not proof of current playability.
4. The source used to create an Ámpula may differ from the source used to play it later.
5. Resolution happens on the receiver/client side. Resolver results and playback caches must not rewrite the received Ámpula.
6. The core format must not require a centralized backend, hosted catalog, account, social network, or a particular music service.
7. Audio bytes, artwork, lyrics, comments, provider catalogs, user profiles, and mutable playback state do not belong in Core v1.
8. `.ampula`, self-contained links, and QR are transports/representations of the same domain object; transport details are not musical identity.
9. Legacy provider-only `?p=<id>...` / `?s=` payloads are not Ámpula v1 and must not be generated or silently imported as Ámpula.
10. Opening or saving a received Ámpula must not mutate `Your library`; adding playable tracks is a separate explicit action.

## Canonical specification

- `ampula/README.md` — Ámpula Core v1 semantics and boundaries.
- `ampula/schema/ampula-1.schema.json` — canonical JSON Schema.
- `ampula/URI.md` — compact self-contained link/QR transport.
- `ampula/RESOLVER.md` — client-side resolution profile.
- `openspec/changes/ampula-native-sharing-v1.6/` — current AMPULAMP integration/runtime contract.

## Development guidance

- Follow `openspec/README.md` for user-visible/runtime changes: specification and targeted tests come before implementation.
- Prefer provider-independent domain concepts and keep provider-specific code behind import/resolution/playback adapters.
- Keep `.ampula` portable, human-readable, versioned, and independently implementable.
- Preserve existing compatibility storage keys, import messages, and internal runtime identifiers unless a migration is explicitly specified and tested.
- Do not reintroduce a remote share service as a requirement for normal Ámpula link/QR transport.
- Update the root `README.md` and relevant Ámpula/OpenSpec documents when format or user-visible sharing semantics change.
