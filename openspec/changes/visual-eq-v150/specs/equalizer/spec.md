# Equalizer capability

## Requirement: visible collapsible EQ
ÁmpulaMP SHALL expose a visible `EQ` control in the player and SHALL keep the equalizer panel collapsible.

### Scenario: open equalizer
Given the player is visible and the equalizer is collapsed, when the user activates `EQ`, then the equalizer panel becomes visible and the toggle reports the expanded state.

### Scenario: close equalizer
Given the equalizer is visible, when the user activates `EQ`, then the equalizer panel becomes hidden without changing playback state.

## Requirement: truthful provider limitation
When playback audio is owned by an external provider and cannot be routed through ÁmpulaMP filtering, the equalizer SHALL be presented as visual/stateful only and SHALL display a muted explanatory message.

### Scenario: YouTube or Apple Music provider playback
Given the equalizer capability is `visual-only`, then the panel says that provider audio cannot be filtered and SHALL NOT claim audible EQ processing.

## Requirement: stateful controls
The equalizer SHALL expose PRE plus 10 frequency bands and SHALL retain slider values and expanded/collapsed preference in local storage when available.

### Scenario: user revisits equalizer
Given the user changes band values and expansion state, when the UI is initialized again, then the saved values and expansion state are restored.

## Requirement: future direct-audio capability
The optional equalizer module SHALL expose a provider-independent capability hook so a future direct/local playback adapter can declare that filtering is available without modifying core playback code.

### Scenario: capable playback adapter
Given a playback adapter owns filterable audio, when it sets equalizer capability to filterable, then the limitation presentation updates without changing the player core.
