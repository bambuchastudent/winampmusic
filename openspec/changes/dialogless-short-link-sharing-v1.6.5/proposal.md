# Proposal: dialogless short-link sharing v1.6.5

## Why

The v1.6.4 receive flow made shared music playable, but it still presents both sending and receiving as custom modal dialogs. That is the wrong product shape for Ámpula: sharing is a transport action and receiving is a playback surface. A modal adds a step without adding value, especially when the user's real goal is simply to send a compact link and let the recipient listen.

The product decision for v1.6.5 is therefore explicit: **share/receive dialogs are not part of the primary Ámpula UX.** A compact link is preferable to a custom share window, and opening that link should put playable shared music directly into the page.

## What changes

- The `Share` action MUST NOT open a custom modal/dialog.
- The current Ámpula is still encoded into the canonical self-contained `?a=` URL first so sharing remains failure-safe.
- When the configured short-link transport can mint an alias, the short URL becomes the final copied value. If alias minting is unavailable, the canonical URL remains the copied fallback.
- Opening `?a=` or resolved `?al=` shared music MUST NOT open a receive modal. The received track surface is rendered inline inside the main library area.
- Received rows remain directly playable using the existing receive resolver/player path.
- Opening a share does not mutate the recipient's saved library. `Add to library` remains an explicit action.
- QR/file/saved-share UI is secondary and MUST NOT block or be required for the normal share/open/listen path.

## Compatibility

- Existing canonical `?a=` links remain valid.
- Existing short aliases `?al=` remain valid.
- Legacy `?p=` / `?s=` receive routing remains unchanged.
- This change supersedes the *presentation form* of the earlier received-share-dialog work, but preserves its playback and non-destructive-library guarantees.
