# Design

## Activation boundary

`fast-release-v150.js` already loads `youtubejs-relay-config.js` before the audio-first runtime. The runtime therefore owns a deterministic installation decision:

- non-empty `window.AMPULA_YOUTUBEJS_RELAY`: install the YouTube.js native-audio override;
- empty relay in normal mode: leave the existing iframe `window.playIndex` handler untouched;
- empty relay in `?playback=youtubejs` mode: leave iframe playback disabled and expose a precise diagnostic status.

The decision is made before event listeners are attached or `window.playIndex` is replaced. This prevents a missing optional deployment from owning the core Play action.

## Compatibility

The checked-in relay config stays inert, and Pages remains deployable without Cloudflare credentials. Existing provider-independent Ámpula behavior, storage keys, sharing, and iframe playback remain unchanged.

When the dedicated relay is configured, the current persistent native `HTMLAudioElement`, Media Session handlers, and audio-only resolution path continue unchanged.

## Failure modes

- Missing relay: immediate iframe playback in normal mode.
- Missing relay in diagnostic-only mode: `YOUTUBEJS ERROR · RELAY NOT CONFIGURED`.
- Configured relay that later fails: existing runtime error handling falls back to the iframe in normal mode.

Native-audio background playback still requires a healthy dedicated relay; the fallback restores listening but cannot make iframe playback equivalent to native audio on every mobile browser.
