# Proposal: visual equalizer for provider playback

## Problem
ÁmpulaMP 1.5 no longer shows the equalizer. Its visual language is inspired by the classic Winamp player; earlier controls were visual/stateful only for YouTube iframe playback, but the current UI hides that capability entirely and gives no explanation of the provider limitation.

## Goal
Restore a clearly discoverable, collapsible PRE + 10-band equalizer panel while being explicit when the active provider audio cannot be filtered by ÁmpulaMP.

## Scope
- Add an EQ toggle to the player.
- Add a compact PRE + 10-band visual equalizer.
- Persist expanded state and slider positions locally.
- Show muted explanatory copy for provider-owned audio such as YouTube and Apple Music.
- Expose a small capability hook so a future direct/local audio adapter can replace the limitation message without redesigning the UI.

## Non-goals
- Do not claim that iframe/provider-owned audio is filtered.
- Do not reroute YouTube or Apple Music audio through Web Audio.
- Do not move EQ code into the startup-critical player path.

## Success criteria
- EQ is visible as a control and can be expanded/collapsed.
- The panel is collapsed by default unless the user previously expanded it.
- Sliders are visually usable and their state persists.
- The UI explicitly says when EQ is visual only and why.
- Existing playback/library controls remain unchanged and usable.
