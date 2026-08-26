# Proposal: Listen-first received Ámpula

## Problem

Receiving a shared musical moment currently looks like object administration, not like music.

Before a single note plays, the received dialog puts four management surfaces in front of the listener:

- `Save Ámpula`
- `Add playable tracks`
- `.ampula file`
- an explanatory paragraph about library mutation semantics

On a phone those controls plus the notice consume a large part of the first screen, and they all
describe what happens to an *object*. The one thing the receiver actually came for — the songs —
competes with them for attention.

Worse, the copy implies a workflow that does not exist: nothing has to be added to the library to
listen. Tapping a track already resolves a local playable source and plays it. The UI simply fails to
say so.

## Goal

Make the received surface **listen-first**.

The happy path must be:

`opened a link → saw the songs → tapped a track → music plays`

Everything that manages the received object is real, supported and unchanged — it is just not the
first thing a listener has to read.

## Scope

- Rebuild the received dialog around the track list.
- Keep only `Shared music`, the moment title/meta and `Close` above the list.
- Move `Save`, `Add to library` and `.ampula file` behind a single compact `⋯` control.
- Move the library-mutation notice into that same secondary surface.
- Report a resolution failure on the individual track that failed.
- Keep every canonical receive transport (`?a=`, short alias `?al=`, `.ampula` file, saved Ámpula)
  on the same receiver and the same playback path.

## Non-goals

- No new player, no second playback path, no change to `playReceivedTrack` semantics.
- No change to Ámpula Core v1, the compact transport encoding, or `.ampula`.
- No change to resolver semantics or provider ordering.
- No change to the non-destructive receive contract.
- No change to what `Save` persists.
- No implicit library import, and no import triggered by playback.
- No removal of `.ampula` export.

## Success criteria

- Opening a canonical link renders the shared tracks immediately, with no intermediate step.
- The primary received surface exposes no more than one secondary control.
- Tapping a track resolves and plays through the existing canonical flow, with `Add to library`
  never invoked.
- A track that cannot be resolved shows its own error, keeps its metadata, keeps the rest of the list
  interactive, and leaves `Your library` untouched.
- `Save`, `Add to library` and `.ampula file` are all reachable from the `⋯` menu.
- `Save` still persists the original received Core v1 object, with no local resolver state merged in.
- Pre-existing `?a=` links and short aliases still open through the same canonical receiver.
- The v1.6.2 received-dialog DOM-integrity regression stays green against the new layout.
