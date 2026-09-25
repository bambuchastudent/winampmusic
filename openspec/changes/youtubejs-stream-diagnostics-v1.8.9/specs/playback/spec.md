# YouTube.js resolution delta

## Requirement: classify an unavailable audio stream

When the WEB client returns no streaming data, the adapter SHALL inspect playability and audio-format availability. A non-OK playability response SHALL stop alternate-client attempts and preserve the iframe fallback in normal mode. When playability is OK and no audio format is available, the adapter MAY attempt one `YTMUSIC` resolution before falling back.

## Requirement: safe local diagnostics

A failed YouTube.js playback SHALL show an expandable local diagnostic containing the attempted client(s), playability state, audio-format count, stage and a stable error category. It SHALL NOT expose signed URLs, request headers, tokens or raw upstream responses. A later successful native audio playback SHALL clear the failure diagnostic. The track title, artist and source observations SHALL remain unchanged.
