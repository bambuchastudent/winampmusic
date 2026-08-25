# Playback continuity requirements

## Requirement: preserve listening position locally

ÁmpulaMP MUST persist a versioned local playback checkpoint containing the active context, stable track identity, elapsed position, and sufficient metadata to restore the intended track.

### Scenario: reload during a track

Given a listener is playing a track at approximately 03:17
When the page is reloaded
Then the same track is restored as current
And the displayed/restored position is approximately 03:17
And pressing Play continues from that restored position rather than 00:00.

## Requirement: identify the track independently of list index

The checkpoint MUST NOT rely solely on a numeric playlist/library index.

### Scenario: list order changes

Given track B was current when its checkpoint was saved
And other tracks are inserted, removed, or reordered before the next load
When ÁmpulaMP restores the checkpoint
Then track B is selected by stable identity
And the previously saved elapsed position is applied to track B.

## Requirement: keep local contexts isolated

The checkpoint MUST include the playback context and MUST NOT mutate unrelated contexts during restore.

### Scenario: received Ámpula over an existing library

Given the local library contains 40 tracks
And a Received Ámpula is open and paused at 02:12 of its seventh track
When the page reloads
Then the Received Ámpula context and seventh track at approximately 02:12 are restored
And the 40-track local library remains unchanged.

### Scenario: saved Ámpula

Given a Saved Ámpula is current
When the app is closed and later reopened
Then ÁmpulaMP can restore the Saved Ámpula session locally without the original share link.

## Requirement: work across playback adapters

YouTube-backed and direct-audio playback MUST implement the same checkpoint semantics.

### Scenario: YouTube-backed track

Given a YouTube-backed track has a checkpoint at 01:45
When its player becomes ready after reload
Then the player is prepared at approximately 01:45 rather than at the beginning.

### Scenario: direct-audio track

Given a direct-audio track has a checkpoint at 04:02
When its source metadata is ready after reload
Then `currentTime` is restored to approximately 04:02 rather than forced to zero.

## Requirement: bound persistence writes

The player MUST checkpoint frequently enough to make reload recovery useful while avoiding writes on every UI progress tick.

### Scenario: continuous playback

Given a track is playing continuously
Then the checkpoint is updated at a bounded periodic cadence
And it is also updated on pause, seek, track change, and page hide.

## Requirement: respect browser autoplay behavior

Restoring state MUST NOT depend on bypassing browser autoplay restrictions.

### Scenario: autoplay is blocked

Given the checkpoint indicates the track was playing before reload
And the browser does not permit autoplay
When the session is restored
Then the correct track and position are still restored
And the player is ready/paused at that position
And the next explicit Play action continues from there.

## Requirement: tolerate source replacement

The intended track and position MUST survive provider/source replacement where normal resolution can identify the same track.

### Scenario: original source is dead

Given the checkpoint references a track whose previous playback source no longer works
And the resolver finds another playable source for the intended track
When playback is prepared
Then the replacement source is used
And the saved elapsed position is applied to that resolved source.
