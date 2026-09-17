# Proposal: YouTube.js browser audio transport

## Problem

AMPULAMP loads YouTube.js before the iframe fallback, but the static GitHub Pages browser cannot call YouTube InnerTube endpoints directly because of browser CORS restrictions. The current resolver therefore falls through to iframe playback and the user never hears the native YouTube.js audio path.

## Goal

Make anonymous YouTube.js audio-only resolution actually work in the deployed browser and feed the result to the existing long-lived HTMLAudioElement.

## Scope

- use the YouTube.js browser build;
- proxy only anonymous YouTube.js network requests through a browser-compatible HTTPS relay;
- request audio-only best quality;
- never forward cookies or authorization headers to the relay;
- prime the persistent audio element during the user gesture so Android Chrome can continue playback after asynchronous resolution;
- keep iframe playback strictly as fallback;
- show YOUTUBEJS in status only while the native audio path is actually active.

## Non-goals

- no YouTube account/login forwarding;
- no persistent audio storage;
- no mutation of title, artist, origin, or received Ámpula evidence;
- no attempt to bypass OS background-playback policy.

## Success criteria

A deployed browser tap can resolve a YouTube video with YouTube.js, start native audio, advance elapsed time, and show `PLAYING · YOUTUBEJS · AUDIO` before any iframe fallback.
