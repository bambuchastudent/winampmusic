# Playback order, shuffle state, and tab continuity v1.7.8

## Why

Playback currently conflates an explicit track selection with queue recovery. If the selected row is unresolved, the queue can substitute another ready row, which makes a direct click appear random. The Shuffle control is also a one-shot random action with no ON/OFF state, and background suspension can overwrite the user's intent to keep playing.

## What changes

- distinguish explicit track selection from Next/automatic continuation;
- keep manual selection pinned to the selected recording, resolving that row in place instead of substituting another recording;
- keep sequential playback as the default and skip unresolved rows in library order only during continuation;
- turn Shuffle into a persistent ON/OFF playback mode with visible and accessible state;
- show a compact playback-mode line directly below origin/playback provenance;
- preserve intended playback while a hidden tab is suspended and resume the same track when the tab becomes visible again.

## Non-goals

- no changes to title, artist, origin, provider matching, or recording identity;
- no rewriting of Spotify/Apple origin metadata from YouTube playback candidates;
- no new matching heuristics.
