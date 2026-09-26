# YouTube TV authorization experiment v1.9.0

## Problem

An anonymous YouTube.js result does not establish whether user authorization changes a selected video's TV InnerTube playability. The existing anonymous playback relay deliberately strips credentials. A diagnostic comparison must avoid changing that path or adopting the YouTube TV application's OAuth identity.

## Goal and scope

Provide an opt-in, standalone browser page to complete Google's device authorization with an operator-owned TV/Limited Input OAuth client, then compare anonymous and authorized YouTube.js TV `getBasicInfo` and audio stream availability for one entered YouTube video ID. Export only a constrained report.

The isolated, stateless relay forwards only the known Google OAuth endpoints and YouTube TV player/next InnerTube endpoints, with restricted origins and no token storage. Users enter the client identity in the page; all state stays in that page's memory and disappears on reload.

## Non-goals

- No normal player integration, automatic deployment, credential persistence, reusable proxy, Google account profile, raw-cookie import, or guarantee of streaming.
- An OAuth token for the YouTube Data API does not prove acceptance by private TV InnerTube.

## Success criteria

Tests verify validation, polling/cancel/logout/refresh, stale replies, two-instance isolation, transport allowlisting, and redacted reports. An operator can follow the documented manual setup and distinguish OAuth completion, TV provider acceptance, playability, and audio format availability.
