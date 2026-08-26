# Received Share UI integrity specification delta

## Requirement: Received copy normalization is non-destructive

UI copy cleanup MUST NOT replace or remove the Received/Shared Music dialog container, track list, player host, close control, Save action, or Add-to-library action.

### Scenario: Canonical shared link opens on mobile

**Given** a valid canonical `?a=` link creates a received dialog with tracks and actions  
**And** the dialog contains the historical explanatory sentence  
**When** transport-neutral UI copy normalization runs  
**Then** the received track list MUST remain attached  
**And** the Save action MUST remain attached  
**And** the Add-to-library action MUST remain attached  
**And** the explanatory copy MAY be rewritten to `Opening this link does not change your library.`

## Requirement: Destructive container matching is forbidden

A copy rewrite that uses `textContent` MUST target a leaf element or another explicitly stable non-container target. The implementation MUST NOT select a parent merely because aggregate descendant text contains the target sentence.

### Scenario: Parent text contains the notice through descendants

**Given** a parent container contains the received header, list, actions and explanatory notice  
**And** the parent's aggregate `textContent` therefore contains the notice text  
**When** cleanup searches for the explanatory message  
**Then** the parent container MUST NOT be rewritten  
**And** only a matching leaf notice MAY receive the replacement text.

## Requirement: Fixed cleanup is cache-busted

Canonical Share and `?a=` receive MUST load the v1.6.2 cleanup asset rather than the destructive v1.6.1 asset.

## Requirement: Legacy recovery remains separate from canonical receive

Historical `?p=`/`?s=` recovery MAY remain available through the receive-only compatibility adapter, but those payloads MUST NOT enter the canonical Ámpula decoder or be persisted as Ámpula Core v1.

## Requirement: Short links are optional transport aliases

A future short-link implementation MAY dereference a short token to a valid Core v1 payload. The token MUST NOT become musical identity, and a full-fidelity self-contained/export path MUST remain available independently of the alias service.
