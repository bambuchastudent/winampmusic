# Received share UX specification delta

This capability describes what a receiver sees and can do when a shared musical moment is opened. It
does not change Ámpula Core v1, the compact transport, or resolver semantics.

## Requirement: Receiving is listen-first

Opening a received Ámpula MUST present the ordered shared tracks as the primary surface, without any
intermediate confirmation, import, or setup step.

Above the track list the receiver MUST see only the shared-music identification (label, moment title,
track/capture metadata) and a close control.

### Scenario: A shared link is opened on a phone

**Given** a valid canonical link containing an 18-track Ámpula
**When** the receiver opens it
**Then** the shared track list MUST be rendered immediately
**And** the region above the list MUST contain only the shared-music label, title, metadata and close
**And** no object-management action MUST be presented before the list.

## Requirement: A shared track plays on tap

Selecting a received track MUST start the existing canonical resolve-and-play flow for that track.

Playback MUST NOT require adding the track to the local library, saving the Ámpula, or exporting it.

### Scenario: The receiver taps the first track

**Given** a received Ámpula is displayed
**When** the receiver taps a track
**Then** the system MUST resolve a locally playable source for that track
**And** MUST start playback in the received context
**And** MUST NOT import any track into `Your library`
**And** the persisted local library MUST be unchanged.

## Requirement: Secondary actions live behind one compact control

The primary received surface MUST NOT present `Save`, `Add to library` and `.ampula` export
simultaneously.

Those actions MUST be reachable through exactly one compact secondary control, and MUST remain
collapsed until the receiver opens it.

### Scenario: Secondary menu is opened

**Given** a received Ámpula is displayed
**Then** the secondary actions MUST be collapsed
**And** the primary surface MUST expose at most one secondary control
**When** the receiver activates that control
**Then** `Save`, `Add to library` and `.ampula` export MUST all become available.

## Requirement: Object-semantics copy is not primary UI

Explanatory copy about library mutation MUST NOT appear on the first received screen.

It MAY be presented inside the secondary surface.

### Scenario: First screen after opening a link

**Given** a received Ámpula is displayed and its secondary menu is collapsed
**Then** the visible text MUST NOT contain the library-mutation explanation
**When** the secondary menu is opened
**Then** the explanation MAY be shown there.

## Requirement: Resolution failures are reported per track

A track whose playable source cannot be resolved MUST report the failure on that track.

The failure MUST NOT turn the received dialog into an error state.

### Scenario: One track cannot be resolved

**Given** a received Ámpula with several tracks is displayed
**And** one track has no reachable playable source
**When** the receiver taps that track
**Then** that track MUST show a readable failure message
**And** that track MUST keep its title and artist metadata
**And** the remaining tracks MUST stay listed and selectable
**And** any already playing track MUST keep playing
**And** the persisted local library MUST be unchanged.

## Requirement: Saving preserves the received object

`Save` MUST persist the received Core v1 object exactly as it was received.

Local playback resolution performed before saving MUST NOT be written into the saved object.

### Scenario: Save after playing a resolved track

**Given** the receiver played a track, which resolved a local playable source
**When** the receiver saves from the secondary menu
**Then** the saved object MUST be equal to the received object
**And** no locally resolved provider identifier MUST be added to it
**And** `Your library` MUST be unchanged.

## Requirement: Library import stays explicit

Tracks MUST enter `Your library` only through an explicit `Add to library` action.

Opening, browsing, playing, saving or exporting a received Ámpula MUST NOT import anything.

### Scenario: Playing then adding

**Given** the receiver played tracks from a received Ámpula
**Then** no import MUST have been performed
**When** the receiver chooses `Add to library` from the secondary menu
**Then** the playable received tracks MUST be imported once
**And** the received Ámpula MUST remain a separate object.

## Requirement: `.ampula` export remains available

Moving `.ampula` export out of the primary surface MUST NOT remove the capability. It MUST stay
reachable from the secondary surface of a received Ámpula.

### Scenario: Exporting a received moment

**Given** a received Ámpula is displayed
**When** the receiver opens the secondary menu
**Then** a `.ampula` export action MUST be present
**And** it MUST export the received Core v1 object.

## Requirement: Every canonical receive transport uses this surface

A self-contained `?a=` link, a short alias, a `.ampula` file and a saved Ámpula MUST all render the
same listen-first received surface through the same receiver.

### Scenario: A short alias is opened

**Given** an alias that dereferences to a valid Core v1 payload
**When** the receiver opens it
**Then** the canonical receiver MUST render the listen-first surface
**And** the track list MUST be immediately available
**And** the secondary actions MUST be collapsed exactly as for a self-contained link.
