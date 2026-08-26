# Share recovery and compact UI specification delta

## Requirement: Historical self-contained playlist links remain openable

AMPULAMP MUST recognize historical `?p=<youtube-id>.<youtube-id>...` links as a legacy playlist compatibility transport.

It MUST NOT represent or save that provider-ID-only payload as Ámpula Core v1.

### Scenario: Reopen an old share after local storage was cleared

**Given** the working library is empty  
**And** the URL contains a valid historical `?p=` payload with multiple YouTube IDs  
**When** the player opens the URL  
**Then** those IDs MUST be restored into the working library in URL order  
**And** the first shared track SHOULD become the selected/start track  
**And** the UI MUST identify the operation as legacy share recovery rather than a received Ámpula.

### Scenario: Malformed old fallback link

**Given** the URL contains `?p=` but no valid YouTube IDs  
**When** the player opens the URL  
**Then** the working library MUST remain unchanged  
**And** normal player startup and controls MUST remain available.

## Requirement: Legacy compatibility is receive-only

The application MUST NOT generate new `?p=` or `?s=` links and MUST NOT use them as a fallback for normal sharing.

Best-effort reading of a historical `?s=` remote bundle MAY be supported by a lazy compatibility adapter, but normal `?a=` sharing MUST NOT depend on that remote service.

## Requirement: Canonical Ámpula receive remains non-destructive

Opening canonical `?a=` MUST continue to use the distinct Received/Shared Music context and MUST NOT mutate the working library merely because the link was opened.

Legacy `p`/`s` parameters MUST NOT be reported as invalid Ámpula payloads by the canonical receiver.

## Requirement: Primary share action is transport-neutral

The primary library action MUST be labelled `Share`.

QR MUST be presented inside the Share experience rather than being named in the primary action.

The primary library toolbar MUST NOT contain a separate `Open .ampula` action.

### Scenario: User views library actions on mobile

**Given** the player shell is loaded  
**When** the library action header renders  
**Then** it MUST expose `Share` and `Clear`  
**And** it MUST NOT expose `Share / QR`  
**And** it MUST NOT expose `Open .ampula`.

## Requirement: Library heading avoids redundant labels

The library header MUST NOT stack both `PLAYLIST` and `Your library` labels. A compact track count is sufficient alongside the controls.

## Requirement: Clearing content is durable for the current page

When the user confirms Clear, the application MUST remove the working-library state and remove `a`, `p`, `s`, and `playlist` URL transports plus the URL hash before reload.

### Scenario: Clear while viewing an old shared URL

**Given** an old `?p=` link has restored tracks  
**When** the user confirms Clear  
**Then** the working library MUST be cleared  
**And** the current URL MUST no longer contain `p`  
**And** reload MUST NOT immediately restore the same shared playlist.
