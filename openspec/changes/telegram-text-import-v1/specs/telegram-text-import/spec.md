# Telegram text import specification delta

This capability is an import adapter. It converts human-readable text into recordings for the working
library defined by `unresolved-tracks-v1`. It does not own musical identity, does not resolve a
playable source, and does not add a provider to Ámpula.

## Requirement: A pasted line becomes a recording

A line of the form `<artist> <separator> <title>` MUST be imported as one recording carrying that
artist and title. The supported separators are the em dash `—`, the en dash `–` and the hyphen `-`.

### Scenario: A single line

**Given** an empty library
**When** the text `Massive Attack — Teardrop` is imported
**Then** exactly one recording MUST be added
**And** its title MUST be `Teardrop`
**And** its artist MUST be `Massive Attack`.

### Scenario: Each supported separator

**Given** an empty library
**When** the text below is imported

```text
Massive Attack — Teardrop
The xx - Intro
Portishead – Roads
```

**Then** three recordings MUST be added
**And** their artists MUST be `Massive Attack`, `The xx` and `Portishead`
**And** their titles MUST be `Teardrop`, `Intro` and `Roads`.

### Scenario: Non-Latin text

**Given** an empty library
**When** the text `Артист — Название песни` is imported
**Then** one recording MUST be added with artist `Артист` and title `Название песни`.

### Scenario: Arbitrary spacing around the separator

**Given** an empty library
**When** the text `   Massive Attack    —    Teardrop   ` is imported
**Then** one recording MUST be added with artist `Massive Attack` and title `Teardrop`.

### Scenario: The order of the pasted lines is preserved

**Given** an empty library
**When** a text of several recognised lines is imported
**Then** the library MUST contain those recordings in the order they appeared in the text.

## Requirement: An obvious chat prefix is removed

A leading timestamp and a leading short author name followed by a colon MUST be removed before the
line is split, and MUST NOT become part of the artist.

### Scenario: Timestamp and author

**Given** an empty library
**When** the text `13:42 Dmitry: Massive Attack — Teardrop` is imported
**Then** one recording MUST be added
**And** its artist MUST be `Massive Attack`
**And** its title MUST be `Teardrop`.

### Scenario: A title that contains a colon

**Given** an empty library
**When** the text `Nine Inch Nails — Something I Can Never Have: live` is imported
**Then** the artist MUST be `Nine Inch Nails`
**And** the title MUST be `Something I Can Never Have: live`.

## Requirement: The parser is conservative

Text that is not clearly a recording MUST be skipped. Skipping MUST NOT raise, and MUST NOT stop the
remaining lines from being imported.

### Scenario: Chat noise between recordings

**Given** an empty library
**When** a text that mixes recognised lines with greetings, empty lines and reactions is imported
**Then** only the recognised lines MUST be imported.

### Scenario: A line that is only a URL

**Given** an empty library
**When** the text `https://music.apple.com/tr/song/teardrop/1850810463` is imported
**Then** nothing MUST be added.

### Scenario: A separator with a URL on one side

**Given** an empty library
**When** the text `Massive Attack — https://youtu.be/dQw4w9WgXcQ` is imported
**Then** nothing MUST be added.

### Scenario: An empty side

**Given** an empty library
**When** the text `— Teardrop` and the text `Massive Attack —` are imported
**Then** nothing MUST be added.

### Scenario: A hyphen inside a word is not a separator

**Given** an empty library
**When** the text `Jay-Z` is imported
**Then** nothing MUST be added.

### Scenario: A sentence with no separator

**Given** an empty library
**When** the text `let's listen to this tonight` is imported
**Then** nothing MUST be added.

### Scenario: Nothing recognised at all

**Given** a text in which no line is a recording
**When** it is imported
**Then** no exception MUST be raised
**And** the status MUST state that no `Artist — Title` line was found
**And** the status MUST NOT report a failure to import.

## Requirement: The import produces unresolved recordings

An imported recording MUST reach the library through `window.importTracks` with no provider
identifier, and MUST be visible immediately as unresolved.

### Scenario: The recording is in the library and unresolved

**Given** an empty library
**When** the text `Massive Attack — Teardrop` is imported
**Then** the stored track MUST carry a non-empty local identifier
**And** that identifier MUST NOT be a valid YouTube video id
**And** the library MUST list it as unresolved
**And** the library count MUST be 1.

### Scenario: The import does not resolve

**Given** an empty library
**When** several lines are imported
**Then** no network request MUST be made by the import
**And** no provider search MUST be started
**And** the adapter MUST NOT assign a provider identifier to any recording.

### Scenario: The import does not start playback

**Given** an empty library
**When** several lines are imported
**Then** playback MUST NOT start automatically
**And** the import MUST complete by saving the recordings.

### Scenario: The recording carries its source

**Given** the text `Massive Attack — Teardrop` is imported
**Then** the stored track MUST be marked as coming from Telegram text
**And** that provenance MUST NOT be stored as `title` or `artist`.

## Requirement: Identity is the library's, not the adapter's

The adapter MUST NOT implement its own deduplication. Two lines that denote the same recording MUST
collapse under the existing normalized `title + artist` identity.

### Scenario: The same text imported twice

**Given** the text `Massive Attack — Teardrop` was imported
**When** the identical text is imported again
**Then** nothing MUST be added
**And** the library MUST still contain exactly one track for that recording.

### Scenario: Capitalization and spacing

**Given** the text `Massive Attack — Teardrop` was imported
**When** the text `massive attack —   teardrop` is imported
**Then** nothing MUST be added
**And** the library MUST still contain exactly one track for that recording.

### Scenario: The recording is already resolved

**Given** the library contains a playable track titled `Teardrop` by `Massive Attack`
**When** the text `Massive Attack — Teardrop` is imported
**Then** nothing MUST be added
**And** the library MUST still contain exactly one track for that recording
**And** that track MUST still be playable with the handle it already had.

### Scenario: A playable handle arrives after the text import

**Given** the text `Massive Attack — Teardrop` was imported as unresolved
**When** another adapter imports the same recording with a playable identifier
**Then** the library MUST still contain exactly one track for that recording
**And** that track MUST become playable.

### Scenario: Same title, different artist

**Given** the text `Massive Attack — Teardrop` was imported
**When** the text `Newton Faulkner — Teardrop` is imported
**Then** it MUST be added as a separate recording.

### Scenario: The same line twice in one paste

**Given** an empty library
**When** a text containing the same `Artist — Title` line twice is imported
**Then** exactly one recording MUST be added.

## Requirement: The import reports what happened

The completion status MUST report how many lines were read, how many recordings were recognised, how
many are new, and how many were already saved.

### Scenario: A partially new import

**Given** a text of 12 non-empty lines containing 8 distinct recordings
**And** 2 of those recordings are already in the library
**When** the text is imported
**Then** the status MUST state 12 lines, 8 tracks, 6 new and 2 already saved.

### Scenario: A fully new import

**Given** a text whose recordings are all new
**When** it is imported
**Then** the status MUST NOT mention already saved tracks.

## Requirement: One paste is bounded

A single import MUST NOT hand an unbounded number of recordings to the library in one synchronous
call, and MUST say when it stopped.

### Scenario: More recordings than the limit

**Given** a text containing 400 distinct recordings
**When** it is imported
**Then** at most 300 recordings MUST be imported
**And** they MUST be the first 300 in the pasted order
**And** the status MUST report how many were left out
**And** the import MUST complete without freezing.

## Requirement: Pasted text is not an Ámpula provider

Telegram MUST NOT be recorded as a provider observation, and the local recording identifier MUST NOT
be published, because pasted text is not a stable playable item reference.

### Scenario: Share a text-imported recording

**Given** the library contains a recording imported from pasted text
**When** the library is converted to an Ámpula
**Then** the Core v1 track MUST keep its real `title` and `artists`
**And** it MUST NOT carry an observation for the local recording identifier
**And** it MUST NOT carry a Telegram observation.

## Requirement: Text import belongs to the unified entry

Pasting a list MUST happen inside the existing import section, and MUST NOT change how a single line
or a link is handled.

### Scenario: A multi-line paste on the unified input

**Given** the unified import input
**When** several lines of text are pasted into it
**Then** the pasted text MUST be routed to the text import panel
**And** the single-line input MUST NOT be filled with the joined lines.

### Scenario: A single line of text is still a search

**Given** the unified import input
**When** one line of free text is submitted
**Then** it MUST still reach the existing music search
**And** it MUST NOT be imported as a recording by this capability.

### Scenario: The parser stays out of the core

**Given** the synchronous core `fast-player-v141.js`
**When** this capability is implemented
**Then** the core MUST NOT contain the text parser
**And** the adapter MUST be loaded on demand
**And** the existing startup and core source budgets MUST NOT be raised.
