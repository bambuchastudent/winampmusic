# YouTube.js playback restriction diagnostics v1.9.0

## Problem

When YouTube.js cannot produce audio, `LOGIN_REQUIRED` is visible but does not explain whether the response indicates sign-in, age confirmation, bot confirmation, or an unknown restriction. The local report also cannot identify which anonymous transport won the YouTube player request.

## Goal

Show a safe, timestamped diagnostic category and the winning player-request transport when evidence is available, while preserving the existing anonymous request behavior and iframe fallback.

## Scope

- Classify a small allowlist of recognizable English restriction signals; preserve unknown or localized cases as `UNKNOWN`.
- Record an ISO timestamp and a safe route label for the winning YouTube player request associated with the video being resolved.
- Keep reports free of raw upstream text, signed URLs, cookies, authorization headers, and tokens.
- Preserve the bounded WEB-to-YTMUSIC retry rule and existing `resolveAudio(videoId, suppliedInnertube)` API.

## Non-goals

- Authentication, cookies, account integration, or changing request credentials.
- Inferring IP blocking or diagnosing network-wide causes.
- Retrying an explicitly restricted video or marking it permanently unavailable.
- Changing iframe fallback behavior or track metadata.

## Success criteria

- Known bot, age, and sign-in signals map to stable categories; unrecognized/localized text maps to `UNKNOWN` without being displayed.
- Player transport evidence is associated with its video request and does not leak across overlapping resolutions.
- An explicit `LOGIN_REQUIRED` result still stops after WEB and falls back to the iframe.
