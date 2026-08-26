# Ámpula sharing specification delta — short transport aliases

Extends `openspec/changes/ampula-native-sharing-v1.6/specs/ampula-sharing/spec.md`
("Optional short-link aliases remain transport-only") and
`openspec/changes/received-share-dialog-integrity-v1.6.2/specs/share-ui-integrity/spec.md`
("Short links are optional transport aliases").

Ámpula Core v1 in `ampula/` is unchanged by this delta.

## Requirement: The self-contained link remains the canonical share transport

Sharing MUST produce a self-contained `?a=<payload>` link before any alias backend is contacted, and
that link MUST remain valid and available to the sender regardless of alias outcome.

An Ámpula MUST NOT be shareable only through an alias.

### Scenario: Share is prepared before any alias attempt

**Given** the sender has tracks to share
**When** the sender taps Share
**Then** the Share dialog MUST already present a decodable self-contained `?a=` link
**And** the presented link MUST be usable even if no alias backend is ever contacted
**And** the `.ampula` export of the same moment MUST remain available.

## Requirement: A short link is an optional transport alias

When a write backend is configured and reachable, sharing SHOULD present a short alias of the form
`<alias-origin>/a/<token>`.

The token MUST be transport-only. It MUST NOT be stored in the local library, stored in a saved
Ámpula, embedded in the Core object, used as track identity, or used as a playback source.

### Scenario: Short link is produced

**Given** a reachable write backend is configured
**And** the canonical payload is within the declared size limit
**When** the sender shares a musical moment
**Then** the Share dialog MUST present the short alias
**And** the alias MUST dereference to the same canonical payload
**And** no persisted Ámpula record MUST contain the token.

## Requirement: Alias failure falls back to the self-contained link

If a backend is not configured, unreachable, slow, rate limited, erroring, or rejects the payload,
the share MUST silently fall back to the canonical `?a=` link and MUST still report success.

The alias attempt MUST be bounded by an explicit timeout.

### Scenario: Backend is unavailable

**Given** the backend rejects, hangs, or cannot be reached
**When** the sender shares a musical moment
**Then** the Share dialog MUST still present the self-contained `?a=` link
**And** the share MUST NOT be reported as failed
**And** no error dialog MUST replace the Share UI.

### Scenario: No write backend is configured

**Given** the deployment configures no write backend
**When** the sender shares a musical moment
**Then** no alias network request MUST be made
**And** the resulting link MUST be the canonical `?a=` link.

## Requirement: Existing Ámpulas never depend on an alias backend

Links, QR codes and `.ampula` files created before, during or after this change MUST remain openable
without contacting any alias backend.

### Scenario: Old self-contained link is opened while no backend exists

**Given** a previously shared `?a=` link
**And** no alias backend is configured or reachable
**When** the receiver opens the link
**Then** the canonical Ámpula MUST be decoded locally
**And** the Shared music UI MUST render the same ordered tracks as before this change.

## Requirement: A received alias enters the canonical receive flow

Opening an alias MUST result in the same canonical Ámpula object, the same Shared music UI, and the
same non-destructive semantics as opening the equivalent `?a=` link.

Alias dereferencing MUST be performed by the client. Track and playback resolution MUST remain local
and MUST NOT be delegated to an alias backend.

### Scenario: Alias resolves to a canonical Ámpula

**Given** the receiver opens `?al=<token>` and the backend returns the payload
**When** the alias is dereferenced
**Then** the resulting object MUST deep-equal the object decoded from the equivalent `?a=` link
**And** the Shared music dialog MUST be rendered by the canonical receiver
**And** the browser URL MUST become the canonical `?a=` URL
**And** the receiver's persisted library MUST be unchanged.

### Scenario: Alias cannot be dereferenced

**Given** the receiver opens `?al=<token>` and the backend is unavailable or the token is gone
**When** dereferencing fails
**Then** the failure MUST be non-destructive
**And** the local library MUST be unchanged
**And** normal local playback MUST remain usable.

### Scenario: Receiving an alias does not mutate the library

**Given** `Your library` contains saved tracks
**When** the receiver opens a valid alias
**Then** the persisted library MUST contain exactly the same tracks afterwards
**And** no track MUST be added merely because the alias was opened.

## Requirement: Public third-party shorteners are not a source of truth

Runtime code MUST NOT delegate Ámpula alias creation or resolution to a public third-party URL
shortening service, and a configured backend origin matching such a service MUST be refused.

### Scenario: Alias provider is first-party

**Given** the runtime share and receive modules
**When** they are inspected
**Then** they MUST NOT reference a public shortening host as an alias provider.

### Scenario: Deployment misconfigures a public shortener

**Given** a deployment configures a known public shortener as the backend origin
**When** the alias client validates the configuration
**Then** it MUST treat the backend as unavailable
**And** sharing MUST produce the canonical `?a=` link.

## Requirement: Alias support stays off the critical path

Alias support MUST be loaded lazily, MUST NOT be added to the startup script list, and MUST NOT
block startup, playback controls, library rendering, or the opening of the Share dialog.

### Scenario: Startup without an alias in the URL

**Given** the application starts normally without `?al=`
**When** the startup scripts run
**Then** the alias module MUST NOT be loaded
**And** playback and library interaction MUST be available with no alias request.

## Requirement: Alias tokens are not persisted into rebuilt app URLs

When the application rebuilds its own base URL — including share-link generation, `.ampula` opening
and the Clear action — it MUST strip the alias parameter along with `a`, `p`, `s` and `playlist`, so
a re-share or a clear never carries a stale token.

### Scenario: Sharing while viewing a received alias URL

**Given** the current URL still contains an alias parameter
**When** the user shares the current moment
**Then** the generated canonical link MUST NOT contain the alias parameter.
