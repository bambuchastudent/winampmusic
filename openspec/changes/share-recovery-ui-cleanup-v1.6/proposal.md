# Share recovery and UI cleanup

## Problem

The move to self-contained Ámpula `?a=` links intentionally stopped consuming the older provider-ID share transports. That made previously issued `?p=` links fail after local browser storage was cleared, even though the URL itself still contained enough YouTube IDs to reconstruct the old working playlist.

The player UI also exposes transport/format concepts too prominently: `Share / QR`, a separate `Open .ampula` button, and the stacked `PLAYLIST` / `Your library` labels add product chrome without helping normal playback.

## Goal

- Restore previously issued legacy share links as an explicit compatibility path without treating them as Ámpula Core v1.
- Keep all newly generated shares on the self-contained `?a=` transport.
- Simplify the primary library UI to a track count, search, `Share`, and `Clear`.
- Keep QR inside the Share experience rather than in the primary button label.
- Keep `.ampula` as an implementation/format capability without promoting it as a primary player action.

## Scope

- Add a lazy legacy-share opener for historical `?p=` and best-effort `?s=` links.
- Ensure a self-contained legacy `?p=` URL can repopulate an empty working library after local storage has been cleared.
- Stop the current Ámpula receiver from reporting legacy links as if they were malformed Ámpulas.
- Simplify the library header and share dialog copy/actions.
- Strip share parameters when the user explicitly clears the working library.

## Non-goals

- Do not generate new `?p=` or `?s=` links.
- Do not convert provider-ID-only legacy payloads into Ámpula Core v1.
- Do not change the Ámpula Core v1 schema or canonical `?a=` encoding.
- Do not make a remote legacy share service a dependency of normal sharing.

## Success criteria

1. Opening an old `?p=id.id...` URL with empty local storage restores the playable IDs into the working library and starts from the first shared track.
2. New Share continues to generate only `?a=` links.
3. The primary library actions show `Share` and `Clear`; there is no separate `Open .ampula` button.
4. QR is rendered from inside the Share dialog.
5. The library header no longer shows both `PLAYLIST` and `Your library`.
6. Clearing the library removes share parameters before reload so the cleared content is not immediately restored by the current URL.
