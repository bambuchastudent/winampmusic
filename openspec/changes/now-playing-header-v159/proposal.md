# Proposal

## Problem

Importing an Apple Music link while another track is already playing can replace the visible Now Playing metadata before a playable source for the imported track has actually been resolved. The header also spends prime space on a repository icon and a large bottle on the right, while the user wants the bottle to act as the repository affordance next to the product name and the right side to show a compact equalizer-style visualization.

## Goal

- Keep Now Playing bound to the source that is actually playing until a replacement source is ready.
- Move the bottle logo to the left of the Ámpula MP title and make it the GitHub repository link.
- Make the footer version label a GitHub repository link and remove the separate square repository button.
- Use the old right-side logo area for a compact spectrum/equalizer-style playback visualization.

## Scope

Player transition behavior in `clean-playback-v150.js`, header/footer markup and styling in `index.html`, plus a lightweight playback-state visualizer.

## Non-goals

- Do not change Apple Music provenance rules.
- Do not claim that provider URLs are playable sources.
- Do not require microphone permission or capture system audio.
- Do not block playback on visualization code.

## Success criteria

1. Importing or attempting to play an unresolved Apple catalog track cannot replace the visible title/artist of an already-playing track until a replacement stream has been resolved.
2. On resolution failure, the existing playback continues and its Now Playing metadata remains visible.
3. The bottle appears immediately left of `Ámpula MP` and opens the repository when clicked.
4. Footer `1.5` opens the same repository and there is no separate square repository icon in the title row.
5. A right-side equalizer-style visualizer animates while playback is active and settles when playback is paused/stopped.
