# Received Share UI integrity specification delta

This delta extends `received-share-dialog-integrity-v1.6.2`. The non-destructive copy-normalization
requirements from that change remain in force.

## Requirement: Copy normalization keeps the listen-first structure intact

Transport-neutral copy normalization MUST NOT remove or replace the received dialog container, the
track list, the player host, the close control, the secondary control, the secondary menu, or any
action inside that menu.

### Scenario: Copy normalization runs against the listen-first dialog

**Given** a received dialog rendered with a track list and a collapsed secondary menu
**When** UI copy normalization runs
**Then** the track list MUST remain attached
**And** `Save`, `Add to library` and the `.ampula` export action MUST remain attached
**And** the secondary menu MUST remain collapsed.

## Requirement: The received `.ampula` export is not treated as primary clutter

Historically, copy normalization removed the received `.ampula` action because it was a third primary
action. Once that capability is a secondary menu item, normalization MUST NOT remove it.

The primary-surface hiding rule therefore applies to the historical primary element ID only, and the
secondary export action MUST use a distinct stable ID.

### Scenario: Export survives normalization

**Given** the received dialog exposes `.ampula` export only inside the secondary menu
**When** UI copy normalization runs
**Then** the export action MUST still be reachable from the secondary menu.

## Requirement: The renderer emits final copy

The received dialog MUST be rendered with its final user-visible labels rather than relying on a
later normalization pass to correct them.

### Scenario: Normalization module fails to load

**Given** the copy normalization module is unavailable
**When** a shared link is received
**Then** the dialog MUST already read `Shared music`, `Save` and `Add to library`
**And** the received flow MUST remain fully usable.
