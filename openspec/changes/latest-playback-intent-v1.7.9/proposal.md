# Latest playback intent v1.7.9

## Problem

A slow resolver started by an earlier explicit track tap can finish after the user has selected a different track. The stale request can then call the underlying player and steal playback from the newer selection. On mobile this looks like a random song starting after tapping a ready row and can also destabilize sequential Next behavior.

The base player also renders an ellipsis while starting playback, so the primary transport control temporarily stops looking like a pause control even though the user has already asked playback to continue.

## Change

- Treat each playback navigation request as a new playback intent generation.
- An async explicit-selection resolution may start playback only if it is still the latest generation.
- Sequential Next with Shuffle OFF keeps library order and skips unresolved rows even while older resolutions finish in the background.
- A pending play/start request exposes Pause immediately; tapping Pause cancels the pending play intent instead of issuing another play request.
- Resolver results may update local playback handles only; title, artist and origin metadata remain canonical.
