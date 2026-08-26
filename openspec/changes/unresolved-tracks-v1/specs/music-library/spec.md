# Music library specification delta

This capability owns `winampmusic.library.v1`, the working playback/import state described in `AGENTS.md`. It consumes the recording domain of Ámpula Core v1 (`ampula/README.md`) but is not itself an Ámpula.

## Requirement: A recording is identified by title and artist

The working library MUST treat human-readable `title` and `artist` as the identity of a recording. A provider identifier MUST be an optional playback handle and MUST NOT be a precondition for a track existing in the library.

### Scenario: Import a recording with no provider identifier

**Given** an empty library
**When** `importTracks([{ title: 'Teardrop', artist: 'Massive Attack' }])` is called
**Then** exactly one track MUST be added
**And** the stored track MUST keep `title` `Teardrop` and `artist` `Massive Attack`
**And** the stored track MUST carry a non-empty local identifier
**And** that identifier MUST NOT be a valid YouTube video id.

### Scenario: Import an item with neither a handle nor a name

**Given** an empty library
**When** `importTracks([{ id: '', title: '', artist: '' }])` is called
**Then** nothing MUST be added.

### Scenario: Import the same recording with a different playback handle

**Given** the library contains a playable track titled `Teardrop` by `Massive Attack`
**When** the same title and artist are imported again carrying a different playable id
**Then** nothing MUST be added
**And** the library MUST still contain exactly one track for that recording
**And** the handle already in use MUST be kept.

### Scenario: Identity ignores capitalization and spacing

**Given** the library contains a playable track titled `Teardrop` by `Massive Attack`
**When** `  teardrop ` by `MASSIVE ATTACK` is imported with a different playable id
**Then** nothing MUST be added.

### Scenario: Two different recordings are not merged

**Given** the library contains a playable track titled `Teardrop` by `Massive Attack`
**When** a track titled `Teardrop` by `Newton Faulkner` is imported
**Then** it MUST be added as a separate recording.

## Requirement: Stored identity is never manufactured from a provider handle

No library write path MAY substitute a provider identifier, provider name, or any string derived from them for a missing `title` or `artist`. Missing metadata MUST be stored as missing.

### Scenario: Import a YouTube id without metadata

**Given** an empty library
**When** `importTracks([{ id: 'dQw4w9WgXcQ' }])` is called
**Then** the track MUST be added
**And** the stored `title` MUST NOT contain `dQw4w9WgXcQ`
**And** the stored `artist` MUST NOT be `YouTube`.

### Scenario: Read a library saved by an older build

**Given** stored data contains a track with an id and no title
**When** the library is read
**Then** the returned track MUST NOT gain an invented `title` or `artist`.

### Scenario: Share a library that has no metadata for a track

**Given** a track was stored with a playable handle and no title
**When** the library is converted to an Ámpula
**Then** the resulting Core v1 track MUST NOT present the provider handle as `title` or as an entry of `artists`.

## Requirement: Missing metadata is resolved at display time

The library list and the now-playing header MUST remain readable when a track has no stored metadata, without persisting the displayed fallback.

### Scenario: Render a track with no metadata

**Given** the library contains a track whose stored `title` and `artist` are empty
**When** the library renders
**Then** the row MUST show a human-readable placeholder
**And** re-reading the stored library MUST still show empty `title` and `artist`.

## Requirement: Unresolved tracks stay visible and ordered

A track without a playable handle MUST be listed, counted, searchable and orderable exactly like a playable one, and MUST be visually distinguishable as unresolved.

### Scenario: Mixed library

**Given** the library contains a playable track followed by an unresolved track
**When** the library renders
**Then** the track count MUST be 2
**And** both rows MUST be present in that order
**And** only the unresolved row MUST be marked unresolved.

### Scenario: Search matches an unresolved track

**Given** the library contains an unresolved track titled `Teardrop`
**When** the user searches for `teardrop`
**Then** that row MUST be shown.

## Requirement: A local identifier is never offered to a provider

A locally generated recording identifier MUST NOT be accepted by provider id normalization and MUST NOT be passed to a provider playback call.

### Scenario: Play an unresolved track whose source cannot be found

**Given** the library contains an unresolved track
**And** no matching source can be found
**When** the user plays that track
**Then** no provider playback call MUST be made with the local identifier
**And** the track MUST remain in the library with its metadata intact
**And** the status MUST report that no source was found.

## Requirement: Resolution is local state, not a new recording

When a playable handle is found for an existing unresolved recording, it MUST be adopted by that track rather than creating a second track.

### Scenario: Play an unresolved track that can be matched

**Given** the library contains an unresolved track with title and artist
**And** a source search would return a playable id
**When** the user plays that track
**Then** the track MUST become playable
**And** the library MUST still contain exactly one track for that recording
**And** the found id MUST be persisted.

### Scenario: Re-import the same recording with a handle

**Given** the library contains an unresolved track for a recording
**When** the same recording is imported again carrying a playable id
**Then** the library MUST still contain exactly one track for that recording
**And** that track MUST be playable.

### Scenario: Import the same recording twice with no handle

**Given** the library contains an unresolved track for a recording
**When** the identical recording is imported again with no id
**Then** nothing MUST be added.

### Scenario: Re-import a source whose matcher returns a different id

**Given** a provider import produced a playable track for a recording
**When** the same source is imported again and the matcher returns a different playable id for that recording
**Then** the library MUST still contain exactly one track for that recording.

## Requirement: A malformed provider identifier is discarded, not the recording

An incoming item whose provider identifier is malformed MUST keep its recording and MUST NOT store the malformed identifier.

### Scenario: Import a recording with a malformed id

**Given** an empty library
**When** `importTracks([{ id: 'not-11', title: 'Bad', artist: 'Bad' }])` is called
**Then** the recording MUST be added as unresolved
**And** the stored id MUST NOT be `not-11`
**And** the stored id MUST NOT be a valid YouTube video id.

## Requirement: The unresolved domain does not slow the core

Supporting unresolved tracks MUST stay inside the synchronous core and MUST NOT move library ownership into an optional module or exceed the core startup budgets.

### Scenario: Startup with a large stored library

**Given** 183 stored tracks
**When** the core boots
**Then** the synchronous startup budget and the core source budget MUST still hold.

### Scenario: The domain grows the core source budget

**Given** the provider-independent domain adds roughly one kilobyte to the synchronous core
**When** the core source budget is evaluated
**Then** the budget MUST be raised to 19000 bytes rather than moving library ownership out of the core
**And** the measured synchronous startup gates MUST remain unchanged
**And** the budget MUST be reduced again once resolution moves out of the core.
