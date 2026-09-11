# Design: foreground unresolved skip v1.7.10

The queue remains the authority for navigation over unresolved rows. No canonical recording data moves into playback state.

For sequential recovery the queue scans candidates in the requested direction. A ready row plays immediately. An unresolved row starts/joins its existing trusted resolver and receives a small foreground grace window. If it still is not ready when that window expires, resolution continues in background and the queue advances to the next row. This prevents one slow or impossible match from blocking a later recording.

The latest-intent generation check is evaluated before and after every await so a newer tap, Next, Previous, Play, or Pause always cancels older recovery work.

The existing long background resolution budget is retained. The new grace window changes only how long navigation waits on one candidate before trying the next candidate.