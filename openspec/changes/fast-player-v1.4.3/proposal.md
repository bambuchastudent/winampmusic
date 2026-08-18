# Proposal: FAST 1.4.3 playlist actions

## Problem
The player recently regressed because optional interaction/recovery modules were allowed to participate in the critical startup path. FAST 1.4.x restored reliable controls by shrinking startup to the minimum player runtime.

Users now need playlist management and sharing back without reintroducing the same class of regression.

## Goal
Add playlist gifting/sharing (including QR) and playlist clearing while preserving the FAST startup contract.

## Scope
- Add `Gift / QR` beside the playlist header.
- Add two-step `Clear` beside the playlist header.
- Load compact share and QR implementation only after the user requests sharing.
- Receive a shared playlist when the page is opened with a supported share parameter.
- Never replace or block the existing Play/Prev/Next/track click handlers.
- Preserve the current local playlist unless the user explicitly confirms Clear.

## Non-goals
- Do not restore the legacy application shell.
- Do not add service-worker startup dependencies.
- Do not add capture/pointer interaction layers.
- Do not make QR or sharing libraries part of first paint.
- Background playback is a separate change because it affects playback lifecycle and mobile browser policy.

## Success criteria
- Existing 183-track fast startup regression test stays green.
- Share/QR modules are absent from normal startup and load only after `Gift / QR`.
- Clear requires two user actions and removes only playlist/current-playback state owned by Winamp Music.
- Shared playlists merge into the receiver library rather than deleting existing tracks.
