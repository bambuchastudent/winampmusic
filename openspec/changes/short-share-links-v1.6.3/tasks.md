# Tasks: Short Ámpula share links

## Specification

- [x] Describe the problem, goal, scope and non-goals in `proposal.md`.
- [x] Define canonical-vs-alias ownership, share flow, receive flow and failure modes in `design.md`.
- [x] Add the `ampula-sharing` delta for optional short aliases and fallback.
- [x] Add the `short-link-relay` capability spec with API contract, limits, privacy and durability.

## Tests

- [x] Prove a configured, reachable relay produces a short link in the Share dialog.
- [x] Prove a missing relay performs no network call and keeps the self-contained link.
- [x] Prove relay timeout/offline/5xx/413 all fall back to the self-contained link and still succeed.
- [x] Prove a received alias decodes to an object deep-equal to the canonical `?a=` object.
- [x] Prove a received alias renders the Shared music UI through the canonical receiver.
- [x] Prove a received alias does not mutate `winampmusic.library.v1`.
- [x] Prove a failed alias dereference is non-destructive.
- [x] Prove pre-existing self-contained `?a=` links still open with no relay present.
- [x] Prove legacy receive-only `?p=` / `?s=` recovery is untouched.
- [x] Prove the alias module is not in the startup script list and is lazily loaded.
- [x] Prove the Share dialog is populated before the alias attempt starts.
- [x] Prove no public third-party shortener is referenced by runtime code.
- [x] Prove the alias token is never persisted into the library or saved Ámpulas.
- [x] Keep the Received Share UI contract test (v1.6.2) green.

## Runtime implementation

- [x] Add lazy `ampula-short-link-v163.js` exposing `isEnabled`, `create`, `apply` and `receive`.
- [x] Read relay configuration from `window.AMPULA_SHORT_LINK_RELAY` or a `<meta>` tag; default off.
- [x] Bound alias creation with `AbortController` and a 2500 ms deadline.
- [x] Skip alias creation for payloads above the declared limit.
- [x] Upgrade only `#winampShareUrl`, leaving `share-ui-cleanup-v162.js` copy ownership intact.
- [x] Wire `fast-actions-v143.js` to attempt the alias after the canonical share, before QR.
- [x] Wire `fast-actions-v143.js` to lazily handle `?al=` receive.
- [x] Route `?al=` through `history.replaceState` + `winampMusicCompactShare.load()`.
- [x] Strip `al` in `compact-share.appUrl()`, `ampula-file-open-v1.js` and the Clear action.
- [x] Precache the alias module in `sw.js`.

## Relay

- [x] Add a deployable Cloudflare Worker under `relay/short-link/`.
- [x] Add `wrangler.toml` with the KV binding and `APP_ORIGIN` placeholder.
- [x] Document the API contract, limits, failure modes, privacy and expiration in the relay README.
- [x] State explicitly that no production relay is deployed by this change.

## Documentation and verification

- [x] Document short links, the fallback and the "no relay configured" default in `README.md`.
- [x] Extend `tests/repository-integrity-v1.mjs` with alias-module guards.
- [x] Add `verify-short-link-optional-v163.mjs` static contract.
- [ ] Confirm the GitHub Pages verification run is green on the merged `develop` head.
