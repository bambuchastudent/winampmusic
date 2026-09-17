# Playback resolution specification delta

## Requirement: recover from embed-denied YouTube observations

When a YouTube iframe rejects the current playback observation with error `101` or `150`, AMPULAMP SHALL treat that provider ID as a failed playback handle rather than as a failed recording identity.

### Scenario: alternate YouTube observation is available

Given the current track has canonical title and artist metadata
And its current YouTube video ID fails with error `101` or `150`
When the playback adapter searches for another YouTube observation
Then it excludes every YouTube ID already attempted for that recording
And selects a new valid video ID when one is available
And retries through the existing playback/navigation path
And does not replace title, artist, origin, or received Ámpula evidence with search-result metadata.

### Scenario: alternate YouTube observation also rejects embedding

Given an alternate YouTube video ID was selected
When that ID also fails with error `101` or `150`
Then the failed alternate ID is added to the attempted set
And AMPULAMP may try another unseen candidate up to a bounded retry limit
And it never cycles back to an ID already attempted in that recording's retry session.

### Scenario: no alternate observation is available

Given the current YouTube observation failed with error `101` or `150`
When every resolver instance fails or no unseen candidate exists
Then AMPULAMP stops automatic retrying
And shows a clear YouTube-unavailable status
And preserves the canonical track identity and order.
