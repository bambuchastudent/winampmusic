# Apple import specification delta

This capability is a provider adapter. It converts an Apple Music page into recordings for the working library defined by `unresolved-tracks-v1`. It does not own musical identity and does not decide whether a recording is worth keeping.

## Requirement: Reading and resolving are separate outcomes

The adapter MUST distinguish a failure to read an Apple page from a failure to find a playable source for a recording it read. A resolution failure MUST NOT be reported as an import failure.

### Scenario: The reader cannot be reached

**Given** the Apple playlist reader responds with an HTTP error
**When** the playlist is imported
**Then** the import MUST report an error
**And** nothing MUST be added to the library.

### Scenario: The page yields no tracks

**Given** the reader returns a page from which no track can be extracted
**When** the playlist is imported
**Then** the import MUST report the playlist as having no readable tracks
**And** it MUST NOT report a failure to import
**And** it MUST NOT raise an exception.

## Requirement: Every recording that was read is imported

Every track the adapter successfully read MUST be handed to the library, in the order it appeared in the Apple source, whether or not a playable source was found for it.

### Scenario: One track of five cannot be matched

**Given** an Apple playlist of 5 readable tracks
**And** the matcher fails for the third track
**When** the playlist is imported
**Then** 5 tracks MUST be imported
**And** they MUST keep the original Apple order
**And** the third track MUST keep its Apple title, artist and album.

### Scenario: No track can be matched

**Given** an Apple playlist of 5 readable tracks
**And** the matcher finds nothing for any of them
**When** the playlist is imported
**Then** 5 tracks MUST be imported as unresolved
**And** the import MUST NOT report an error.

### Scenario: The matcher is unavailable

**Given** no YouTube matcher is present in the runtime
**When** an Apple playlist is imported
**Then** every readable track MUST still be imported as unresolved.

### Scenario: An album track cannot be matched

**Given** an Apple album whose tracks cannot all be matched
**When** the album is imported
**Then** every album track MUST be imported
**And** the unmatched ones MUST be unresolved.

### Scenario: The catalog-first strategy falls through to the matcher

**Given** an Apple playlist page that exposes no Apple catalog identifier for its tracks
**And** the catalog-first strategy is active
**And** the matcher fails for one track
**When** the playlist is imported
**Then** every readable track MUST be imported in the original order
**And** the unmatched one MUST be unresolved with its Apple metadata intact.

## Requirement: An unresolved import keeps its Apple evidence

An unresolved track MUST retain the metadata the adapter read and the Apple URL it came from, and MUST NOT be given a provider-shaped identifier by the adapter.

### Scenario: Share a partially matched playlist

**Given** a playlist was imported with one unresolved track
**When** the library is converted to an Ámpula
**Then** the unresolved track MUST carry its real title and artist
**And** its Apple URL MUST appear as a historical observation
**And** no fabricated YouTube observation MUST be present for it.

### Scenario: The adapter does not assign identifiers

**Given** the adapter produces an unresolved track
**When** that track is handed to the library
**Then** the adapter MUST NOT set a provider identifier on it
**And** the library MUST assign the local recording identifier.

## Requirement: Playback starts on a playable track

An import MUST start playback from the first track that can actually be played, and MUST NOT start playback when no track can be played.

### Scenario: The first track is unresolved

**Given** an imported playlist whose first track is unresolved and whose second track is playable
**When** the import completes
**Then** playback MUST start on the second track.

### Scenario: Nothing is playable

**Given** an imported playlist in which no track could be matched
**When** the import completes
**Then** playback MUST NOT start.

## Requirement: The import reports what happened

The completion status MUST report how many tracks were read, how many were matched, and how many are unresolved.

### Scenario: Partially matched import status

**Given** 5 readable tracks of which 4 matched
**When** the import completes
**Then** the status MUST state 5 tracks, 4 matched and 1 unresolved.

### Scenario: Fully matched import status

**Given** every readable track matched
**When** the import completes
**Then** the status MUST NOT mention unresolved tracks.

## Requirement: Re-importing does not duplicate a recording

Importing the same Apple source twice MUST NOT create a second copy of a recording, including an unresolved one.

### Scenario: Import the same playlist twice

**Given** a playlist containing unresolved tracks was imported
**When** the identical playlist is imported again
**Then** the library MUST contain the same number of tracks as after the first import.
