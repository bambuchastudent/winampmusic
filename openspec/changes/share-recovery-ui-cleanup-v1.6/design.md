# Design

## Ownership

New Ámpula sharing stays owned by `compact-share.js` and continues to generate/receive only the canonical self-contained `?a=` transport.

Historical provider-only share links are handled by a new, isolated `legacy-share-v1.js` compatibility adapter. The adapter is loaded only when the initial URL contains `?p=` or `?s=`. It never generates links and never constructs or saves an Ámpula object.

## Legacy `?p=` flow

1. Parse dot-separated historical provider IDs from `p`.
2. Validate each ID as a YouTube video ID and deduplicate while preserving order.
3. Import those IDs into the existing working-library runtime through `window.importTracks`.
4. Select/play the first shared ID when possible.
5. Report the result as a legacy playlist recovery, not as a received Ámpula.

This restores the behavior of previously issued self-contained fallback links even when local storage is empty.

## Legacy `?s=` flow

The compatibility adapter may best-effort read the historical encrypted remote bundle using the old share endpoint/key contract. Failure remains non-destructive. This path is compatibility-only and is not required by normal Ámpula sharing.

## New `?a=` flow

No encoding or Core semantics change. `compact-share.js` continues to decode `?a=` into a distinct received context without mutating the working library.

When `compact-share.js` encounters `p`/`s`, it must not label them invalid Ámpulas; ownership remains with the legacy adapter.

## UI

Primary library chrome becomes intentionally small:

- compact track count;
- library filter toggle;
- `Share`;
- `Clear`.

The current separate `Open .ampula` action is removed from the primary toolbar. File-format helpers remain available internally so the open format is not removed from the implementation.

The Share dialog owns link copy/system share and QR presentation. Transport jargon is removed from the primary call to action and from routine share copy.

## Clear behavior

An explicit clear removes working-library state and removes `a`, `p`, `s`, and legacy `playlist` parameters plus the URL hash before reload. This prevents the same shared URL from repopulating content immediately after a deliberate clear.

## Compatibility and failure modes

- Existing local-storage keys remain unchanged.
- New sharing never falls back to `p`/`s`.
- Malformed legacy payloads do not mutate the library.
- Remote `s` failure does not affect normal startup or controls.
- Legacy recovery can mutate the working library because that is the historical playlist semantics; it is not a Received Ámpula operation.
