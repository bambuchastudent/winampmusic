# Proposal: fix search, metadata and library UI in AmpMusic 1.5

## Problem
A real Android production check exposed four related regressions in the current 1.5 shell:

- YouTube search can fall through to the external-search link when the small Invidious pool is unavailable.
- A pasted YouTube track can play correctly while remaining labelled `YouTube <videoId>` because background oEmbed metadata updates localStorage but not the FAST player's in-memory library/UI.
- The empty-library block can remain visible even when tracks exist because the stylesheet gives `.empty-state` an explicit display value that wins over the HTML `hidden` state.
- The lazily loaded legacy search helper overwrites the public footer with `v0.5.9`.

## Goal
Keep the current AmpMusic 1.5 UI and playback architecture, but make search resilient and keep the visible library state consistent with the actual library.

## Scope
- Add a second search-provider family as fallback without adding a backend or API key.
- Make metadata hydration update the active FAST library and current-track UI immediately.
- Make `hidden` authoritative for the empty state.
- Prevent legacy helper code from changing the public 1.5 version.
- Add release-gate coverage for these regressions.

## Non-goals
- No redesign.
- No version bump.
- No YouTube Data API key or server-side search service.
