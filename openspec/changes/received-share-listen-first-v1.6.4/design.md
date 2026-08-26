# Design: Listen-first received Ámpula v1.6.4

## Ownership

`compact-share.js` builds and owns the received dialog. The layout change therefore happens in the
module that renders it, not in a patch layer on top of it.

This is deliberate. The v1.6.1 regression was caused by a cleanup layer rewriting DOM it did not own.
Adding a second layer to restructure the dialog would repeat that mistake. `share-ui-cleanup-v162.js`
keeps its narrow job — transport-neutral copy normalization by stable element ID — and the structural
decision moves into the renderer.

## Layout

The received dialog becomes three regions:

| Region | Content |
| --- | --- |
| Header | `SHARED MUSIC` eyebrow, moment title, `<n> tracks · captured at`, `Close` |
| Body | hidden player host, then the ordered track list |
| Secondary | one `⋯` control, and a collapsed menu holding `Save`, `Add to library`, `.ampula file`, plus the library-mutation notice |

The header carries no action other than `Close`. The `⋯` control sits after the list so the primary
scroll region stays the music, and the menu is `hidden` until it is opened.

Element IDs:

| ID | Role |
| --- | --- |
| `#ampulaReceivedTitle`, `#ampulaReceivedMeta`, `#ampulaReceivedClose` | unchanged |
| `#ampulaReceivedPlayer`, `#ampulaReceivedList` | unchanged |
| `#ampulaSave`, `#ampulaAdd` | unchanged, relocated into the menu |
| `#ampulaMore`, `#ampulaMoreMenu`, `#ampulaReceivedNote` | new |
| `#ampulaExport` | replaces `#ampulaFile` |

### Why `#ampulaFile` becomes `#ampulaExport`

`share-ui-cleanup-v162.js` removes `#ampulaFile` from the received dialog, because in the v1.6.2
layout that button was a third primary action competing with `Save` and `Add`. In the listen-first
layout the same capability is already secondary, so deleting it would lose `.ampula` export for no
benefit.

Renaming the element is the smallest way to express the new boundary: the cleanup layer keeps its
existing behaviour and its existing regression test unchanged, and the export survives because it is
no longer the element the cleanup layer was written to hide. Labels normalized by the cleanup layer
(`Save`, `Add to library`, `Shared music`) are emitted by the renderer with those exact values, so
normalization is a no-op rather than a fight.

## Playback path

Unchanged. A row click still calls `playReceivedTrack(index)`, which still calls `findYouTube` and
still mounts the same embedded player into `#ampulaReceivedPlayer`.

Only reporting changes. Each row owns a state and a note:

| State | Note |
| --- | --- |
| `resolving` | `Finding a playable source…` |
| `playing` | cleared |
| `unresolved` | `No playable source found right now. The track stays in this Ámpula.` |

`resolvedIds` remains local mutable state keyed by track index. It is never written back into
`receivedAmpula`, so `Save` continues to persist exactly the object that was received.

## Failure containment

A resolution failure is scoped to the row that failed:

- the dialog stays open and keeps its list;
- every other row stays interactive;
- an already mounted player keeps playing;
- `Your library` is not touched;
- the global status line reports the failure but the dialog does not become an error state.

`findYouTube` already swallows per-instance network errors and returns an empty string. The renderer
treats an empty result and a thrown error identically.

## Non-destructive receive

Unchanged and re-asserted by test:

- opening a link does not write `winampmusic.library.v1`;
- playback does not write `winampmusic.library.v1`;
- `Add to library` is the only path that calls `window.importTracks`;
- `Save` writes only `winampmusic.ampulas.v1`.

## Transport equivalence

`?a=`, the `?al=` short alias, `.ampula` file open and reopening a saved Ámpula all converge on
`renderReceived`. The listen-first layout is therefore reached by every canonical receive path
without any transport-specific UI code.

## Critical path

The FAST invariant is unchanged. The received dialog is still lazily loaded by
`fast-actions-v143.js`, still only for share/receive flows, and still cannot block local playback
controls or startup.

## Deployment

`compact-share.js` is loaded with `?v=164` and the service-worker shell cache key is bumped, so
deployed clients pick up the new layout instead of staying on the v1.6.1 asset query.

## Failure modes

- Menu markup missing: the `⋯` handler is a no-op and the list still plays.
- Row note missing: state changes are skipped, playback is unaffected.
- Cleanup module unavailable: the renderer already emits final copy, so the dialog is correct.
- Resolver unavailable: every row reports its own failure and metadata stays visible.
