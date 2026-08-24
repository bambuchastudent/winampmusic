# Ámpulamp repository instructions

Before making changes, read `AGENTS.md` and `AMPULA_SPEC.md`.

Keep these product invariants unless the maintainer explicitly changes the specification:

- **Ámpulamp** is the music player; `MP` means **Music Player**.
- **Ámpula** is the portable musical moment transferred as a `.ampula` file.
- The goal is to let people share a moment and ordered tracks from their library and reopen that moment later.
- Provider URLs and service IDs are provenance/recovery hints, not the canonical identity of the track or moment.
- Creation and playback may use different providers/sources.
- Do not turn the product into a streaming service, centralized music catalog, mandatory social network, or single-provider application.
- Do not equate a stored provider URL with actual playability; represent source history and usable playback sources separately.

If a proposed change contradicts these rules, call out the conflict and update `AMPULA_SPEC.md` plus the relevant ADR instead of silently redefining the product in code.