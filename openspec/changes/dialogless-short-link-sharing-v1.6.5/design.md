# Design: dialogless short-link sharing v1.6.5

## Product rule

Ámpula sharing has no intermediate product window in the primary flow:

`Share` → copy a link → send it.

Opening that link is also direct:

`open link` → inline shared track list → tap a track → listen.

A custom modal is not a destination and must not sit between either of those steps.

## Sender flow

1. `compact-share.js` continues to build the canonical self-contained `?a=` URL. This preserves the open-format/failure-safe property.
2. `share-ui-cleanup-v162.js` suppresses `#winampShareDialog.showModal()` and watches the existing share status transition.
3. When the canonical URL is ready, it is copied immediately as the fallback.
4. `fast-actions-v143.js` may run the existing `ampula-short-link-v163.js` alias adapter asynchronously.
5. If alias minting succeeds, the adapter replaces `#winampShareUrl` with the short URL and emits `SHORT LINK READY`; the dialogless adapter copies that value again so the user's clipboard ends with the short link.
6. If alias minting is unavailable, the already-copied canonical link remains usable. Sharing must never fail solely because shortening failed.

The hidden share dialog remains an internal compatibility container for now because the existing compact-share and short-link adapters exchange the URL through `#winampShareUrl`. It is not presented to the user and is not a product surface.

## Receiver flow

`compact-share.js` remains the owner of decoding, track rendering and received-track playback. Its `#ampulaReceivedDialog` is reused only as a DOM container so the existing event listeners and resolver/player code do not need to be duplicated.

The dialogless adapter intercepts `showModal()` for this specific receive container and instead:

- moves it into `.library-panel`;
- presents it as a normal inline block;
- temporarily hides the normal local-library list to avoid two competing track surfaces;
- preserves the existing received track list, resolver state and embedded player;
- replaces the modal close affordance with `← My library`, which restores the local-library surface and removes share parameters from the current URL.

No saved-library mutation occurs during open or playback. `Add to library` remains explicit.

## Scope and safety

The `HTMLDialogElement.showModal` interception is narrowly scoped to `#winampShareDialog` and `#ampulaReceivedDialog`. Other dialogs continue to call the browser's native `showModal()` implementation unchanged.

The short-link relay remains optional. This change makes a short alias the preferred result when available; it does not make a network service the source of truth for Ámpula.

## Follow-up

A future cleanup may replace the hidden sender dialog with a plain internal URL state object. That is deliberately not required for v1.6.5 because removing the visible window can be done without destabilizing the share codec or short-link adapter.
