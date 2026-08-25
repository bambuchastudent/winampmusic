# Proposal: Ámpula open format v1

## Problem

The repository had two partially overlapping ideas: an older standalone Ámpula v0.1 draft and a newer v1.6 sharing contract. The runtime still generated legacy provider-ID-only `?p=` links, while the product model requires a portable provider-independent musical moment.

## Goal

Make Ámpula Core v1 the canonical open format and make AMPULAMP sharing use that same object through a lightweight self-contained transport.

## Scope

- Canonical `.ampula` JSON format and JSON Schema.
- Provider-independent recording evidence and historical observations.
- Compact self-contained URL/QR transport using `?a=`.
- Local resolver profile separate from identity.
- Non-destructive received-Ámpula UI.
- Explicit local `Save Ámpula` and explicit `Add playable tracks` actions.
- `.ampula` file export.
- Removal of runtime generation/consumption of provider-ID-only `?p=` sharing.

## Non-goals

- Hosted music catalog or central resolver.
- Mandatory account or backend.
- Embedding audio, artwork, lyrics or comments into Core v1.
- Standardizing every resolver cache implementation.
- Guaranteeing that every provider can be played in every browser.

## Success criteria

1. A shared link contains enough information to render ordered title/artist metadata without provider lookup.
2. The link is self-contained and requires no Ámpula server or paste/short-link service.
3. Opening a received Ámpula does not modify `winampmusic.library.v1`.
4. Provider IDs/URLs remain observations/hints rather than canonical identity.
5. The receiver may explicitly save the original Ámpula or explicitly add currently playable tracks to the library.
6. `.ampula`, link and QR represent the same Core v1 domain object.
7. The runtime no longer creates or imports `?p=<provider-id>...` shares.
