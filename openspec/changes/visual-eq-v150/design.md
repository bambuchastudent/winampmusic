# Design

## Architecture
The equalizer is optional UI layered beside the existing player. Markup and styles live in `index.html`; behavior lives in deferred `equalizer-v150.js` so it does not own playback controls or delay the FAST core.

The equalizer is intentionally provider-aware. Its default capability is `visual-only`, which matches YouTube iframe and Apple Music provider-owned playback: ÁmpulaMP cannot route that audio through its own Web Audio graph. The panel therefore keeps visual slider state without claiming audible filtering.

A small `window.ampulaEqualizer.setCapability({ canFilter, label })` hook allows a future local/direct-audio adapter to update the capability message when it really owns an audio node. This change does not implement that future audio graph.

## Ownership
- `index.html`: EQ toggle, panel, sliders, muted capability message, responsive styling, deferred script tag.
- `equalizer-v150.js`: collapse state, slider state, labels, capability message API.
- `tests/equalizer-ui.test.mjs`: static behavioral contract for visibility, truthful limitation copy, deferred/non-core wiring, persistence, and capability hook.

## Critical-path constraints
`fast-player-v141.js` remains the synchronous playback core. `equalizer-v150.js` is loaded with `defer` and has no dependency from the core player.

## Compatibility
Existing storage/runtime identifiers are untouched. EQ uses new keys under `ampula.eq.*` and does not migrate or rewrite legacy library/player state.

## Failure modes
If EQ script execution fails, playback still works and the panel remains collapsed. If localStorage is unavailable, state persistence silently degrades while controls remain usable.
