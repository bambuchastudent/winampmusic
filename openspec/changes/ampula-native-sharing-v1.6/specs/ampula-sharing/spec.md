# Ámpula sharing specification delta

This capability consumes the canonical Ámpula Core v1 format in `ampula/`.

## Requirement: Sharing transfers a complete Ámpula

The system MUST share a valid Core v1 object that preserves the musical moment independently of any single playback provider.

The representation MUST preserve track order and human-readable title/artist metadata. It MAY preserve context, stable recording evidence and historical provider observations. Provider IDs MUST NOT be the only representation of a track.

### Scenario: Share an 18-track Ámpula

**Given** the sender has 18 ordered tracks with title and artist metadata  
**When** the sender shares them  
**Then** the generated Ámpula MUST contain all 18 tracks in the same order  
**And** the link MUST be decodable without querying a central Ámpula backend  
**And** provider identifiers MUST remain observations rather than musical identity.

## Requirement: Legacy provider-ID sharing is removed

The system MUST NOT generate, consume, or fall back to legacy `?p=<id>.<id>...` or remote `?s=` playlist sharing as Ámpula.

### Scenario: Old share link is opened

**Given** a URL contains only legacy `?p=` or `?s=` sharing  
**When** AMPULAMP opens the URL  
**Then** it MUST NOT import those IDs into the local library  
**And** it MUST report that legacy share format as unsupported.

## Requirement: Receiving is non-destructive

Opening `?a=` MUST create a distinct Received Ámpula presentation and MUST NOT mutate the receiver's existing general library.

### Scenario: Receiver already has 40 local tracks

**Given** `Your library` contains 40 tracks  
**And** the receiver opens an 18-track Ámpula  
**When** decoding succeeds  
**Then** the received context MUST show exactly those 18 shared tracks  
**And** the persisted local library MUST still contain the same 40 tracks  
**And** no received track MUST be added merely because the link was opened.

## Requirement: Received metadata is visible without playback resolution

The receiver MUST be able to inspect the intended musical moment even when one or more playable sources cannot be resolved.

### Scenario: Original provider is unavailable

**Given** a received track contains preserved title and artist metadata  
**When** its historical provider observation cannot be played  
**Then** title and artist MUST remain visible  
**And** the resolver MAY search locally available sources  
**And** a failed match MUST NOT delete or replace the track in the received Ámpula.

## Requirement: A received Ámpula can be explicitly saved

The receiver MUST be able to persist the original received Core v1 object using an explicit `Save Ámpula` action.

### Scenario: Save after local source resolution

**Given** a received track was locally resolved to a new current provider representation  
**When** the receiver saves the Ámpula  
**Then** the saved object MUST preserve the original received evidence/observations  
**And** the local playback match MUST remain local mutable state.

## Requirement: Saving and library import are separate

`Save Ámpula` MUST NOT implicitly add tracks to `Your library`. Any `Add playable tracks` action MUST be separate and explicit.

## Requirement: URL, QR and `.ampula` represent the same Core object

A compact link/QR and `.ampula` file MUST decode to equivalent ordered musical-moment semantics. Transport-specific encoding MUST NOT become musical identity.

## Requirement: Share/receive failures do not break the core player

Invalid, unavailable, or unsupported shared payloads MUST fail non-destructively and MUST NOT block normal local player startup or controls.
