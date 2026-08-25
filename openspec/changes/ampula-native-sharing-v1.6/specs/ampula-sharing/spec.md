# Ámpula sharing specification delta

## Requirement: Sharing transfers a complete Ámpula

The system MUST share a versioned Ámpula object that preserves the musical moment independently of any single playback provider.

The payload MUST preserve at least:

- track order;
- human-readable title and artist metadata;
- provenance/source hints sufficient for later resolution;
- provider identifiers/URLs when known;
- the intended start track.

Provider-specific IDs MUST NOT be the only representation of a shared track.

### Scenario: Share an 18-track Ámpula

**Given** the sender has an Ámpula containing 18 ordered tracks with title and artist metadata  
**When** the sender shares it  
**Then** the generated share represents all 18 tracks in the same order  
**And** the shared representation preserves title and artist metadata  
**And** provider identifiers remain source/provenance information rather than the identity of the moment.

## Requirement: Legacy provider-ID sharing is removed

The system MUST NOT generate, consume, or fall back to the legacy `?p=<id>.<id>...` share format.

### Scenario: Full-fidelity transport fails

**Given** the preferred full-fidelity share transport is unavailable  
**When** the user attempts to share an Ámpula  
**Then** the system MUST NOT generate a provider-ID-only fallback URL  
**And** the system MAY offer another transport that still contains the complete Ámpula.

### Scenario: Old `?p=` link is opened

**Given** a URL contains only the legacy `?p=` parameter  
**When** ÁmpulaMP opens the URL  
**Then** it MUST NOT import those IDs into the local library  
**And** it MUST treat that share format as unsupported.

## Requirement: Receiving is non-destructive

Opening a shared Ámpula MUST create a distinct `Received Ámpula` context and MUST NOT mutate the receiver's existing general library.

### Scenario: Receiver already has 40 local tracks

**Given** the receiver's `Your library` contains 40 tracks  
**And** the receiver opens a shared Ámpula containing 18 tracks  
**When** the shared Ámpula finishes loading  
**Then** the received context MUST show exactly those 18 shared tracks  
**And** `Your library` MUST still contain the same 40 tracks in the same state  
**And** no shared track MUST be added to the library merely because the link was opened.

### Scenario: Receiver has an empty library

**Given** the receiver has no local tracks  
**When** the receiver opens a valid 18-track Ámpula  
**Then** the received context MUST contain exactly 18 tracks  
**And** `Your library` MUST remain empty until the receiver explicitly imports tracks.

## Requirement: Received metadata is visible without successful playback resolution

The receiver MUST be able to see the intended musical moment even when one or more playback sources cannot be resolved.

### Scenario: Original provider source is unavailable

**Given** a received track contains preserved title, artist, and provenance  
**And** its original provider URL can no longer be played  
**When** the received Ámpula is opened  
**Then** the track MUST still display its preserved title and artist  
**And** the system MUST NOT replace it with a placeholder such as `YouTube <id>` solely because resolution failed  
**And** the resolver MAY search locally available sources for a playable match.

## Requirement: A received Ámpula can be explicitly saved

The receiver MUST be able to persist a received Ámpula as a first-class local Ámpula using an explicit `Save Ámpula` action.

Saving MUST preserve the received musical moment rather than converting it into the currently resolved provider representation.

### Scenario: Save a received Ámpula

**Given** a valid received Ámpula is open  
**When** the receiver activates `Save Ámpula`  
**Then** the complete Ámpula MUST be stored locally  
**And** its track order, title/artist metadata, provenance, and intended start track MUST be preserved  
**And** it MUST be reopenable later without requiring the original share link.

### Scenario: Save after local source resolution

**Given** a received track originated from one provider  
**And** the receiver resolves it to a different playable provider  
**When** the receiver saves the Ámpula  
**Then** the saved Ámpula MUST preserve the original received provenance  
**And** the resolved playback source MUST remain local resolution/cache state rather than redefining the musical moment.

## Requirement: Saving an Ámpula is separate from importing tracks

`Save Ámpula` MUST NOT implicitly add its tracks to `Your library`.

If the product exposes `Add tracks to library`, that action MUST be separate and explicit.

### Scenario: Save without library import

**Given** the receiver has 40 tracks in `Your library`  
**And** an 18-track received Ámpula is open  
**When** the receiver chooses `Save Ámpula`  
**Then** the Ámpula MUST appear in the receiver's saved Ámpula collection  
**And** `Your library` MUST still contain the same 40 tracks.

## Requirement: Shared transport and `.ampula` represent the same domain object

Link sharing, QR sharing, and `.ampula` file import/export MUST decode to the same versioned Ámpula domain model.

### Scenario: Same Ámpula arrives through different transports

**Given** the same Ámpula is sent once by share link and once as a `.ampula` file  
**When** both representations are decoded  
**Then** they MUST produce equivalent ordered musical moments  
**And** transport-specific details MUST NOT become part of the musical identity.

## Requirement: Share/receive failures do not break the core player

Invalid, unavailable, or unsupported shared payloads MUST fail non-destructively and MUST NOT block normal local player startup or controls.

### Scenario: Shared payload cannot be decoded

**Given** the application is opened with an invalid shared payload  
**When** decoding fails  
**Then** the user MUST receive an error state  
**And** the existing local library MUST remain unchanged  
**And** normal local playback controls MUST remain usable.
