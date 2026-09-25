# Proposal: relay-aware YouTube.js activation

## Problem

The Pages workflow intentionally publishes AMPULAMP when optional Cloudflare credentials are absent. In that state `youtubejs-relay-config.js` correctly contains an empty relay URL, but the YouTube.js audio-first adapter still replaces the working iframe `playIndex` handler and tries browser-incompatible direct/public transports. A normal Play action can therefore stall or fail even though the legacy YouTube iframe path is available.

## Goal

Keep normal music playback immediately usable when the dedicated YouTube.js relay is not configured, while preserving native-audio background playback whenever that relay is available.

## Scope

- gate installation of the YouTube.js audio-first override on a configured dedicated relay;
- keep the existing iframe player untouched in normal mode when the relay is absent;
- show an explicit relay-not-configured error in YouTube.js-only diagnostic mode;
- bump the runtime cache revision and add a behavioral regression test.

## Non-goals

- no attempt to provide native-audio background playback without a browser-compatible server transport;
- no return to the short-link Worker for provider traffic;
- no mandatory backend for Ámpula Core;
- no change to track identity, origin evidence, or received Ámpula data.

## Success criteria

With an empty `window.AMPULA_YOUTUBEJS_RELAY`, loading the audio-first adapter does not replace `window.playIndex` in normal mode. With a configured relay, the existing YouTube.js native-audio path remains primary. YouTube.js-only mode reports that the relay is not configured instead of silently attempting unrelated transports.
