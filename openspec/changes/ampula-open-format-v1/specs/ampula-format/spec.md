# Ámpula open-format specification

## Requirement: Core is provider-independent

A valid Ámpula v1 MUST contain `format = ampula`, `version = 1`, and a non-empty ordered tracks array. Each track MUST contain human-readable title and at least one artist. Provider identifiers and URLs MUST NOT be the only canonical track identity.

### Scenario: Provider disappears

**Given** an Ámpula track has title/artist metadata and a historical provider observation  
**When** that provider item is unavailable  
**Then** the track MUST remain visible with its preserved metadata  
**And** another resolver MAY find a different playable representation.

## Requirement: Sharing is self-contained

AMPULAMP MUST encode the complete Ámpula into a self-contained share transport and MUST NOT require a central Ámpula backend or paste/short-link service to open it.

### Scenario: Share service does not exist

**Given** a user shares an 18-track Ámpula  
**When** the receiver opens the generated URL  
**Then** all 18 ordered tracks and their metadata MUST be reconstructable from the link itself.

## Requirement: Legacy provider-ID fallback is removed

The runtime MUST NOT generate or import `?p=<id>.<id>...` as an Ámpula fallback.

### Scenario: Old provider-ID link

**Given** a URL contains only legacy `?p=` or remote `?s=` sharing  
**When** AMPULAMP opens it  
**Then** the local library MUST NOT be mutated  
**And** the runtime MUST report the legacy share as unsupported.

## Requirement: Receiving is non-destructive

Opening `?a=` MUST present a Received Ámpula context without implicitly adding tracks to `Your library`.

### Scenario: Existing local library

**Given** Your library contains 40 tracks  
**When** an 18-track Ámpula is opened  
**Then** the receiver MUST be able to inspect all 18 received tracks  
**And** the persisted 40-track library MUST remain unchanged.

## Requirement: Save and import are separate

`Save Ámpula` MUST persist the received Core object separately from the general track library. `Add playable tracks` MUST be an explicit independent action.

### Scenario: Save after local resolution

**Given** the receiver resolves one track to a current YouTube representation  
**When** the receiver saves the Ámpula  
**Then** the saved Ámpula MUST preserve the original received observations/evidence  
**And** the local resolved ID MUST NOT rewrite that original object.

## Requirement: File and link represent the same object

A `.ampula` file and a compact link/QR MUST decode to equivalent Core v1 semantics.

### Scenario: Export file after generating link

**Given** a playlist is converted to Ámpula Core v1  
**When** it is shared as a link and exported as `.ampula`  
**Then** both transports MUST preserve track order, title/artist metadata, optional context, stable evidence, and historical observations.

## Requirement: Sharing stays outside FAST startup

The sharing/receiving module MUST remain lazy and MUST NOT block normal player startup when no Ámpula is being shared or received.
