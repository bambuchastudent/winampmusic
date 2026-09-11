# Playback navigation delta v1.7.8

## Requirement: explicit selection is exact

When the user explicitly selects a library row, playback MUST target that recording. Shuffle state and unresolved recovery MUST NOT substitute a different row.

### Scenario: explicit ready row while Shuffle is ON
Given row 3 is current, Shuffle is ON, and row 5 is ready, when the user clicks row 5, row 5 starts.

### Scenario: explicit unresolved row
Given row 3 is current and row 4 is unresolved, when the user clicks row 4, the client attempts resolution for row 4 and MUST NOT start row 5 or another fallback recording merely because it is ready.

## Requirement: default continuation preserves order

When Shuffle is OFF, forward continuation MUST follow library order while skipping unresolved rows.

### Scenario: one missing row
Given row 3 is current, row 4 is unresolved, and row 5 is ready, when row 3 ends or Next is requested, row 5 starts.

## Requirement: Shuffle is an explicit playback mode

Shuffle MUST default to OFF when the user has no stored preference. Toggling Shuffle MUST NOT immediately change the current track. The mode MUST expose an accessible pressed state and visible compact status beneath origin/playback provenance.

### Scenario: Shuffle enabled
When the user enables Shuffle, the button reports `aria-pressed=true`, the status line reports `SHUFFLE · ON · NEXT · RANDOM`, and future forward continuation may choose another ready row out of sequential order.

### Scenario: Shuffle disabled
When Shuffle is disabled, the button reports `aria-pressed=false`, the status line reports `SHUFFLE · OFF · ORDER · SEQUENTIAL`, and forward continuation returns to library order.

## Requirement: hidden suspension preserves playback intent

A provider/browser-generated pause while the document is hidden MUST NOT erase a snapshot that says playback was intended to continue.

### Scenario: leave and return to the Ámpula tab
Given a track is playing, when the document becomes hidden and the embedded provider reports PAUSED due to suspension, then returning to the visible document resumes the same intended playback instead of remaining stopped.

## Requirement: navigation does not mutate musical identity

Navigation, shuffle, and continuity behavior MUST NOT overwrite title, artist, origin metadata, or origin provider with playback-provider data.
