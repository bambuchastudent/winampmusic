# Proposal: foreground unresolved skip v1.7.10

## Problem

Sequential playback can still appear stuck when the next recording is unresolved and a later recording is also not pre-resolved yet. The queue currently waits for background full-library resolution to make a later row ready instead of actively walking the next rows in playback order.

In production this means a non-resolving row can block `Next` / `ENDED` even though a later recording could resolve and play.

## Change

Make forward/backward queue recovery deterministic and foreground-aware:

- preserve library order with Shuffle OFF;
- give each unresolved candidate only a short foreground resolution grace period;
- if that candidate does not become playable in the grace period, leave its resolver running in background and continue to the following candidate;
- play the first later candidate that is already ready or becomes final-trusted during its foreground attempt;
- keep the existing latest-intent cancellation guard;
- never rewrite title, artist, origin, or origin provider from a playback match.
