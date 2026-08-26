# Design: Received Share dialog integrity v1.6.2

## Root cause

`Element.textContent` is destructive when written on a container: all descendant nodes are replaced by one text node. The v1.6.1 cleanup searched `dialog.querySelectorAll('div')` and matched against aggregate `textContent`, so a parent `div` could match before the actual explanatory leaf.

## UI patch ownership

The v1.6.2 cleanup keeps the existing lazy patch layer but narrows the received-message rewrite:

1. enumerate descendant `div` nodes;
2. ignore every node that has element children;
3. match the historical explanatory copy only on a leaf;
4. rewrite that leaf and nothing else.

This is deliberately fail-safe. If the exact leaf cannot be found, copy normalization is skipped; the dialog remains functional.

The Save and Add labels are still normalized by stable element IDs. The format-specific `.ampula` action remains hidden from the primary received UI without removing sibling controls.

## Deployment/cache behavior

`fast-actions-v143.js` loads `share-ui-cleanup-v162.js?v=162` for both Share and canonical `?a=` receive. The service-worker cache key is bumped and the v1.6.2 file is included in the shell list. The old v1.6.1 file may remain in the repository for historical compatibility but is no longer the active loader target.

## Behavioral test

The targeted Node test uses a minimal fake DOM with browser-like `textContent` setter semantics: setting a container's text detaches all children. The fixture places the old explanatory message under the same kind of nested received-dialog structure as production.

The test asserts that after executing the cleanup script:

- track list still exists;
- Save and Add buttons still exist;
- their labels are normalized;
- only the explanatory leaf text changes;
- the `.ampula` button is removed without deleting siblings.

This specifically catches the v1.6.1 failure mode rather than only checking strings in source code.

## Compatibility semantics

Canonical `?a=` receive remains non-destructive and produces a distinct received context.

Historical `?p=` and `?s=` URLs are not Ámpula Core. A separate lazy receive-only compatibility adapter may recover them into working playlist state. New sharing never generates those transports.

## Short-link boundary

A short link is technically possible only with a mapping/dereference service. If added later, it is a transport alias to a Core v1 object, not a canonical Ámpula ID and not a resolver authority. The product must keep a self-contained URL or `.ampula` export path so the musical moment remains portable if the alias service disappears.

## Critical path

The FAST invariant is unchanged. The cleanup remains lazy and is loaded only for Share or received-share flows. Failure to load or patch copy must not block local playback controls or mutate the local library.

## Failure modes

- Leaf notice missing: leave existing copy untouched.
- Cleanup module unavailable: Share/receive reports failure without corrupting local library.
- Stale client cache: v1.6.2 file name/query and service-worker cache bump force a fresh shell on normal deployment update.
- Legacy compatibility unavailable: canonical `?a=` receive remains unaffected.
