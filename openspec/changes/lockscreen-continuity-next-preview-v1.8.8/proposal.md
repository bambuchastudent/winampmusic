# Lockscreen continuity and next-track preview

## Problem

On Android the YouTube iframe can pause as the screen locks. The native-audio route can fail with `Streaming data not available`, so the iframe remains a necessary fallback. The next track and playlist position are not shown alongside the existing shuffle state.

## Goal

Attempt to resume an iframe interrupted immediately by hiding the page, while preserving explicit pause. Show the expected next playable recording and its one-based library position in the player and Media Session metadata.

## Scope and success

Keep the iframe fallback; one bounded recovery attempt after a lock-triggered pause. Reserve a random next track while shuffle is enabled so the preview agrees with the next navigation. Show an honest pending indication when no playable next track is known. Test pause intent, preview, and shuffle reservation.

## Non-goals

Guaranteeing background playback when Android suspends the page or its embedded provider; adding a native shuffle button to the Media Session API.
