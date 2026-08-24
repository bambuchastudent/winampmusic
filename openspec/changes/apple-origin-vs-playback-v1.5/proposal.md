# Proposal: distinguish Apple origin from playback source

## Problem
A pasted Apple Music track can be identified and matched to a YouTube candidate, but AmpMusic currently reports `playing YouTube match` before playback has actually succeeded. If playback later fails, the player only shows `TRACK UNAVAILABLE`, which hides the useful fact that the track originally came from a specific Apple Music storefront/link.

The Apple Music page URL is historical/origin metadata for AmpMusic. It is not, by itself, a playable media source for the player.

## Change
- Preserve the exact Apple Music URL and storefront as origin metadata.
- Treat a YouTube result as a playback candidate until playback is actually confirmed.
- Never display `playing YouTube match` immediately after matching.
- Show origin and playback state separately in the player.
- When no playable source is available, keep the Apple origin visible instead of presenting the track as generically unavailable.

## Non-goals
- Do not download audio from Apple Music.
- Do not treat an Apple Music web page URL as an audio stream.
- Do not require Apple Music login/subscription for import metadata.
- Do not change ordinary YouTube import behavior.
