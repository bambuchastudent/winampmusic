# Apple album source requirements

## Requirement: bare album links are albums
A bare Apple Music album URL MUST be interpreted as an album collection. The numeric path id MUST NOT be treated as a song id. An album URL with `?i=<trackId>` MAY be treated as a single-track link.

## Requirement: exact Apple collection metadata
Album import MUST accept only Apple song rows belonging to the supplied collection id and MUST preserve Apple track order for resolved rows.

## Requirement: safe source resolution
Each Apple song MUST use the strict current-source matcher. A missing safe match MUST be skipped rather than replaced with unrelated content.

## Requirement: no ad fallback for Apple imports
Apple-provenance rows MUST prefer direct audio and MUST NOT silently fall through to the YouTube iframe if direct audio cannot be obtained. The player SHOULD surface source unavailability instead.

## Requirement: compatibility
Ordinary YouTube track/playlist behavior and the public AmpMusic 1.5 version MUST remain unchanged.
