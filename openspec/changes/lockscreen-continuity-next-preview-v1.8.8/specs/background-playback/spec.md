# Background playback and next-track preview delta

## Requirement: lock interruption recovery

If the iframe reports PAUSED shortly after the page becomes hidden while playback intent was active, the player SHALL request one resume. An explicit Media Session Pause SHALL cancel this attempt. The player SHALL NOT present this as guaranteed background playback on all Android devices.

## Requirement: next recording visibility

The player SHALL show the expected next playable recording and its one-based library position; when none is known, it SHALL say that resolution is pending. Shuffle SHALL reserve the displayed candidate until continuation, so the queue uses that candidate. Direct selection and Previous SHALL ignore the reservation. Media Session metadata SHALL include the preview and shuffle state, while standard Previous/Next action handlers remain installed.
